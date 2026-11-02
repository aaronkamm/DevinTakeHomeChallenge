import { sql } from "drizzle-orm";
import {
  bigserial,
  check,
  index,
  integer,
  pgTable,
  text,
  timestamp,
} from "drizzle-orm/pg-core";

export const REFUND_STATUSES = [
  "pending",
  "escalated",
  "approved",
  "partially_approved",
  "rejected",
] as const;
export type RefundStatus = (typeof REFUND_STATUSES)[number];

export const AUDIT_ACTIONS = [
  "created",
  "approved",
  "partially_approved",
  "rejected",
  "escalated",
] as const;
export type AuditAction = (typeof AUDIT_ACTIONS)[number];

export const ACTOR_ROLES = ["agent", "manager", "system"] as const;
export type ActorRole = (typeof ACTOR_ROLES)[number];

const inList = (values: readonly string[]) =>
  sql.raw(values.map((v) => `'${v}'`).join(", "));

const timestamptz = (name: string) =>
  timestamp(name, { withTimezone: true, mode: "date" });

export const refunds = pgTable(
  "refunds",
  {
    id: text("id").primaryKey(),
    customerName: text("customer_name").notNull(),
    customerEmail: text("customer_email").notNull(),
    transactionId: text("transaction_id").notNull(),
    originalAmountCents: integer("original_amount_cents").notNull(),
    requestedAmountCents: integer("requested_amount_cents").notNull(),
    approvedAmountCents: integer("approved_amount_cents"),
    currency: text("currency").notNull().default("USD"),
    reason: text("reason").notNull(),
    status: text("status", { enum: REFUND_STATUSES })
      .notNull()
      .default("pending"),
    riskScore: integer("risk_score").notNull().default(0),
    decisionNote: text("decision_note"),
    decidedBy: text("decided_by"),
    decidedAt: timestamptz("decided_at"),
    createdAt: timestamptz("created_at").notNull().defaultNow(),
    // Maintained by the refunds_set_updated_at trigger (see drizzle/0001_*.sql).
    updatedAt: timestamptz("updated_at").notNull().defaultNow(),
  },
  (t) => [
    index("refunds_status_idx").on(t.status),
    index("refunds_created_at_idx").on(t.createdAt),
    index("refunds_transaction_id_idx").on(t.transactionId),
    check("refunds_status_check", sql`${t.status} IN (${inList(REFUND_STATUSES)})`),
    check("refunds_original_amount_check", sql`${t.originalAmountCents} > 0`),
    check(
      "refunds_requested_amount_check",
      sql`${t.requestedAmountCents} > 0 AND ${t.requestedAmountCents} <= ${t.originalAmountCents}`,
    ),
    check(
      "refunds_approved_amount_check",
      sql`${t.approvedAmountCents} IS NULL OR (${t.approvedAmountCents} > 0 AND ${t.approvedAmountCents} <= ${t.requestedAmountCents})`,
    ),
    check("refunds_risk_score_check", sql`${t.riskScore} BETWEEN 0 AND 100`),
  ],
);

export const auditEvents = pgTable(
  "audit_events",
  {
    id: bigserial("id", { mode: "number" }).primaryKey(),
    refundId: text("refund_id")
      .notNull()
      .references(() => refunds.id, { onDelete: "restrict" }),
    action: text("action", { enum: AUDIT_ACTIONS }).notNull(),
    actor: text("actor").notNull(),
    actorRole: text("actor_role", { enum: ACTOR_ROLES }).notNull(),
    fromStatus: text("from_status", { enum: REFUND_STATUSES }),
    toStatus: text("to_status", { enum: REFUND_STATUSES }).notNull(),
    amountCents: integer("amount_cents"),
    note: text("note"),
    createdAt: timestamptz("created_at").notNull().defaultNow(),
  },
  (t) => [
    index("audit_events_refund_id_idx").on(t.refundId, t.createdAt),
    check("audit_events_action_check", sql`${t.action} IN (${inList(AUDIT_ACTIONS)})`),
    check(
      "audit_events_actor_role_check",
      sql`${t.actorRole} IN (${inList(ACTOR_ROLES)})`,
    ),
    check(
      "audit_events_from_status_check",
      sql`${t.fromStatus} IS NULL OR ${t.fromStatus} IN (${inList(REFUND_STATUSES)})`,
    ),
    check(
      "audit_events_to_status_check",
      sql`${t.toStatus} IN (${inList(REFUND_STATUSES)})`,
    ),
  ],
);

export type Refund = typeof refunds.$inferSelect;
export type NewRefund = typeof refunds.$inferInsert;
export type AuditEvent = typeof auditEvents.$inferSelect;
export type NewAuditEvent = typeof auditEvents.$inferInsert;
