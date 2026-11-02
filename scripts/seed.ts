import { asc, count, eq, sql } from "drizzle-orm";
import { seed } from "drizzle-seed";

import { getDb, type DB } from "../src/lib/db";
import {
  auditEvents,
  refunds,
  type ActorRole,
  type NewAuditEvent,
  type PaymentMethod,
  type Refund,
  type RefundStatus,
} from "../src/lib/schema";

const SEED = 15;
const HOUR_MS = 60 * 60 * 1000;
const DAY_MS = 24 * HOUR_MS;

/** Agents decide refunds up to this amount with a risk score below HIGH_RISK_SCORE; anything else goes to a manager. */
const AGENT_APPROVAL_LIMIT_CENTS = 50_000;
const HIGH_RISK_SCORE = 60;

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

type ReasonProfile = {
  reason: string;
  paymentMethod: PaymentMethod;
  amountCents: [min: number, max: number];
  riskScore: [min: number, max: number];
  merchants?: readonly string[];
  /** Customer disputes only part of the original charge. */
  partialRequest?: boolean;
  /** Amounts are whole multiples of this (e.g. ATM cash in $20 notes). */
  roundToCents?: number;
  /** Always routed to the fraud team rather than decided by an agent. */
  fraudReview?: boolean;
  approveNote: string;
  partialNote: string;
  rejectNotes: readonly string[];
};

const REASON_PROFILES: readonly ReasonProfile[] = [
  {
    reason: "Duplicate charge on card",
    paymentMethod: "card",
    amountCents: [500, 60_000],
    riskScore: [5, 40],
    merchants: ["Amazon Marketplace", "Whole Foods Market", "Uber", "DoorDash", "Best Buy"],
    approveNote: "Duplicate settlement confirmed in card network records",
    partialNote: "Refunded duplicate net of merchant's partial reversal",
    rejectNotes: ["Second charge is a separate valid purchase", "Merchant already reversed the duplicate"],
  },
  {
    reason: "Subscription cancelled but still billed",
    paymentMethod: "card",
    amountCents: [800, 6_000],
    riskScore: [0, 30],
    merchants: ["Netflix", "Spotify", "Adobe", "Peloton", "LinkedIn Premium"],
    approveNote: "Cancellation confirmed before billing date",
    partialNote: "Prorated refund for unused billing period",
    rejectNotes: ["Charge predates cancellation date", "Merchant refund already issued"],
  },
  {
    reason: "Charged incorrect amount",
    paymentMethod: "card",
    amountCents: [2_000, 120_000],
    riskScore: [5, 50],
    merchants: ["Shell", "Marriott Hotels", "Delta Air Lines", "The Home Depot"],
    partialRequest: true,
    approveNote: "Receipt confirms overcharge",
    partialNote: "Refunded verified overcharge; remainder matches receipt",
    rejectNotes: ["Amount matches signed receipt", "Difference is a disclosed surcharge"],
  },
  {
    reason: "Unauthorized transaction reported by customer",
    paymentMethod: "card",
    amountCents: [4_000, 250_000],
    riskScore: [55, 95],
    merchants: ["Steam Games", "Apple.com/bill", "Walmart.com", "Coinbase"],
    fraudReview: true,
    approveNote: "Fraud confirmed; card blocked and reissued",
    partialNote: "Refunded charges made after card was reported lost",
    rejectNotes: [
      "Transaction verified as customer-authorized (device match)",
      "Reported outside the 60-day dispute window",
      "Customer already received chargeback",
    ],
  },
  {
    reason: "Pending authorization not released",
    paymentMethod: "card",
    amountCents: [5_000, 80_000],
    riskScore: [0, 35],
    merchants: ["Hertz", "Hilton Hotels", "Chevron", "Enterprise Rent-A-Car"],
    approveNote: "Stale authorization released",
    partialNote: "Released hold amount above final charge",
    rejectNotes: ["Hold converted to valid final charge", "Authorization already released by merchant"],
  },
  {
    reason: "Transfer failed but account was debited",
    paymentMethod: "ach",
    amountCents: [10_000, 300_000],
    riskScore: [20, 70],
    approveNote: "ACH return confirmed by receiving bank",
    partialNote: "Credited amount returned by receiving bank",
    rejectNotes: ["Transfer completed; funds received by beneficiary bank"],
  },
  {
    reason: "FX fee charged at incorrect rate",
    paymentMethod: "card",
    amountCents: [300, 7_500],
    riskScore: [0, 25],
    merchants: ["Air France", "Harrods", "Uniqlo Tokyo", "Booking.com"],
    approveNote: "FX markup exceeded disclosed rate; fee refunded",
    partialNote: "Refunded difference from network exchange rate",
    rejectNotes: ["FX rate matches network rate on settlement date"],
  },
  {
    reason: "Overdraft fee waiver request",
    paymentMethod: "account_fee",
    amountCents: [2_500, 3_900],
    riskScore: [0, 20],
    approveNote: "Courtesy overdraft fee waiver granted",
    partialNote: "Partial courtesy waiver applied",
    rejectNotes: ["Fee waiver already used in last 12 months"],
  },
  {
    reason: "ATM did not dispense cash",
    paymentMethod: "atm",
    amountCents: [4_000, 50_000],
    riskScore: [10, 60],
    merchants: ["Allpoint ATM", "Cardtronics ATM", "MoneyPass ATM"],
    roundToCents: 2_000,
    approveNote: "ATM journal shows no cash dispensed",
    partialNote: "ATM journal shows partial dispense; shortfall refunded",
    rejectNotes: ["ATM journal confirms full cash dispense"],
  },
  {
    reason: "Wire transfer fee charged in error",
    paymentMethod: "wire",
    amountCents: [1_500, 5_000],
    riskScore: [0, 20],
    approveNote: "Fee not applicable to this wire type",
    partialNote: "Refunded difference from domestic wire fee",
    rejectNotes: ["Wire fee disclosed and accepted at initiation"],
  },
];
const PROFILE_BY_REASON = new Map(REASON_PROFILES.map((p) => [p.reason, p]));
// Every reason appears at least twice; drizzle-seed shuffles the order.
const REASONS = Array.from({ length: REFUND_COUNT }, (_, i) => REASON_PROFILES[i % REASON_PROFILES.length].reason);

const AGENTS = ["Maya Chen", "Jordan Lee", "Priya Patel", "Diego Alvarez"];
const MANAGERS = ["Sam Okafor", "Rachel Kim"];
const FRAUD_ANALYSTS = ["Elena Novak", "Marcus Webb"];
const INTAKE = "refund-intake-bot";

// drizzle-seed generates these raw ranges; they are rescaled into each reason's range.
const RAW_AMOUNT: [number, number] = [1, 10_000];
const RAW_RISK: [number, number] = [0, 100];

const pick = <T>(list: readonly T[], i: number) => list[i % list.length];
const pad = (n: number) => String(n).padStart(4, "0");

// Mostly USD accounts, plus a few EUR/GBP/CAD accounts.
const CURRENCIES = Array.from({ length: REFUND_COUNT }, (_, i) => (i < 18 ? "USD" : pick(["EUR", "GBP", "CAD"], i)));
const rescale = (raw: number, [rawMin, rawMax]: [number, number], [min, max]: [number, number]) =>
  Math.round(min + ((raw - rawMin) / (rawMax - rawMin)) * (max - min));
const roundTo = (cents: number, step = 1) => Math.max(step, Math.floor(cents / step) * step);
const money = (cents: number, currency: string) => `${(cents / 100).toFixed(2)} ${currency}`;

type Actor = { name: string; role: ActorRole };
type Step = {
  status: Exclude<RefundStatus, "pending">;
  actor: Actor;
  note: string;
  amountCents?: number;
};

/** Why a refund needs review above agent level, or null if an agent may decide it. */
function escalationFor(refund: Refund, profile: ReasonProfile, i: number) {
  if (profile.fraudReview) {
    return { reviewer: { name: pick(FRAUD_ANALYSTS, i), role: "fraud_analyst" } as Actor, note: "Possible card fraud; routed to fraud review" };
  }
  const manager: Actor = { name: pick(MANAGERS, i), role: "manager" };
  if (refund.requestedAmountCents > AGENT_APPROVAL_LIMIT_CENTS) {
    return { reviewer: manager, note: `Amount above ${money(AGENT_APPROVAL_LIMIT_CENTS, refund.currency)} agent approval limit` };
  }
  if (refund.riskScore >= HIGH_RISK_SCORE) {
    return { reviewer: manager, note: `High risk score (${refund.riskScore}); needs manager review` };
  }
  return null;
}

const MANUAL_ESCALATION_NOTES = [
  "Repeat refund request on this account; needs manager review",
  "Customer disputes earlier decision; second review requested",
  "Merchant evidence conflicts with customer claim",
] as const;

/** Builds the transition history that ends in the refund's final status. */
function buildTrail(refund: Refund, profile: ReasonProfile, i: number): Step[] {
  const agent: Actor = { name: pick(AGENTS, i), role: "agent" };
  const escalation = escalationFor(refund, profile, i);

  if (refund.status === "pending") return [];
  if (refund.status === "escalated") {
    const note = escalation?.note ?? pick(MANUAL_ESCALATION_NOTES, i);
    return [{ status: "escalated", actor: agent, note }];
  }

  const prefix: Step[] = escalation ? [{ status: "escalated", actor: agent, note: escalation.note }] : [];
  const decider = escalation?.reviewer ?? agent;
  const requested = refund.requestedAmountCents;

  switch (refund.status) {
    case "approved":
      return [...prefix, { status: "approved", actor: decider, note: profile.approveNote, amountCents: requested }];
    case "partially_approved":
      return [
        ...prefix,
        {
          status: "partially_approved",
          actor: decider,
          note: profile.partialNote,
          amountCents: Math.min(requested - 1, roundTo(Math.round(requested * 0.6), profile.roundToCents)),
        },
      ];
    case "rejected":
      return [...prefix, { status: "rejected", actor: decider, note: pick(profile.rejectNotes, i) }];
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
          accountId: f.valuesFromArray({
            values: STATUSES.map((_, i) => `acct_${410_000 + i * 7_919}`),
            isUnique: true,
          }),
          // Placeholders; set from the reason profile below.
          paymentMethod: f.default({ defaultValue: "card" }),
          merchantName: f.default({ defaultValue: null }),
          originalAmountCents: f.int({ minValue: RAW_AMOUNT[0], maxValue: RAW_AMOUNT[1] }),
          requestedAmountCents: f.default({ defaultValue: 1 }),
          approvedAmountCents: f.default({ defaultValue: null }),
          currency: f.valuesFromArray({ values: CURRENCIES, isUnique: true }),
          reason: f.valuesFromArray({ values: REASONS, isUnique: true }),
          status: f.valuesFromArray({ values: STATUSES, isUnique: true }),
          riskScore: f.int({ minValue: RAW_RISK[0], maxValue: RAW_RISK[1] }),
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
      const profile = PROFILE_BY_REASON.get(row.reason);
      if (!profile) throw new Error(`No profile for reason "${row.reason}"`);

      const original = roundTo(rescale(row.originalAmountCents, RAW_AMOUNT, profile.amountCents), profile.roundToCents);
      const requested = profile.partialRequest
        ? Math.max(1, Math.round((original * (20 + (i % 5) * 10)) / 100))
        : original;
      const refund: Refund = {
        ...row,
        paymentMethod: profile.paymentMethod,
        merchantName: profile.merchants ? pick(profile.merchants, i) : null,
        originalAmountCents: original,
        requestedAmountCents: requested,
        riskScore: rescale(row.riskScore, RAW_RISK, profile.riskScore),
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

      const trail = buildTrail(refund, profile, i);
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
          paymentMethod: refund.paymentMethod,
          merchantName: refund.merchantName,
          originalAmountCents: refund.originalAmountCents,
          requestedAmountCents: refund.requestedAmountCents,
          riskScore: refund.riskScore,
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
