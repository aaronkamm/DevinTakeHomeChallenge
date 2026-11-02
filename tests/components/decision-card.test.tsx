// @vitest-environment jsdom
import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { DecisionCard } from "@/app/refunds/[id]/decision-card";
import type { CurrentActor } from "@/lib/actor";

import { FIXTURE_DECIDED_AT, fixtureRefund } from "../helpers/fixtures";

vi.mock("@/app/refunds/[id]/actions", () => ({
  approveRefund: vi.fn(),
  partiallyApproveRefund: vi.fn(),
  rejectRefund: vi.fn(),
  escalateRefund: vi.fn(),
}));

const AGENT: CurrentActor = { name: "Maya Chen", role: "agent" };
const MANAGER: CurrentActor = { name: "Sam Okafor", role: "manager" };
const FRAUD_ANALYST: CurrentActor = { name: "Elena Novak", role: "fraud_analyst" };

const button = (name: RegExp) => screen.queryByRole("button", { name });

describe("DecisionCard", () => {
  it("shows who is acting", () => {
    render(<DecisionCard refund={fixtureRefund("lowRisk")} actor={AGENT} />);
    expect(screen.getByText("Acting as Maya Chen · Agent")).toBeInTheDocument();
  });

  it("gives an agent every action on a small, low-risk refund", () => {
    render(<DecisionCard refund={fixtureRefund("lowRisk")} actor={AGENT} />);
    expect(screen.getByLabelText(/note/i)).toBeInTheDocument();
    for (const name of [/^approve \$125\.00$/i, /^partially approve$/i, /^reject$/i, /^escalate$/i]) {
      expect(button(name)).toBeEnabled();
    }
  });

  it.each([
    ["overLimit", "Amount is above the agent approval limit"],
    ["highRisk", "Risk score is 60 or higher"],
  ] as const)("only lets an agent escalate the %s refund", (key, why) => {
    render(<DecisionCard refund={fixtureRefund(key)} actor={AGENT} />);

    expect(
      screen.getByText(`Only a manager can decide this refund. ${why}.`),
    ).toBeInTheDocument();
    expect(button(/^approve/i)).not.toBeInTheDocument();
    expect(button(/^partially approve$/i)).not.toBeInTheDocument();
    expect(button(/^reject$/i)).not.toBeInTheDocument();
    expect(button(/^escalate$/i)).toBeEnabled();
  });

  it.each(["overLimit", "highRisk"] as const)("lets a manager decide the %s refund", (key) => {
    render(<DecisionCard refund={fixtureRefund(key)} actor={MANAGER} />);
    expect(button(/^approve/i)).toBeEnabled();
    expect(button(/^reject$/i)).toBeEnabled();
    expect(screen.queryByText(/^Only a/)).not.toBeInTheDocument();
  });

  it.each([AGENT, MANAGER])("blocks a $role from deciding a card-fraud refund", (actor) => {
    render(<DecisionCard refund={fixtureRefund("fraud")} actor={actor} />);
    expect(screen.getByText(/^Only a fraud analyst can decide this refund/)).toBeInTheDocument();
    expect(button(/^approve/i)).not.toBeInTheDocument();
    expect(button(/^escalate$/i)).toBeEnabled();
  });

  it("lets a fraud analyst decide a card-fraud refund", () => {
    render(<DecisionCard refund={fixtureRefund("fraud")} actor={FRAUD_ANALYST} />);
    expect(button(/^approve/i)).toBeEnabled();
    expect(button(/^reject$/i)).toBeEnabled();
  });

  it("lets a manager decide an escalated refund, without escalating it again", () => {
    render(<DecisionCard refund={fixtureRefund("escalated")} actor={MANAGER} />);
    expect(button(/^approve/i)).toBeEnabled();
    expect(button(/^escalate$/i)).not.toBeInTheDocument();
  });

  it("leaves an agent with no actions on an escalated refund", () => {
    render(<DecisionCard refund={fixtureRefund("escalated")} actor={AGENT} />);
    expect(
      screen.getByText(
        "Only a manager can decide this refund. Escalated refunds are decided by a manager.",
      ),
    ).toBeInTheDocument();
    expect(screen.queryAllByRole("button")).toHaveLength(0);
  });

  it("shows the recorded decision and no actions for a decided refund", () => {
    render(<DecisionCard refund={fixtureRefund("decided")} actor={MANAGER} />);

    expect(screen.getByText("Approved")).toBeInTheDocument();
    expect(screen.getByText("Sam Okafor")).toBeInTheDocument();
    expect(screen.getByText("$99.00")).toBeInTheDocument();
    expect(screen.getByText("Duplicate confirmed on statement")).toBeInTheDocument();
    expect(screen.getByRole("time")).toHaveAttribute("datetime", FIXTURE_DECIDED_AT.toISOString());

    expect(screen.queryAllByRole("button")).toHaveLength(0);
    expect(screen.queryByRole("textbox")).not.toBeInTheDocument();
  });

  it("shows 'None (rejected)' as the approved amount of a rejected refund", () => {
    const refund = fixtureRefund("lowRisk", {
      status: "rejected",
      decidedBy: "Maya Chen",
      decidedAt: FIXTURE_DECIDED_AT,
    });
    render(<DecisionCard refund={refund} actor={AGENT} />);
    expect(screen.getByText("Rejected")).toBeInTheDocument();
    expect(screen.getByText("None (rejected)")).toBeInTheDocument();
    expect(screen.queryAllByRole("button")).toHaveLength(0);
  });
});
