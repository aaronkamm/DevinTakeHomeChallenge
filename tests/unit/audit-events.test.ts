import { eq } from "drizzle-orm";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

import type { DB } from "@/lib/db";
import { auditEvents } from "@/lib/schema";

import { closeTestDb, createTestDb } from "../helpers/db";
import { FIXTURE_IDS } from "../helpers/fixtures";

let db: DB;

beforeEach(async () => {
  db = await createTestDb();
});

afterEach(async () => {
  await closeTestDb(db);
});

/** Drizzle wraps driver errors, so look for the trigger's message anywhere in the cause chain. */
async function expectAppendOnlyError(query: Promise<unknown>) {
  const err = await query.then(
    () => null,
    (e: unknown) => e,
  );
  expect(err, "expected the query to fail").toBeInstanceOf(Error);
  const messages: string[] = [];
  for (let e: unknown = err; e instanceof Error; e = e.cause) messages.push(e.message);
  expect(messages.join("\n")).toMatch(/audit_events is append-only/);
}

describe("audit_events append-only trigger", () => {
  it("allows inserts", async () => {
    const [row] = await db
      .insert(auditEvents)
      .values({
        refundId: FIXTURE_IDS.lowRisk,
        action: "escalated",
        actor: "Maya Chen",
        actorRole: "agent",
        fromStatus: "pending",
        toStatus: "escalated",
      })
      .returning();
    expect(row.id).toBeGreaterThan(0);
  });

  it("rejects UPDATE", async () => {
    const [before] = await db.select().from(auditEvents).limit(1);
    await expectAppendOnlyError(
      db.update(auditEvents).set({ note: "tampered" }).where(eq(auditEvents.id, before.id)),
    );
    await expectAppendOnlyError(db.$client.query("UPDATE audit_events SET actor = 'someone else'"));

    const [after] = await db.select().from(auditEvents).where(eq(auditEvents.id, before.id));
    expect(after).toEqual(before);
  });

  it("rejects DELETE", async () => {
    const countBefore = await db.$count(auditEvents);
    expect(countBefore).toBeGreaterThan(0);

    const [first] = await db.select().from(auditEvents).limit(1);
    await expectAppendOnlyError(db.delete(auditEvents).where(eq(auditEvents.id, first.id)));
    await expectAppendOnlyError(db.$client.query("DELETE FROM audit_events"));

    expect(await db.$count(auditEvents)).toBe(countBefore);
  });
});
