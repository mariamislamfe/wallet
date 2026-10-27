import { NextResponse } from "next/server";

import { getSupabase } from "@/lib/supabase";

// Deployment diagnostics: reports whether each env var is set and shaped right,
// and whether Supabase answers — never the values themselves. Sits behind the
// passcode like the rest of the app.

export const dynamic = "force-dynamic";

function describeUrl(value: string | undefined): string {
  if (!value) return "missing";
  if (value !== value.trim()) return "has spaces around it";
  if (/^["']|["']$/.test(value)) return "wrapped in quotes — remove them";
  if (!/^https:\/\/[a-z0-9]+\.supabase\.co\/?$/.test(value)) return "doesn't look like https://<ref>.supabase.co";
  return "ok";
}

function describeKey(value: string | undefined): string {
  if (!value) return "missing";
  if (value !== value.trim()) return "has spaces around it";
  if (/^["']|["']$/.test(value)) return "wrapped in quotes — remove them";
  if (value.includes("=")) return "contains '=' — paste only the value, not NAME=value";
  if (value.startsWith("sb_publishable_")) return "this is the publishable key — use the service_role key";
  if (value.startsWith("sb_secret_")) return "ok";
  const parts = value.split(".");
  if (parts.length !== 3) return `not a complete key (${value.length} chars) — copy it again`;
  try {
    const payload = JSON.parse(Buffer.from(parts[1]!, "base64url").toString()) as { role?: string };
    if (payload.role !== "service_role") return `this is the '${payload.role}' key — use the service_role key`;
  } catch {
    return "not a valid key — copy it again";
  }
  return "ok";
}

export async function GET() {
  const env = {
    SUPABASE_URL: describeUrl(process.env.SUPABASE_URL),
    SUPABASE_SERVICE_ROLE_KEY: describeKey(process.env.SUPABASE_SERVICE_ROLE_KEY),
    APP_PASSCODE: process.env.APP_PASSCODE?.trim() ? "set" : "missing",
    SMS_INGEST_TOKEN: process.env.SMS_INGEST_TOKEN?.trim() ? "set" : "missing",
  };

  let database: string;
  try {
    const checks = await Promise.all([
      getSupabase().from("wallets").select("type").limit(1),
      getSupabase().from("budgets").select("id, due_day").limit(1),
      getSupabase().from("transactions").select("budget_id, source, in_plan").limit(1),
    ]);
    const failed = checks.find((check) => check.error);
    database = failed?.error ? `error: ${failed.error.message}` : "ok";
  } catch (error) {
    database = `error: ${error instanceof Error ? error.message : String(error)}`;
  }

  return NextResponse.json({ env, database }, { headers: { "cache-control": "no-store" } });
}
