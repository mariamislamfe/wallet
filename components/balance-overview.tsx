"use client";

import { useState } from "react";
import { Banknote, Check, CreditCard, Pencil } from "lucide-react";

import { Ar } from "@/components/ar";
import { AnimatedAmount } from "@/components/animated-amount";
import { cn } from "@/lib/client";
import { WALLET_LABELS, round2, sanitizeAmountInput } from "@/lib/finance";
import { formatMoney } from "@/lib/format";
import { WALLET_TYPES, type Balances, type WalletType } from "@/types/finance";

type Props = {
  balances: Balances;
  /** Money still set aside in pockets; null until the plan is known (client-side). */
  reserved: number | null;
  showSetupHint: boolean;
  onSetBalance: (wallet: WalletType, balance: number) => void;
};

export function BalanceOverview({ balances, reserved, showSetupHint, onSetBalance }: Props) {
  const total = round2(balances.cash + balances.visa);
  const free = reserved === null ? null : round2(total - reserved);

  return (
    <section aria-label="Balances">
      <p className="text-[13px] font-medium text-neutral-500">
        Can be used <span aria-hidden className="mx-1 text-neutral-300 dark:text-neutral-600">·</span>
        <Ar className="font-normal text-neutral-400">تقدري تصرفي</Ar>
      </p>
      {free === null ? (
        <div className="mt-1 h-10 w-48 rounded-lg bg-neutral-100 sm:h-12 dark:bg-neutral-800" />
      ) : (
        <AnimatedAmount
          value={Math.max(free, 0)}
          className={cn(
            "mt-1 block truncate text-[clamp(2rem,10vw,2.5rem)] leading-none font-semibold tracking-[-0.035em] tabular-nums sm:text-5xl",
            free < 0 && "text-red-600 dark:text-red-400",
          )}
        />
      )}
      <p className="mt-2 h-4 text-xs text-neutral-500 tabular-nums">
        {free !== null && free < 0 ? (
          <span className="text-red-600 dark:text-red-400">
            {formatMoney(-free)} into money set aside <Ar className="ms-1">· دخلتي على فلوس الجيوب</Ar>
          </span>
        ) : reserved ? (
          <>
            Total {formatMoney(total)} · {formatMoney(reserved)} set aside in pockets
          </>
        ) : (
          <>Total {formatMoney(total)}</>
        )}
      </p>

      <div className="mt-6 grid grid-cols-2 gap-3">
        {WALLET_TYPES.map((wallet) => (
          <WalletCard
            key={wallet}
            wallet={wallet}
            balance={balances[wallet]}
            onSave={(value) => onSetBalance(wallet, value)}
          />
        ))}
      </div>

      {showSetupHint && (
        <p className="mt-3 text-xs text-neutral-500">
          Tap <Pencil className="inline size-3 align-[-1px]" strokeWidth={1.5} aria-label="edit" /> on a
          card to set your starting balance.
        </p>
      )}
    </section>
  );
}

function WalletCard({
  wallet,
  balance,
  onSave,
}: {
  wallet: WalletType;
  balance: number;
  onSave: (value: number) => void;
}) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState("");
  const Icon = wallet === "cash" ? Banknote : CreditCard;
  const label = WALLET_LABELS[wallet];

  function startEditing() {
    setDraft(balance === 0 ? "" : String(balance));
    setEditing(true);
  }

  function save() {
    const negative = /^\s*[-−]/.test(draft);
    const magnitude = Number(sanitizeAmountInput(draft)) || 0;
    const value = round2(negative ? -magnitude : magnitude);
    setEditing(false);
    if (value !== balance) onSave(value);
  }

  return (
    <div className="group relative rounded-2xl border border-neutral-200 bg-white p-4 transition-colors dark:border-neutral-800 dark:bg-neutral-900">
      <div className="flex items-center justify-between gap-2">
        <div className="flex min-w-0 items-center gap-2">
          <Icon className="size-4 shrink-0 text-neutral-400" strokeWidth={1.5} />
          <span className="text-[13px] font-medium text-neutral-700 dark:text-neutral-300">{label.en}</span>
          <Ar className="truncate text-xs text-neutral-400 max-[359px]:hidden">{label.ar}</Ar>
        </div>
        {!editing && (
          <button
            type="button"
            onClick={startEditing}
            aria-label={`Adjust ${label.en} balance`}
            className="-m-1.5 rounded-md p-1.5 text-neutral-400 transition hover:bg-neutral-100 hover:text-neutral-700 focus-visible:opacity-100 group-hover:opacity-100 [@media(hover:hover)]:opacity-0 dark:hover:bg-neutral-800 dark:hover:text-neutral-200"
          >
            <Pencil className="size-3.5" strokeWidth={1.5} />
          </button>
        )}
      </div>

      {editing ? (
        <form
          onSubmit={(event) => {
            event.preventDefault();
            save();
          }}
          className="mt-3 flex items-center gap-1.5"
        >
          <span className="text-sm text-neutral-400">EGP</span>
          <input
            autoFocus
            inputMode="decimal"
            enterKeyHint="done"
            autoComplete="off"
            aria-label={`${label.en} balance`}
            placeholder="0"
            value={draft}
            onChange={(event) => setDraft(event.target.value)}
            onBlur={() => setEditing(false)}
            onKeyDown={(event) => {
              if (event.key === "Escape") setEditing(false);
            }}
            className="min-w-0 flex-1 bg-transparent text-xl font-semibold tracking-tight tabular-nums outline-none placeholder:text-neutral-300 dark:placeholder:text-neutral-700"
          />
          <button
            type="submit"
            aria-label="Save balance"
            onMouseDown={(event) => event.preventDefault()}
            className="flex size-7 shrink-0 items-center justify-center rounded-full bg-neutral-900 text-white transition hover:bg-neutral-700 dark:bg-white dark:text-neutral-900 dark:hover:bg-neutral-200"
          >
            <Check className="size-3.5" strokeWidth={2} />
          </button>
        </form>
      ) : (
        <AnimatedAmount
          value={balance}
          className={cn(
            "mt-3 block truncate text-xl font-semibold tracking-tight tabular-nums sm:text-2xl",
            balance < 0 && "text-red-600 dark:text-red-400",
          )}
        />
      )}
    </div>
  );
}
