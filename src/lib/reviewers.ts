import type { ActorRole } from "./schema";

/**
 * The fixed reviewer roster. The seed script writes these names into the audit trail, and the
 * "Acting as" switcher lets you pick one of them, so both always agree on who exists.
 * Kept free of Next.js imports so `scripts/seed.ts` can use it outside the app.
 */
export const AGENTS = ["Maya Chen", "Jordan Lee", "Priya Patel", "Diego Alvarez"] as const;
export const MANAGERS = ["Sam Okafor", "Rachel Kim"] as const;
export const FRAUD_ANALYSTS = ["Elena Novak", "Marcus Webb"] as const;
/** The automated intake that files some refunds. It never makes decisions, so it isn't selectable. */
export const INTAKE = "refund-intake-bot";

/** The roles a person can act as. `system` is reserved for the intake bot. */
export type ReviewerRole = Exclude<ActorRole, "system">;

export type Reviewer = { name: string; role: ReviewerRole };

export const REVIEWER_ROLE_LABELS: Record<ReviewerRole, string> = {
  agent: "Agent",
  manager: "Manager",
  fraud_analyst: "Fraud analyst",
};

export const REVIEWERS_BY_ROLE: Record<ReviewerRole, readonly string[]> = {
  agent: AGENTS,
  manager: MANAGERS,
  fraud_analyst: FRAUD_ANALYSTS,
};

export const REVIEWERS: readonly Reviewer[] = (
  Object.entries(REVIEWERS_BY_ROLE) as [ReviewerRole, readonly string[]][]
).flatMap(([role, names]) => names.map((name) => ({ name, role })));

export const DEFAULT_REVIEWER: Reviewer = { name: AGENTS[0], role: "agent" };

/** Returns the roster entry matching this name and role, or null if the pair isn't on it. */
export function findReviewer(name: unknown, role: unknown): Reviewer | null {
  return REVIEWERS.find((r) => r.name === name && r.role === role) ?? null;
}
