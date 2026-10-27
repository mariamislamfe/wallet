import "server-only";

import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/types/finance";

/**
 * A client plus whose data it works on. Queries still filter by `userId`
 * themselves, so they're scoped the same way under RLS (a signed-in user's
 * client) and without it (the service-role client /api/sms uses).
 */
export type Db = { client: SupabaseClient<Database>; userId: string };

let client: SupabaseClient<Database> | null = null;

/**
 * Server-only Supabase client. It uses the service_role key and bypasses RLS,
 * so it's only for /api/sms (scoped to the token's owner) — never the browser;
 * the `server-only` import fails the build if it does.
 */
export function getSupabase(): SupabaseClient<Database> {
  if (client) return client;

  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!url || !key) {
    throw new Error("Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY. Add both to .env.local.");
  }

  client = createClient<Database>(url, key, {
    auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
  });

  return client;
}
