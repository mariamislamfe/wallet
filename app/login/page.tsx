"use client";

import { useActionState, useState } from "react";
import { ArrowRight, WalletMinimal } from "lucide-react";

import { Ar } from "@/components/ar";
import { cn } from "@/lib/client";
import { authenticate, type LoginMode, type LoginState } from "./actions";

const initialState: LoginState = { error: null, notice: null, email: "" };

const COPY: Record<LoginMode, { title: string; titleAr: string; submit: string; switchText: string; switchAction: string }> = {
  "sign-in": {
    title: "Welcome back",
    titleAr: "تسجيل الدخول",
    submit: "Sign in",
    switchText: "New here?",
    switchAction: "Create an account",
  },
  "sign-up": {
    title: "Create your wallet",
    titleAr: "حساب جديد",
    submit: "Create account",
    switchText: "Have an account?",
    switchAction: "Sign in",
  },
};

const INPUT =
  "h-12 w-full rounded-xl border border-neutral-200 bg-white px-4 text-base outline-none transition placeholder:text-neutral-400 focus:border-neutral-400 dark:border-neutral-800 dark:bg-neutral-900 dark:focus:border-neutral-600";

export default function LoginPage() {
  const [mode, setMode] = useState<LoginMode>("sign-in");
  const [state, action, pending] = useActionState(authenticate, initialState);
  const copy = COPY[mode];

  return (
    <main className="flex min-h-dvh items-center justify-center px-4 py-10">
      <form action={action} className="w-full max-w-sm">
        <span className="flex size-11 items-center justify-center rounded-2xl bg-neutral-900 text-white dark:bg-white dark:text-neutral-900">
          <WalletMinimal className="size-5" strokeWidth={1.75} />
        </span>
        <h1 className="mt-6 text-2xl font-semibold tracking-tight">{copy.title}</h1>
        <Ar className="mt-0.5 text-sm text-neutral-500">{copy.titleAr}</Ar>

        <input type="hidden" name="mode" value={mode} />
        <div className="mt-8 space-y-3">
          <input
            name="email"
            type="email"
            defaultValue={state.email}
            autoComplete="email"
            inputMode="email"
            autoCapitalize="none"
            spellCheck={false}
            required
            placeholder="Email"
            aria-label="Email"
            className={INPUT}
          />
          <input
            name="password"
            type="password"
            autoComplete={mode === "sign-in" ? "current-password" : "new-password"}
            minLength={mode === "sign-up" ? 8 : undefined}
            required
            placeholder={mode === "sign-up" ? "Password (8+ characters)" : "Password"}
            aria-label="Password"
            className={INPUT}
          />
        </div>

        <p
          role={state.error ? "alert" : "status"}
          className={cn(
            "mt-3 min-h-5 text-sm",
            state.error ? "text-red-600 dark:text-red-400" : "text-emerald-700 dark:text-emerald-400",
          )}
        >
          {state.error ?? state.notice}
        </p>

        <button
          type="submit"
          disabled={pending}
          className="mt-3 flex h-12 w-full items-center justify-center gap-2 rounded-xl bg-neutral-900 text-sm font-medium text-white transition hover:bg-neutral-800 active:scale-[0.99] disabled:opacity-50 dark:bg-white dark:text-neutral-900 dark:hover:bg-neutral-200"
        >
          {pending ? "One moment…" : copy.submit}
          {!pending && <ArrowRight className="size-4" strokeWidth={1.75} />}
        </button>

        <p className="mt-6 text-center text-sm text-neutral-500">
          {copy.switchText}{" "}
          <button
            type="button"
            onClick={() => setMode(mode === "sign-in" ? "sign-up" : "sign-in")}
            className="font-medium text-neutral-900 underline-offset-4 hover:underline dark:text-neutral-100"
          >
            {copy.switchAction}
          </button>
        </p>
      </form>
    </main>
  );
}
