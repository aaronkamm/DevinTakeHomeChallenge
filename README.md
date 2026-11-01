# DevinTakeHomeChallenge

Next.js (App Router, TypeScript, Tailwind CSS, ESLint) app.

## Getting started

Requires Node 22+.

```bash
npm install
npm run dev        # http://localhost:3000
```

## Scripts

- `npm run dev` – start the dev server
- `npm run build` – production build
- `npm run start` – serve the production build
- `npm run lint` – ESLint
- `npm run typecheck` – TypeScript type check

## Database

SQLite via `better-sqlite3` + Drizzle ORM. Schema lives in `src/lib/schema.ts`; migrations in `drizzle/`.

- `getDb()` from `src/lib/db.ts` creates `data/refunds.db` (override with `DATABASE_PATH`) and applies pending migrations on first access.
- After changing the schema, run `npm run db:generate` to create a new migration.
- `audit_events` is append-only (UPDATE/DELETE are blocked by triggers).
- `refunds.updated_at` is set by Drizzle's `$onUpdate`. An AFTER UPDATE trigger backfills it for raw SQL, but SQLite runs `RETURNING` before AFTER triggers, so a raw `UPDATE ... RETURNING` returns the stale value. To close the raw-SQL gap, the rule is: always go through Drizzle, or re-select the row after a raw update.
