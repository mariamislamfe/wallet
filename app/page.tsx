import { Dashboard } from "@/components/dashboard";
import {
  fetchBalances,
  fetchBudgets,
  fetchFirstTransactionAt,
  fetchPlanHistory,
  fetchProjects,
  fetchTransactions,
  initialWindowStart,
} from "@/lib/data";

export const dynamic = "force-dynamic";

export default async function HomePage() {
  const loadedFrom = initialWindowStart();
  const [balances, transactions, firstTransactionAt, budgets, planHistory, projects] = await Promise.all([
    fetchBalances(),
    fetchTransactions(loadedFrom),
    fetchFirstTransactionAt(),
    fetchBudgets(),
    fetchPlanHistory(loadedFrom),
    fetchProjects(),
  ]);

  return (
    <Dashboard
      initialBalances={balances}
      initialTransactions={transactions}
      initialLoadedFrom={loadedFrom.toISOString()}
      firstTransactionAt={firstTransactionAt}
      initialBudgets={budgets}
      planHistory={planHistory}
      initialProjects={projects}
    />
  );
}
