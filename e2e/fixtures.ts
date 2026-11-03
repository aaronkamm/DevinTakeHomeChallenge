/**
 * Refund IDs the e2e specs rely on. The seed script is deterministic (fixed drizzle-seed seed and
 * `rf_0001`…`rf_0024` IDs), so these point at the same rows on every fresh run.
 */
export const SEEDED_REFUND_COUNT = 24;

/** Pending, $30.61 USD, risk 6, not a fraud claim: any agent may decide it. */
export const AGENT_DECIDABLE_REFUND = { id: "rf_0006", amount: "$30.61" };

/** Already approved by a reviewer, so its detail page has no action panel. */
export const DECIDED_REFUND = { id: "rf_0007", amount: "$208.93" };

/**
 * The seed has no open, non-fraud refund over the $500 agent limit, so `prepare-db.ts` adds this
 * one on top of the seeded rows.
 */
export const OVER_LIMIT_REFUND = {
  id: "rf_e2e_over_limit",
  customerName: "Avery Brooks",
  amountCents: 82_000,
  amount: "$820.00",
} as const;

export const TOTAL_REFUND_COUNT = SEEDED_REFUND_COUNT + 1;
