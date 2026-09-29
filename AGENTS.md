<!-- BEGIN:nextjs-agent-rules -->

# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->

# HyperFid — project rules

- Security lives in Postgres (`supabase/migrations`): RLS on every table, guard triggers, RPCs. Never bypass it from the app; the service-role client (`src/lib/supabase/admin.ts`) is only for Auth admin and wallet-pass sync writes.
- Every Server Action must start with `requireSuperAdmin()` or `requireMerchantAdmin()` (`src/lib/auth/guards.ts`). The proxy redirect is not an authorization check.
- The public scan (`/s/[code]`) must stay side-effect free on GET; the claim runs from a user gesture through `claim_qr_scan`.
- Form Server Actions return `FormState` from `src/lib/form-state.ts`; use `failure(msg, formData, keys)` so forms keep user input after React's automatic form reset.
- Schema changes: add a new migration file, extend `supabase/tests/rls.test.sql`, update `src/types/database.ts`.
- Checks before pushing: `npm run lint && npm run typecheck && npm test && npm run test:db && npm run build`. CI (`.github/workflows/ci.yml`) enforces the same gate, with the database suite running on real Supabase Postgres.
