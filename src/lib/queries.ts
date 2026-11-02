import { asc, count, desc, eq } from "drizzle-orm";

import { getDb } from "./db";
import {
  auditEvents,
  REFUND_STATUSES,
  refunds,
  type AuditEvent,
  type Refund,
  type RefundStatus,
} from "./schema";

export const REFUNDS_PAGE_SIZE = 20;

const refundListColumns = {
  id: refunds.id,
  customerName: refunds.customerName,
  customerEmail: refunds.customerEmail,
  merchantName: refunds.merchantName,
  paymentMethod: refunds.paymentMethod,
  originalAmountCents: refunds.originalAmountCents,
  requestedAmountCents: refunds.requestedAmountCents,
  approvedAmountCents: refunds.approvedAmountCents,
  currency: refunds.currency,
  status: refunds.status,
  riskScore: refunds.riskScore,
  createdAt: refunds.createdAt,
};

export type RefundListItem = Pick<Refund, keyof typeof refundListColumns>;

export type RefundListPage = {
  items: RefundListItem[];
  page: number;
  pageSize: number;
  total: number;
  totalPages: number;
};

export type RefundWithAuditTrail = {
  refund: Refund;
  auditEvents: AuditEvent[];
};

export function isRefundStatus(value: unknown): value is RefundStatus {
  return (REFUND_STATUSES as readonly unknown[]).includes(value);
}

/** Lists refunds newest first, optionally filtered by status. `page` is 1-based; invalid values fall back to 1. */
export async function listRefunds({
  status,
  page = 1,
}: { status?: RefundStatus; page?: number } = {}): Promise<RefundListPage> {
  if (status !== undefined && !isRefundStatus(status)) {
    throw new Error(`Invalid refund status: ${String(status)}`);
  }
  const currentPage = Number.isSafeInteger(page) && page > 0 ? page : 1;
  const where = status ? eq(refunds.status, status) : undefined;

  const db = await getDb();
  const [items, [{ total }]] = await Promise.all([
    db
      .select(refundListColumns)
      .from(refunds)
      .where(where)
      .orderBy(desc(refunds.createdAt), desc(refunds.id))
      .limit(REFUNDS_PAGE_SIZE)
      .offset((currentPage - 1) * REFUNDS_PAGE_SIZE),
    db.select({ total: count() }).from(refunds).where(where),
  ]);

  return {
    items,
    page: currentPage,
    pageSize: REFUNDS_PAGE_SIZE,
    total,
    totalPages: Math.ceil(total / REFUNDS_PAGE_SIZE),
  };
}

/** Returns the refund and its audit events (oldest first), or `null` if no refund has this id. */
export async function getRefundWithAuditTrail(
  id: string,
): Promise<RefundWithAuditTrail | null> {
  const db = await getDb();
  const [refund] = await db
    .select()
    .from(refunds)
    .where(eq(refunds.id, id))
    .limit(1);
  if (!refund) return null;

  const events = await db
    .select()
    .from(auditEvents)
    .where(eq(auditEvents.refundId, id))
    .orderBy(asc(auditEvents.createdAt), asc(auditEvents.id));

  return { refund, auditEvents: events };
}
