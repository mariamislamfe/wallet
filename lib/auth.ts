// Shared by middleware (Edge runtime) and the server, so no Node-only imports.

/** Paths that work without signing in. /api/sms authenticates with its own bearer token; /guide is shareable. */
export function isPublicPath(pathname: string): boolean {
  return pathname === "/login" || pathname === "/guide" || pathname.startsWith("/auth/") || pathname === "/api/sms";
}

/** URL and publishable (anon) key for acting as the signed-in user. */
export function authKeys(): { url: string; key: string } {
  const url = process.env.SUPABASE_URL ?? process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ?? process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !key) {
    throw new Error("Missing SUPABASE_URL or NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY. Add both to .env.local.");
  }
  return { url, key };
}
