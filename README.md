# DevinTakeHomeChallenge

Next.js (App Router, TypeScript, Tailwind CSS, ESLint) app.

## Getting started

Requires Node 20.9+ to run the app (Next.js 16). The test suite (`npm test`) needs Node 22.22.2+ or 24.15.0+ — Vitest 5 and jsdom 30 do not support Node 20.

```bash
npm install
npm run dev        # http://localhost:3000
```

## Scripts

- `npm run dev` – start the dev server (runs `db:seed` first)
- `npm run build` – production build
- `npm run start` – serve the production build
- `npm run lint` – ESLint
- `npm run typecheck` – TypeScript type check
- `npm test` – run the Vitest suite once (`npm run test:watch` to re-run on change); DB tests use a fresh in-memory PGlite per test with the real migrations, component tests use jsdom + React Testing Library
- `npm run test:e2e` – placeholder until end-to-end tests are added
- `npm run db:seed` (alias `npm run seed`) – insert sample refunds + audit events if the `refunds` table is empty
- `npm run db:generate` – generate a SQL migration in `drizzle/` from `src/lib/schema.ts`

## Database

PostgreSQL via [PGlite](https://pglite.dev) (embedded Postgres, no server to install) with Drizzle ORM.

- Schema: `src/lib/schema.ts` — `refunds` and append-only `audit_events` (amounts in cents).
- Migrations: `drizzle/` (`0001_triggers.sql` is hand-written: `refunds.updated_at` trigger and the append-only guard on `audit_events`).
- `await getDb()` from `src/lib/db.ts` creates the data directory and applies pending migrations on first access.
- Read queries live in `src/lib/queries.ts` (server-side only): `listRefunds({ status?, page? })` (newest first, 20 per page, returns `{ items, page, pageSize, total, totalPages }`) and `getRefundWithAuditTrail(id)` (refund + audit events oldest first, or `null`).
- Data lives in `data/pglite/` (gitignored); override with `DATABASE_DIR`. Delete the directory to reset.
- PGlite allows one process per data directory — don't point two running servers at the same `DATABASE_DIR`.
- Sample data: `scripts/seed.ts` uses `drizzle-seed` (fixed seed) to insert 24 refunds and matching `audit_events` (created → escalated/approved/partially_approved/rejected, with actors and roles). It skips if `refunds` already has rows.
  - Covers every status and 10 fintech refund reasons (card, ACH, wire, ATM and account-fee cases) with account IDs, merchants, and USD/EUR/GBP/CAD amounts sized to the reason.
  - Refunds above the 500.00 agent approval limit or with risk score ≥ 60 escalate to a manager; unauthorized-card claims go to a fraud analyst.
  - To reseed, stop the dev server, delete `data/pglite/`, and rerun. Do this after pulling schema changes too: rows seeded earlier keep placeholder `account_id`/`payment_method` values.
