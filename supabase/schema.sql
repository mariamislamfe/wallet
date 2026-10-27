-- Wallet tracker schema.
-- Run once in Supabase → SQL Editor. Safe to re-run.

create extension if not exists pgcrypto;

-- ---------------------------------------------------------------------------
-- Tables
-- ---------------------------------------------------------------------------

create table if not exists public.wallets (
  id          uuid primary key default gen_random_uuid(),
  type        text not null check (type in ('cash', 'visa')),
  balance     numeric(14, 2) not null default 0,
  updated_at  timestamptz not null default now()
);

create table if not exists public.transactions (
  id           uuid primary key default gen_random_uuid(),
  amount       numeric(14, 2) not null check (amount > 0),
  type         text not null check (type in ('expense', 'income')),
  wallet_type  text not null check (wallet_type in ('cash', 'visa')),
  description  text not null default '' check (char_length(description) <= 120),
  created_at   timestamptz not null default now()
);

create index if not exists transactions_created_at_idx
  on public.transactions (created_at desc);

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
  add column if not exists source_hash text;

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
-- Accounts: every row belongs to a Supabase Auth user. `user_id` defaults to
-- the signed-in user, and RLS lets each user see and change only their rows.
-- ---------------------------------------------------------------------------

alter table public.wallets
  add column if not exists user_id uuid default auth.uid() references auth.users (id) on delete cascade;
alter table public.transactions
  add column if not exists user_id uuid default auth.uid() references auth.users (id) on delete cascade;
alter table public.budgets
  add column if not exists user_id uuid default auth.uid() references auth.users (id) on delete cascade;
alter table public.projects
  add column if not exists user_id uuid default auth.uid() references auth.users (id) on delete cascade;

-- One cash and one visa wallet per user (was: per database).
alter table public.transactions drop constraint if exists transactions_wallet_type_fkey;
alter table public.wallets drop constraint if exists wallets_type_key;
-- The same bank SMS can only land once per user (was: once overall).
alter table public.transactions drop constraint if exists transactions_source_hash_key;

do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'wallets_user_type_key') then
    alter table public.wallets add constraint wallets_user_type_key unique (user_id, type);
  end if;
  if not exists (select 1 from pg_constraint where conname = 'transactions_user_wallet_fkey') then
    alter table public.transactions
      add constraint transactions_user_wallet_fkey
      foreign key (user_id, wallet_type) references public.wallets (user_id, type);
  end if;
  if not exists (select 1 from pg_constraint where conname = 'transactions_user_source_hash_key') then
    alter table public.transactions
      add constraint transactions_user_source_hash_key unique (user_id, source_hash);
  end if;
end;
$$;

create index if not exists transactions_user_created_at_idx
  on public.transactions (user_id, created_at desc);

-- Each user's bank SMS token, stored as a sha-256 hash. The token itself is
-- shown once when it's made; /api/sms finds the user by the hash.
create table if not exists public.sms_tokens (
  user_id     uuid primary key default auth.uid() references auth.users (id) on delete cascade,
  token_hash  text not null unique,
  created_at  timestamptz not null default now()
);

-- New users start with empty cash and visa wallets.
create or replace function public.create_wallets_for_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into wallets (user_id, type)
  values (new.id, 'cash'), (new.id, 'visa')
  on conflict do nothing;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;

create trigger on_auth_user_created
after insert on auth.users
for each row execute function public.create_wallets_for_new_user();

-- ---------------------------------------------------------------------------
-- Balance trigger: every insert / update / delete on transactions is
-- reflected in the owner's matching wallet inside the same database transaction.
-- Changing only user_id (claiming rows) doesn't move money, so it doesn't fire.
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
     where type = old.wallet_type
       and user_id is not distinct from old.user_id;
  end if;

  if tg_op in ('INSERT', 'UPDATE') then
    update wallets
       set balance    = balance + case when new.type = 'income' then new.amount else -new.amount end,
           updated_at = now()
     where type = new.wallet_type
       and user_id is not distinct from new.user_id;
  end if;

  if tg_op = 'DELETE' then
    return old;
  end if;
  return new;
end;
$$;

drop trigger if exists transactions_apply_to_wallet on public.transactions;

create trigger transactions_apply_to_wallet
after insert or delete or update of amount, type, wallet_type on public.transactions
for each row execute function public.apply_transaction_to_wallet();

-- Hands the rows from before accounts existed (user_id is null) to one user,
-- replacing the empty wallets they got at sign-up. Run it once, as the owner:
--   select public.claim_unowned_data('you@example.com');
create or replace function public.claim_unowned_data(owner_email text)
returns void
language plpgsql
set search_path = public
as $$
declare
  owner uuid;
begin
  select id into owner from auth.users where lower(email) = lower(owner_email);
  if owner is null then
    raise exception 'No account with the email %', owner_email;
  end if;
  if exists (select 1 from transactions where user_id = owner) then
    raise exception 'That account already has transactions; claim before logging anything';
  end if;

  if exists (select 1 from wallets where user_id is null) then
    delete from wallets where user_id = owner;
    update wallets set user_id = owner where user_id is null;
  end if;
  update budgets set user_id = owner where user_id is null;
  update projects set user_id = owner where user_id is null;
  update transactions set user_id = owner where user_id is null;
end;
$$;

revoke execute on function public.claim_unowned_data(text) from public, anon, authenticated;
revoke execute on function public.create_wallets_for_new_user() from public, anon, authenticated;

-- ---------------------------------------------------------------------------
-- Row Level Security
-- Signed-in users reach only their own rows. /api/sms uses the service_role
-- key (which bypasses RLS) and filters by the token's owner itself.
-- ---------------------------------------------------------------------------

alter table public.wallets enable row level security;
alter table public.transactions enable row level security;
alter table public.budgets enable row level security;
alter table public.projects enable row level security;
alter table public.sms_tokens enable row level security;

drop policy if exists "Own rows" on public.wallets;
create policy "Own rows" on public.wallets for all to authenticated
  using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));

drop policy if exists "Own rows" on public.transactions;
create policy "Own rows" on public.transactions for all to authenticated
  using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));

drop policy if exists "Own rows" on public.budgets;
create policy "Own rows" on public.budgets for all to authenticated
  using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));

drop policy if exists "Own rows" on public.projects;
create policy "Own rows" on public.projects for all to authenticated
  using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));

drop policy if exists "Own rows" on public.sms_tokens;
create policy "Own rows" on public.sms_tokens for all to authenticated
  using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));
