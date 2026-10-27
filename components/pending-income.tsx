"use client";

import { AnimatePresence, motion } from "framer-motion";

import { Ar } from "@/components/ar";
import { displayDescription, splitOf } from "@/lib/finance";
import { formatMoney, formatSignedMoney } from "@/lib/format";
import type { Budget, Transaction } from "@/types/finance";

const EASE = [0.22, 1, 0.36, 1] as const;

type Props = {
  /** Income in this month that hasn't been put into or kept out of the plan. */
  transactions: Transaction[];
  budgets: Budget[];
  pendingIds: ReadonlySet<string>;
  onDecide: (tx: Transaction, inPlan: boolean) => void;
};

/** Asks, per income, whether the plan's % pockets come out of it. */
export function PendingIncome({ transactions, budgets, pendingIds, onDecide }: Props) {
  return (
    <AnimatePresence initial={false}>
      {transactions.map((tx) => {
        const split = splitOf(budgets, tx.amount);
        const busy = pendingIds.has(tx.id);
        return (
          <motion.div
            key={tx.id}
            layout="position"
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: "auto" }}
            exit={{ opacity: 0, height: 0 }}
            transition={{ duration: 0.24, ease: EASE }}
            className="overflow-hidden"
          >
            <div className="mt-3 rounded-2xl border border-amber-200 bg-amber-50 p-4 dark:border-amber-900/60 dark:bg-amber-950/30">
              <p className="text-xs font-medium text-amber-800 dark:text-amber-300">
                New income <span aria-hidden className="mx-1 opacity-50">·</span>
                <Ar className="font-normal">دخل جديد، يدخل في التقسيمة؟</Ar>
              </p>
              <p className="mt-1 flex min-w-0 items-baseline gap-2">
                <span className="shrink-0 text-lg font-semibold text-emerald-700 tabular-nums dark:text-emerald-400">
                  {formatSignedMoney(tx)}
                </span>
                <bdi className="truncate text-sm text-neutral-600 dark:text-neutral-400">{displayDescription(tx)}</bdi>
              </p>

              {split.length > 0 && (
                <ul className="mt-2 flex flex-wrap gap-1.5 text-xs">
                  {split.map((part) => (
                    <li
                      key={part.name}
                      className="rounded-full bg-white px-2.5 leading-6 text-neutral-700 tabular-nums dark:bg-neutral-900 dark:text-neutral-300"
                    >
                      <bdi>{part.name}</bdi> {formatMoney(part.amount)}
                    </li>
                  ))}
                </ul>
              )}

              <div className="mt-3 grid grid-cols-2 gap-2">
                <button
                  type="button"
                  disabled={busy}
                  onClick={() => onDecide(tx, true)}
                  className="h-10 rounded-xl bg-neutral-900 text-sm font-medium text-white transition hover:bg-neutral-800 active:scale-[0.98] disabled:opacity-50 dark:bg-white dark:text-neutral-900 dark:hover:bg-neutral-200"
                >
                  Split it <Ar className="ms-1 font-normal opacity-70">وزّعيه</Ar>
                </button>
                <button
                  type="button"
                  disabled={busy}
                  onClick={() => onDecide(tx, false)}
                  className="h-10 rounded-xl border border-neutral-200 bg-white text-sm font-medium text-neutral-700 transition hover:bg-neutral-100 active:scale-[0.98] disabled:opacity-50 dark:border-neutral-800 dark:bg-neutral-900 dark:text-neutral-300 dark:hover:bg-neutral-800"
                >
                  Keep out <Ar className="ms-1 font-normal text-neutral-400">لأ</Ar>
                </button>
              </div>
            </div>
          </motion.div>
        );
      })}
    </AnimatePresence>
  );
}
