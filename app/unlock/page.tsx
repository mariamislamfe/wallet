"use client";

import { useActionState } from "react";
import { ArrowRight, Lock } from "lucide-react";

import { unlock, type UnlockState } from "./actions";

const initialState: UnlockState = { error: null };

export default function UnlockPage() {
  const [state, action, pending] = useActionState(unlock, initialState);

  return (
    <main className="flex min-h-dvh items-center justify-center px-4">
      <form action={action} className="w-full max-w-xs text-center">
        <div className="mx-auto flex size-11 items-center justify-center rounded-full border border-neutral-200 dark:border-neutral-800">
          <Lock className="size-4 text-neutral-500" strokeWidth={1.5} />
        </div>
        <h1 className="mt-5 text-lg font-semibold tracking-tight">Wallet is locked</h1>
        <p lang="ar" dir="rtl" className="mt-0.5 text-sm text-neutral-500">
          اكتب الباسكود
        </p>

        <div className="relative mt-6">
          <input
            name="passcode"
            type="password"
            inputMode="numeric"
            autoComplete="current-password"
            autoFocus
            required
            aria-label="Passcode"
            aria-invalid={Boolean(state.error)}
            className="h-12 w-full rounded-xl border border-neutral-200 bg-white pe-12 ps-4 text-center text-base tracking-[0.3em] outline-none transition focus:border-neutral-400 dark:border-neutral-800 dark:bg-neutral-900 dark:focus:border-neutral-600"
          />
          <button
            type="submit"
            disabled={pending}
            aria-label="Unlock"
            className="absolute end-1.5 top-1.5 flex size-9 items-center justify-center rounded-lg bg-neutral-900 text-white transition hover:bg-neutral-700 disabled:opacity-40 dark:bg-white dark:text-neutral-900 dark:hover:bg-neutral-200"
          >
            <ArrowRight className="size-4" strokeWidth={1.75} />
          </button>
        </div>

        <p role="alert" className="mt-3 h-5 text-sm text-red-600 dark:text-red-400">
          {state.error}
        </p>
      </form>
    </main>
  );
}
