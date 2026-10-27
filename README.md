# Wallet

A minimal cash + card tracker. Log an expense or income in three keystrokes.

## Setup

1. **Create the database.** In Supabase → SQL Editor, run [`supabase/schema.sql`](supabase/schema.sql).
   It creates the tables, the balance trigger, a trigger that gives each new account its two wallets,
   and RLS policies so every account sees only its own rows. Safe to re-run.
2. **Let people sign up.** Supabase → Authentication → Sign In / Providers → Email: either turn
   **Confirm email** off, or set up custom SMTP (the built-in mailer only emails your team) and add
   `https://<your-domain>/auth/callback` to Authentication → URL Configuration → Redirect URLs.
3. **Configure env.** Copy `.env.example` to `.env.local` and fill in:

   | Variable | Where | Notes |
   | --- | --- | --- |
   | `SUPABASE_URL` | Project Settings → API | |
   | `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` | Project Settings → API | `sb_publishable_…` or the legacy `anon` key. |
   | `SUPABASE_SERVICE_ROLE_KEY` | Project Settings → API | `service_role` or `sb_secret_…`. Server-only, used by `/api/sms`. |

4. **Run.**
   ```bash
   npm install
   npm run dev
   ```

## How it works

- Accounts are Supabase Auth (email + password). Sessions live in httpOnly cookies that middleware refreshes;
  signed-out visitors go to `/login`.
- Every table has a `user_id`. Server Components and Server Actions query as the signed-in user, so RLS
  limits them to that account's rows (and each query filters by `user_id` too).
- Balances are kept by a Postgres trigger on `transactions`. Insert, delete or update a row and the wallet follows.
- The UI updates optimistically (`useOptimistic`), then reconciles with balances returned by the server.

### Moving data from before accounts

Rows created before accounts existed have no owner and are hidden. Sign up, then run once in the SQL Editor:

```sql
select public.claim_unowned_data('you@example.com');
```

## Months and the plan

- The month header pages back through history; older months are fetched when opened.
- **Plan** lines are either a % of that month's income or a fixed EGP amount. Tag an expense with a line
  while entering it, or tap the tag on any row. A description (or SMS merchant) that was tagged before is
  tagged the same way automatically.

## Bank SMS import (iPhone)

Each account makes its own token in the app: **Account (top right) → Bank SMS**. Only its hash is stored.
`POST /api/sms` with `Authorization: Bearer <token>` and `{"text": "<sms>"}` records the message on that
account's Visa wallet. OTPs, declined payments, ATM withdrawals and foreign-currency charges are
skipped; the same message sent twice is stored once. The app must be reachable from the phone (deployed).

Shortcuts → Automation → **Message** (sender: the bank) → **Run Immediately** →
**Get Contents of URL**: method `POST`, header `Authorization: Bearer …`, JSON body `text` = *Shortcut Input → Content*.

## Keyboard

| Step | Keys |
| --- | --- |
| Amount | type a number · `+` income · `-` expense · `Enter` next |
| Wallet | `C` / `1` cash · `V` / `2` visa · `←` `→` · `Enter` confirm · `Esc` back |
| Description | `Enter` save · `Tab` complete suggestion · `Esc` back |

On mobile, swipe a row left to delete it. Delete always offers Undo.
