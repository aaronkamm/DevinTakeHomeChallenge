import fs from "node:fs";
import path from "node:path";

import { PGlite } from "@electric-sql/pglite";
import { drizzle, type PgliteDatabase } from "drizzle-orm/pglite";
import { migrate } from "drizzle-orm/pglite/migrator";

import * as schema from "./schema";

export type DB = PgliteDatabase<typeof schema> & { $client: PGlite };

const DATABASE_DIR = path.resolve(
  /* turbopackIgnore: true */
  process.env.DATABASE_DIR ?? path.join(process.cwd(), "data", "pglite"),
);
const MIGRATIONS_FOLDER = path.join(
  /* turbopackIgnore: true */ process.cwd(),
  "drizzle",
);

const globalForDb = globalThis as unknown as { __refundsDb?: Promise<DB> };

/**
 * Opens a database and applies all migrations. Pass a data directory to persist it, or omit it
 * for a throwaway in-memory database.
 */
export async function createDb(dataDir?: string): Promise<DB> {
  if (dataDir) fs.mkdirSync(dataDir, { recursive: true });
  const client = await PGlite.create(dataDir);
  const db = drizzle({ client, schema });
  try {
    await migrate(db, { migrationsFolder: MIGRATIONS_FOLDER });
  } catch (err) {
    await client.close();
    throw err;
  }
  return db;
}

/** Returns the shared database, creating the data directory and applying migrations on first access. */
export function getDb(): Promise<DB> {
  globalForDb.__refundsDb ??= createDb(DATABASE_DIR).catch((err) => {
    globalForDb.__refundsDb = undefined;
    throw err;
  });
  return globalForDb.__refundsDb;
}

/** Makes `getDb()` return this database instead of the one on disk. For tests; pass null to reset. */
export function setDb(db: DB | null): void {
  globalForDb.__refundsDb = db ? Promise.resolve(db) : undefined;
}

export { schema };
