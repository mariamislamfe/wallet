import { NextResponse, type NextRequest } from "next/server";

import { SESSION_COOKIE, getPasscode, isValidSession } from "@/lib/auth";

export async function middleware(request: NextRequest) {
  // /api/sms authenticates with its own bearer token.
  const { pathname } = request.nextUrl;
  if (!getPasscode() || pathname.startsWith("/unlock") || pathname === "/api/sms") {
    return NextResponse.next();
  }

  if (await isValidSession(request.cookies.get(SESSION_COOKIE)?.value)) {
    return NextResponse.next();
  }

  const url = request.nextUrl.clone();
  url.pathname = "/unlock";
  url.search = "";
  return NextResponse.redirect(url);
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|icon.svg).*)"],
};
