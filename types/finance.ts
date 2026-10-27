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
  /** Income only: null until the user decides, then whether the plan's % lines come out of it. */
  in_plan: boolean | null;
  project_id: string | null;
  created_at: string;
};

/** A line of the monthly plan: `value` is a percentage of the month's income or a fixed EGP amount. */
export type Budget = {
  id: string;
  name: string;
  kind: BudgetKind;
  value: number;
  position: number;
  /** Day of the month this line gets paid, e.g. a subscription on the 17th. */
  due_day: number | null;
};

/** A project income comes from and spending goes to. */
export type Project = {
  id: string;
  name: string;
  position: number;
};

export type ProjectInput = Pick<Project, "id" | "name">;

/** `id` is generated on the client so optimistic rows keep a stable key once confirmed. */
export type NewTransaction = Pick<
  Transaction,
  "id" | "amount" | "type" | "wallet_type" | "description" | "budget_id" | "project_id"
>;

export type BudgetInput = Pick<Budget, "id" | "name" | "kind" | "value" | "due_day">;

export type Balances = Record<WalletType, number>;

export type ActionResult<T> = { ok: true; data: T } | { ok: false; error: string };

export type TransactionMutation = { transaction: Transaction; balances: Balances };
export type BalanceMutation = { balances: Balances };

export type Database = {
  public: {
    Tables: {
      wallets: {
        Row: Wallet & { user_id: string | null };
        Insert: {
          id?: string;
          user_id?: string;
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
        Row: Transaction & { user_id: string | null; source_hash: string | null };
        Insert: {
          id?: string;
          user_id?: string;
          amount: number;
          type: TransactionType;
          wallet_type: WalletType;
          description?: string;
          budget_id?: string | null;
          source?: TransactionSource;
          source_hash?: string | null;
          in_plan?: boolean | null;
          project_id?: string | null;
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
          in_plan?: boolean | null;
          project_id?: string | null;
          created_at?: string;
        };
        Relationships: [];
      };
      budgets: {
        Row: Budget & { user_id: string | null; created_at: string };
        Insert: {
          id?: string;
          user_id?: string;
          name: string;
          kind: BudgetKind;
          value: number;
          position?: number;
          due_day?: number | null;
          created_at?: string;
        };
        Update: {
          id?: string;
          name?: string;
          kind?: BudgetKind;
          value?: number;
          position?: number;
          due_day?: number | null;
          created_at?: string;
        };
        Relationships: [];
      };
      projects: {
        Row: Project & { user_id: string | null; created_at: string };
        Insert: { id?: string; user_id?: string; name: string; position?: number; created_at?: string };
        Update: { id?: string; name?: string; position?: number; created_at?: string };
        Relationships: [];
      };
      sms_tokens: {
        Row: { user_id: string; token_hash: string; created_at: string };
        Insert: { user_id?: string; token_hash: string; created_at?: string };
        Update: { user_id?: string; token_hash?: string; created_at?: string };
        Relationships: [];
      };
    };
    Views: { [_ in never]: never };
    Functions: { [_ in never]: never };
    Enums: { [_ in never]: never };
    CompositeTypes: { [_ in never]: never };
  };
};
