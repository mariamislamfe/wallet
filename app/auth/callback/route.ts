import { NextResponse, type NextRequest } from "next/server";

import { getAuthClient } from "@/lib/session";

// Where the sign-up confirmation email lands: trades the one-time code for a session.
export async function GET(request: NextRequest) {
  const code = request.nextUrl.searchParams.get("code");
  const home = new URL("/", request.url);

  if (code) {
    const client = await getAuthClient();
    const { error } = await client.auth.exchangeCodeForSession(code);
    if (!error) return NextResponse.redirect(home);
    console.error("[wallet] email confirmation failed:", error.code, error.message);
  }
  return NextResponse.redirect(new URL("/login", request.url));
}
