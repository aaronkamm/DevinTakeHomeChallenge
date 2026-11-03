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
- `npm run test:e2e` – run the Playwright end-to-end tests against a freshly seeded database (see [Testing](#testing))
- `npm run db:seed` (alias `npm run seed`) – insert sample refunds + audit events if the `refunds` table is empty
- `npm run db:generate` – generate a SQL migration in `drizzle/` from `src/lib/schema.ts`

## Testing

### Unit and component tests

```bash
npm test             # Vitest, runs once
npm run test:watch   # re-run on change
```

Tests live in `tests/`. DB tests get a fresh in-memory PGlite per test with the real migrations and a small fixture (`tests/helpers/`); component tests use jsdom + React Testing Library. Needs Node 22.22.2+ or 24.15.0+.

### End-to-end tests

Playwright drives the real app in Chromium. Install the browser once (plus its system libraries on Linux/CI):

```bash
npx playwright install --with-deps chromium
```

Then run:

```bash
npm run test:e2e                 # same as `npx playwright test`
npx playwright test --ui         # interactive mode
npx playwright show-report       # HTML report (written on CI runs)
```

How it works (`playwright.config.ts`):

- The `webServer` runs `e2e/prepare-db.ts`, then `next dev` on port 3100 (override with `E2E_PORT`). The prepare script deletes `data/e2e-pglite/`, runs the migrations and `npm run db:seed`, and adds one extra pending refund over the $500 agent limit (the seed has none that isn't a fraud claim). Every run starts from the same data.
- The e2e server uses its own database (`data/e2e-pglite/`) and build directory (`.next-e2e/`, via `NEXT_DIST_DIR`), so it can run while `npm run dev` is up on port 3000.
- Specs live in `e2e/` and run one at a time on a single worker, because some of them decide refunds in the shared database. Retries are off for the same reason: a retried approval would find its refund already decided. Refund IDs the specs use are listed in `e2e/fixtures.ts`; the seed is deterministic, so they stay the same across runs.
- Coverage: browse list, status filter and row navigation; detail overview, audit timeline and not-found page; approving a refund as an agent (status, decision card, new audit entry, browse page); no action panel on decided refunds; agent blocked over $500 until switching to a manager.

## Decision workflow

Open refunds (`pending` or `escalated`) are decided on the detail page: **Approve** the full amount, **Partially approve** a smaller amount, **Reject**, or **Escalate** a pending refund for review. Each decision updates the refund and appends an `audit_events` row in one transaction (`src/app/refunds/[id]/actions.ts`). Approved, partially approved and rejected refunds are final and show no action panel.

Roles:

- **Agent** – decides routine refunds.
- **Manager** – can decide anything an agent can, plus refunds that need a manager.
- **Fraud analyst** – decides card-fraud claims.

Routing rules (`src/lib/decision-rules.ts`; the seed script uses the same rules, and the server actions enforce them as well as the UI):

- A claim with the reason "Unauthorized transaction reported by customer" can only be decided by a fraud analyst.
- Otherwise a manager is needed when the requested amount is over **500.00** (in the refund's currency), the risk score is **60 or higher**, or the refund has been escalated.
- Everything else can be decided by an agent or a manager.
- Escalating moves a pending refund to `escalated` without recording a decision. It can't be escalated again.
- A partial approval must be more than zero and less than the requested amount.

When the current actor isn't allowed to decide, the panel hides the decision buttons and explains who can.

> **The role switcher is a demo mechanism, not authentication.** The "Acting as" menu at the top of every page stores a name and role from the fixed roster in `src/lib/reviewers.ts` in cookies (`src/lib/actor.ts`). Anyone can pick any role. Real deployments need proper sign-in and server-side role checks tied to a verified identity.

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
