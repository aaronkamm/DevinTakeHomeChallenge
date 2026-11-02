# DevinTakeHomeChallenge

Next.js (App Router, TypeScript, Tailwind CSS, ESLint) app.

## Getting started

Requires Node 20.9+.

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
- `npm run db:generate` – generate a SQL migration in `drizzle/` from `src/lib/schema.ts`

## Database

PostgreSQL via [PGlite](https://pglite.dev) (embedded Postgres, no server to install) with Drizzle ORM.

- Schema: `src/lib/schema.ts` — `refunds` and append-only `audit_events` (amounts in cents).
- Migrations: `drizzle/` (`0001_triggers.sql` is hand-written: `refunds.updated_at` trigger and the append-only guard on `audit_events`).
- `await getDb()` from `src/lib/db.ts` creates the data directory and applies pending migrations on first access.
- Data lives in `data/pglite/` (gitignored); override with `DATABASE_DIR`. Delete the directory to reset.
- PGlite allows one process per data directory — don't point two running servers at the same `DATABASE_DIR`.
