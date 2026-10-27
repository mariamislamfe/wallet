"use server";

import { createHash, randomBytes } from "node:crypto";
import { redirect } from "next/navigation";

import {
  TRANSACTION_COLUMNS,
  fetchBalances,
  fetchBudgets,
  fetchProjects,
  fetchTransactions,
  normalizeTransaction,
} from "@/lib/data";
import { round2 } from "@/lib/finance";
import { getAuthClient, getSession, type Session } from "@/lib/session";
import {
  BUDGET_KINDS,
  TRANSACTION_TYPES,
  WALLET_TYPES,
  type ActionResult,
  type BalanceMutation,
  type Budget,
  type BudgetInput,
  type Project,
  type ProjectInput,
  type NewTransaction,
  type Transaction,
  type TransactionMutation,
  type WalletType,
} from "@/types/finance";

const MAX_AMOUNT = 1_000_000_000;
const MAX_BUDGETS = 30;
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

class ValidationError extends Error {}

async function authorize(): Promise<Session> {
  const session = await getSession();
  if (!session) throw new ValidationError("Signed out. Reload and sign in again.");
  return session;
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

function validateProjectId(value: unknown): string | null {
  if (value === null || value === undefined) return null;
  if (typeof value !== "string" || !UUID.test(value)) throw new ValidationError("Unknown project.");
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
    project_id: validateProjectId(input.project_id),
  };
}

function validateProjects(input: ProjectInput[]): ProjectInput[] {
  if (!Array.isArray(input) || input.length > MAX_BUDGETS) throw new ValidationError("Too many projects.");
  return input.map((project) => {
    const name = typeof project?.name === "string" ? project.name.trim().slice(0, 40) : "";
    if (!name) throw new ValidationError("Every project needs a name.");
    return { id: validateId(project.id), name };
  });
}

function validateBudgets(input: BudgetInput[]): BudgetInput[] {
  if (!Array.isArray(input) || input.length > MAX_BUDGETS) throw new ValidationError("Too many budget lines.");
  return input.map((line) => {
    const name = typeof line?.name === "string" ? line.name.trim().slice(0, 40) : "";
    if (!name) throw new ValidationError("Every budget line needs a name.");
    if (!(BUDGET_KINDS as readonly string[]).includes(line.kind)) throw new ValidationError("Pick % or EGP.");
    const value = validateAmount(line.value);
    if (line.kind === "percent" && value > 100) throw new ValidationError(`${name}: a share can't pass 100%.`);
    const dueDay = line.due_day ?? null;
    if (dueDay !== null && !(Number.isInteger(dueDay) && dueDay >= 1 && dueDay <= 31)) {
      throw new ValidationError(`${name}: pay day must be 1–31.`);
    }
    return { id: validateId(line.id), name, kind: line.kind, value, due_day: line.kind === "fixed" ? dueDay : null };
  });
}

export async function addTransaction(
  input: NewTransaction,
): Promise<ActionResult<TransactionMutation>> {
  try {
    const db = await authorize();
    const values = validateNewTransaction(input);

    const { data, error } = await db.client
      .from("transactions")
      .insert({ ...values, user_id: db.userId })
      .select(TRANSACTION_COLUMNS)
      .single();
    if (error) throw error;

    return { ok: true, data: { transaction: normalizeTransaction(data), balances: await fetchBalances(db) } };
  } catch (error) {
    return fail(error);
  }
}

export async function deleteTransaction(id: string): Promise<ActionResult<BalanceMutation>> {
  try {
    const db = await authorize();
    const { error } = await db.client
      .from("transactions")
      .delete()
      .eq("user_id", db.userId)
      .eq("id", validateId(id));
    if (error) throw error;

    return { ok: true, data: { balances: await fetchBalances(db) } };
  } catch (error) {
    return fail(error);
  }
}

/** Re-inserts a deleted transaction with its original id and timestamp (undo). */
export async function restoreTransaction(
  tx: Transaction,
): Promise<ActionResult<TransactionMutation>> {
  try {
    const db = await authorize();
    const createdAt = new Date(tx.created_at);
    if (Number.isNaN(createdAt.getTime())) throw new ValidationError("Invalid date.");

    const { data, error } = await db.client
      .from("transactions")
      .upsert(
        {
          ...validateNewTransaction(tx),
          user_id: db.userId,
          source: tx.source === "sms" ? "sms" : "manual",
          in_plan: tx.type === "income" && typeof tx.in_plan === "boolean" ? tx.in_plan : null,
          created_at: createdAt.toISOString(),
        },
        { onConflict: "id", ignoreDuplicates: true },
      )
      .select(TRANSACTION_COLUMNS)
      .maybeSingle();
    if (error) throw error;

    return {
      ok: true,
      data: { transaction: data ? normalizeTransaction(data) : tx, balances: await fetchBalances(db) },
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
    const db = await authorize();
    const { data, error } = await db.client
      .from("transactions")
      .update({ budget_id: validateBudgetId(budgetId) })
      .eq("user_id", db.userId)
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

/** Tags (or untags) a transaction with a project. */
export async function setTransactionProject(
  id: string,
  projectId: string | null,
): Promise<ActionResult<Transaction>> {
  try {
    const db = await authorize();
    const { data, error } = await db.client
      .from("transactions")
      .update({ project_id: validateProjectId(projectId) })
      .eq("user_id", db.userId)
      .eq("id", validateId(id))
      .select(TRANSACTION_COLUMNS)
      .single();
    if (error) throw error;

    return { ok: true, data: normalizeTransaction(data) };
  } catch (error) {
    return fail(error);
  }
}

/** Replaces the project list with `input`, in order; removed projects untag their rows. */
export async function saveProjects(input: ProjectInput[]): Promise<ActionResult<Project[]>> {
  try {
    const db = await authorize();
    const projects = validateProjects(input);
    const keep = projects.map((project) => project.id);
    const removal = db.client.from("projects").delete().eq("user_id", db.userId);
    const { error: deleteError } = await (keep.length
      ? removal.not("id", "in", `(${keep.join(",")})`)
      : removal.not("id", "is", null));
    if (deleteError) throw deleteError;

    if (projects.length > 0) {
      const { error } = await db.client
        .from("projects")
        .upsert(
          projects.map((project, position) => ({ ...project, position, user_id: db.userId })),
          { onConflict: "id" },
        );
      if (error) throw error;
    }

    return { ok: true, data: await fetchProjects(db) };
  } catch (error) {
    return fail(error);
  }
}

/** Decides whether an income counts toward the plan (null puts it back to undecided). */
export async function setIncomeInPlan(
  id: string,
  inPlan: boolean | null,
): Promise<ActionResult<Transaction>> {
  try {
    const db = await authorize();
    if (inPlan !== null && typeof inPlan !== "boolean") throw new ValidationError("Pick yes or no.");
    const { data, error } = await db.client
      .from("transactions")
      .update({ in_plan: inPlan })
      .eq("user_id", db.userId)
      .eq("id", validateId(id))
      .eq("type", "income")
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
    const db = await authorize();
    const lines = validateBudgets(input);
    const keep = lines.map((line) => line.id);
    const removal = db.client.from("budgets").delete().eq("user_id", db.userId);
    const { error: deleteError } = await (keep.length
      ? removal.not("id", "in", `(${keep.join(",")})`)
      : removal.not("id", "is", null));
    if (deleteError) throw deleteError;

    if (lines.length > 0) {
      const { error } = await db.client
        .from("budgets")
        .upsert(
          lines.map((line, position) => ({ ...line, position, user_id: db.userId })),
          { onConflict: "id" },
        );
      if (error) throw error;
    }

    return { ok: true, data: await fetchBudgets(db) };
  } catch (error) {
    return fail(error);
  }
}

/** Fetches an older slice of history when the user pages back to a month not loaded yet. */
export async function loadTransactions(from: string, to: string): Promise<ActionResult<Transaction[]>> {
  try {
    const db = await authorize();
    const start = new Date(from);
    const end = new Date(to);
    if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime()) || start >= end) {
      throw new ValidationError("Invalid date range.");
    }

    return { ok: true, data: await fetchTransactions(db, start, end) };
  } catch (error) {
    return fail(error);
  }
}

export async function setWalletBalance(
  wallet: WalletType,
  balance: number,
): Promise<ActionResult<BalanceMutation>> {
  try {
    const db = await authorize();
    const type = validateWallet(wallet);
    const value = validateAmount(balance, { allowZeroOrNegative: true });

    const { error } = await db.client
      .from("wallets")
      .upsert(
        { user_id: db.userId, type, balance: value, updated_at: new Date().toISOString() },
        { onConflict: "user_id,type" },
      );
    if (error) throw error;

    return { ok: true, data: { balances: await fetchBalances(db) } };
  } catch (error) {
    return fail(error);
  }
}

/**
 * Makes a new bank SMS token for the iPhone Shortcut, replacing the old one.
 * Only its hash is stored, so this is the one time the token is shown.
 */
export async function createSmsToken(): Promise<ActionResult<string>> {
  try {
    const db = await authorize();
    const token = randomBytes(24).toString("base64url");
    const { error } = await db.client.from("sms_tokens").upsert(
      {
        user_id: db.userId,
        token_hash: createHash("sha256").update(token).digest("hex"),
        created_at: new Date().toISOString(),
      },
      { onConflict: "user_id" },
    );
    if (error) throw error;

    return { ok: true, data: token };
  } catch (error) {
    return fail(error);
  }
}

export async function signOut(): Promise<void> {
  const client = await getAuthClient();
  await client.auth.signOut();
  redirect("/login");
}
