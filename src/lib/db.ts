import fs from "node:fs";
import path from "node:path";

import Database from "better-sqlite3";
import { drizzle, type BetterSQLite3Database } from "drizzle-orm/better-sqlite3";
import { migrate } from "drizzle-orm/better-sqlite3/migrator";

import * as schema from "./schema";

export type DB = BetterSQLite3Database<typeof schema>;

const DATABASE_PATH = path.resolve(
  /* turbopackIgnore: true */
  process.env.DATABASE_PATH ?? path.join(process.cwd(), "data", "refunds.db"),
);
const MIGRATIONS_FOLDER = path.join(process.cwd(), "drizzle");

const globalForDb = globalThis as unknown as { __refundsDb?: DB };

function createDb(): DB {
  fs.mkdirSync(path.dirname(DATABASE_PATH), { recursive: true });

  const sqlite = new Database(DATABASE_PATH);
  sqlite.pragma("journal_mode = WAL");
  sqlite.pragma("foreign_keys = ON");
  sqlite.pragma("busy_timeout = 5000");

  const db = drizzle(sqlite, { schema });
  migrate(db, { migrationsFolder: MIGRATIONS_FOLDER });
  return db;
}

/** Returns the shared database, creating the file and applying migrations on first access. */
export function getDb(): DB {
  globalForDb.__refundsDb ??= createDb();
  return globalForDb.__refundsDb;
}

export { schema };
