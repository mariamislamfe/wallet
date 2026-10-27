import "server-only";

import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { createServerClient } from "@supabase/ssr";

import { authKeys } from "@/lib/auth";
import type { Db } from "@/lib/supabase";
import type { Database } from "@/types/finance";

export type Session = Db & { email: string };

/**
 * Supabase client acting as the signed-in user: the session lives in cookies
 * and every query runs under RLS. Server Components can't write cookies, so a
 * refresh there is dropped — middleware already refreshed it for the request.
 */
export async function getAuthClient() {
  const store = await cookies();
  const { url, key } = authKeys();
  return createServerClient<Database>(url, key, {
    cookies: {
      getAll: () => store.getAll(),
      setAll: (list) => {
        try {
          for (const { name, value, options } of list) store.set(name, value, options);
        } catch {
          // Called from a Server Component.
        }
      },
    },
  });
}

/** The signed-in user, or null. The JWT is verified, not just decoded. */
export async function getSession(): Promise<Session | null> {
  const client = await getAuthClient();
  const { data, error } = await client.auth.getClaims();
  const claims = error ? null : data?.claims;
  if (!claims?.sub) return null;
  return { client, userId: claims.sub, email: typeof claims.email === "string" ? claims.email : "" };
}

export async function requireSession(): Promise<Session> {
  const session = await getSession();
  if (!session) redirect("/login");
  return session;
}
