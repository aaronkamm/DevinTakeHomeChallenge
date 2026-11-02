import { FRAUD_REVIEW_REASONS } from "@/lib/decision-rules";
import { INTAKE } from "@/lib/reviewers";
import type { NewAuditEvent, NewRefund, Refund } from "@/lib/schema";

/** Fixed clock for fixture rows so every run sees the same data. */
export const FIXTURE_CREATED_AT = new Date("2026-10-01T09:00:00.000Z");
export const FIXTURE_DECIDED_AT = new Date("2026-10-02T15:30:00.000Z");

export const FIXTURE_IDS = {
  /** Pending, $125, risk 12: any agent or manager may decide it. */
  lowRisk: "RF-T-LOW",
  /** Pending, $750: above the agent approval limit. */
  overLimit: "RF-T-LIMIT",
  /** Pending, $200, risk 72: high risk. */
  highRisk: "RF-T-RISK",
  /** Pending card-fraud claim: fraud analysts only. */
  fraud: "RF-T-FRAUD",
  /** Already approved by a manager. */
  decided: "RF-T-DONE",
  /** Escalated by an agent, waiting for a manager. */
  escalated: "RF-T-ESC",
} as const;

const BASE = {
  customerName: "Test Customer",
  customerEmail: "customer@example.com",
  accountId: "ACC-0001",
  paymentMethod: "card",
  merchantName: "Corner Coffee",
  currency: "USD",
  reason: "Duplicate charge on card",
  status: "pending",
  riskScore: 12,
  createdAt: FIXTURE_CREATED_AT,
  updatedAt: FIXTURE_CREATED_AT,
} as const satisfies Partial<NewRefund>;

export const FIXTURE_REFUNDS = [
  {
    ...BASE,
    id: FIXTURE_IDS.lowRisk,
    transactionId: "TXN-LOW",
    originalAmountCents: 12_500,
    requestedAmountCents: 12_500,
  },
  {
    ...BASE,
    id: FIXTURE_IDS.overLimit,
    transactionId: "TXN-LIMIT",
    paymentMethod: "wire",
    merchantName: null,
    reason: "Wire transfer fee charged in error",
    originalAmountCents: 90_000,
    requestedAmountCents: 75_000,
    riskScore: 20,
  },
  {
    ...BASE,
    id: FIXTURE_IDS.highRisk,
    transactionId: "TXN-RISK",
    reason: "Charged incorrect amount",
    originalAmountCents: 20_000,
    requestedAmountCents: 20_000,
    riskScore: 72,
  },
  {
    ...BASE,
    id: FIXTURE_IDS.fraud,
    transactionId: "TXN-FRAUD",
    reason: FRAUD_REVIEW_REASONS[0],
    originalAmountCents: 30_000,
    requestedAmountCents: 30_000,
    riskScore: 40,
  },
  {
    ...BASE,
    id: FIXTURE_IDS.decided,
    transactionId: "TXN-DONE",
    originalAmountCents: 9_900,
    requestedAmountCents: 9_900,
    approvedAmountCents: 9_900,
    status: "approved",
    decisionNote: "Duplicate confirmed on statement",
    decidedBy: "Sam Okafor",
    decidedAt: FIXTURE_DECIDED_AT,
    updatedAt: FIXTURE_DECIDED_AT,
  },
  {
    ...BASE,
    id: FIXTURE_IDS.escalated,
    transactionId: "TXN-ESC",
    originalAmountCents: 8_000,
    requestedAmountCents: 8_000,
    status: "escalated",
    updatedAt: FIXTURE_DECIDED_AT,
  },
] as const satisfies readonly NewRefund[];

export const FIXTURE_AUDIT_EVENTS: NewAuditEvent[] = [
  ...FIXTURE_REFUNDS.map(
    (r): NewAuditEvent => ({
      refundId: r.id,
      action: "created",
      actor: INTAKE,
      actorRole: "system",
      fromStatus: null,
      toStatus: "pending",
      amountCents: r.requestedAmountCents,
      note: r.reason,
      createdAt: FIXTURE_CREATED_AT,
    }),
  ),
  {
    refundId: FIXTURE_IDS.decided,
    action: "approved",
    actor: "Sam Okafor",
    actorRole: "manager",
    fromStatus: "pending",
    toStatus: "approved",
    amountCents: 9_900,
    note: "Duplicate confirmed on statement",
    createdAt: FIXTURE_DECIDED_AT,
  },
  {
    refundId: FIXTURE_IDS.escalated,
    action: "escalated",
    actor: "Maya Chen",
    actorRole: "agent",
    fromStatus: "pending",
    toStatus: "escalated",
    amountCents: null,
    note: "Customer disputes the merchant's response",
    createdAt: FIXTURE_DECIDED_AT,
  },
];

type FixtureKey = keyof typeof FIXTURE_IDS;

/** A fully populated `Refund` row for one fixture, for tests that don't need a database. */
export function fixtureRefund(key: FixtureKey, overrides: Partial<Refund> = {}): Refund {
  const row: NewRefund = FIXTURE_REFUNDS.find((r) => r.id === FIXTURE_IDS[key])!;
  return {
    merchantName: null,
    approvedAmountCents: null,
    decisionNote: null,
    decidedBy: null,
    decidedAt: null,
    ...row,
    currency: row.currency ?? "USD",
    status: row.status ?? "pending",
    riskScore: row.riskScore ?? 0,
    createdAt: row.createdAt ?? FIXTURE_CREATED_AT,
    updatedAt: row.updatedAt ?? FIXTURE_CREATED_AT,
    ...overrides,
  };
}
