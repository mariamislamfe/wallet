"use client";

import { useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { MessageSquareText, Plus, Trash2 } from "lucide-react";

import { Ar } from "@/components/ar";
import { cn } from "@/lib/client";
import { WALLET_LABELS, displayDescription, totalsFor } from "@/lib/finance";
import { formatMoney, formatRowTime, formatSignedMoney, groupByDay } from "@/lib/format";
import type { Budget, Transaction } from "@/types/finance";

type Props = {
  /** Already narrowed to the selected month. */
  transactions: Transaction[];
  budgets: Budget[];
  pendingIds: ReadonlySet<string>;
  onDelete: (tx: Transaction) => void;
  onSetBudget: (tx: Transaction, budgetId: string | null) => void;
};

const EASE = [0.22, 1, 0.36, 1] as const;
const SWIPE_DISTANCE = 96;
const SWIPE_VELOCITY = 700;

// Day grouping depends on the viewer's timezone; the parent only renders this after mount.
export function ActivityFeed({ transactions, budgets, pendingIds, onDelete, onSetBudget }: Props) {
  // The row whose budget picker is open; one at a time.
  const [pickingId, setPickingId] = useState<string | null>(null);

  return groupByDay(transactions).map((group) => {
    const spent = totalsFor(group.items).expense;
    return (
      <div key={group.key} className="mt-6 first:mt-0">
        <h3 className="mb-2 flex items-baseline justify-between gap-3 px-1 text-[11px] font-medium tracking-[0.06em] text-neutral-400 uppercase">
          <span className="min-w-0 truncate">
            {group.label.en}
            <span aria-hidden className="mx-1.5">·</span>
            <Ar className="tracking-normal normal-case">{group.label.ar}</Ar>
          </span>
          {spent > 0 && (
            <span className="shrink-0 tracking-normal normal-case tabular-nums">
              <span className="sr-only">Spent </span>−{formatMoney(spent)}
            </span>
          )}
        </h3>
        <ul className="overflow-hidden rounded-2xl border border-neutral-200 bg-white dark:border-neutral-800 dark:bg-neutral-900">
          <AnimatePresence initial={false}>
            {group.items.map((tx, index) => (
              <FeedRow
                key={tx.id}
                tx={tx}
                first={index === 0}
                pending={pendingIds.has(tx.id)}
                budgets={budgets}
                picking={pickingId === tx.id}
                onTogglePicker={() => setPickingId((id) => (id === tx.id ? null : tx.id))}
                onPick={(budgetId) => {
                  setPickingId(null);
                  onSetBudget(tx, budgetId);
                }}
                onDelete={onDelete}
              />
            ))}
          </AnimatePresence>
        </ul>
      </div>
    );
  });
}

function FeedRow({
  tx,
  first,
  pending,
  budgets,
  picking,
  onTogglePicker,
  onPick,
  onDelete,
}: {
  tx: Transaction;
  first: boolean;
  pending: boolean;
  budgets: Budget[];
  picking: boolean;
  onTogglePicker: () => void;
  onPick: (budgetId: string | null) => void;
  onDelete: (tx: Transaction) => void;
}) {
  const income = tx.type === "income";
  const description = displayDescription(tx);
  const budget = budgets.find((b) => b.id === tx.budget_id) ?? null;
  const taggable = !income && budgets.length > 0;

  return (
    <motion.li
      layout="position"
      initial={{ opacity: 0, height: 0 }}
      animate={{ opacity: 1, height: "auto" }}
      exit={{ opacity: 0, height: 0 }}
      transition={{ duration: 0.28, ease: EASE }}
      className={cn("relative overflow-hidden", !first && "border-t border-neutral-100 dark:border-neutral-800/80")}
    >
      {/* Swipe-to-delete reveal sits behind the row only, not the budget picker. */}
      <div className="relative">
        <div
          aria-hidden
          className="absolute inset-0 flex items-center justify-end bg-neutral-100 pe-5 text-red-500 dark:bg-neutral-800"
        >
          <Trash2 className="size-4" strokeWidth={1.5} />
        </div>

        <motion.div
          drag={pending ? false : "x"}
          dragDirectionLock
          dragConstraints={{ left: 0, right: 0 }}
          dragElastic={{ left: 0.6, right: 0 }}
          dragSnapToOrigin
          onDragEnd={(_, info) => {
            if (info.offset.x < -SWIPE_DISTANCE || info.velocity.x < -SWIPE_VELOCITY) onDelete(tx);
          }}
          className={cn(
            "group relative flex items-center gap-3 bg-white px-4 py-3 transition-opacity dark:bg-neutral-900",
            pending && "opacity-50",
          )}
        >
          <div className="min-w-0 flex-1">
            <p className="truncate text-[15px] leading-5 font-medium">
              <bdi>{description}</bdi>
            </p>
            <div className="mt-1 flex items-center gap-2 text-xs text-neutral-500">
              <span className="rounded-md border border-neutral-200 px-1.5 text-[11px] leading-[18px] font-medium text-neutral-600 dark:border-neutral-700 dark:text-neutral-400">
                {WALLET_LABELS[tx.wallet_type].en}
              </span>
              {taggable && (
                <button
                  type="button"
                  disabled={pending}
                  onClick={onTogglePicker}
                  aria-expanded={picking}
                  aria-label={budget ? `Budget: ${budget.name}. Change` : "Add to a budget"}
                  className={cn(
                    "relative flex max-w-[9rem] min-w-0 items-center gap-0.5 rounded-md px-1.5 text-[11px] leading-[18px] font-medium transition after:absolute after:-inset-2",
                    budget
                      ? "bg-neutral-100 text-neutral-700 hover:bg-neutral-200 dark:bg-neutral-800 dark:text-neutral-300 dark:hover:bg-neutral-700"
                      : "border border-dashed border-neutral-300 text-neutral-400 hover:text-neutral-600 dark:border-neutral-700 dark:hover:text-neutral-300",
                  )}
                >
                  {budget ? (
                    <bdi className="truncate">{budget.name}</bdi>
                  ) : (
                    <>
                      <Plus className="size-3" strokeWidth={2} />
                      Budget
                    </>
                  )}
                </button>
              )}
              {tx.source === "sms" && (
                <MessageSquareText className="size-3.5 shrink-0 text-neutral-400" strokeWidth={1.5} aria-label="From bank SMS" />
              )}
              <time dateTime={tx.created_at} className="tabular-nums">
                {formatRowTime(tx.created_at)}
              </time>
            </div>
          </div>

          <span
            className={cn(
              "shrink-0 text-[15px] font-medium tabular-nums",
              income ? "text-emerald-600 dark:text-emerald-400" : "text-neutral-900 dark:text-neutral-100",
            )}
          >
            {formatSignedMoney(tx)}
          </span>

          <button
            type="button"
            disabled={pending}
            onClick={() => onDelete(tx)}
            aria-label={`Delete ${description}`}
            className="-ms-3 -me-1.5 hidden h-7 w-0 shrink-0 items-center justify-center overflow-hidden rounded-md text-neutral-400 opacity-0 transition-all duration-200 ease-out-quint group-hover:ms-0 group-hover:w-7 group-hover:opacity-100 hover:bg-neutral-100 hover:text-red-500 focus-visible:ms-0 focus-visible:w-7 focus-visible:opacity-100 disabled:invisible [@media(hover:hover)]:inline-flex dark:hover:bg-neutral-800"
          >
            <Trash2 className="size-3.5" strokeWidth={1.5} />
          </button>
        </motion.div>
      </div>

      <AnimatePresence initial={false}>
        {picking && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.22, ease: EASE }}
            className="relative overflow-hidden bg-neutral-50 dark:bg-neutral-950/40"
          >
            <div
              role="radiogroup"
              aria-label="Budget"
              className="flex gap-1.5 overflow-x-auto px-4 py-2.5 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
            >
              {[...budgets.map((b) => ({ id: b.id as string | null, name: b.name })), { id: null, name: "None" }].map(
                (option) => {
                  const selected = option.id === tx.budget_id;
                  return (
                    <button
                      key={option.id ?? "none"}
                      type="button"
                      role="radio"
                      aria-checked={selected}
                      onClick={() => onPick(option.id)}
                      className={cn(
                        "h-8 shrink-0 rounded-full border px-3 text-[13px] transition active:scale-[0.97]",
                        selected
                          ? "border-neutral-900 bg-neutral-900 text-white dark:border-neutral-100 dark:bg-neutral-100 dark:text-neutral-900"
                          : "border-neutral-200 bg-white text-neutral-600 hover:border-neutral-300 dark:border-neutral-800 dark:bg-neutral-900 dark:text-neutral-400",
                        option.id === null && !selected && "text-neutral-400",
                      )}
                    >
                      <bdi>{option.name}</bdi>
                    </button>
                  );
                },
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.li>
  );
}

export function FeedSkeleton() {
  return (
    <div className="overflow-hidden rounded-2xl border border-neutral-200 bg-white dark:border-neutral-800 dark:bg-neutral-900">
      {[0, 1, 2].map((i) => (
        <div key={i} className={cn("flex items-center gap-3 px-4 py-3.5", i > 0 && "border-t border-neutral-100 dark:border-neutral-800/80")}>
          <div className="flex-1 space-y-2">
            <div className="h-3 w-28 rounded bg-neutral-100 dark:bg-neutral-800" />
            <div className="h-2.5 w-16 rounded bg-neutral-100 dark:bg-neutral-800" />
          </div>
          <div className="h-3 w-16 rounded bg-neutral-100 dark:bg-neutral-800" />
        </div>
      ))}
    </div>
  );
}
