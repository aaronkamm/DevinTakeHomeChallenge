import { asc, eq } from "drizzle-orm";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import {
  approveRefund,
  escalateRefund,
  partiallyApproveRefund,
  rejectRefund,
  type PartialDecisionInput,
} from "@/app/refunds/[id]/actions";
import { ACTOR_NAME_COOKIE, ACTOR_ROLE_COOKIE } from "@/lib/actor";
import type { DB } from "@/lib/db";
import { REVIEWERS_BY_ROLE, type ReviewerRole } from "@/lib/reviewers";
import { auditEvents, refunds } from "@/lib/schema";

import { closeTestDb, createTestDb } from "../helpers/db";
import { FIXTURE_IDS } from "../helpers/fixtures";

// The server actions read the actor from request cookies and revalidate pages afterwards; those
// are the only Next.js pieces stubbed out. Everything below them (Drizzle, PGlite, the
// migrations and triggers) is real.
const { cookieJar, revalidatePath } = vi.hoisted(() => ({
  cookieJar: new Map<string, string>(),
  revalidatePath: vi.fn(),
}));

vi.mock("next/headers", () => ({
  cookies: async () => ({
    get: (name: string) => {
      const value = cookieJar.get(name);
      return value === undefined ? undefined : { name, value };
    },
  }),
}));

vi.mock("next/cache", () => ({ revalidatePath }));

let db: DB;

beforeEach(async () => {
  db = await createTestDb();
  cookieJar.clear();
  revalidatePath.mockClear();
});

afterEach(async () => {
  await closeTestDb(db);
});

function actAs(role: ReviewerRole) {
  const name = REVIEWERS_BY_ROLE[role][0];
  cookieJar.set(ACTOR_NAME_COOKIE, name);
  cookieJar.set(ACTOR_ROLE_COOKIE, role);
  return name;
}

async function getRefund(id: string) {
  const [row] = await db.select().from(refunds).where(eq(refunds.id, id));
  return row;
}

function auditTrail(id: string) {
  return db
    .select()
    .from(auditEvents)
    .where(eq(auditEvents.refundId, id))
    .orderBy(asc(auditEvents.id));
}

/** Runs an action that should be refused and checks it changed nothing. */
async function expectRefused(
  id: string,
  run: () => Promise<{ ok: boolean; error?: string }>,
  error: string | RegExp,
) {
  const refundBefore = await getRefund(id);
  const auditCountBefore = await db.$count(auditEvents);
  revalidatePath.mockClear();

  const result = await run();

  expect(result.ok).toBe(false);
  expect(result.error).toMatch(error);
  expect(await getRefund(id)).toEqual(refundBefore);
  expect(await db.$count(auditEvents)).toBe(auditCountBefore);
  expect(revalidatePath).not.toHaveBeenCalled();
}

describe("approveRefund", () => {
  it("approves the full requested amount and appends exactly one audit event", async () => {
    const name = actAs("agent");
    const before = await getRefund(FIXTURE_IDS.lowRisk);
    const trailBefore = await auditTrail(FIXTURE_IDS.lowRisk);
    const totalBefore = await db.$count(auditEvents);
    const start = Date.now();

    const result = await approveRefund(FIXTURE_IDS.lowRisk, { note: "  Duplicate confirmed  " });

    expect(result).toEqual({ ok: true });
    const after = await getRefund(FIXTURE_IDS.lowRisk);
    expect(after).toMatchObject({
      status: "approved",
      approvedAmountCents: before.requestedAmountCents,
      decidedBy: name,
      decisionNote: "Duplicate confirmed",
    });
    expect(after.decidedAt).toBeInstanceOf(Date);
    expect(after.decidedAt!.getTime()).toBeGreaterThanOrEqual(start - 1000);
    expect(after.decidedAt!.getTime()).toBeLessThanOrEqual(Date.now() + 1000);
    // Fields the decision shouldn't touch.
    expect(after.requestedAmountCents).toBe(before.requestedAmountCents);
    expect(after.originalAmountCents).toBe(before.originalAmountCents);

    expect(await db.$count(auditEvents)).toBe(totalBefore + 1);
    const trail = await auditTrail(FIXTURE_IDS.lowRisk);
    expect(trail).toHaveLength(trailBefore.length + 1);
    expect(trail.at(-1)).toMatchObject({
      action: "approved",
      actor: name,
      actorRole: "agent",
      fromStatus: "pending",
      toStatus: "approved",
      amountCents: before.requestedAmountCents,
      note: "Duplicate confirmed",
      createdAt: after.decidedAt,
    });

    expect(revalidatePath).toHaveBeenCalledWith(`/refunds/${FIXTURE_IDS.lowRisk}`);
    expect(revalidatePath).toHaveBeenCalledWith("/");
  });

  it("stores an empty note as null", async () => {
    actAs("agent");
    await approveRefund(FIXTURE_IDS.lowRisk, { note: "   " });
    expect((await getRefund(FIXTURE_IDS.lowRisk)).decisionNote).toBeNull();
    expect((await auditTrail(FIXTURE_IDS.lowRisk)).at(-1)?.note).toBeNull();
  });

  it("falls back to the default agent when the actor cookies are missing", async () => {
    await approveRefund(FIXTURE_IDS.lowRisk);
    expect((await getRefund(FIXTURE_IDS.lowRisk)).decidedBy).toBe(REVIEWERS_BY_ROLE.agent[0]);
  });

  it("returns an error for an unknown refund", async () => {
    actAs("manager");
    expect(await approveRefund("RF-NOPE")).toEqual({ ok: false, error: "Refund not found." });
  });
});

describe("rejectRefund", () => {
  it("records the decision without an approved amount", async () => {
    const name = actAs("manager");
    expect(await rejectRefund(FIXTURE_IDS.highRisk, { note: "Outside policy" })).toEqual({
      ok: true,
    });
    expect(await getRefund(FIXTURE_IDS.highRisk)).toMatchObject({
      status: "rejected",
      approvedAmountCents: null,
      decidedBy: name,
      decisionNote: "Outside policy",
    });
    expect((await auditTrail(FIXTURE_IDS.highRisk)).at(-1)).toMatchObject({
      action: "rejected",
      actorRole: "manager",
      amountCents: null,
    });
  });
});

describe("partiallyApproveRefund", () => {
  it("approves a smaller amount", async () => {
    const name = actAs("agent");
    expect(await partiallyApproveRefund(FIXTURE_IDS.lowRisk, { amountCents: 5_000 })).toEqual({
      ok: true,
    });
    expect(await getRefund(FIXTURE_IDS.lowRisk)).toMatchObject({
      status: "partially_approved",
      approvedAmountCents: 5_000,
      decidedBy: name,
    });
    expect((await auditTrail(FIXTURE_IDS.lowRisk)).at(-1)).toMatchObject({
      action: "partially_approved",
      toStatus: "partially_approved",
      amountCents: 5_000,
    });
  });

  it("accepts one cent less than requested", async () => {
    actAs("agent");
    expect(await partiallyApproveRefund(FIXTURE_IDS.lowRisk, { amountCents: 12_499 })).toEqual({
      ok: true,
    });
  });

  it.each([
    ["missing", undefined],
    ["a string", "5000"],
    ["fractional cents", 12.5],
    ["NaN", Number.NaN],
    ["Infinity", Number.POSITIVE_INFINITY],
    ["above the safe integer range", Number.MAX_SAFE_INTEGER + 1],
  ])("refuses an amount that is %s", async (_, amountCents) => {
    actAs("agent");
    await expectRefused(
      FIXTURE_IDS.lowRisk,
      () =>
        partiallyApproveRefund(FIXTURE_IDS.lowRisk, { amountCents } as unknown as PartialDecisionInput),
      "Enter the partial amount as a whole number of cents.",
    );
  });

  it.each([0, -100])("refuses %i cents", async (amountCents) => {
    actAs("agent");
    await expectRefused(
      FIXTURE_IDS.lowRisk,
      () => partiallyApproveRefund(FIXTURE_IDS.lowRisk, { amountCents }),
      "Partial amount must be greater than zero.",
    );
  });

  // A "partial" approval of the full amount would read as a bug, so it must be strictly smaller.
  it.each([
    ["equal to", 12_500],
    ["above", 12_501],
  ])("refuses an amount %s the requested amount", async (_, amountCents) => {
    actAs("agent");
    await expectRefused(
      FIXTURE_IDS.lowRisk,
      () => partiallyApproveRefund(FIXTURE_IDS.lowRisk, { amountCents }),
      /^Partial amount must be less than the requested amount/,
    );
  });
});

describe("input validation", () => {
  it("refuses a note over 1000 characters", async () => {
    actAs("agent");
    await expectRefused(
      FIXTURE_IDS.lowRisk,
      () => approveRefund(FIXTURE_IDS.lowRisk, { note: "x".repeat(1001) }),
      "Note must be 1000 characters or fewer.",
    );
  });

  it("refuses a note that isn't text", async () => {
    actAs("agent");
    await expectRefused(
      FIXTURE_IDS.lowRisk,
      () => approveRefund(FIXTURE_IDS.lowRisk, { note: 42 } as never),
      "Note must be text.",
    );
  });
});

describe("already-decided refunds", () => {
  const actions = {
    approve: () => approveRefund(FIXTURE_IDS.decided),
    partially_approve: () => partiallyApproveRefund(FIXTURE_IDS.decided, { amountCents: 100 }),
    reject: () => rejectRefund(FIXTURE_IDS.decided),
    escalate: () => escalateRefund(FIXTURE_IDS.decided),
  };

  it.each(Object.keys(actions) as (keyof typeof actions)[])("refuses %s", async (action) => {
    actAs("manager");
    await expectRefused(
      FIXTURE_IDS.decided,
      actions[action],
      "This refund is already approved and can't be changed.",
    );
  });

  it("refuses a second decision on a refund decided in this test", async () => {
    actAs("agent");
    expect((await rejectRefund(FIXTURE_IDS.lowRisk)).ok).toBe(true);
    await expectRefused(
      FIXTURE_IDS.lowRisk,
      () => approveRefund(FIXTURE_IDS.lowRisk),
      "This refund is already rejected and can't be changed.",
    );
  });
});

describe("role enforcement", () => {
  it.each([
    ["overLimit", "manager", "Amount is above the agent approval limit"],
    ["highRisk", "manager", "Risk score is 60 or higher"],
    ["fraud", "fraud analyst", "Card-fraud claims are decided by the fraud team"],
  ] as const)("blocks an agent on the %s refund", async (key, who, why) => {
    actAs("agent");
    const id = FIXTURE_IDS[key];
    const expected = `Only a ${who} can decide this refund. ${why}.`;
    await expectRefused(id, () => approveRefund(id), expected);
    await expectRefused(id, () => partiallyApproveRefund(id, { amountCents: 100 }), expected);
    await expectRefused(id, () => rejectRefund(id), expected);
  });

  it.each(["manager", "agent"] as const)(
    "blocks a %s on a card-fraud refund",
    async (role) => {
      actAs(role);
      await expectRefused(
        FIXTURE_IDS.fraud,
        () => approveRefund(FIXTURE_IDS.fraud),
        /^Only a fraud analyst can decide this refund/,
      );
    },
  );

  it("lets a manager decide over-limit and high-risk refunds", async () => {
    actAs("manager");
    expect(await approveRefund(FIXTURE_IDS.overLimit)).toEqual({ ok: true });
    expect(await partiallyApproveRefund(FIXTURE_IDS.highRisk, { amountCents: 10_000 })).toEqual({
      ok: true,
    });
  });

  it("lets a fraud analyst decide a card-fraud refund", async () => {
    const name = actAs("fraud_analyst");
    expect(await rejectRefund(FIXTURE_IDS.fraud)).toEqual({ ok: true });
    expect((await auditTrail(FIXTURE_IDS.fraud)).at(-1)).toMatchObject({
      actor: name,
      actorRole: "fraud_analyst",
    });
  });

  it("blocks a fraud analyst on an ordinary refund", async () => {
    actAs("fraud_analyst");
    await expectRefused(
      FIXTURE_IDS.lowRisk,
      () => approveRefund(FIXTURE_IDS.lowRisk),
      /^Only a manager can decide this refund/,
    );
  });
});

describe("escalateRefund", () => {
  it.each([
    ["agent", "lowRisk"],
    ["agent", "overLimit"],
    ["agent", "highRisk"],
    ["agent", "fraud"],
    ["manager", "fraud"],
    ["fraud_analyst", "overLimit"],
  ] as const)("lets a %s escalate the %s refund", async (role, key) => {
    const name = actAs(role);
    const id = FIXTURE_IDS[key];

    expect(await escalateRefund(id, { note: "Needs a second look" })).toEqual({ ok: true });

    // Escalating isn't a decision, so the decision fields stay empty.
    expect(await getRefund(id)).toMatchObject({
      status: "escalated",
      approvedAmountCents: null,
      decidedBy: null,
      decidedAt: null,
      decisionNote: null,
    });
    expect((await auditTrail(id)).at(-1)).toMatchObject({
      action: "escalated",
      actor: name,
      actorRole: role,
      fromStatus: "pending",
      toStatus: "escalated",
      amountCents: null,
      note: "Needs a second look",
    });
  });

  it("refuses to escalate an escalated refund", async () => {
    actAs("manager");
    await expectRefused(
      FIXTURE_IDS.escalated,
      () => escalateRefund(FIXTURE_IDS.escalated),
      "This refund has already been escalated.",
    );
  });

  it("leaves an escalated refund open for a manager to decide", async () => {
    actAs("agent");
    await expectRefused(
      FIXTURE_IDS.escalated,
      () => approveRefund(FIXTURE_IDS.escalated),
      "Only a manager can decide this refund. Escalated refunds are decided by a manager.",
    );

    const name = actAs("manager");
    expect(await approveRefund(FIXTURE_IDS.escalated)).toEqual({ ok: true });
    expect(await getRefund(FIXTURE_IDS.escalated)).toMatchObject({
      status: "approved",
      approvedAmountCents: 8_000,
      decidedBy: name,
    });
    expect((await auditTrail(FIXTURE_IDS.escalated)).at(-1)).toMatchObject({
      action: "approved",
      fromStatus: "escalated",
      toStatus: "approved",
    });
  });
});
