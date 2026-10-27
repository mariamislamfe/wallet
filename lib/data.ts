import "server-only";

import { getSupabase } from "@/lib/supabase";
import { EMPTY_BALANCES } from "@/lib/finance";
import type { PlanRow } from "@/lib/finance";
import type { Balances, Budget, Transaction, Wallet } from "@/types/finance";

export const TRANSACTION_COLUMNS = "id, amount, type, wallet_type, description, budget_id, source, in_plan, created_at";
export const BUDGET_COLUMNS = "id, name, kind, value, position, due_day";

// PostgREST may serialise `numeric` as strings depending on precision; coerce defensively.
export function normalizeTransaction(row: Transaction): Transaction {
  return { ...row, amount: Number(row.amount), description: row.description ?? "" };
}

export function normalizeBudget(row: Budget): Budget {
  return { ...row, value: Number(row.value), due_day: row.due_day ?? null };
}

function toBalances(rows: Pick<Wallet, "type" | "balance">[]): Balances {
  const balances: Balances = { ...EMPTY_BALANCES };
  for (const row of rows) balances[row.type] = Number(row.balance);
  return balances;
}

export async function fetchBalances(): Promise<Balances> {
  const { data, error } = await getSupabase().from("wallets").select("type, balance");
  if (error) throw new Error(error.message);
  return toBalances(data);
}

/**
 * Start of the window loaded with the page: the first of last month in UTC,
 * pulled back by the widest timezone offset (UTC+14) so it covers this month
 * and last month for almost any viewer. Older months are fetched on demand.
 */
export function initialWindowStart(now = new Date()): Date {
  return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - 1, 1) - 14 * 3_600_000);
}

/** Transactions with `from <= created_at < to` (no upper bound when `to` is omitted), newest first. */
export async function fetchTransactions(from: Date, to?: Date): Promise<Transaction[]> {
  let query = getSupabase()
    .from("transactions")
    .select(TRANSACTION_COLUMNS)
    .gte("created_at", from.toISOString());
  if (to) query = query.lt("created_at", to.toISOString());

  const { data, error } = await query.order("created_at", { ascending: false });
  if (error) throw new Error(error.message);
  return data.map(normalizeTransaction);
}

/** Split income and pocket spending from before `before`: what % pockets carry into it. */
export async function fetchPlanHistory(before: Date): Promise<PlanRow[]> {
  const { data, error } = await getSupabase()
    .from("transactions")
    .select("id, amount, type, budget_id, in_plan, created_at")
    .lt("created_at", before.toISOString())
    .or("in_plan.is.true,budget_id.not.is.null");
  if (error) throw new Error(error.message);
  return data.map((row) => ({ ...row, amount: Number(row.amount) }));
}

/** When the very first transaction was logged — bounds how far back the month picker goes. */
export async function fetchFirstTransactionAt(): Promise<string | null> {
  const { data, error } = await getSupabase()
    .from("transactions")
    .select("created_at")
    .order("created_at", { ascending: true })
    .limit(1)
    .maybeSingle();
  if (error) throw new Error(error.message);
  return data?.created_at ?? null;
}

export async function fetchBudgets(): Promise<Budget[]> {
  const { data, error } = await getSupabase()
    .from("budgets")
    .select(BUDGET_COLUMNS)
    .order("position")
    .order("created_at");
  if (error) throw new Error(error.message);
  return data.map(normalizeBudget);
}
