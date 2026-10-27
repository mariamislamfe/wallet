import { createHash } from "node:crypto";
import { NextResponse } from "next/server";

import {
  TRANSACTION_COLUMNS,
  fetchBalances,
  fetchBudgets,
  fetchPlanHistory,
  fetchTransactions,
  normalizeTransaction,
} from "@/lib/data";
import { planFor, round2 } from "@/lib/finance";
import { formatMoney, formatSignedMoney } from "@/lib/format";
import { parseBankSms } from "@/lib/sms";
import { getSupabase, type Db } from "@/lib/supabase";
import type { Transaction } from "@/types/finance";

// Receives bank SMS forwarded by an iPhone Shortcuts automation and records
// them on the Visa wallet. Each account has its own bearer token (Shortcuts
// can't sign in), so middleware lets it through and the token picks the account.

export const dynamic = "force-dynamic";

const MAX_LENGTH = 1000;
/** 24 random bytes in base64url, as made by `createSmsToken`. */
const TOKEN_LENGTH = 32;

// Months for the notification follow the phone's clock, which is in Egypt.
const cairoMonth = new Intl.DateTimeFormat("en-CA", { timeZone: "Africa/Cairo", year: "numeric", month: "2-digit" });

function sha256(text: string): string {
  return createHash("sha256").update(text).digest("hex");
}

function reply(status: number, body: { status: string; message: string; [key: string]: unknown }) {
  return NextResponse.json(body, { status });
}

/**
 * Second notification line: income asks to be split; spending from a pocket
 * shows what's left in it, other spending shows what can still be used.
 */
async function monthLine(db: Db, tx: Transaction): Promise<string> {
  if (tx.type === "income") return "دخل جديد: افتحي التطبيق وقرري يدخل في التقسيمة ولا لأ";

  const now = new Date();
  const month = cairoMonth.format(now);
  const windowStart = new Date(now.getTime() - 32 * 86_400_000);
  const [recent, older, budgets, balances] = await Promise.all([
    fetchTransactions(db, windowStart),
    fetchPlanHistory(db, windowStart),
    fetchBudgets(db),
    fetchBalances(db),
  ]);
  const inMonth = recent.filter((row) => cairoMonth.format(new Date(row.created_at)) === month);
  const before = [...older, ...recent.filter((row) => cairoMonth.format(new Date(row.created_at)) !== month)];
  const plan = planFor(budgets, inMonth, before);

  const line = plan.lines.find((usage) => usage.budget.id === tx.budget_id);
  if (line) {
    const left = round2(line.allocated - line.spent);
    return left >= 0
      ? `${line.budget.name}: فاضل ${formatMoney(left)} من ${formatMoney(line.allocated)}`
      : `${line.budget.name}: زيادة ${formatMoney(-left)} عن الميزانية`;
  }

  const free = round2(balances.cash + balances.visa - plan.reserved);
  return free >= 0
    ? `تقدري تصرفي: ${formatMoney(free)}`
    : `⚠️ دخلتي على فلوس الجيوب بـ ${formatMoney(-free)}`;
}

async function readText(request: Request): Promise<string> {
  const raw = await request.text();
  if ((request.headers.get("content-type") ?? "").includes("application/json")) {
    const body = JSON.parse(raw) as { text?: unknown };
    return typeof body.text === "string" ? body.text : "";
  }
  return raw;
}

/** The account whose token this is, or null. */
async function tokenOwner(token: string): Promise<string | null> {
  if (!token) return null;
  const { data, error } = await getSupabase()
    .from("sms_tokens")
    .select("user_id")
    .eq("token_hash", sha256(token))
    .maybeSingle();
  if (error) throw error;
  return data?.user_id ?? null;
}

export async function POST(request: Request) {
  // Tokens pasted on a phone often pick up invisible direction marks, quotes or spaces.
  // The token is base64url, so anything outside that alphabet is noise.
  const given = (request.headers.get("authorization") ?? "")
    .replace(/[^A-Za-z0-9_-]/g, "")
    .replace(/^(?:Bearer)+/i, "");

  let userId: string | null;
  try {
    userId = await tokenOwner(given);
  } catch (error) {
    console.error("[wallet] sms token lookup failed:", error);
    return reply(500, { status: "error", message: "Couldn't reach the database." });
  }
  if (!userId) {
    const hint = given
      ? `got ${given.length} characters; tokens are ${TOKEN_LENGTH}. Make a new one in the app: Account → Bank SMS`
      : request.headers.has("authorization")
        ? "Authorization header has no token after Bearer"
        : "no Authorization header";
    return reply(401, { status: "error", message: `Wrong token (${hint}).` });
  }

  let text: string;
  try {
    text = (await readText(request)).trim().slice(0, MAX_LENGTH);
  } catch {
    return reply(400, { status: "error", message: "Send JSON like {\"text\": \"…\"}." });
  }

  const parsed = parseBankSms(text);
  if (!parsed.ok) return reply(200, { status: "skipped", message: `Skipped: ${parsed.reason}` });

  // The service-role client skips RLS, so every query below filters by the token's owner.
  const db: Db = { client: getSupabase(), userId };
  const supabase = db.client;
  const description = parsed.merchant ?? (parsed.type === "expense" ? "Card purchase" : "Card deposit");

  try {
    // Reuse the pocket and project last used for this merchant so repeat entries tag themselves.
    let budgetId: string | null = null;
    let projectId: string | null = null;
    if (parsed.merchant) {
      const { data, error } = await supabase
        .from("transactions")
        .select("project_id")
        .eq("user_id", userId)
        .eq("type", parsed.type)
        .eq("description", description)
        .not("project_id", "is", null)
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();
      if (error) throw error;
      projectId = data?.project_id ?? null;
    }
    if (parsed.type === "expense" && parsed.merchant) {
      const { data, error } = await supabase
        .from("transactions")
        .select("budget_id")
        .eq("user_id", userId)
        .eq("type", "expense")
        .eq("description", description)
        .not("budget_id", "is", null)
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();
      if (error) throw error;
      budgetId = data?.budget_id ?? null;
    }

    const { data, error } = await supabase
      .from("transactions")
      .upsert(
        {
          user_id: userId,
          amount: parsed.amount,
          type: parsed.type,
          wallet_type: "visa",
          description: description.slice(0, 120),
          budget_id: budgetId,
          project_id: projectId,
          source: "sms",
          source_hash: sha256(text),
        },
        { onConflict: "user_id,source_hash", ignoreDuplicates: true },
      )
      .select(TRANSACTION_COLUMNS)
      .maybeSingle();
    if (error) throw error;

    if (!data) return reply(200, { status: "duplicate", message: "Already recorded." });

    const tx = normalizeTransaction(data);
    const message = `${formatSignedMoney(tx)} · ${tx.description}`;
    // The summary line is a nicety; never fail a recorded SMS over it.
    const summary = await monthLine(db, tx).catch((error: unknown) => {
      console.error("[wallet] sms summary failed:", error);
      return null;
    });
    return reply(201, {
      status: "recorded",
      message,
      notify: summary ? `${message}\n${summary}` : message,
      transaction: tx,
    });
  } catch (error) {
    console.error("[wallet] sms import failed:", error);
    return reply(500, { status: "error", message: "Couldn't save to the database." });
  }
}
