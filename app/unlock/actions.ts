"use server";

import { cookies } from "next/headers";
import { redirect } from "next/navigation";

import { SESSION_COOKIE, SESSION_MAX_AGE, getPasscode, safeEqual, sessionToken } from "@/lib/auth";

export type UnlockState = { error: string | null };

export async function unlock(_prev: UnlockState, formData: FormData): Promise<UnlockState> {
  const passcode = getPasscode();
  if (!passcode) redirect("/");

  const attempt = String(formData.get("passcode") ?? "");
  const [expected, received] = await Promise.all([sessionToken(passcode), sessionToken(attempt)]);

  if (!safeEqual(expected, received)) {
    // Slow down guessing without blocking the event loop.
    await new Promise((resolve) => setTimeout(resolve, 600));
    return { error: "Wrong passcode" };
  }

  const store = await cookies();
  store.set(SESSION_COOKIE, expected, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: SESSION_MAX_AGE,
  });

  redirect("/");
}
