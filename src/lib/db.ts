import fs from "node:fs";
import path from "node:path";

import Database from "better-sqlite3";
import { drizzle, type BetterSQLite3Database } from "drizzle-orm/better-sqlite3";
import { readMigrationFiles } from "drizzle-orm/migrator";

import * as schema from "./schema";

export type DB = BetterSQLite3Database<typeof schema>;

const DATABASE_PATH = path.resolve(
  /* turbopackIgnore: true */
  process.env.DATABASE_PATH ?? path.join(process.cwd(), "data", "refunds.db"),
);
const MIGRATIONS_FOLDER = path.join(process.cwd(), "drizzle");

const MIGRATIONS_TABLE = "__drizzle_migrations";

const globalForDb = globalThis as unknown as { __refundsDb?: DB };

function createDb(): DB {
  fs.mkdirSync(path.dirname(DATABASE_PATH), { recursive: true });

  const sqlite = new Database(DATABASE_PATH);
  sqlite.pragma("journal_mode = WAL");
  sqlite.pragma("foreign_keys = ON");
  sqlite.pragma("busy_timeout = 5000");

  runMigrations(sqlite);
  return drizzle(sqlite, { schema });
}

/**
 * Same bookkeeping as drizzle's `migrate()`, but the applied-migrations check runs inside
 * a `BEGIN IMMEDIATE` transaction. drizzle reads it before taking the write lock, so
 * concurrent processes (build workers, dev server + scripts) could apply a migration twice.
 */
function runMigrations(sqlite: Database.Database) {
  const migrations = readMigrationFiles({ migrationsFolder: MIGRATIONS_FOLDER });

  sqlite
    .transaction(() => {
      sqlite.exec(
        `CREATE TABLE IF NOT EXISTS "${MIGRATIONS_TABLE}" (id SERIAL PRIMARY KEY, hash text NOT NULL, created_at numeric)`,
      );
      const lastAppliedMillis = sqlite
        .prepare(`SELECT created_at FROM "${MIGRATIONS_TABLE}" ORDER BY created_at DESC LIMIT 1`)
        .pluck()
        .get() as number | string | undefined;
      const insert = sqlite.prepare(
        `INSERT INTO "${MIGRATIONS_TABLE}" ("hash", "created_at") VALUES (?, ?)`,
      );

      for (const migration of migrations) {
        if (lastAppliedMillis !== undefined && Number(lastAppliedMillis) >= migration.folderMillis) {
          continue;
        }
        for (const statement of migration.sql) sqlite.exec(statement);
        insert.run(migration.hash, migration.folderMillis);
      }
    })
    .immediate();
}

/** Returns the shared database, creating the file and applying migrations on first access. */
export function getDb(): DB {
  globalForDb.__refundsDb ??= createDb();
  return globalForDb.__refundsDb;
}

export { schema };
