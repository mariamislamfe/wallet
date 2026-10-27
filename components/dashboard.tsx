"use client";

import { useCallback, useEffect, useMemo, useOptimistic, useState, useTransition } from "react";
import { AnimatePresence, motion, useReducedMotion, type Variants } from "framer-motion";
import { WalletMinimal } from "lucide-react";

import {
  addTransaction,
  deleteTransaction,
  loadTransactions,
  restoreTransaction,
  saveBudgets,
  saveProjects,
  setIncomeInPlan,
  setTransactionBudget,
  setTransactionProject,
  setWalletBalance,
} from "@/app/actions";
import { Ar } from "@/components/ar";
import { ActivityFeed, FeedSkeleton } from "@/components/activity-feed";
import { BalanceOverview } from "@/components/balance-overview";
import { BillsCard, BudgetPlan } from "@/components/budget-plan";
import {
  EmptyState,
  MonthPage,
  MonthSummary,
  SummarySkeleton,
  type MonthStatus,
} from "@/components/month-view";
import { PendingIncome } from "@/components/pending-income";
import { ProjectsCard } from "@/components/projects";
import { QuickEntry } from "@/components/quick-entry";
import { TABS, TabBar, type Tab } from "@/components/tab-bar";
import { Toast, type ToastState } from "@/components/toast";
import { useMounted } from "@/lib/client";
import {
  applyToBalances,
  isPlanRow,
  isUndecidedIncome,
  mergeTransactions,
  planFor,
  projectTotals,
  splitOf,
  totalsFor,
  type PlanRow,
} from "@/lib/finance";
import { formatMoney, monthOffsetOf, monthRange } from "@/lib/format";
import type {
  ActionResult,
  Balances,
  Budget,
  BudgetInput,
  Project,
  ProjectInput,
  NewTransaction,
  Transaction,
  WalletType,
} from "@/types/finance";

type FinanceState = { balances: Balances; transactions: Transaction[] };

/** Rows shown under "Recent" on Home. */
const RECENT_COUNT = 5;
const POCKETS_DOT: ReadonlySet<Tab> = new Set(["pockets"]);

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
  /** Split income and pocket spending from before `initialLoadedFrom`. */
  planHistory: PlanRow[];
  initialProjects: Project[];
};

export function Dashboard({
  initialBalances,
  initialTransactions,
  initialLoadedFrom,
  firstTransactionAt,
  initialBudgets,
  planHistory,
  initialProjects,
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
  const [projects, setProjects] = useState(initialProjects);
  const mounted = useMounted();
  const [monthOffset, setMonthOffset] = useState(0);
  const [loadedFrom, setLoadedFrom] = useState(() => Date.parse(initialLoadedFrom));
  const [loadFailed, setLoadFailed] = useState(false);
  const [retryCount, setRetryCount] = useState(0);
  const [tab, setTab] = useState<Tab>("home");
  // -1 / 1: which way the page slides when switching tabs (by their order in the bar).
  const [pageDirection, setPageDirection] = useState(0);
  const reduceMotion = useReducedMotion();

  // The open tab lives in the URL hash so a reload or the back button keeps it.
  useEffect(() => {
    const fromHash = () => {
      const hash = window.location.hash.slice(1);
      setPageDirection(0);
      setTab((TABS as readonly string[]).includes(hash) ? (hash as Tab) : "home");
    };
    fromHash();
    window.addEventListener("hashchange", fromHash);
    return () => window.removeEventListener("hashchange", fromHash);
  }, []);

  const openTab = useCallback((next: Tab) => {
    setTab((current) => {
      setPageDirection(Math.sign(TABS.indexOf(next) - TABS.indexOf(current)));
      return next;
    });
    const url = next === "home" ? window.location.pathname + window.location.search : `#${next}`;
    window.history.replaceState(null, "", url);
    window.scrollTo({ top: 0 });
  }, []);

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
      const transaction: Transaction = { ...input, source: "manual", in_plan: null, created_at: new Date().toISOString() };
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

  const handleSetInPlan = useCallback(
    (transaction: Transaction, inPlan: boolean | null) => {
      if (transaction.in_plan === inPlan) return;
      const split = inPlan ? splitOf(budgets, transaction.amount) : [];
      mutate(
        { kind: "replace", transaction: { ...transaction, in_plan: inPlan } },
        () => setIncomeInPlan(transaction.id, inPlan),
        (updated, prev) => ({
          ...prev,
          transactions: prev.transactions.map((tx) => (tx.id === updated.id ? updated : tx)),
        }),
        split.length > 0
          ? () =>
              showToast({
                message: split.map((part) => `${part.name} ${formatMoney(part.amount)}`).join(" · "),
                tone: "neutral",
              })
          : undefined,
      );
    },
    [budgets, mutate, showToast],
  );

  const handleSetProject = useCallback(
    (transaction: Transaction, projectId: string | null) => {
      if (transaction.project_id === projectId) return;
      mutate(
        { kind: "replace", transaction: { ...transaction, project_id: projectId } },
        () => setTransactionProject(transaction.id, projectId),
        (updated, prev) => ({
          ...prev,
          transactions: prev.transactions.map((tx) => (tx.id === updated.id ? updated : tx)),
        }),
      );
    },
    [mutate],
  );

  /** Resolves to an error message, or null once the projects are saved. */
  const handleSaveProjects = useCallback(async (list: ProjectInput[]): Promise<string | null> => {
    let result: ActionResult<Project[]>;
    try {
      result = await saveProjects(list);
    } catch {
      return "You're offline. Try again.";
    }
    if (!result.ok) return result.error;

    const kept = new Set(result.data.map((p) => p.id));
    setProjects(result.data);
    // Deleted projects untag their rows in the database; mirror that locally.
    setConfirmed((prev) => ({
      ...prev,
      transactions: prev.transactions.map((tx) =>
        tx.project_id && !kept.has(tx.project_id) ? { ...tx, project_id: null } : tx,
      ),
    }));
    return null;
  }, []);

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
  const balance = view.balances.cash + view.balances.visa;

  // Month slices need the viewer's timezone, so they exist only after mount.
  const months = useMemo(() => {
    if (!mounted) return null;
    // Loaded rows win over the server's snapshot of older pocket/project rows.
    const byId = new Map<string, PlanRow>();
    for (const row of [...planHistory, ...view.transactions]) byId.set(row.id, row);
    const known = [...byId.values()];

    const slice = (offset: number) => {
      const { start, end } = monthRange(offset);
      const from = start.getTime();
      const to = end.getTime();
      return {
        rows: view.transactions.filter((tx) => {
          const at = Date.parse(tx.created_at);
          return at >= from && at < to;
        }),
        history: known.filter((row) => Date.parse(row.created_at) < from && isPlanRow(row)),
      };
    };
    const current = slice(0);
    return {
      current,
      selected: monthOffset === 0 ? current : slice(monthOffset),
      projectRows: known.filter((row) => row.project_id !== null),
    };
  }, [mounted, planHistory, view.transactions, monthOffset]);

  const currentPlan = months ? planFor(budgets, months.current.rows, months.current.history) : null;
  const undecided = view.transactions.filter(isUndecidedIncome);

  const feedProps = {
    budgets,
    projects,
    pendingIds,
    onDelete: handleDelete,
    onSetBudget: handleSetBudget,
    onSetInPlan: handleSetInPlan,
    onSetProject: handleSetProject,
  };
  const slide = reduceMotion ? 0 : 24;
  const pageVariants: Variants = {
    enter: (direction: number) => ({ opacity: 0, x: direction * slide }),
    center: { opacity: 1, x: 0, transition: { duration: 0.24, ease: [0.22, 1, 0.36, 1] } },
    exit: (direction: number) => ({ opacity: 0, x: direction * -slide, transition: { duration: 0.12, ease: "easeIn" } }),
  };

  const monthPageProps = {
    offset: monthOffset,
    maxOffset: oldestOffset,
    status: monthStatus,
    onOffsetChange: changeMonth,
    onRetry: () => setRetryCount((count) => count + 1),
  };

  return (
    <>
      <main className="mx-auto w-full max-w-xl px-4 pt-[calc(env(safe-area-inset-top)+1.5rem)] pb-[calc(env(safe-area-inset-bottom)+7rem)] sm:pt-14">
        <header className="mb-8 flex items-center gap-2.5">
          <span className="flex size-7 items-center justify-center rounded-lg bg-neutral-900 text-white dark:bg-white dark:text-neutral-900">
            <WalletMinimal className="size-3.5" strokeWidth={1.75} />
          </span>
          <span className="text-[15px] font-semibold tracking-tight">Wallet</span>
          <Ar className="text-sm text-neutral-400">محفظتي</Ar>
        </header>

        <AnimatePresence mode="wait" initial={false} custom={pageDirection}>
          <motion.div
            key={tab}
            custom={pageDirection}
            variants={pageVariants}
            initial="enter"
            animate="center"
            exit="exit"
          >
            {tab === "home" && (
              <>
                <BalanceOverview
                  balances={view.balances}
                  reserved={currentPlan?.reserved ?? null}
                  showSetupHint={isFresh}
                  onSetBalance={handleSetBalance}
                />

                <QuickEntry
                  balances={view.balances}
                  transactions={view.transactions}
                  budgets={budgets}
                  projects={projects}
                  onSubmit={handleAdd}
                />

                {budgets.length > 0 && (
                  <PendingIncome
                    transactions={undecided}
                    budgets={budgets}
                    pendingIds={pendingIds}
                    onDecide={handleSetInPlan}
                  />
                )}

                {currentPlan && <BillsCard plan={currentPlan} balance={balance} onOpen={() => openTab("pockets")} />}

                <section aria-labelledby="recent-heading" className="mt-10">
                  <div className="mb-2 flex items-center justify-between gap-3 px-1">
                    <h2 id="recent-heading" className="text-[13px] font-medium text-neutral-500">
                      Recent <span aria-hidden className="mx-1 text-neutral-300 dark:text-neutral-600">·</span>
                      <Ar className="font-normal text-neutral-400">آخر الحركات</Ar>
                    </h2>
                    {view.transactions.length > RECENT_COUNT && (
                      <button
                        type="button"
                        onClick={() => {
                          changeMonth(0);
                          openTab("activity");
                        }}
                        className="-me-2 h-8 rounded-full px-3 text-[13px] font-medium text-neutral-600 transition hover:bg-neutral-100 hover:text-neutral-900 dark:text-neutral-400 dark:hover:bg-neutral-800 dark:hover:text-neutral-100"
                      >
                        See all
                      </button>
                    )}
                  </div>
                  {!mounted ? (
                    <FeedSkeleton />
                  ) : view.transactions.length === 0 ? (
                    <EmptyState en="Nothing logged yet" ar="لسه مفيش حركات" />
                  ) : (
                    <ActivityFeed transactions={view.transactions.slice(0, RECENT_COUNT)} {...feedProps} />
                  )}
                </section>
              </>
            )}

            {tab === "activity" && (
              <MonthPage
                {...monthPageProps}
                skeleton={
                  <>
                    <SummarySkeleton />
                    <div className="mt-8">
                      <FeedSkeleton />
                    </div>
                  </>
                }
              >
                {months && (
                  <>
                    <MonthSummary totals={totalsFor(months.selected.rows)} />
                    <div className="mt-8">
                      {months.selected.rows.length === 0 ? (
                        <EmptyState
                          en={monthOffset === 0 ? "Nothing logged this month yet" : "Nothing logged this month"}
                          ar="مفيش حركات في الشهر ده"
                        />
                      ) : (
                        <ActivityFeed transactions={months.selected.rows} {...feedProps} />
                      )}
                    </div>
                  </>
                )}
              </MonthPage>
            )}

            {tab === "pockets" && (
              <section aria-label="Pockets">
                {budgets.length > 0 && (
                  <PendingIncome
                    transactions={undecided}
                    budgets={budgets}
                    pendingIds={pendingIds}
                    onDecide={handleSetInPlan}
                  />
                )}
                {currentPlan ? (
                  <BudgetPlan plan={currentPlan} budgets={budgets} balance={balance} onSave={handleSaveBudgets} />
                ) : (
                  <SummarySkeleton />
                )}
              </section>
            )}

            {tab === "projects" && (
              <MonthPage {...monthPageProps} skeleton={<SummarySkeleton />}>
                {months && (
                  <ProjectsCard
                    totals={projectTotals(projects, months.selected.rows, months.projectRows)}
                    projects={projects}
                    onSave={handleSaveProjects}
                  />
                )}
              </MonthPage>
            )}
          </motion.div>
        </AnimatePresence>
      </main>

      <TabBar tab={tab} onChange={openTab} dots={undecided.length > 0 && budgets.length > 0 ? POCKETS_DOT : undefined} />
      <Toast toast={toast} onDismiss={dismissToast} onUndo={handleRestore} />
    </>
  );
}
