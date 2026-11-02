import type { PGlite } from "@electric-sql/pglite";
import { drizzle } from "drizzle-orm/pglite";

import { createDb, schema, setDb, type DB } from "@/lib/db";
import { auditEvents, refunds } from "@/lib/schema";

import { FIXTURE_AUDIT_EVENTS, FIXTURE_REFUNDS } from "./fixtures";

// Booting PGlite and running the migrations takes most of a second, so do it once per test file
// and give each test its own clone of the result.
let migrated: Promise<DB> | undefined;

/**
 * Returns a fresh in-memory PGlite database with every migration in drizzle/ applied (triggers
 * included) and the small fixture from ./fixtures seeded, and makes `getDb()` return it so
 * server actions and queries run against it.
 */
export async function createTestDb(): Promise<DB> {
  migrated ??= createDb();
  const client = (await (await migrated).$client.clone()) as PGlite;
  const db = drizzle({ client, schema });
  await db.insert(refunds).values([...FIXTURE_REFUNDS]);
  await db.insert(auditEvents).values(FIXTURE_AUDIT_EVENTS);
  setDb(db);
  return db;
}

/** Closes a database from `createTestDb()` and stops `getDb()` returning it. */
export async function closeTestDb(db: DB): Promise<void> {
  setDb(null);
  await db.$client.close();
}
