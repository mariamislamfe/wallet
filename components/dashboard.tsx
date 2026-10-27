"use client";

import { useCallback, useEffect, useMemo, useOptimistic, useState, useTransition } from "react";
import { WalletMinimal } from "lucide-react";

import {
  addTransaction,
  deleteTransaction,
  loadTransactions,
  restoreTransaction,
  saveBudgets,
  setTransactionBudget,
  setWalletBalance,
} from "@/app/actions";
import { Ar } from "@/components/ar";
import { BalanceOverview } from "@/components/balance-overview";
import { MonthView, type MonthStatus } from "@/components/month-view";
import { QuickEntry } from "@/components/quick-entry";
import { Toast, type ToastState } from "@/components/toast";
import { useMounted } from "@/lib/client";
import { applyToBalances, mergeTransactions } from "@/lib/finance";
import { monthOffsetOf, monthRange } from "@/lib/format";
import type {
  ActionResult,
  Balances,
  Budget,
  BudgetInput,
  NewTransaction,
  Transaction,
  WalletType,
} from "@/types/finance";

type FinanceState = { balances: Balances; transactions: Transaction[] };

type OptimisticAction =
  | { kind: "add"; transaction: Transaction }
  | { kind: "remove"; transaction: Transaction }
  | { kind: "replace"; transaction: Transaction }
  | { kind: "set-balance"; wallet: WalletType; balance: number };

function reduce(state: FinanceState, action: OptimisticAction): FinanceState {
  switch (action.kind) {
    case "add":
      if (state.transactions.some((tx) => tx.id === action.transaction.id)) return state;
      return {
        balances: applyToBalances(state.balances, action.transaction, 1),
        transactions: [action.transaction, ...state.transactions],
      };
    case "remove":
      if (!state.transactions.some((tx) => tx.id === action.transaction.id)) return state;
      return {
        balances: applyToBalances(state.balances, action.transaction, -1),
        transactions: state.transactions.filter((tx) => tx.id !== action.transaction.id),
      };
    case "replace":
      return {
        ...state,
        transactions: state.transactions.map((tx) =>
          tx.id === action.transaction.id ? action.transaction : tx,
        ),
      };
    case "set-balance":
      return { ...state, balances: { ...state.balances, [action.wallet]: action.balance } };
  }
}

type Props = {
  initialBalances: Balances;
  initialTransactions: Transaction[];
  /** Everything from this instant on is in `initialTransactions`; older months load on demand. */
  initialLoadedFrom: string;
  firstTransactionAt: string | null;
  initialBudgets: Budget[];
};

export function Dashboard({
  initialBalances,
  initialTransactions,
  initialLoadedFrom,
  firstTransactionAt,
  initialBudgets,
}: Props) {
  // `confirmed` mirrors the database; `view` layers in-flight optimistic changes on top.
  const [confirmed, setConfirmed] = useState<FinanceState>({
    balances: initialBalances,
    transactions: initialTransactions,
  });
  const [view, applyOptimistic] = useOptimistic(confirmed, reduce);
  const [, startTransition] = useTransition();
  const [toast, setToast] = useState<ToastState | null>(null);

  const [budgets, setBudgets] = useState(initialBudgets);
  const mounted = useMounted();
  const [monthOffset, setMonthOffset] = useState(0);
  const [loadedFrom, setLoadedFrom] = useState(() => Date.parse(initialLoadedFrom));
  const [loadFailed, setLoadFailed] = useState(false);
  const [retryCount, setRetryCount] = useState(0);

  // Before mount the month boundaries are unknown (timezone), so nothing is fetched.
  const monthStart = mounted ? monthRange(monthOffset).start.getTime() : Number.POSITIVE_INFINITY;
  const monthLoaded = monthStart >= loadedFrom;
  const monthStatus: MonthStatus = monthLoaded ? "ready" : loadFailed ? "error" : "loading";

  const oldestOffset = useMemo(() => {
    if (!mounted) return 0;
    const oldest = confirmed.transactions.reduce(
      (min, tx) => Math.min(min, Date.parse(tx.created_at)),
      firstTransactionAt ? Date.parse(firstTransactionAt) : Date.now(),
    );
    return Math.max(0, monthOffsetOf(new Date(oldest)));
  }, [mounted, confirmed.transactions, firstTransactionAt]);

  const pendingIds = useMemo(() => {
    const known = new Set(confirmed.transactions.map((tx) => tx.id));
    return new Set(view.transactions.filter((tx) => !known.has(tx.id)).map((tx) => tx.id));
  }, [confirmed.transactions, view.transactions]);

  const showToast = useCallback((next: Omit<ToastState, "id">) => {
    setToast({ ...next, id: Date.now() });
  }, []);

  const dismissToast = useCallback(() => setToast(null), []);

  useEffect(() => {
    if (monthLoaded) return;
    let active = true;
    setLoadFailed(false);

    // Fetch the gap between this month and what is already cached, keeping the cache contiguous.
    loadTransactions(new Date(monthStart).toISOString(), new Date(loadedFrom).toISOString())
      .catch(() => ({ ok: false as const, error: "You're offline. Try again." }))
      .then((result) => {
        if (!result.ok) {
          if (active) setLoadFailed(true);
          return;
        }
        setConfirmed((prev) => ({ ...prev, transactions: mergeTransactions(prev.transactions, result.data) }));
        setLoadedFrom((prev) => Math.min(prev, monthStart));
      });

    return () => {
      active = false;
    };
  }, [monthLoaded, monthStart, loadedFrom, retryCount]);

  const changeMonth = useCallback((offset: number) => {
    setLoadFailed(false);
    setMonthOffset(offset);
  }, []);

  const mutate = useCallback(
    <T,>(
      optimistic: OptimisticAction,
      request: () => Promise<ActionResult<T>>,
      reconcile: (data: T, prev: FinanceState) => FinanceState,
      onSuccess?: () => void,
    ) => {
      startTransition(async () => {
        applyOptimistic(optimistic);

        let result: ActionResult<T>;
        try {
          result = await request();
        } catch {
          result = { ok: false, error: "You're offline. Try again." };
        }

        if (!result.ok) {
          showToast({ message: result.error, tone: "error" });
          return;
        }

        const { data } = result;
        startTransition(() => setConfirmed((prev) => reconcile(data, prev)));
        onSuccess?.();
      });
    },
    [applyOptimistic, showToast],
  );

  const handleAdd = useCallback(
    (input: NewTransaction) => {
      const transaction: Transaction = { ...input, source: "manual", created_at: new Date().toISOString() };
      setMonthOffset(0);
      mutate(
        { kind: "add", transaction },
        () => addTransaction(input),
        (data, prev) => ({
          balances: data.balances,
          transactions: [data.transaction, ...prev.transactions],
        }),
      );
    },
    [mutate],
  );

  const handleDelete = useCallback(
    (transaction: Transaction) => {
      mutate(
        { kind: "remove", transaction },
        () => deleteTransaction(transaction.id),
        (data, prev) => ({
          balances: data.balances,
          transactions: prev.transactions.filter((tx) => tx.id !== transaction.id),
        }),
        () => showToast({ message: "Deleted", tone: "neutral", undo: transaction }),
      );
    },
    [mutate, showToast],
  );

  const handleRestore = useCallback(
    (transaction: Transaction) => {
      setToast(null);
      mutate(
        { kind: "add", transaction },
        () => restoreTransaction(transaction),
        (data, prev) => ({
          balances: data.balances,
          transactions: prev.transactions.some((tx) => tx.id === data.transaction.id)
            ? prev.transactions
            : [data.transaction, ...prev.transactions],
        }),
      );
    },
    [mutate],
  );

  const handleSetBudget = useCallback(
    (transaction: Transaction, budgetId: string | null) => {
      if (transaction.budget_id === budgetId) return;
      mutate(
        { kind: "replace", transaction: { ...transaction, budget_id: budgetId } },
        () => setTransactionBudget(transaction.id, budgetId),
        (updated, prev) => ({
          ...prev,
          transactions: prev.transactions.map((tx) => (tx.id === updated.id ? updated : tx)),
        }),
      );
    },
    [mutate],
  );

  /** Resolves to an error message, or null once the plan is saved. */
  const handleSaveBudgets = useCallback(async (lines: BudgetInput[]): Promise<string | null> => {
    let result: ActionResult<Budget[]>;
    try {
      result = await saveBudgets(lines);
    } catch {
      return "You're offline. Try again.";
    }
    if (!result.ok) return result.error;

    const kept = new Set(result.data.map((b) => b.id));
    setBudgets(result.data);
    // Deleted lines untag their expenses in the database; mirror that locally.
    setConfirmed((prev) => ({
      ...prev,
      transactions: prev.transactions.map((tx) =>
        tx.budget_id && !kept.has(tx.budget_id) ? { ...tx, budget_id: null } : tx,
      ),
    }));
    return null;
  }, []);

  const handleSetBalance = useCallback(
    (wallet: WalletType, balance: number) => {
      mutate(
        { kind: "set-balance", wallet, balance },
        () => setWalletBalance(wallet, balance),
        (data, prev) => ({ ...prev, balances: data.balances }),
      );
    },
    [mutate],
  );

  const isFresh =
    view.transactions.length === 0 && view.balances.cash === 0 && view.balances.visa === 0;

  return (
    <>
      <main className="mx-auto w-full max-w-xl px-4 pt-[calc(env(safe-area-inset-top)+1.5rem)] pb-[calc(env(safe-area-inset-bottom)+6rem)] sm:pt-14">
        <header className="mb-10 flex items-center gap-2.5">
          <span className="flex size-7 items-center justify-center rounded-lg bg-neutral-900 text-white dark:bg-white dark:text-neutral-900">
            <WalletMinimal className="size-3.5" strokeWidth={1.75} />
          </span>
          <span className="text-[15px] font-semibold tracking-tight">Wallet</span>
          <Ar className="text-sm text-neutral-400">محفظتي</Ar>
        </header>

        <BalanceOverview
          balances={view.balances}
          showSetupHint={isFresh}
          onSetBalance={handleSetBalance}
        />

        <QuickEntry
          balances={view.balances}
          transactions={view.transactions}
          budgets={budgets}
          onSubmit={handleAdd}
        />

        <MonthView
          offset={monthOffset}
          maxOffset={oldestOffset}
          status={monthStatus}
          transactions={view.transactions}
          budgets={budgets}
          pendingIds={pendingIds}
          onOffsetChange={changeMonth}
          onSaveBudgets={handleSaveBudgets}
          onSetBudget={handleSetBudget}
          onRetry={() => setRetryCount((count) => count + 1)}
          onDelete={handleDelete}
        />
      </main>

      <Toast toast={toast} onDismiss={dismissToast} onUndo={handleRestore} />
    </>
  );
}
