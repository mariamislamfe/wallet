"use server";

import { headers } from "next/headers";
import { redirect } from "next/navigation";

import { getAuthClient } from "@/lib/session";

export type LoginMode = "sign-in" | "sign-up";
/** `email` is sent back so the form keeps it after an error (React resets forms after an action). */
export type LoginState = { error: string | null; notice: string | null; email: string };

const MIN_PASSWORD = 8;
const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/** Supabase error codes → what to tell the person. */
const MESSAGES: Record<string, string> = {
  invalid_credentials: "Wrong email or password.",
  email_not_confirmed: "Confirm your email first — check your inbox.",
  user_already_exists: "There's already an account with this email. Sign in instead.",
  email_exists: "There's already an account with this email. Sign in instead.",
  weak_password: `Pick a stronger password (at least ${MIN_PASSWORD} characters).`,
  email_address_invalid: "That email doesn't look right.",
  signup_disabled: "New accounts are turned off.",
  over_request_rate_limit: "Too many tries. Wait a minute and try again.",
  over_email_send_rate_limit: "Too many emails sent. Wait a while and try again.",
};

export async function authenticate(_prev: LoginState, formData: FormData): Promise<LoginState> {
  const mode: LoginMode = formData.get("mode") === "sign-up" ? "sign-up" : "sign-in";
  const email = String(formData.get("email") ?? "").trim().toLowerCase();
  const password = String(formData.get("password") ?? "");

  if (!EMAIL.test(email)) return { error: "Enter your email.", notice: null, email };
  if (mode === "sign-up" && password.length < MIN_PASSWORD) {
    return { error: `Password needs at least ${MIN_PASSWORD} characters.`, notice: null, email };
  }
  if (!password) return { error: "Enter your password.", notice: null, email };

  const client = await getAuthClient();

  if (mode === "sign-in") {
    const { error } = await client.auth.signInWithPassword({ email, password });
    if (error) return { error: describe(error), notice: null, email };
    redirect("/");
  }

  const origin = (await headers()).get("origin");
  const { data, error } = await client.auth.signUp({
    email,
    password,
    options: origin ? { emailRedirectTo: `${origin}/auth/callback` } : undefined,
  });
  if (error) return { error: describe(error), notice: null, email };
  // With "Confirm email" on, there's no session until the link in the email is opened.
  if (!data.session) return { error: null, notice: `Check ${email} for a link to finish signing up.`, email };
  redirect("/");
}

function describe(error: { code?: string; message: string }): string {
  if (error.code && MESSAGES[error.code]) return MESSAGES[error.code]!;
  console.error("[wallet] auth failed:", error.code, error.message);
  return "Couldn't sign in right now. Try again.";
}
