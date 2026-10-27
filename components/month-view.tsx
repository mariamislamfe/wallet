"use client";

import { AnimatePresence, motion } from "framer-motion";
import { ChevronLeft, ChevronRight, RotateCw } from "lucide-react";

import { ActivityFeed, FeedSkeleton } from "@/components/activity-feed";
import { Ar } from "@/components/ar";
import { BudgetPlan } from "@/components/budget-plan";
import { PendingIncome } from "@/components/pending-income";
import { cn, useMounted } from "@/lib/client";
import { isPlanRow, isUndecidedIncome, planFor, totalsFor, type PlanRow, type Totals } from "@/lib/finance";
import { formatMoney, monthRange, monthTitle } from "@/lib/format";
import type { Budget, BudgetInput, Transaction } from "@/types/finance";

export type MonthStatus = "ready" | "loading" | "error";

type Props = {
  offset: number;
  /** Oldest month that can be opened, as an offset. */
  maxOffset: number;
  status: MonthStatus;
  transactions: Transaction[];
  budgets: Budget[];
  /** Cash + Visa right now. */
  balance: number;
  /** Pocket rows from before the loaded window; % pockets carry them forward. */
  planHistory: PlanRow[];
  pendingIds: ReadonlySet<string>;
  onOffsetChange: (offset: number) => void;
  onRetry: () => void;
  onDelete: (tx: Transaction) => void;
  onSetBudget: (tx: Transaction, budgetId: string | null) => void;
  onSetInPlan: (tx: Transaction, inPlan: boolean | null) => void;
  onSaveBudgets: (lines: BudgetInput[]) => Promise<string | null>;
};

const EASE = [0.22, 1, 0.36, 1] as const;

export function MonthView({
  offset,
  maxOffset,
  status,
  transactions,
  budgets,
  balance,
  planHistory,
  pendingIds,
  onOffsetChange,
  onRetry,
  onDelete,
  onSetBudget,
  onSetInPlan,
  onSaveBudgets,
}: Props) {
  // Month boundaries depend on the viewer's timezone, so render them client-side only.
  const mounted = useMounted();

  return (
    <section aria-labelledby="month-heading" className="mt-12">
      {mounted ? (
        <MonthContent
          offset={offset}
          maxOffset={maxOffset}
          status={status}
          transactions={transactions}
          budgets={budgets}
          balance={balance}
          planHistory={planHistory}
          pendingIds={pendingIds}
          onOffsetChange={onOffsetChange}
          onRetry={onRetry}
          onDelete={onDelete}
          onSetBudget={onSetBudget}
          onSetInPlan={onSetInPlan}
          onSaveBudgets={onSaveBudgets}
        />
      ) : (
        <>
          <div className="h-12" />
          <SummarySkeleton />
          <div className="mt-6">
            <FeedSkeleton />
          </div>
        </>
      )}
    </section>
  );
}

function MonthContent({
  offset,
  maxOffset,
  status,
  transactions,
  budgets,
  balance,
  planHistory,
  pendingIds,
  onOffsetChange,
  onRetry,
  onDelete,
  onSetBudget,
  onSetInPlan,
  onSaveBudgets,
}: Props) {
  const now = new Date();
  const { start, end } = monthRange(offset, now);
  const inMonth = transactions.filter((tx) => {
    const at = Date.parse(tx.created_at);
    return at >= start.getTime() && at < end.getTime();
  });
  const totals = totalsFor(inMonth);
  // Everything before this month that fills or drains a pocket; loaded rows win over the snapshot.
  const byId = new Map<string, PlanRow>();
  for (const row of [...planHistory, ...transactions]) byId.set(row.id, row);
  const history = [...byId.values()].filter((row) => Date.parse(row.created_at) < start.getTime() && isPlanRow(row));
  const title = monthTitle(offset, now);
  const canGoOlder = offset < maxOffset;
  const canGoNewer = offset > 0;

  return (
    <>
      <div className="flex items-center gap-2">
        <div className="min-w-0 flex-1 px-1">
          <h2 id="month-heading" className="flex items-baseline gap-x-2 text-xl font-semibold tracking-tight">
            <span className="truncate">
              {title.name.en}
              {title.year !== null && <span className="text-neutral-400"> {title.year}</span>}
            </span>
            <Ar className="shrink-0 text-base font-normal text-neutral-400">{title.name.ar}</Ar>
          </h2>
          <p className="mt-0.5 h-4 text-xs text-neutral-500">
            {title.relative ? (
              <>
                {title.relative.en}
                <span aria-hidden className="mx-1 text-neutral-300 dark:text-neutral-600">·</span>
                <Ar className="text-neutral-400">{title.relative.ar}</Ar>
              </>
            ) : (
              <button
                type="button"
                onClick={() => onOffsetChange(0)}
                className="font-medium text-neutral-600 underline-offset-4 hover:text-neutral-900 hover:underline dark:text-neutral-400 dark:hover:text-neutral-100"
              >
                Back to this month
              </button>
            )}
          </p>
        </div>

        <div className="flex shrink-0 items-center gap-1">
          <NavButton label="Previous month" disabled={!canGoOlder} onClick={() => onOffsetChange(offset + 1)}>
            <ChevronLeft className="size-4" strokeWidth={1.75} />
          </NavButton>
          <NavButton label="Next month" disabled={!canGoNewer} onClick={() => onOffsetChange(offset - 1)}>
            <ChevronRight className="size-4" strokeWidth={1.75} />
          </NavButton>
        </div>
      </div>

      <AnimatePresence mode="wait" initial={false}>
        <motion.div
          key={offset}
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.16, ease: EASE }}
        >
          {status === "ready" ? (
            <>
              <MonthSummary totals={totals} />
              {budgets.length > 0 && (
                <PendingIncome
                  transactions={inMonth.filter(isUndecidedIncome)}
                  budgets={budgets}
                  pendingIds={pendingIds}
                  onDecide={onSetInPlan}
                />
              )}
              <BudgetPlan
                plan={planFor(budgets, inMonth, history)}
                budgets={budgets}
                balance={offset === 0 ? balance : null}
                onSave={onSaveBudgets}
              />
              <div className="mt-8">
                {inMonth.length === 0 ? (
                  <div className="rounded-2xl border border-dashed border-neutral-200 px-6 py-10 text-center dark:border-neutral-800">
                    <p className="text-sm text-neutral-500">
                      {offset === 0 ? "Nothing logged this month yet" : `Nothing logged in ${title.name.en}`}
                    </p>
                    <Ar className="mt-0.5 text-sm text-neutral-400">مفيش حركات في الشهر ده</Ar>
                  </div>
                ) : (
                  <ActivityFeed
                    transactions={inMonth}
                    budgets={budgets}
                    pendingIds={pendingIds}
                    onDelete={onDelete}
                    onSetBudget={onSetBudget}
                    onSetInPlan={onSetInPlan}
                  />
                )}
              </div>
            </>
          ) : status === "loading" ? (
            <>
              <SummarySkeleton />
              <div className="mt-8">
                <FeedSkeleton />
              </div>
            </>
          ) : (
            <div className="mt-4 rounded-2xl border border-dashed border-neutral-200 px-6 py-10 text-center dark:border-neutral-800">
              <p className="text-sm text-neutral-500">Couldn&apos;t load {title.name.en}</p>
              <button
                type="button"
                onClick={onRetry}
                className="mt-4 inline-flex h-9 items-center gap-2 rounded-full border border-neutral-200 bg-white px-4 text-sm font-medium transition hover:bg-neutral-100 dark:border-neutral-800 dark:bg-neutral-900 dark:hover:bg-neutral-800"
              >
                <RotateCw className="size-3.5" strokeWidth={1.75} />
                Try again
              </button>
            </div>
          )}
        </motion.div>
      </AnimatePresence>
    </>
  );
}

function NavButton({
  label,
  disabled,
  onClick,
  children,
}: {
  label: string;
  disabled: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      aria-label={label}
      disabled={disabled}
      onClick={onClick}
      className="flex size-10 items-center justify-center rounded-full border border-neutral-200 bg-white text-neutral-600 transition hover:bg-neutral-100 hover:text-neutral-900 active:scale-95 disabled:pointer-events-none disabled:opacity-35 dark:border-neutral-800 dark:bg-neutral-900 dark:text-neutral-400 dark:hover:bg-neutral-800 dark:hover:text-neutral-100"
    >
      {children}
    </button>
  );
}

function MonthSummary({ totals }: { totals: Totals }) {
  const { income, expense, net } = totals;
  const spentShare = income > 0 ? Math.min(expense / income, 1) : null;

  return (
    <div className="mt-4 rounded-2xl border border-neutral-200 bg-white p-4 dark:border-neutral-800 dark:bg-neutral-900">
      <p className="text-[13px] font-medium text-neutral-500">
        Net <span aria-hidden className="mx-1 text-neutral-300 dark:text-neutral-600">·</span>
        <Ar className="font-normal text-neutral-400">الصافي</Ar>
      </p>
      <p
        className={cn(
          "mt-1 truncate text-[28px] leading-tight font-semibold tracking-[-0.03em] tabular-nums",
          net > 0 && "text-emerald-600 dark:text-emerald-400",
        )}
      >
        {net > 0 && "+"}
        {formatMoney(net)}
      </p>

      <div className="mt-4 grid grid-cols-2 gap-3 border-t border-neutral-100 pt-4 dark:border-neutral-800">
        <Stat label={{ en: "In", ar: "دخل" }} value={income} tone="income" />
        <Stat label={{ en: "Out", ar: "صرفت" }} value={expense} tone="expense" />
      </div>

      {spentShare !== null && (
        <div className="mt-4">
          <div className="h-1.5 overflow-hidden rounded-full bg-emerald-100 dark:bg-emerald-950">
            <div
              className="h-full rounded-full bg-neutral-900 transition-[width] duration-500 ease-out-quint dark:bg-neutral-100"
              style={{ width: `${spentShare * 100}%` }}
            />
          </div>
          <p className="mt-1.5 text-xs text-neutral-500 tabular-nums">
            {expense > income
              ? "Spent more than came in"
              : `Spent ${Math.round(spentShare * 100)}% of what came in`}
          </p>
        </div>
      )}
    </div>
  );
}

function Stat({
  label,
  value,
  tone,
}: {
  label: { en: string; ar: string };
  value: number;
  tone: "income" | "expense";
}) {
  return (
    <div className="min-w-0">
      <p className="text-xs text-neutral-500">
        {label.en} <span aria-hidden className="text-neutral-300 dark:text-neutral-600">·</span>{" "}
        <Ar className="text-neutral-400">{label.ar}</Ar>
      </p>
      <p
        className={cn(
          "mt-0.5 truncate text-base font-semibold tabular-nums sm:text-lg",
          tone === "income" && value > 0 && "text-emerald-600 dark:text-emerald-400",
        )}
        title={formatMoney(value)}
      >
        {value > 0 && (tone === "income" ? "+" : "−")}
        {formatMoney(value)}
      </p>
    </div>
  );
}

function SummarySkeleton() {
  return (
    <div className="mt-4 rounded-2xl border border-neutral-200 bg-white p-4 dark:border-neutral-800 dark:bg-neutral-900">
      <div className="h-3 w-12 rounded bg-neutral-100 dark:bg-neutral-800" />
      <div className="mt-3 h-6 w-36 rounded bg-neutral-100 dark:bg-neutral-800" />
      <div className="mt-5 grid grid-cols-2 gap-3 border-t border-neutral-100 pt-4 dark:border-neutral-800">
        <div className="h-8 rounded bg-neutral-100 dark:bg-neutral-800" />
        <div className="h-8 rounded bg-neutral-100 dark:bg-neutral-800" />
      </div>
    </div>
  );
}
