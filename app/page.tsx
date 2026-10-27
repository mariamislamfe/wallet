import { Dashboard } from "@/components/dashboard";
import {
  fetchBalances,
  fetchBudgets,
  fetchFirstTransactionAt,
  fetchPlanHistory,
  fetchTransactions,
  initialWindowStart,
} from "@/lib/data";

export const dynamic = "force-dynamic";

export default async function HomePage() {
  const loadedFrom = initialWindowStart();
  const [balances, transactions, firstTransactionAt, budgets, planHistory] = await Promise.all([
    fetchBalances(),
    fetchTransactions(loadedFrom),
    fetchFirstTransactionAt(),
    fetchBudgets(),
    fetchPlanHistory(loadedFrom),
  ]);

  return (
    <Dashboard
      initialBalances={balances}
      initialTransactions={transactions}
      initialLoadedFrom={loadedFrom.toISOString()}
      firstTransactionAt={firstTransactionAt}
      initialBudgets={budgets}
      planHistory={planHistory}
    />
  );
}
