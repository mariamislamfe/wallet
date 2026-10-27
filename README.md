# Wallet

A minimal cash + card tracker. Log an expense or income in three keystrokes.

## Setup

1. **Create the database.** In Supabase → SQL Editor, run [`supabase/schema.sql`](supabase/schema.sql).
   It creates `wallets` and `transactions`, seeds the two wallets, adds the balance trigger and enables RLS.
2. **Configure env.** Copy `.env.example` to `.env.local` and fill in:

   | Variable | Where | Notes |
   | --- | --- | --- |
   | `SUPABASE_URL` | Project Settings → API | |
   | `SUPABASE_SERVICE_ROLE_KEY` | Project Settings → API | `service_role` or `sb_secret_…`. Server-only. |
   | `APP_PASSCODE` | you choose | Optional locally, set it before deploying. |
   | `SMS_INGEST_TOKEN` | you choose | Long random secret for `/api/sms`. Leave empty to turn SMS import off. |

3. **Run.**
   ```bash
   npm install
   npm run dev
   ```

## How it works

- Supabase is only called from the server (Server Components + Server Actions) with the service-role key.
  RLS is on with no policies, so the anon key can't touch your data.
- Balances are kept by a Postgres trigger on `transactions`. Insert, delete or update a row and the wallet follows.
- The UI updates optimistically (`useOptimistic`), then reconciles with balances returned by the server.
- Set `APP_PASSCODE` to put the whole app behind a passcode (httpOnly cookie, one year).

## Months and the plan

- The month header pages back through history; older months are fetched when opened.
- **Plan** lines are either a % of that month's income or a fixed EGP amount. Tag an expense with a line
  while entering it, or tap the tag on any row. A description (or SMS merchant) that was tagged before is
  tagged the same way automatically.

## Bank SMS import (iPhone)

`POST /api/sms` with `Authorization: Bearer <SMS_INGEST_TOKEN>` and `{"text": "<sms>"}` records the
message on the Visa wallet. OTPs, declined payments, ATM withdrawals and foreign-currency charges are
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
