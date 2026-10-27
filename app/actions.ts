"use server";

import { cookies } from "next/headers";

import { SESSION_COOKIE, isValidSession } from "@/lib/auth";
import {
  TRANSACTION_COLUMNS,
  fetchBalances,
  fetchBudgets,
  fetchTransactions,
  normalizeTransaction,
} from "@/lib/data";
import { round2 } from "@/lib/finance";
import { getSupabase } from "@/lib/supabase";
import {
  BUDGET_KINDS,
  TRANSACTION_TYPES,
  WALLET_TYPES,
  type ActionResult,
  type BalanceMutation,
  type Budget,
  type BudgetInput,
  type NewTransaction,
  type Transaction,
  type TransactionMutation,
  type WalletType,
} from "@/types/finance";

const MAX_AMOUNT = 1_000_000_000;
const MAX_BUDGETS = 30;
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

class ValidationError extends Error {}

async function authorize(): Promise<void> {
  const store = await cookies();
  if (!(await isValidSession(store.get(SESSION_COOKIE)?.value))) {
    throw new ValidationError("Session expired. Reload and enter your passcode.");
  }
}

function fail(error: unknown): { ok: false; error: string } {
  if (error instanceof ValidationError) return { ok: false, error: error.message };
  console.error("[wallet] action failed:", error);
  return { ok: false, error: "Couldn't reach the database. Try again." };
}

function validateWallet(value: unknown): WalletType {
  if (typeof value !== "string" || !(WALLET_TYPES as readonly string[]).includes(value)) {
    throw new ValidationError("Pick Cash or Visa.");
  }
  return value as WalletType;
}

function validateAmount(value: unknown, { allowZeroOrNegative = false } = {}): number {
  const amount = typeof value === "number" ? round2(value) : Number.NaN;
  if (!Number.isFinite(amount) || Math.abs(amount) > MAX_AMOUNT) {
    throw new ValidationError("Enter a valid amount.");
  }
  if (!allowZeroOrNegative && amount <= 0) throw new ValidationError("Amount must be above zero.");
  return amount;
}

function validateId(value: unknown): string {
  if (typeof value !== "string" || !UUID.test(value)) throw new ValidationError("Unknown transaction.");
  return value;
}

function validateBudgetId(value: unknown): string | null {
  if (value === null || value === undefined) return null;
  if (typeof value !== "string" || !UUID.test(value)) throw new ValidationError("Unknown budget.");
  return value;
}

function validateNewTransaction(input: NewTransaction): NewTransaction {
  if (!(TRANSACTION_TYPES as readonly string[]).includes(input?.type)) {
    throw new ValidationError("Pick Expense or Income.");
  }
  return {
    id: validateId(input.id),
    type: input.type,
    amount: validateAmount(input.amount),
    wallet_type: validateWallet(input.wallet_type),
    description: typeof input.description === "string" ? input.description.trim().slice(0, 120) : "",
    // Only spending counts against a budget line.
    budget_id: input.type === "expense" ? validateBudgetId(input.budget_id) : null,
  };
}

function validateBudgets(input: BudgetInput[]): BudgetInput[] {
  if (!Array.isArray(input) || input.length > MAX_BUDGETS) throw new ValidationError("Too many budget lines.");
  return input.map((line) => {
    const name = typeof line?.name === "string" ? line.name.trim().slice(0, 40) : "";
    if (!name) throw new ValidationError("Every budget line needs a name.");
    if (!(BUDGET_KINDS as readonly string[]).includes(line.kind)) throw new ValidationError("Pick % or EGP.");
    const value = validateAmount(line.value);
    if (line.kind === "percent" && value > 100) throw new ValidationError(`${name}: a share can't pass 100%.`);
    return { id: validateId(line.id), name, kind: line.kind, value };
  });
}

export async function addTransaction(
  input: NewTransaction,
): Promise<ActionResult<TransactionMutation>> {
  try {
    await authorize();
    const values = validateNewTransaction(input);

    const { data, error } = await getSupabase()
      .from("transactions")
      .insert(values)
      .select(TRANSACTION_COLUMNS)
      .single();
    if (error) throw error;

    return { ok: true, data: { transaction: normalizeTransaction(data), balances: await fetchBalances() } };
  } catch (error) {
    return fail(error);
  }
}

export async function deleteTransaction(id: string): Promise<ActionResult<BalanceMutation>> {
  try {
    await authorize();
    const { error } = await getSupabase().from("transactions").delete().eq("id", validateId(id));
    if (error) throw error;

    return { ok: true, data: { balances: await fetchBalances() } };
  } catch (error) {
    return fail(error);
  }
}

/** Re-inserts a deleted transaction with its original id and timestamp (undo). */
export async function restoreTransaction(
  tx: Transaction,
): Promise<ActionResult<TransactionMutation>> {
  try {
    await authorize();
    const createdAt = new Date(tx.created_at);
    if (Number.isNaN(createdAt.getTime())) throw new ValidationError("Invalid date.");

    const { data, error } = await getSupabase()
      .from("transactions")
      .upsert(
        {
          ...validateNewTransaction(tx),
          source: tx.source === "sms" ? "sms" : "manual",
          created_at: createdAt.toISOString(),
        },
        { onConflict: "id", ignoreDuplicates: true },
      )
      .select(TRANSACTION_COLUMNS)
      .maybeSingle();
    if (error) throw error;

    return {
      ok: true,
      data: { transaction: data ? normalizeTransaction(data) : tx, balances: await fetchBalances() },
    };
  } catch (error) {
    return fail(error);
  }
}

/** Tags (or untags) an expense with a budget line. */
export async function setTransactionBudget(
  id: string,
  budgetId: string | null,
): Promise<ActionResult<Transaction>> {
  try {
    await authorize();
    const { data, error } = await getSupabase()
      .from("transactions")
      .update({ budget_id: validateBudgetId(budgetId) })
      .eq("id", validateId(id))
      .eq("type", "expense")
      .select(TRANSACTION_COLUMNS)
      .single();
    if (error) throw error;

    return { ok: true, data: normalizeTransaction(data) };
  } catch (error) {
    return fail(error);
  }
}

/**
 * Replaces the whole plan with `input`, in order. Lines left out are deleted
 * and their expenses become untagged (`on delete set null`).
 */
export async function saveBudgets(input: BudgetInput[]): Promise<ActionResult<Budget[]>> {
  try {
    await authorize();
    const lines = validateBudgets(input);
    const supabase = getSupabase();

    const keep = lines.map((line) => line.id);
    const removal = supabase.from("budgets").delete();
    const { error: deleteError } = await (keep.length
      ? removal.not("id", "in", `(${keep.join(",")})`)
      : removal.not("id", "is", null));
    if (deleteError) throw deleteError;

    if (lines.length > 0) {
      const { error } = await supabase
        .from("budgets")
        .upsert(lines.map((line, position) => ({ ...line, position })), { onConflict: "id" });
      if (error) throw error;
    }

    return { ok: true, data: await fetchBudgets() };
  } catch (error) {
    return fail(error);
  }
}

/** Fetches an older slice of history when the user pages back to a month not loaded yet. */
export async function loadTransactions(from: string, to: string): Promise<ActionResult<Transaction[]>> {
  try {
    await authorize();
    const start = new Date(from);
    const end = new Date(to);
    if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime()) || start >= end) {
      throw new ValidationError("Invalid date range.");
    }

    return { ok: true, data: await fetchTransactions(start, end) };
  } catch (error) {
    return fail(error);
  }
}

export async function setWalletBalance(
  wallet: WalletType,
  balance: number,
): Promise<ActionResult<BalanceMutation>> {
  try {
    await authorize();
    const type = validateWallet(wallet);
    const value = validateAmount(balance, { allowZeroOrNegative: true });

    const { error } = await getSupabase()
      .from("wallets")
      .upsert({ type, balance: value, updated_at: new Date().toISOString() }, { onConflict: "type" });
    if (error) throw error;

    return { ok: true, data: { balances: await fetchBalances() } };
  } catch (error) {
    return fail(error);
  }
}
