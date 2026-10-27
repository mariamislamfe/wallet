import "server-only";

import type { Db } from "@/lib/supabase";
import { EMPTY_BALANCES } from "@/lib/finance";
import type { PlanRow } from "@/lib/finance";
import type { Balances, Budget, Project, Transaction, Wallet } from "@/types/finance";

export const TRANSACTION_COLUMNS = "id, amount, type, wallet_type, description, budget_id, source, in_plan, project_id, created_at";
export const BUDGET_COLUMNS = "id, name, kind, value, position, due_day";
export const PROJECT_COLUMNS = "id, name, position";

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

export async function fetchBalances({ client, userId }: Db): Promise<Balances> {
  const { data, error } = await client.from("wallets").select("type, balance").eq("user_id", userId);
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
export async function fetchTransactions({ client, userId }: Db, from: Date, to?: Date): Promise<Transaction[]> {
  let query = client
    .from("transactions")
    .select(TRANSACTION_COLUMNS)
    .eq("user_id", userId)
    .gte("created_at", from.toISOString());
  if (to) query = query.lt("created_at", to.toISOString());

  const { data, error } = await query.order("created_at", { ascending: false });
  if (error) throw new Error(error.message);
  return data.map(normalizeTransaction);
}

/**
 * Rows from before `before` that still count today: split income and pocket
 * spending (what % pockets carry forward) and anything tagged with a project.
 */
export async function fetchPlanHistory({ client, userId }: Db, before: Date): Promise<PlanRow[]> {
  const { data, error } = await client
    .from("transactions")
    .select("id, amount, type, budget_id, in_plan, project_id, created_at")
    .eq("user_id", userId)
    .lt("created_at", before.toISOString())
    .or("in_plan.is.true,budget_id.not.is.null,project_id.not.is.null");
  if (error) throw new Error(error.message);
  return data.map((row) => ({ ...row, amount: Number(row.amount) }));
}

/** When the very first transaction was logged — bounds how far back the month picker goes. */
export async function fetchFirstTransactionAt({ client, userId }: Db): Promise<string | null> {
  const { data, error } = await client
    .from("transactions")
    .select("created_at")
    .eq("user_id", userId)
    .order("created_at", { ascending: true })
    .limit(1)
    .maybeSingle();
  if (error) throw new Error(error.message);
  return data?.created_at ?? null;
}

export async function fetchBudgets({ client, userId }: Db): Promise<Budget[]> {
  const { data, error } = await client
    .from("budgets")
    .select(BUDGET_COLUMNS)
    .eq("user_id", userId)
    .order("position")
    .order("created_at");
  if (error) throw new Error(error.message);
  return data.map(normalizeBudget);
}

export async function fetchProjects({ client, userId }: Db): Promise<Project[]> {
  const { data, error } = await client
    .from("projects")
    .select(PROJECT_COLUMNS)
    .eq("user_id", userId)
    .order("position")
    .order("created_at");
  if (error) throw new Error(error.message);
  return data;
}

export async function hasSmsToken({ client, userId }: Db): Promise<boolean> {
  const { count, error } = await client
    .from("sms_tokens")
    .select("user_id", { count: "exact", head: true })
    .eq("user_id", userId);
  if (error) throw new Error(error.message);
  return (count ?? 0) > 0;
}
