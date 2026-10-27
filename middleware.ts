import { NextResponse, type NextRequest } from "next/server";
import { createServerClient } from "@supabase/ssr";

import { authKeys, isPublicPath } from "@/lib/auth";

/** Refreshes the Supabase session cookies on every request and sends signed-out visitors to /login. */
export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;
  if (pathname === "/api/sms") return NextResponse.next();

  let response = NextResponse.next({ request });
  const { url, key } = authKeys();
  const supabase = createServerClient(url, key, {
    cookies: {
      getAll: () => request.cookies.getAll(),
      setAll: (list) => {
        for (const { name, value } of list) request.cookies.set(name, value);
        response = NextResponse.next({ request });
        for (const { name, value, options } of list) response.cookies.set(name, value, options);
      },
    },
  });

  const { data } = await supabase.auth.getClaims();
  const signedIn = Boolean(data?.claims?.sub);

  if (!signedIn && !isPublicPath(pathname)) return redirectTo(request, response, "/login");
  if (signedIn && pathname === "/login") return redirectTo(request, response, "/");
  return response;
}

/** Redirects while keeping any refreshed session cookies. */
function redirectTo(request: NextRequest, response: NextResponse, pathname: string) {
  const url = request.nextUrl.clone();
  url.pathname = pathname;
  url.search = "";
  const redirect = NextResponse.redirect(url);
  for (const cookie of response.cookies.getAll()) redirect.cookies.set(cookie);
  return redirect;
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|icon.svg).*)"],
};
