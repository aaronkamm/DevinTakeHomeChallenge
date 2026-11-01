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

## Database

SQLite via `better-sqlite3` + Drizzle ORM. Schema lives in `src/lib/schema.ts`; migrations in `drizzle/`.

- `getDb()` from `src/lib/db.ts` creates `data/refunds.db` (override with `DATABASE_PATH`) and applies pending migrations on first access.
- After changing the schema, run `npm run db:generate` to create a new migration.
- `audit_events` is append-only (UPDATE/DELETE are blocked by triggers).
