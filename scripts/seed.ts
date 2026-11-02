import { asc, count, eq, sql } from "drizzle-orm";
import { seed } from "drizzle-seed";

import { getDb, type DB } from "../src/lib/db";
import {
  auditEvents,
  refunds,
  type ActorRole,
  type NewAuditEvent,
  type Refund,
  type RefundStatus,
} from "../src/lib/schema";

const SEED = 20261101;
const HOUR_MS = 60 * 60 * 1000;
const DAY_MS = 24 * HOUR_MS;

const STATUS_MIX: Record<RefundStatus, number> = {
  pending: 5,
  escalated: 4,
  approved: 6,
  partially_approved: 4,
  rejected: 5,
};
const STATUSES = Object.entries(STATUS_MIX).flatMap(([status, n]) =>
  Array<string>(n).fill(status),
);
const REFUND_COUNT = STATUSES.length;

const REASONS = [
  "Duplicate charge on card",
  "Subscription cancelled but still billed",
  "Charged incorrect amount",
  "Unauthorized transaction reported by customer",
  "Pending authorization not released",
  "Transfer failed but account was debited",
  "FX fee charged at incorrect rate",
  "Overdraft fee waiver request",
  "ATM did not dispense cash",
  "Wire transfer fee charged in error",
];

const AGENTS = ["Maya Chen", "Jordan Lee", "Priya Patel", "Diego Alvarez"];
const MANAGERS = ["Sam Okafor", "Rachel Kim"];
const INTAKE = "refund-intake-bot";

const pick = <T>(list: readonly T[], i: number) => list[i % list.length];
const pad = (n: number) => String(n).padStart(4, "0");

type Actor = { name: string; role: ActorRole };
type Step = {
  status: Exclude<RefundStatus, "pending">;
  actor: Actor;
  note: string;
  amountCents?: number;
};

/** Builds the transition history that ends in the refund's final status. */
function buildTrail(refund: Refund, i: number, approvedPartial: number): Step[] {
  const agent: Actor = { name: pick(AGENTS, i), role: "agent" };
  const manager: Actor = { name: pick(MANAGERS, i), role: "manager" };
  const viaEscalation = i % 2 === 0;
  const escalate: Step = {
    status: "escalated",
    actor: agent,
    note:
      refund.riskScore >= 60
        ? `High risk score (${refund.riskScore}); needs manager review`
        : "Amount above agent approval limit",
  };
  const decider = viaEscalation ? manager : agent;
  const prefix = viaEscalation ? [escalate] : [];

  switch (refund.status) {
    case "pending":
      return [];
    case "escalated":
      return [escalate];
    case "approved":
      return [
        ...prefix,
        {
          status: "approved",
          actor: decider,
          note: "Verified with transaction records",
          amountCents: refund.requestedAmountCents,
        },
      ];
    case "partially_approved":
      return [
        ...prefix,
        {
          status: "partially_approved",
          actor: decider,
          note: "Partial refund for affected items only",
          amountCents: approvedPartial,
        },
      ];
    case "rejected":
      return [
        ...prefix,
        {
          status: "rejected",
          actor: decider,
          note: pick(
            [
              "Reported outside the 60-day dispute window",
              "Customer already received chargeback",
              "Transaction verified as customer-authorized",
            ],
            i,
          ),
        },
      ];
  }
}

async function seedRefunds(db: DB) {
  await db.transaction(async (tx) => {
    const [{ total }] = await tx.select({ total: count() }).from(refunds);
    if (total > 0) {
      console.log(`refunds already has ${total} rows; skipping seed.`);
      return;
    }

    const now = Date.now();
    await seed(tx, { refunds }, { seed: SEED }).refine((f) => ({
      refunds: {
        count: REFUND_COUNT,
        columns: {
          id: f.valuesFromArray({
            values: STATUSES.map((_, i) => `rf_${pad(i + 1)}`),
            isUnique: true,
          }),
          customerName: f.fullName(),
          customerEmail: f.email(),
          transactionId: f.valuesFromArray({
            values: STATUSES.map((_, i) => `txn_${pad(8100 + i * 37)}`),
            isUnique: true,
          }),
          originalAmountCents: f.int({ minValue: 2_500, maxValue: 250_000 }),
          // Placeholder satisfying the requested <= original check; set below.
          requestedAmountCents: f.int({ minValue: 1, maxValue: 2_500 }),
          approvedAmountCents: f.default({ defaultValue: null }),
          currency: f.default({ defaultValue: "USD" }),
          reason: f.valuesFromArray({ values: REASONS }),
          status: f.valuesFromArray({ values: STATUSES, isUnique: true }),
          riskScore: f.int({ minValue: 0, maxValue: 100 }),
          decisionNote: f.default({ defaultValue: null }),
          decidedBy: f.default({ defaultValue: null }),
          decidedAt: f.default({ defaultValue: null }),
          createdAt: f.date({
            minDate: new Date(now - 30 * DAY_MS),
            maxDate: new Date(now - 6 * HOUR_MS),
          }),
          updatedAt: f.default({ defaultValue: new Date(now) }),
        },
      },
    }));

    // Keep updated_at aligned with the last seeded transition instead of now().
    await tx.execute(sql`ALTER TABLE refunds DISABLE TRIGGER refunds_set_updated_at`);

    const rows = await tx.select().from(refunds).orderBy(asc(refunds.id));
    const events: NewAuditEvent[] = [];

    for (const [i, row] of rows.entries()) {
      const fullRefund = i % 3 !== 0;
      const requested = fullRefund
        ? row.originalAmountCents
        : Math.max(1, Math.round((row.originalAmountCents * (30 + (i % 5) * 10)) / 100));
      const approvedPartial = Math.max(1, Math.round(requested * 0.6));
      const refund: Refund = {
        ...row,
        requestedAmountCents: requested,
        customerEmail: `${row.customerName.toLowerCase().replace(/[^a-z]+/g, ".")}@example.com`,
      };

      const createdBy: Actor =
        i % 4 === 0 ? { name: INTAKE, role: "system" } : { name: pick(AGENTS, i + 1), role: "agent" };
      events.push({
        refundId: refund.id,
        action: "created",
        actor: createdBy.name,
        actorRole: createdBy.role,
        fromStatus: null,
        toStatus: "pending",
        amountCents: requested,
        note: refund.reason,
        createdAt: refund.createdAt,
      });

      let status: RefundStatus = "pending";
      let at = refund.createdAt.getTime();
      let decision: Pick<Refund, "approvedAmountCents" | "decisionNote" | "decidedBy" | "decidedAt"> = {
        approvedAmountCents: null,
        decisionNote: null,
        decidedBy: null,
        decidedAt: null,
      };

      const trail = buildTrail(refund, i, approvedPartial);
      for (const [s, step] of trail.entries()) {
        // Cap each step a minute per remaining step before now, so timestamps stay strictly increasing.
        at = Math.min(now - (trail.length - s) * 60_000, at + (2 + ((i + s) % 5) * 3) * HOUR_MS);
        events.push({
          refundId: refund.id,
          action: step.status,
          actor: step.actor.name,
          actorRole: step.actor.role,
          fromStatus: status,
          toStatus: step.status,
          amountCents: step.amountCents ?? null,
          note: step.note,
          createdAt: new Date(at),
        });
        status = step.status;
        if (step.status !== "escalated") {
          decision = {
            approvedAmountCents: step.amountCents ?? null,
            decisionNote: step.note,
            decidedBy: step.actor.name,
            decidedAt: new Date(at),
          };
        }
      }

      await tx
        .update(refunds)
        .set({
          requestedAmountCents: refund.requestedAmountCents,
          customerEmail: refund.customerEmail,
          ...decision,
          updatedAt: new Date(at),
        })
        .where(eq(refunds.id, refund.id));
    }

    await tx.execute(sql`ALTER TABLE refunds ENABLE TRIGGER refunds_set_updated_at`);
    await tx.insert(auditEvents).values(events);
    console.log(`Seeded ${rows.length} refunds and ${events.length} audit events.`);
  });
}

async function main() {
  const db = await getDb();
  try {
    await seedRefunds(db);
  } finally {
    await db.$client.close();
  }
}

main().catch((err) => {
  console.error(err);
  process.exitCode = 1;
});
