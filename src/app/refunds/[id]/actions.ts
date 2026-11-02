"use server";

import { eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";

import { STATUS_LABELS } from "@/app/_components/status-badge";
import { getCurrentActor } from "@/lib/actor";
import { getDb } from "@/lib/db";
import { isOpenStatus, permissionError, type DecisionAction } from "@/lib/decision-rules";
import { auditEvents, refunds, type AuditAction, type Refund } from "@/lib/schema";

export type DecisionResult = { ok: true } | { ok: false; error: string };

export type DecisionInput = { note?: string };
export type PartialDecisionInput = DecisionInput & { amountCents: number };

const MAX_NOTE_LENGTH = 1000;

// Each decision moves the refund to the status of the same name, logged as that audit action.
const TO_STATUS = {
  approve: "approved",
  partially_approve: "partially_approved",
  reject: "rejected",
  escalate: "escalated",
} as const satisfies Record<DecisionAction, AuditAction & Refund["status"]>;

export async function approveRefund(refundId: string, input: DecisionInput = {}) {
  return decide(refundId, "approve", input);
}

export async function partiallyApproveRefund(refundId: string, input: PartialDecisionInput) {
  return decide(refundId, "partially_approve", input);
}

export async function rejectRefund(refundId: string, input: DecisionInput = {}) {
  return decide(refundId, "reject", input);
}

export async function escalateRefund(refundId: string, input: DecisionInput = {}) {
  return decide(refundId, "escalate", input);
}

const fail = (error: string): DecisionResult => ({ ok: false, error });

async function decide(
  refundId: unknown,
  action: DecisionAction,
  input: unknown,
): Promise<DecisionResult> {
  // Server actions are public endpoints, so check every argument rather than trusting the types.
  if (typeof refundId !== "string" || refundId.length === 0 || refundId.length > 100) {
    return fail("Invalid refund ID.");
  }
  if (typeof input !== "object" || input === null) return fail("Invalid request.");
  const { note: rawNote, amountCents } = input as { note?: unknown; amountCents?: unknown };

  if (rawNote !== undefined && rawNote !== null && typeof rawNote !== "string") {
    return fail("Note must be text.");
  }
  const note = rawNote?.trim() || null;
  if (note && note.length > MAX_NOTE_LENGTH) {
    return fail(`Note must be ${MAX_NOTE_LENGTH} characters or fewer.`);
  }

  if (action === "partially_approve") {
    if (typeof amountCents !== "number" || !Number.isSafeInteger(amountCents)) {
      return fail("Enter the partial amount as a whole number of cents.");
    }
    if (amountCents <= 0) return fail("Partial amount must be greater than zero.");
  }

  let result: DecisionResult;
  try {
    const actor = await getCurrentActor();
    const db = await getDb();
    result = await db.transaction(async (tx) => {
      // Lock the row so two reviewers can't both decide the same refund.
      const [refund] = await tx
        .select()
        .from(refunds)
        .where(eq(refunds.id, refundId))
        .for("update");
      if (!refund) return fail("Refund not found.");

      if (!isOpenStatus(refund.status)) {
        return fail(
          `This refund is already ${STATUS_LABELS[refund.status].toLowerCase()} and can't be changed.`,
        );
      }
      const denied = permissionError(refund, actor.role, action);
      if (denied) return fail(denied);

      let approvedAmountCents: number | null = null;
      if (action === "approve") approvedAmountCents = refund.requestedAmountCents;
      if (action === "partially_approve") {
        if ((amountCents as number) > refund.requestedAmountCents) {
          return fail("Partial amount can't be more than the requested amount.");
        }
        approvedAmountCents = amountCents as number;
      }

      const toStatus = TO_STATUS[action];
      const now = new Date();
      // Escalating isn't a decision: it only moves the refund to the escalated queue, so the
      // decision fields stay empty for the reviewer who picks it up.
      const changes: Partial<Refund> =
        action === "escalate"
          ? { status: toStatus }
          : {
              status: toStatus,
              approvedAmountCents,
              decisionNote: note,
              decidedBy: actor.name,
              decidedAt: now,
            };
      await tx.update(refunds).set(changes).where(eq(refunds.id, refund.id));

      await tx.insert(auditEvents).values({
        refundId: refund.id,
        action: toStatus,
        actor: actor.name,
        actorRole: actor.role,
        fromStatus: refund.status,
        toStatus,
        amountCents: approvedAmountCents,
        note,
        createdAt: now,
      });
      return { ok: true } as const;
    });
  } catch (err) {
    console.error(`Failed to ${action} refund ${refundId}`, err);
    return fail("Couldn't save the decision. Please try again.");
  }

  if (result.ok) {
    revalidatePath(`/refunds/${refundId}`);
    revalidatePath("/");
  }
  return result;
}
