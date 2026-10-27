import { createHash } from "node:crypto";
import { NextResponse } from "next/server";

import { safeEqual } from "@/lib/auth";
import { TRANSACTION_COLUMNS, normalizeTransaction } from "@/lib/data";
import { formatSignedMoney } from "@/lib/format";
import { parseBankSms } from "@/lib/sms";
import { getSupabase } from "@/lib/supabase";

// Receives bank SMS forwarded by an iPhone Shortcuts automation and records
// them on the Visa wallet. Authenticated by its own bearer token (the
// passcode cookie can't be sent from Shortcuts), so middleware lets it through.

export const dynamic = "force-dynamic";

const MAX_LENGTH = 1000;

function sha256(text: string): string {
  return createHash("sha256").update(text).digest("hex");
}

function reply(status: number, body: { status: string; message: string; [key: string]: unknown }) {
  return NextResponse.json(body, { status });
}

async function readText(request: Request): Promise<string> {
  const raw = await request.text();
  if ((request.headers.get("content-type") ?? "").includes("application/json")) {
    const body = JSON.parse(raw) as { text?: unknown };
    return typeof body.text === "string" ? body.text : "";
  }
  return raw;
}

export async function POST(request: Request) {
  const token = process.env.SMS_INGEST_TOKEN?.trim();
  if (!token) return reply(503, { status: "error", message: "SMS import is off: set SMS_INGEST_TOKEN." });

  const given = (request.headers.get("authorization") ?? "").replace(/^Bearer\s+/i, "").trim();
  if (!safeEqual(sha256(given), sha256(token))) {
    return reply(401, { status: "error", message: "Wrong token." });
  }

  let text: string;
  try {
    text = (await readText(request)).trim().slice(0, MAX_LENGTH);
  } catch {
    return reply(400, { status: "error", message: "Send JSON like {\"text\": \"…\"}." });
  }

  const parsed = parseBankSms(text);
  if (!parsed.ok) return reply(200, { status: "skipped", message: `Skipped: ${parsed.reason}` });

  const supabase = getSupabase();
  const description = parsed.merchant ?? (parsed.type === "expense" ? "Card purchase" : "Card deposit");

  try {
    // Reuse the budget line last used for this merchant so repeat purchases tag themselves.
    let budgetId: string | null = null;
    if (parsed.type === "expense" && parsed.merchant) {
      const { data, error } = await supabase
        .from("transactions")
        .select("budget_id")
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
          amount: parsed.amount,
          type: parsed.type,
          wallet_type: "visa",
          description: description.slice(0, 120),
          budget_id: budgetId,
          source: "sms",
          source_hash: sha256(text),
        },
        { onConflict: "source_hash", ignoreDuplicates: true },
      )
      .select(TRANSACTION_COLUMNS)
      .maybeSingle();
    if (error) throw error;

    if (!data) return reply(200, { status: "duplicate", message: "Already recorded." });

    const tx = normalizeTransaction(data);
    return reply(201, {
      status: "recorded",
      message: `${formatSignedMoney(tx)} · ${tx.description}`,
      transaction: tx,
    });
  } catch (error) {
    console.error("[wallet] sms import failed:", error);
    return reply(500, { status: "error", message: "Couldn't save to the database." });
  }
}
