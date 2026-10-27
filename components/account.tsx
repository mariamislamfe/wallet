"use client";

import { useState, useTransition } from "react";
import { Check, Copy, LogOut, MessageSquareText } from "lucide-react";

import { createSmsToken, signOut } from "@/app/actions";
import { Ar } from "@/components/ar";
import { Sheet } from "@/components/sheet";
import { cn } from "@/lib/client";

export type Account = { email: string; smsConnected: boolean };

/** Round initial in the header that opens the account sheet. */
export function AccountButton({ email, onClick }: { email: string; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={`Account · ${email}`}
      className="ms-auto flex size-9 items-center justify-center rounded-full border border-neutral-200 bg-white text-sm font-semibold uppercase text-neutral-700 transition hover:border-neutral-300 active:scale-95 dark:border-neutral-800 dark:bg-neutral-900 dark:text-neutral-200 dark:hover:border-neutral-700"
    >
      {email.slice(0, 1) || "?"}
    </button>
  );
}

type Props = { account: Account; onClose: () => void };

export function AccountSheet({ account, onClose }: Props) {
  const [connected, setConnected] = useState(account.smsConnected);
  const [token, setToken] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState<"token" | "url" | null>(null);
  const [pending, startTransition] = useTransition();
  const [signingOut, startSignOut] = useTransition();
  const endpoint = typeof window === "undefined" ? "/api/sms" : `${window.location.origin}/api/sms`;

  const makeToken = () =>
    startTransition(async () => {
      setError(null);
      const result = await createSmsToken();
      if (!result.ok) {
        setError(result.error);
        return;
      }
      setToken(result.data);
      setConnected(true);
    });

  const copy = async (what: "token" | "url", text: string) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(what);
      window.setTimeout(() => setCopied(null), 1600);
    } catch {
      setError("Couldn't copy. Press and hold the text to copy it.");
    }
  };

  return (
    <Sheet
      id="account-title"
      title="Account"
      titleAr="الحساب"
      subtitle={account.email}
      onClose={onClose}
      footer={
        <button
          type="button"
          disabled={signingOut}
          onClick={() => startSignOut(() => signOut())}
          className="flex h-11 w-full items-center justify-center gap-2 rounded-xl border border-neutral-200 text-sm font-medium text-red-600 transition hover:bg-red-50 disabled:opacity-50 dark:border-neutral-800 dark:text-red-400 dark:hover:bg-red-950/40"
        >
          <LogOut className="size-4" strokeWidth={1.75} />
          {signingOut ? "Signing out…" : "Sign out"}
        </button>
      }
    >
      <section className="mt-2 rounded-2xl border border-neutral-200 p-4 dark:border-neutral-800">
        <div className="flex items-start gap-3">
          <span className="flex size-9 shrink-0 items-center justify-center rounded-xl bg-neutral-100 dark:bg-neutral-800">
            <MessageSquareText className="size-4 text-neutral-600 dark:text-neutral-300" strokeWidth={1.75} />
          </span>
          <div className="min-w-0 flex-1">
            <h3 className="text-[15px] font-semibold">
              Bank SMS <Ar className="ms-1 text-sm font-normal text-neutral-400">رسائل البنك</Ar>
            </h3>
            <p className="mt-0.5 text-[13px] text-neutral-500">
              {connected
                ? "Connected. Bank messages from your iPhone Shortcut land here."
                : "Log card spending automatically from your bank's SMS with an iPhone Shortcut."}
            </p>
          </div>
          <span
            className={cn(
              "shrink-0 rounded-full px-2 py-0.5 text-[11px] font-medium",
              connected
                ? "bg-emerald-50 text-emerald-700 dark:bg-emerald-950/50 dark:text-emerald-400"
                : "bg-neutral-100 text-neutral-500 dark:bg-neutral-800 dark:text-neutral-400",
            )}
          >
            {connected ? "On" : "Off"}
          </span>
        </div>

        {token ? (
          <div className="mt-4 space-y-3">
            <CopyRow label="Token" value={token} copied={copied === "token"} onCopy={() => copy("token", token)} />
            <CopyRow label="URL" value={endpoint} copied={copied === "url"} onCopy={() => copy("url", endpoint)} />
            <p className="text-[13px] leading-relaxed text-neutral-500">
              In the Shortcut&apos;s <b className="font-medium text-neutral-700 dark:text-neutral-300">Get Contents of URL</b>
              , add one header: <span className="font-mono text-[12px]">Authorization</span> →{" "}
              <span className="font-mono text-[12px]">Bearer</span>, a space, then the token. It&apos;s shown only now,
              so copy it before closing.
            </p>
          </div>
        ) : (
          <>
            {connected && (
              <p className="mt-3 text-[13px] text-amber-700 dark:text-amber-400">
                A new token replaces the old one — update the Shortcut with it.
              </p>
            )}
            <button
              type="button"
              onClick={makeToken}
              disabled={pending}
              className="mt-4 flex h-11 w-full items-center justify-center rounded-xl bg-neutral-900 text-sm font-medium text-white transition hover:bg-neutral-800 active:scale-[0.99] disabled:opacity-50 dark:bg-white dark:text-neutral-900 dark:hover:bg-neutral-200"
            >
              {pending ? "Making…" : connected ? "Make a new token" : "Set up · make a token"}
            </button>
          </>
        )}

        {error && (
          <p role="alert" className="mt-3 text-sm text-red-600 dark:text-red-400">
            {error}
          </p>
        )}
      </section>
    </Sheet>
  );
}

function CopyRow({ label, value, copied, onCopy }: { label: string; value: string; copied: boolean; onCopy: () => void }) {
  return (
    <div>
      <p className="mb-1 text-[11px] font-medium tracking-wide text-neutral-400 uppercase">{label}</p>
      <div className="flex items-center gap-2 rounded-xl border border-neutral-200 bg-neutral-50 py-1.5 ps-3 pe-1.5 dark:border-neutral-800 dark:bg-neutral-800/50">
        <code className="min-w-0 flex-1 truncate font-mono text-[13px] select-all">{value}</code>
        <button
          type="button"
          onClick={onCopy}
          aria-label={`Copy ${label.toLowerCase()}`}
          className="flex h-8 shrink-0 items-center gap-1.5 rounded-lg bg-white px-2.5 text-[12px] font-medium shadow-sm transition active:scale-95 dark:bg-neutral-900"
        >
          {copied ? <Check className="size-3.5 text-emerald-600" /> : <Copy className="size-3.5" />}
          {copied ? "Copied" : "Copy"}
        </button>
      </div>
    </div>
  );
}
