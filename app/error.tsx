"use client";

import { RotateCw } from "lucide-react";

export default function ErrorPage({ reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <main className="flex min-h-dvh items-center justify-center px-4">
      <div className="max-w-xs text-center">
        <h1 className="text-lg font-semibold tracking-tight">Couldn&apos;t load your wallet</h1>
        <p className="mt-1 text-sm text-neutral-500">
          Check your connection and the Supabase environment variables.
        </p>
        <button
          type="button"
          onClick={reset}
          className="mt-6 inline-flex h-10 items-center gap-2 rounded-full border border-neutral-200 bg-white px-4 text-sm font-medium transition hover:bg-neutral-100 dark:border-neutral-800 dark:bg-neutral-900 dark:hover:bg-neutral-800"
        >
          <RotateCw className="size-3.5" strokeWidth={1.75} />
          Try again
        </button>
      </div>
    </main>
  );
}
