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

async function createDb(): Promise<DB> {
  fs.mkdirSync(DATABASE_DIR, { recursive: true });
  const client = await PGlite.create(DATABASE_DIR);
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
  globalForDb.__refundsDb ??= createDb().catch((err) => {
    globalForDb.__refundsDb = undefined;
    throw err;
  });
  return globalForDb.__refundsDb;
}

export { schema };
