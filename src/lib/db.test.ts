import { execFile } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { promisify } from "node:util";

import { eq, sql } from "drizzle-orm";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { auditEvents, refunds, type NewRefund } from "./schema";

const execFileAsync = promisify(execFile);
const journal = JSON.parse(
  fs.readFileSync(path.join(process.cwd(), "drizzle", "meta", "_journal.json"), "utf8"),
) as { entries: unknown[] };

let tmpDir: string;
let dbPath: string;

async function loadDb() {
  vi.resetModules();
  delete (globalThis as { __refundsDb?: unknown }).__refundsDb;
  return import("./db");
}

const baseRefund: NewRefund = {
  id: "RF-1",
  customerName: "Ada Lovelace",
  customerEmail: "ada@example.com",
  transactionId: "txn_1",
  originalAmountCents: 10_000,
  requestedAmountCents: 5_000,
  reason: "Duplicate charge",
};

beforeEach(() => {
  tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "refunds-db-"));
  dbPath = path.join(tmpDir, "nested", "refunds.db");
  vi.stubEnv("DATABASE_PATH", dbPath);
});

afterEach(() => {
  delete (globalThis as { __refundsDb?: unknown }).__refundsDb;
  vi.unstubAllEnvs();
  fs.rmSync(tmpDir, { recursive: true, force: true });
});

describe("initialization", () => {
  it("creates the database file, tables and triggers on first access", async () => {
    const { getDb } = await loadDb();
    expect(fs.existsSync(dbPath)).toBe(false);

    const db = getDb();

    expect(fs.existsSync(dbPath)).toBe(true);
    const objects = db
      .all<{ type: string; name: string }>(
        sql`SELECT type, name FROM sqlite_master WHERE name NOT LIKE 'sqlite_%' ORDER BY type, name`,
      )
      .map((o) => `${o.type}:${o.name}`);
    expect(objects).toEqual(
      expect.arrayContaining([
        "table:refunds",
        "table:audit_events",
        "table:__drizzle_migrations",
        "trigger:audit_events_no_update",
        "trigger:audit_events_no_delete",
        "trigger:refunds_set_updated_at",
      ]),
    );
  });

  it("records every migration once and is a no-op on an existing database", async () => {
    const countMigrations = (db: ReturnType<(typeof import("./db"))["getDb"]>) =>
      db.get<{ n: number }>(sql`SELECT count(*) AS n FROM __drizzle_migrations`)!.n;

    const first = await loadDb();
    expect(countMigrations(first.getDb())).toBe(journal.entries.length);

    const second = await loadDb();
    expect(countMigrations(second.getDb())).toBe(journal.entries.length);
  });

  it("returns the same instance on repeated calls", async () => {
    const { getDb } = await loadDb();
    expect(getDb()).toBe(getDb());
  });

  it("enables WAL and foreign keys", async () => {
    const db = (await loadDb()).getDb();
    expect(db.get(sql`PRAGMA journal_mode`)).toEqual({ journal_mode: "wal" });
    expect(db.get(sql`PRAGMA foreign_keys`)).toEqual({ foreign_keys: 1 });
  });

  it("initializes safely when many processes open a fresh database at once", async () => {
    const script = path.join(process.cwd(), "src", "lib", "__tests__", "open-db.ts");
    const tsx = path.join(process.cwd(), "node_modules", ".bin", "tsx");
    const env = { ...process.env, DATABASE_PATH: dbPath };

    const results = await Promise.allSettled(
      Array.from({ length: 8 }, () => execFileAsync(tsx, [script], { env })),
    );

    for (const result of results) {
      expect(result.status === "fulfilled" ? result.value.stdout : String(result.reason)).toBe("ok");
    }
    const db = (await loadDb()).getDb();
    expect(db.get(sql`SELECT count(*) AS n FROM __drizzle_migrations`)).toEqual({
      n: journal.entries.length,
    });
  });
});

describe("refunds", () => {
  it("applies defaults", async () => {
    const db = (await loadDb()).getDb();
    const row = db.insert(refunds).values(baseRefund).returning().get();

    expect(row).toMatchObject({
      status: "pending",
      currency: "USD",
      riskScore: 0,
      approvedAmountCents: null,
      decidedAt: null,
    });
    expect(row.createdAt).toBeInstanceOf(Date);
    expect(row.updatedAt.getTime()).toBe(row.createdAt.getTime());
  });

  it.each<[string, Partial<NewRefund>]>([
    ["requested amount above the original charge", { requestedAmountCents: 10_001 }],
    ["zero requested amount", { requestedAmountCents: 0 }],
    ["non-positive original amount", { originalAmountCents: 0, requestedAmountCents: 0 }],
    ["approved amount above the requested amount", { approvedAmountCents: 5_001 }],
    ["zero approved amount", { approvedAmountCents: 0 }],
    ["unknown status", { status: "refunded" as NewRefund["status"] }],
    ["risk score above 100", { riskScore: 101 }],
    ["negative risk score", { riskScore: -1 }],
  ])("rejects %s", async (_label, overrides) => {
    const db = (await loadDb()).getDb();
    expect(() => db.insert(refunds).values({ ...baseRefund, ...overrides }).run()).toThrow(
      /CHECK constraint failed/,
    );
  });

  it("accepts an approved amount equal to the requested amount", async () => {
    const db = (await loadDb()).getDb();
    expect(() =>
      db.insert(refunds).values({ ...baseRefund, approvedAmountCents: 5_000 }).run(),
    ).not.toThrow();
  });

  it("rejects a duplicate id", async () => {
    const db = (await loadDb()).getDb();
    db.insert(refunds).values(baseRefund).run();
    expect(() => db.insert(refunds).values(baseRefund).run()).toThrow(/UNIQUE constraint failed/);
  });

  it("bumps updatedAt on Drizzle updates and returns the stored value", async () => {
    const db = (await loadDb()).getDb();
    db.insert(refunds).values({ ...baseRefund, createdAt: new Date(1_000), updatedAt: new Date(1_000) }).run();

    const returned = db
      .update(refunds)
      .set({ status: "approved" })
      .where(eq(refunds.id, baseRefund.id))
      .returning()
      .get();
    const stored = db.select().from(refunds).where(eq(refunds.id, baseRefund.id)).get()!;

    expect(returned.updatedAt.getTime()).toBeGreaterThan(1_000);
    expect(returned.updatedAt.getTime()).toBe(stored.updatedAt.getTime());
    expect(stored.createdAt.getTime()).toBe(1_000);
  });

  it("bumps updated_at on raw SQL updates via the trigger", async () => {
    const db = (await loadDb()).getDb();
    db.insert(refunds).values({ ...baseRefund, updatedAt: new Date(1_000) }).run();

    db.run(sql`UPDATE refunds SET status = 'rejected' WHERE id = ${baseRefund.id}`);

    const stored = db.select().from(refunds).where(eq(refunds.id, baseRefund.id)).get()!;
    expect(stored.updatedAt.getTime()).toBeGreaterThan(1_000);
  });

  it("keeps an explicitly set updatedAt", async () => {
    const db = (await loadDb()).getDb();
    db.insert(refunds).values(baseRefund).run();

    db.update(refunds)
      .set({ status: "escalated", updatedAt: new Date(5_000) })
      .where(eq(refunds.id, baseRefund.id))
      .run();

    const stored = db.select().from(refunds).where(eq(refunds.id, baseRefund.id)).get()!;
    expect(stored.updatedAt.getTime()).toBe(5_000);
  });
});

describe("audit_events", () => {
  const event = {
    refundId: baseRefund.id,
    action: "created",
    actor: "system",
    actorRole: "system",
    toStatus: "pending",
  } as const;

  it("stores an event with a default timestamp", async () => {
    const db = (await loadDb()).getDb();
    db.insert(refunds).values(baseRefund).run();

    const row = db.insert(auditEvents).values(event).returning().get();

    expect(row).toMatchObject({ ...event, fromStatus: null, amountCents: null, note: null });
    expect(row.id).toBeGreaterThan(0);
    expect(row.createdAt).toBeInstanceOf(Date);
  });

  it("rejects an event for an unknown refund", async () => {
    const db = (await loadDb()).getDb();
    expect(() => db.insert(auditEvents).values(event).run()).toThrow(/FOREIGN KEY constraint failed/);
  });

  it.each<[string, Record<string, string>]>([
    ["action", { action: "deleted" }],
    ["actor role", { actorRole: "admin" }],
  ])("rejects an unknown %s", async (_label, overrides) => {
    const db = (await loadDb()).getDb();
    db.insert(refunds).values(baseRefund).run();
    expect(() =>
      db.insert(auditEvents).values({ ...event, ...overrides } as typeof event).run(),
    ).toThrow(/CHECK constraint failed/);
  });

  it("is append-only", async () => {
    const db = (await loadDb()).getDb();
    db.insert(refunds).values(baseRefund).run();
    db.insert(auditEvents).values(event).run();

    expect(() => db.update(auditEvents).set({ note: "edited" }).run()).toThrow(
      /audit_events is append-only/,
    );
    expect(() => db.delete(auditEvents).run()).toThrow(/audit_events is append-only/);
    expect(db.select().from(auditEvents).all()).toHaveLength(1);
  });

  it("prevents deleting a refund that has audit events", async () => {
    const db = (await loadDb()).getDb();
    db.insert(refunds).values(baseRefund).run();
    db.insert(auditEvents).values(event).run();

    expect(() => db.delete(refunds).where(eq(refunds.id, baseRefund.id)).run()).toThrow(
      /FOREIGN KEY constraint failed/,
    );
  });
});
