import { describe, expect, it } from "vitest";

import {
  AGENT_APPROVAL_LIMIT_CENTS,
  canDecide,
  canEscalate,
  FRAUD_REVIEW_REASONS,
  HIGH_RISK_SCORE,
  isOpenStatus,
  permissionError,
  reviewRequirement,
} from "@/lib/decision-rules";
import type { ReviewerRole } from "@/lib/reviewers";
import { REFUND_STATUSES } from "@/lib/schema";

import { fixtureRefund } from "../helpers/fixtures";

const ROLES: ReviewerRole[] = ["agent", "manager", "fraud_analyst"];

describe("isOpenStatus", () => {
  it.each(REFUND_STATUSES)("%s", (status) => {
    expect(isOpenStatus(status)).toBe(status === "pending" || status === "escalated");
  });
});

describe("reviewRequirement", () => {
  it("lets any agent decide a small, low-risk refund", () => {
    expect(reviewRequirement(fixtureRefund("lowRisk"))).toEqual({ role: "agent", reason: null });
  });

  it("needs a manager above the agent approval limit ($500)", () => {
    const atLimit = fixtureRefund("lowRisk", { requestedAmountCents: AGENT_APPROVAL_LIMIT_CENTS });
    const overLimit = fixtureRefund("lowRisk", {
      requestedAmountCents: AGENT_APPROVAL_LIMIT_CENTS + 1,
    });
    expect(AGENT_APPROVAL_LIMIT_CENTS).toBe(50_000);
    expect(reviewRequirement(atLimit).role).toBe("agent");
    expect(reviewRequirement(overLimit)).toEqual({
      role: "manager",
      reason: "Amount is above the agent approval limit",
    });
  });

  it("needs a manager at or above risk score 60", () => {
    expect(HIGH_RISK_SCORE).toBe(60);
    expect(reviewRequirement(fixtureRefund("lowRisk", { riskScore: 59 })).role).toBe("agent");
    expect(reviewRequirement(fixtureRefund("lowRisk", { riskScore: 60 }))).toEqual({
      role: "manager",
      reason: "Risk score is 60 or higher",
    });
  });

  it("sends card-fraud claims to a fraud analyst, even when they are also large and risky", () => {
    const fraud = fixtureRefund("fraud", { requestedAmountCents: 30_000, riskScore: 95 });
    expect(FRAUD_REVIEW_REASONS).toContain(fraud.reason);
    expect(reviewRequirement(fraud).role).toBe("fraud_analyst");
  });

  it("needs a manager for an escalated refund", () => {
    expect(reviewRequirement(fixtureRefund("escalated"))).toEqual({
      role: "manager",
      reason: "Escalated refunds are decided by a manager",
    });
  });
});

describe("canDecide", () => {
  it.each([
    ["lowRisk", { agent: true, manager: true, fraud_analyst: false }],
    ["overLimit", { agent: false, manager: true, fraud_analyst: false }],
    ["highRisk", { agent: false, manager: true, fraud_analyst: false }],
    ["fraud", { agent: false, manager: false, fraud_analyst: true }],
    ["escalated", { agent: false, manager: true, fraud_analyst: false }],
  ] as const)("%s refund", (key, expected) => {
    const refund = fixtureRefund(key);
    for (const role of ROLES) {
      expect(canDecide(refund, role), role).toBe(expected[role]);
    }
  });
});

describe("canEscalate", () => {
  it("allows escalating a pending refund whatever it needs", () => {
    for (const key of ["lowRisk", "overLimit", "highRisk", "fraud"] as const) {
      expect(canEscalate(fixtureRefund(key)), key).toBe(true);
    }
  });

  it("does not allow escalating twice", () => {
    expect(canEscalate(fixtureRefund("escalated"))).toBe(false);
  });
});

describe("permissionError", () => {
  it("is null when the role may decide", () => {
    expect(permissionError(fixtureRefund("lowRisk"), "agent", "approve")).toBeNull();
    expect(permissionError(fixtureRefund("fraud"), "fraud_analyst", "reject")).toBeNull();
  });

  it("names the role that can decide and why", () => {
    expect(permissionError(fixtureRefund("overLimit"), "agent", "approve")).toBe(
      "Only a manager can decide this refund. Amount is above the agent approval limit.",
    );
    expect(permissionError(fixtureRefund("highRisk"), "agent", "partially_approve")).toBe(
      "Only a manager can decide this refund. Risk score is 60 or higher.",
    );
    expect(permissionError(fixtureRefund("fraud"), "manager", "reject")).toBe(
      "Only a fraud analyst can decide this refund. Card-fraud claims are decided by the fraud team.",
    );
  });

  it("lets every role escalate a pending refund, including ones they can't decide", () => {
    for (const role of ROLES) {
      for (const key of ["lowRisk", "overLimit", "highRisk", "fraud"] as const) {
        expect(permissionError(fixtureRefund(key), role, "escalate"), `${role} ${key}`).toBeNull();
      }
    }
  });

  it("refuses to escalate an escalated refund", () => {
    expect(permissionError(fixtureRefund("escalated"), "manager", "escalate")).toBe(
      "This refund has already been escalated.",
    );
  });
});
