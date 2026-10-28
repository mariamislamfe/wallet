"use client";

import { useState } from "react";
import { Check, Copy } from "lucide-react";

type Props = { label: string; value: string };

/** A value shown in full-width mono with a Copy button. Press-and-hold still works if the clipboard is blocked. */
export function CopyField({ label, value }: Props) {
  const [state, setState] = useState<"idle" | "copied" | "failed">("idle");

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(value);
      setState("copied");
    } catch {
      setState("failed");
    }
    window.setTimeout(() => setState("idle"), 1600);
  };

  return (
    <div dir="ltr">
      <p className="mb-1 text-[11px] font-medium tracking-wide text-neutral-400 uppercase">{label}</p>
      <div className="flex items-center gap-2 rounded-xl border border-neutral-200 bg-neutral-50 py-1.5 ps-3 pe-1.5 dark:border-neutral-800 dark:bg-neutral-800/50">
        <code className="min-w-0 flex-1 truncate font-mono text-[13px] select-all">{value}</code>
        <button
          type="button"
          onClick={copy}
          aria-label={`Copy ${label.toLowerCase()}`}
          className="flex h-8 shrink-0 items-center gap-1.5 rounded-lg bg-white px-2.5 text-[12px] font-medium shadow-sm transition active:scale-95 dark:bg-neutral-900"
        >
          {state === "copied" ? <Check className="size-3.5 text-emerald-600" /> : <Copy className="size-3.5" />}
          {state === "copied" ? "Copied" : state === "failed" ? "Hold to copy" : "Copy"}
        </button>
      </div>
    </div>
  );
}
