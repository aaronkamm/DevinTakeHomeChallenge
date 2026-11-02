import type { ReviewerRole } from "./reviewers";
import type { Refund, RefundStatus } from "./schema";

/**
 * Who may decide which refunds. The seed script builds its audit trails from the same rules, so
 * seeded history and live decisions agree. Kept free of Next.js imports so scripts can use it.
 */

/** Agents may decide refunds up to this amount (in the refund's currency). */
export const AGENT_APPROVAL_LIMIT_CENTS = 50_000;
/** Refunds at or above this risk score need a manager. */
export const HIGH_RISK_SCORE = 60;
/** Card-fraud claims always go to the fraud team. */
export const FRAUD_REVIEW_REASONS: readonly string[] = [
  "Unauthorized transaction reported by customer",
];

/** Only these statuses still accept a decision; the others are final. */
export const OPEN_STATUSES = ["pending", "escalated"] as const satisfies readonly RefundStatus[];

export type DecisionAction = "approve" | "partially_approve" | "reject" | "escalate";

type RuleInput = Pick<Refund, "status" | "reason" | "requestedAmountCents" | "riskScore">;

export type ReviewRequirement = {
  /** The least senior role that may decide the refund. */
  role: ReviewerRole;
  /** Why that role is needed, or null when any agent may decide. */
  reason: string | null;
};

export function isOpenStatus(status: RefundStatus): status is (typeof OPEN_STATUSES)[number] {
  return (OPEN_STATUSES as readonly RefundStatus[]).includes(status);
}

export function reviewRequirement(refund: RuleInput): ReviewRequirement {
  if (FRAUD_REVIEW_REASONS.includes(refund.reason)) {
    return { role: "fraud_analyst", reason: "Card-fraud claims are decided by the fraud team" };
  }
  if (refund.requestedAmountCents > AGENT_APPROVAL_LIMIT_CENTS) {
    return { role: "manager", reason: "Amount is above the agent approval limit" };
  }
  if (refund.riskScore >= HIGH_RISK_SCORE) {
    return { role: "manager", reason: `Risk score is ${HIGH_RISK_SCORE} or higher` };
  }
  if (refund.status === "escalated") {
    return { role: "manager", reason: "Escalated refunds are decided by a manager" };
  }
  return { role: "agent", reason: null };
}

/** Whether this role may approve, partially approve or reject the refund. */
export function canDecide(refund: RuleInput, role: ReviewerRole): boolean {
  const required = reviewRequirement(refund).role;
  if (required === "agent") return role === "agent" || role === "manager";
  return role === required;
}

/** Escalation hands a pending refund up for review; an escalated one can't be escalated again. */
export function canEscalate(refund: RuleInput): boolean {
  return refund.status === "pending";
}

/** Returns why this role can't take the action on the refund, or null if it can. */
export function permissionError(
  refund: RuleInput,
  role: ReviewerRole,
  action: DecisionAction,
): string | null {
  if (action === "escalate") {
    return canEscalate(refund) ? null : "This refund has already been escalated.";
  }
  if (canDecide(refund, role)) return null;
  const { role: required, reason } = reviewRequirement(refund);
  const who = required === "fraud_analyst" ? "a fraud analyst" : "a manager";
  return `Only ${who} can decide this refund. ${reason}.`;
}
