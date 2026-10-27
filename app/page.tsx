import { Dashboard } from "@/components/dashboard";
import {
  fetchBalances,
  fetchBudgets,
  fetchFirstTransactionAt,
  fetchPlanHistory,
  fetchProjects,
  fetchTransactions,
  hasSmsToken,
  initialWindowStart,
} from "@/lib/data";
import { requireSession } from "@/lib/session";

export const dynamic = "force-dynamic";

export default async function HomePage() {
  const session = await requireSession();
  const loadedFrom = initialWindowStart();
  const [balances, transactions, firstTransactionAt, budgets, planHistory, projects, smsConnected] =
    await Promise.all([
      fetchBalances(session),
      fetchTransactions(session, loadedFrom),
      fetchFirstTransactionAt(session),
      fetchBudgets(session),
      fetchPlanHistory(session, loadedFrom),
      fetchProjects(session),
      hasSmsToken(session),
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
      account={{ email: session.email, smsConnected }}
    />
  );
}
