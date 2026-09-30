# HyperFid

Multi-tenant digital loyalty for Tunisian SMBs. A customer scans a single-use QR code (cup, receipt, pizza box), scratches a digital card for a chance at an instant reward, and receives a stamp card in **Apple Wallet / Google Wallet** — no app, no sign-up.

| Area | Who | What |
|---|---|---|
| `/s/[code]` | Customers (anonymous) | Scratch card, instant-win roll, stamp card, Add-to-Wallet |
| `/dashboard` | Merchant admins | Live retention analytics, win redemption, customers, settings |
| `/admin` | Super admin (platform) | Tenants, subscriptions, win rates, one-click "Générer 100 QR" per merchant (instant CSV download), custom batches (CSV + print), team invites |

**Stack:** Next.js 16 (App Router, `proxy.ts`), TypeScript, Tailwind CSS v4, Recharts · Supabase (Postgres + RLS, Auth, Realtime) · WalletWallet.dev for passes.

---

## Architecture

```
Browser ──► proxy.ts ──► Server Components (read via RLS)
                   └──► Server Actions ──► Postgres RPCs (SECURITY DEFINER / INVOKER)
                                      └──► WalletWallet.dev (after commit, best-effort)
```

1. **The database owns every security boundary.** RLS isolates tenants, guard triggers enforce column-level rules, and the anonymous scan is a single RPC. The Next.js layer is thin; a bug there cannot widen access.
2. **Exactly-once scans.** `claim_qr_scan` locks the QR row (`FOR UPDATE`), rolls the win with a CSPRNG (`gen_random_bytes`), upserts the device wallet, adds the stamp and flips the code, all in one transaction. With 20 concurrent claims on one code, exactly one succeeds.
3. **No side effects on GET.** `/s/[code]` only reads (`get_qr_public`). The claim runs on the first scratch/tap as `POST /api/scan/[uuid]` (`GET` answers 405, cross-origin POSTs 403), so WhatsApp/iMessage link previews can't burn codes. The response carries the Wallet `passUrl`: non-winners are redirected to it after a 3 s countdown; winners stay on their redemption-code screen.
4. **Device identity without login.** The proxy issues an `httpOnly` `hf_device` cookie (random UUID) on the landing page. Only its HMAC-SHA256 (`DEVICE_HASH_SECRET`) reaches the database.
5. **Wallet sync is outside the transaction.** The DB is the source of truth. If the provider is down, the scan still counts and the next scan re-syncs the pass.

### Data model (`supabase/migrations/20260929000000_init.sql`)

| Table | Purpose |
|---|---|
| `merchants` | Tenant: `win_rate` (%), `reward_description`, `subscription_status`, `stamps_goal`, `brand_color` |
| `profiles` | `role` (`super_admin` \| `merchant_admin`), `merchant_id`. Created by a trigger on `auth.users` from **app_metadata only** |
| `qr_batches` | One row per physical single-use code: `batch_id`, `is_scanned`, `scan_date`, `is_winner`, `wallet_id`, `redemption_code`, `redeemed_at` |
| `digital_wallets` | One per device per merchant: `device_fingerprint` (HMAC), `current_stamps`, `rewards_redeemed`, pass serial/URLs |

> The spec's `qr_batches.uuid` column is named `id` for consistency (and to avoid `uuid uuid`).

### Security model

| Actor | merchants | profiles | qr_batches | digital_wallets |
|---|---|---|---|---|
| `super_admin` | all | all | all (can't un-scan) | all |
| `merchant_admin` | own row; may edit reward / stamps goal / color only | own row, read-only | own rows; may only set `redeemed_at` | own rows, read-only |
| `anon` | — | — | — (only via `claim_qr_scan`) | — |

- `win_rate`, `subscription_status`, `name` and `category` are locked to the super admin by the `merchants_guard` trigger.
- A scanned code is immutable for **every** role (`qr_batches_guard`), and a reward can be redeemed once.
- Helpers `private.is_super_admin()` / `private.current_merchant_id()` live in a schema that isn't exposed through the API.
- Every Server Action re-checks the role (`requireSuperAdmin` / `requireMerchantAdmin`); the proxy's redirect is only a convenience.
- The service-role key is used for two things only: Auth admin (invites) and writing pass-sync metadata.

### RPCs

| Function | Mode | Caller |
|---|---|---|
| `get_qr_public(code)` | definer | anon: landing page (never exposes `is_winner`) |
| `claim_qr_scan(code, device_hash)` | definer | anon: the scan |
| `generate_qr_batch(merchant, qty ≤ 5000, label)` | invoker | super admin |
| `redeem_win(merchant, code)` | invoker (RLS + guard) | merchant / super admin |
| `redeem_stamp_card(wallet)` | definer + ownership check | merchant / super admin |
| `merchant_analytics(merchant, days)` | invoker (RLS-scoped) | dashboards |
| `platform_overview()` | invoker | super admin |

---

## Getting started

### 1. Supabase

**Local (Docker):**

```bash
npx supabase start          # applies supabase/migrations + supabase/seed.sql
npx supabase status         # copy API URL, anon key, service_role key
```

**Hosted project:**

1. Run `supabase/migrations/20260929000000_init.sql`, then `supabase/seed.sql`, in the SQL editor (or `npx supabase db push`).
2. In **Authentication → Providers → Email**, disable sign-ups (accounts are invite-only).
3. In **Authentication → Email Templates → Invite user**, paste `supabase/templates/invite.html`. It uses the `token_hash` flow handled by `/auth/confirm`.
4. In **Authentication → URL Configuration**, set the Site URL to your app URL and add `<app>/auth/confirm` to the redirect URLs.

### 2. Environment

```bash
cp .env.example .env.local
openssl rand -hex 32   # → DEVICE_HASH_SECRET
```

| Variable | Notes |
|---|---|
| `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Public |
| `SUPABASE_SERVICE_ROLE_KEY` | **Server-only.** Invites and pass-sync writes |
| `NEXT_PUBLIC_APP_URL` | Origin encoded in the QR codes, e.g. `https://app.hyperfid.tn` |
| `DEVICE_HASH_SECRET` | ≥ 32 chars. Rotating it resets every customer's card |
| `WALLET_PROVIDER` | `mock` (local, no network) or `walletwallet` |
| `WALLETWALLET_API_KEY` | `ww_live_…` from walletwallet.dev |

### 3. Users & run

```bash
npm install
npm run bootstrap:users     # creates the super admin + Mandy's merchant admin (BOOTSTRAP_* vars)
npm run dev
```

Seeded test client: **Mandy Coffee Shop** (Cafe, 10 % win rate, "1 Café Express gratuit") with a demo batch of 25 codes. Get a scan URL:

```sql
select 'http://localhost:3000/s/' || id from qr_batches where not is_scanned limit 1;
```

Promote an existing account to super admin:

```sql
update public.profiles set role = 'super_admin', merchant_id = null
where id = (select id from auth.users where email = 'you@example.com');
```

---

## Scripts

| Command | What it does |
|---|---|
| `npm run dev` / `build` / `start` | Next.js |
| `npm run lint` / `typecheck` | ESLint / route-type generation (`next typegen`) + `tsc --noEmit` |
| `npm test` | Vitest unit tests (device hashing, pass payload, CSV, validation) |
| `npm run test:db` | RLS & business-rule suite (`supabase/tests/rls.test.sql`) on a throwaway local Postgres. Set `DATABASE_URL` to run it against `supabase start` instead |
| `npm run bootstrap:users` | Creates the first admin accounts through the Auth admin API |
| `npm run wallet:smoke` | Creates and updates one real test pass through WalletWallet (reads `WALLETWALLET_API_KEY` from `.env.local`; uses 2 passes of your quota) |

**CI** (`.github/workflows/ci.yml`) runs lint, typecheck, unit tests and the build on every PR and push to `main`. It also runs the database suite against real Supabase Postgres (`supabase db start`).

`supabase/tests/rls.test.sql` covers:
- tenant isolation and privilege escalation
- anon lockout
- exactly-once claim, inactive-merchant refusal
- redemption (once, never across tenants)
- stamp-card redemption and analytics scoping
- the win-rate distribution (10 % over 2,000 scans)
- cascade deletes

## Wallet passes

`src/lib/wallet/` has a provider interface (`createPass` / `updatePass`) with two implementations:
- **`walletwallet.ts`:** `POST /api/passes` returns `serialNumber`, `shareUrl`, `googleSaveUrl` and `applePass`. `PUT /api/passes/{serial}` pushes stamp updates to every device that holds the pass. Payload mapping is in `pass-content.ts`.
- **`mock.ts`:** local development. Links go to `/wallet-preview/[serial]`.

On the result screen, iOS gets **Add to Apple Wallet** (`shareUrl`), Android gets **Google Wallet** (`googleSaveUrl`), and desktop gets both.

## Project structure

```
src/
  proxy.ts                    session refresh, coarse auth redirect, device cookie on /s/*
  app/
    s/[code]/                 public scan page (scratch UI, calls the scan API)
    api/scan/[uuid]/          POST: claim a code, sync the Wallet pass, return passUrl
    login/, auth/             sign-in, invite confirmation, set password, sign-out
    admin/                    super admin: overview, merchants, batches (CSV/print)
    dashboard/                merchant: analytics, redeem, customers, settings
  components/                 ui primitives, charts (Recharts), scan & shell components
  lib/
    supabase/                 server / browser / anon / admin clients + proxy helper
    auth/guards.ts            requireSuperAdmin / requireMerchantAdmin
    wallet/                   provider interface, WalletWallet, mock, sync
    device.ts, validation.ts, rpc-types.ts, format.ts, csv.ts
  types/database.ts           Supabase types (regenerate: npx supabase gen types typescript --local)
supabase/
  migrations/                 schema, RLS, guards, RPCs
  seed.sql                    Mandy Coffee Shop + demo batch
  tests/                      RLS suite + plain-Postgres shim
```

## Next iterations

- Online subscription billing (status is set manually today)
- Per-IP rate limiting on invalid scan codes
- Merchant logo upload for passes
- Multi-location merchants
- Arabic / English UI
