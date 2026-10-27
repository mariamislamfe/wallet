-- Wallet tracker schema.
-- Run once in Supabase → SQL Editor. Safe to re-run.

create extension if not exists pgcrypto;

-- ---------------------------------------------------------------------------
-- Tables
-- ---------------------------------------------------------------------------

create table if not exists public.wallets (
  id          uuid primary key default gen_random_uuid(),
  type        text not null unique check (type in ('cash', 'visa')),
  balance     numeric(14, 2) not null default 0,
  updated_at  timestamptz not null default now()
);

create table if not exists public.transactions (
  id           uuid primary key default gen_random_uuid(),
  amount       numeric(14, 2) not null check (amount > 0),
  type         text not null check (type in ('expense', 'income')),
  wallet_type  text not null references public.wallets (type) on update cascade,
  description  text not null default '' check (char_length(description) <= 120),
  created_at   timestamptz not null default now()
);

create index if not exists transactions_created_at_idx
  on public.transactions (created_at desc);

-- Exactly one row per wallet.
insert into public.wallets (type, balance)
values ('cash', 0), ('visa', 0)
on conflict (type) do nothing;

-- ---------------------------------------------------------------------------
-- Balance trigger: every insert / update / delete on transactions is
-- reflected in the matching wallet inside the same database transaction.
-- ---------------------------------------------------------------------------

create or replace function public.apply_transaction_to_wallet()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if tg_op in ('DELETE', 'UPDATE') then
    update wallets
       set balance    = balance - case when old.type = 'income' then old.amount else -old.amount end,
           updated_at = now()
     where type = old.wallet_type;
  end if;

  if tg_op in ('INSERT', 'UPDATE') then
    update wallets
       set balance    = balance + case when new.type = 'income' then new.amount else -new.amount end,
           updated_at = now()
     where type = new.wallet_type;
  end if;

  if tg_op = 'DELETE' then
    return old;
  end if;
  return new;
end;
$$;

drop trigger if exists transactions_apply_to_wallet on public.transactions;

create trigger transactions_apply_to_wallet
after insert or update or delete on public.transactions
for each row execute function public.apply_transaction_to_wallet();

-- ---------------------------------------------------------------------------
-- Budget plan: each line is a share of the month's income (percent) or a
-- fixed amount. Expenses are tagged with a line to track how much of it is used.
-- ---------------------------------------------------------------------------

create table if not exists public.budgets (
  id          uuid primary key default gen_random_uuid(),
  name        text not null check (char_length(name) between 1 and 40),
  kind        text not null check (kind in ('percent', 'fixed')),
  value       numeric(14, 2) not null check (value > 0),
  position    integer not null default 0,
  created_at  timestamptz not null default now(),
  check (kind <> 'percent' or value <= 100)
);

alter table public.transactions
  add column if not exists budget_id uuid references public.budgets (id) on delete set null;

-- `source` marks rows imported from bank SMS; `source_hash` (sha-256 of the
-- message) makes a message that is delivered twice land only once.
alter table public.transactions
  add column if not exists source text not null default 'manual' check (source in ('manual', 'sms'));

alter table public.transactions
  add column if not exists source_hash text unique;

-- `in_plan` on income: null while waiting for the user to decide, true when the
-- plan's % lines are taken from it, false when it's kept out of the plan.
alter table public.transactions
  add column if not exists in_plan boolean;

-- `due_day` on a line: the day of the month it gets paid (a subscription on the 17th).
alter table public.budgets
  add column if not exists due_day smallint check (due_day between 1 and 31);

-- ---------------------------------------------------------------------------
-- Projects: income and spending can be tagged with the project they belong to.
-- ---------------------------------------------------------------------------

create table if not exists public.projects (
  id          uuid primary key default gen_random_uuid(),
  name        text not null check (char_length(name) between 1 and 40),
  position    integer not null default 0,
  created_at  timestamptz not null default now()
);

alter table public.transactions
  add column if not exists project_id uuid references public.projects (id) on delete set null;

-- ---------------------------------------------------------------------------
-- Row Level Security
-- RLS is on with no policies, so the public anon key can neither read nor
-- write. The app talks to Supabase only from the server with the
-- service_role key, which bypasses RLS.
-- ---------------------------------------------------------------------------

alter table public.wallets enable row level security;
alter table public.transactions enable row level security;
alter table public.budgets enable row level security;
alter table public.projects enable row level security;
