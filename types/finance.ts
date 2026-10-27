export const WALLET_TYPES = ["cash", "visa"] as const;
export type WalletType = (typeof WALLET_TYPES)[number];

export const TRANSACTION_TYPES = ["expense", "income"] as const;
export type TransactionType = (typeof TRANSACTION_TYPES)[number];

export const BUDGET_KINDS = ["percent", "fixed"] as const;
export type BudgetKind = (typeof BUDGET_KINDS)[number];

export type TransactionSource = "manual" | "sms";

// Row shapes are `type` aliases (not interfaces) so they satisfy
// supabase-js's `Record<string, unknown>` table constraint.
export type Wallet = {
  id: string;
  type: WalletType;
  balance: number;
  updated_at: string;
};

export type Transaction = {
  id: string;
  amount: number;
  type: TransactionType;
  wallet_type: WalletType;
  description: string;
  budget_id: string | null;
  source: TransactionSource;
  created_at: string;
};

/** A line of the monthly plan: `value` is a percentage of the month's income or a fixed EGP amount. */
export type Budget = {
  id: string;
  name: string;
  kind: BudgetKind;
  value: number;
  position: number;
};

/** `id` is generated on the client so optimistic rows keep a stable key once confirmed. */
export type NewTransaction = Pick<
  Transaction,
  "id" | "amount" | "type" | "wallet_type" | "description" | "budget_id"
>;

export type BudgetInput = Pick<Budget, "id" | "name" | "kind" | "value">;

export type Balances = Record<WalletType, number>;

export type ActionResult<T> = { ok: true; data: T } | { ok: false; error: string };

export type TransactionMutation = { transaction: Transaction; balances: Balances };
export type BalanceMutation = { balances: Balances };

export type Database = {
  public: {
    Tables: {
      wallets: {
        Row: Wallet;
        Insert: {
          id?: string;
          type: WalletType;
          balance?: number;
          updated_at?: string;
        };
        Update: {
          id?: string;
          type?: WalletType;
          balance?: number;
          updated_at?: string;
        };
        Relationships: [];
      };
      transactions: {
        Row: Transaction;
        Insert: {
          id?: string;
          amount: number;
          type: TransactionType;
          wallet_type: WalletType;
          description?: string;
          budget_id?: string | null;
          source?: TransactionSource;
          source_hash?: string | null;
          created_at?: string;
        };
        Update: {
          id?: string;
          amount?: number;
          type?: TransactionType;
          wallet_type?: WalletType;
          description?: string;
          budget_id?: string | null;
          source?: TransactionSource;
          source_hash?: string | null;
          created_at?: string;
        };
        Relationships: [];
      };
      budgets: {
        Row: Budget & { created_at: string };
        Insert: {
          id?: string;
          name: string;
          kind: BudgetKind;
          value: number;
          position?: number;
          created_at?: string;
        };
        Update: {
          id?: string;
          name?: string;
          kind?: BudgetKind;
          value?: number;
          position?: number;
          created_at?: string;
        };
        Relationships: [];
      };
    };
    Views: { [_ in never]: never };
    Functions: { [_ in never]: never };
    Enums: { [_ in never]: never };
    CompositeTypes: { [_ in never]: never };
  };
};
