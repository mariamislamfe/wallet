import { Dashboard } from "@/components/dashboard";
import {
  fetchBalances,
  fetchBudgets,
  fetchFirstTransactionAt,
  fetchTransactions,
  initialWindowStart,
} from "@/lib/data";

export const dynamic = "force-dynamic";

export default async function HomePage() {
  const loadedFrom = initialWindowStart();
  const [balances, transactions, firstTransactionAt, budgets] = await Promise.all([
    fetchBalances(),
    fetchTransactions(loadedFrom),
    fetchFirstTransactionAt(),
    fetchBudgets(),
  ]);

  return (
    <Dashboard
      initialBalances={balances}
      initialTransactions={transactions}
      initialLoadedFrom={loadedFrom.toISOString()}
      firstTransactionAt={firstTransactionAt}
      initialBudgets={budgets}
    />
  );
}
