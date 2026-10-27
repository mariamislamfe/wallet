import type { Balances, Budget, Transaction, TransactionType, WalletType } from "@/types/finance";

export const EMPTY_BALANCES: Balances = { cash: 0, visa: 0 };

export const WALLET_LABELS: Record<WalletType, { en: string; ar: string }> = {
  cash: { en: "Cash", ar: "الكاش" },
  visa: { en: "Visa", ar: "الفيزا" },
};

export const TYPE_LABELS: Record<TransactionType, { en: string; ar: string }> = {
  expense: { en: "Expense", ar: "صرفت" },
  income: { en: "Income", ar: "دخلي" },
};

const DEFAULT_SUGGESTIONS: Record<TransactionType, string[]> = {
  expense: ["Coffee", "Food", "Uber", "Groceries", "Bills"],
  income: ["Salary", "Freelance", "Transfer", "Gift"],
};

export function round2(value: number): number {
  return Math.round(value * 100) / 100;
}

export function signedAmount(tx: Pick<Transaction, "amount" | "type">): number {
  return tx.type === "income" ? tx.amount : -tx.amount;
}

/** Applies (direction = 1) or reverses (direction = -1) a transaction on a balance set. */
export function applyToBalances(balances: Balances, tx: Transaction, direction: 1 | -1): Balances {
  return {
    ...balances,
    [tx.wallet_type]: round2(balances[tx.wallet_type] + signedAmount(tx) * direction),
  };
}

export type Totals = { income: number; expense: number; net: number };

export function totalsFor(transactions: Transaction[]): Totals {
  let income = 0;
  let expense = 0;
  for (const tx of transactions) {
    if (tx.type === "income") income += tx.amount;
    else expense += tx.amount;
  }
  return { income: round2(income), expense: round2(expense), net: round2(income - expense) };
}

export type BudgetUsage = { budget: Budget; allocated: number; spent: number };

export type MonthPlan = {
  lines: BudgetUsage[];
  /** Income the user put into the plan this month; % lines are shares of it. */
  income: number;
  /** Sum of every line's allocation for the month. */
  allocated: number;
  /** Income not assigned to any line (negative when the plan exceeds income). */
  unallocated: number;
  /** What's still set aside: each line's allocation minus what was spent from it. */
  reserved: number;
  /** Spending not tagged with any line. */
  untagged: number;
};

/** Percent lines are a share of the month's income; fixed lines are the same every month. */
export function allocationFor(budget: Budget, income: number): number {
  return budget.kind === "percent" ? round2((income * budget.value) / 100) : budget.value;
}

/** Income the user hasn't yet put into or kept out of the plan. */
export function isUndecidedIncome(tx: Transaction): boolean {
  return tx.type === "income" && tx.in_plan === null;
}

export function planFor(budgets: Budget[], monthTransactions: Transaction[]): MonthPlan {
  const spentBy = new Map<string, number>();
  let income = 0;
  let untagged = 0;

  for (const tx of monthTransactions) {
    if (tx.type === "income") {
      if (tx.in_plan) income += tx.amount;
    } else if (tx.budget_id && budgets.some((b) => b.id === tx.budget_id)) {
      spentBy.set(tx.budget_id, (spentBy.get(tx.budget_id) ?? 0) + tx.amount);
    } else untagged += tx.amount;
  }

  const lines = budgets.map((budget) => ({
    budget,
    allocated: allocationFor(budget, income),
    spent: round2(spentBy.get(budget.id) ?? 0),
  }));
  const allocated = round2(lines.reduce((sum, line) => sum + line.allocated, 0));
  const reserved = round2(lines.reduce((sum, line) => sum + Math.max(0, line.allocated - line.spent), 0));

  return {
    lines,
    income: round2(income),
    allocated,
    unallocated: round2(income - allocated),
    reserved,
    untagged: round2(untagged),
  };
}

/** How an income would be split by the plan's % lines ("Savings EGP 2,500"). */
export function splitOf(budgets: Budget[], amount: number): { name: string; amount: number }[] {
  return budgets
    .filter((budget) => budget.kind === "percent")
    .map((budget) => ({ name: budget.name, amount: allocationFor(budget, amount) }));
}

export type BillStatus = "paid" | "covered" | "short" | "overdue";

/**
 * For lines with a pay day this month: paid already, or whether the balance
 * covers it together with every unpaid bill due before it. Unpaid past its day is overdue.
 */
export function billStatuses(plan: MonthPlan, balance: number, today: number): Map<string, BillStatus> {
  const statuses = new Map<string, BillStatus>();
  const bills = plan.lines
    .filter((line) => line.budget.due_day !== null)
    .sort((a, b) => a.budget.due_day! - b.budget.due_day!);

  let needed = 0;
  for (const line of bills) {
    const left = round2(line.allocated - line.spent);
    if (left <= 0) {
      statuses.set(line.budget.id, "paid");
      continue;
    }
    needed += left;
    statuses.set(
      line.budget.id,
      today > line.budget.due_day! ? "overdue" : balance >= needed ? "covered" : "short",
    );
  }
  return statuses;
}

/** The line last used for an expense with this description, so repeat entries tag themselves. */
export function rememberedBudget(
  transactions: Transaction[],
  budgets: Budget[],
  description: string,
): string | null {
  const key = description.trim().toLocaleLowerCase();
  if (!key) return null;
  const match = transactions.find(
    (tx) =>
      tx.type === "expense" &&
      tx.budget_id &&
      tx.description.trim().toLocaleLowerCase() === key &&
      budgets.some((b) => b.id === tx.budget_id),
  );
  return match?.budget_id ?? null;
}

/** Merges fetched rows into the cache, skipping ids it already has. */
export function mergeTransactions(current: Transaction[], incoming: Transaction[]): Transaction[] {
  const known = new Set(current.map((tx) => tx.id));
  const fresh = incoming.filter((tx) => !known.has(tx.id));
  if (fresh.length === 0) return current;
  return [...current, ...fresh].sort((a, b) => Date.parse(b.created_at) - Date.parse(a.created_at));
}

export function displayDescription(tx: Pick<Transaction, "description" | "type">): string {
  return tx.description.trim() || TYPE_LABELS[tx.type].en;
}

const ARABIC_DIGITS = /[٠-٩۰-۹]/g;

/**
 * Normalises whatever the user types into a plain decimal string:
 * Arabic-Indic digits → 0-9, Arabic decimal separator → ".", strips everything else,
 * keeps at most one dot and two decimals.
 */
export function sanitizeAmountInput(raw: string): string {
  const western = raw
    .replace(ARABIC_DIGITS, (d) => String(d.charCodeAt(0) & 0xf))
    .replace(/[,٬]/g, "")
    .replace(/[٫.]/g, ".")
    .replace(/[^\d.]/g, "");

  const [whole = "", ...rest] = western.split(".");
  const trimmedWhole = whole.replace(/^0+(?=\d)/, "").slice(0, 10);
  if (rest.length === 0) return trimmedWhole;
  return `${trimmedWhole || "0"}.${rest.join("").slice(0, 2)}`;
}

export function parseAmount(text: string): number | null {
  if (!text) return null;
  const value = Number(text);
  if (!Number.isFinite(value) || value <= 0) return null;
  return round2(value);
}

export function buildSuggestions(
  transactions: Transaction[],
  type: TransactionType,
  query: string,
  limit = 6,
): string[] {
  const tally = new Map<string, { label: string; count: number; last: number }>();

  for (const tx of transactions) {
    if (tx.type !== type) continue;
    const label = tx.description.trim();
    if (!label) continue;
    const key = label.toLocaleLowerCase();
    const at = Date.parse(tx.created_at);
    const entry = tally.get(key);
    if (entry) {
      entry.count += 1;
      entry.last = Math.max(entry.last, at);
    } else {
      tally.set(key, { label, count: 1, last: at });
    }
  }

  const ranked = [...tally.values()]
    .sort((a, b) => b.count - a.count || b.last - a.last)
    .map((entry) => entry.label);

  for (const fallback of DEFAULT_SUGGESTIONS[type]) {
    if (!tally.has(fallback.toLocaleLowerCase())) ranked.push(fallback);
  }

  const q = query.trim().toLocaleLowerCase();
  return ranked
    .filter((label) => {
      const l = label.toLocaleLowerCase();
      return !q || (l.includes(q) && l !== q);
    })
    .slice(0, limit);
}
