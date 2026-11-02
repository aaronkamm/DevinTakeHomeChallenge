// @vitest-environment jsdom
import { fireEvent, render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { DecisionPanel } from "@/app/refunds/[id]/decision-panel";
import {
  approveRefund,
  escalateRefund,
  partiallyApproveRefund,
  rejectRefund,
} from "@/app/refunds/[id]/actions";

// The panel calls server actions; stub them so the tests control what they return.
vi.mock("@/app/refunds/[id]/actions", () => ({
  approveRefund: vi.fn(),
  partiallyApproveRefund: vi.fn(),
  rejectRefund: vi.fn(),
  escalateRefund: vi.fn(),
}));

const actions = vi.mocked({ approveRefund, partiallyApproveRefund, rejectRefund, escalateRefund });

beforeEach(() => {
  for (const fn of Object.values(actions)) {
    fn.mockReset();
    fn.mockResolvedValue({ ok: true });
  }
});

type Props = Parameters<typeof DecisionPanel>[0];

function renderPanel(props: Partial<Props> = {}) {
  return render(
    <DecisionPanel
      refundId="RF-1"
      requestedAmountCents={12_500}
      currency="USD"
      canDecide
      canEscalate
      restriction={null}
      {...props}
    />,
  );
}

const button = (name: RegExp) => screen.queryByRole("button", { name });
const errorAlert = () => screen.findByRole("alert");

describe("DecisionPanel", () => {
  it("renders the note field, the amount field and every action for a reviewer who can decide", () => {
    renderPanel();

    expect(screen.getByLabelText(/note/i)).toBeInstanceOf(HTMLTextAreaElement);
    expect(screen.getByLabelText(/partial amount/i)).toBeInTheDocument();
    expect(button(/^approve \$125\.00$/i)).toBeEnabled();
    expect(button(/^partially approve$/i)).toBeEnabled();
    expect(button(/^reject$/i)).toBeEnabled();
    expect(button(/^escalate$/i)).toBeEnabled();
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
  });

  it("only offers escalation, with the restriction, when the reviewer can't decide", () => {
    renderPanel({
      canDecide: false,
      restriction: "Only a manager can decide this refund. Amount is above the agent approval limit.",
    });

    expect(screen.getByText(/^Only a manager can decide this refund/)).toBeInTheDocument();
    expect(screen.getByLabelText(/note/i)).toBeInTheDocument();
    expect(screen.queryByLabelText(/partial amount/i)).not.toBeInTheDocument();
    expect(button(/^approve/i)).not.toBeInTheDocument();
    expect(button(/^partially approve$/i)).not.toBeInTheDocument();
    expect(button(/^reject$/i)).not.toBeInTheDocument();
    expect(button(/^escalate$/i)).toBeEnabled();
  });

  it("hides escalation for an escalated refund", () => {
    renderPanel({ canEscalate: false });
    expect(button(/^approve/i)).toBeInTheDocument();
    expect(button(/^escalate$/i)).not.toBeInTheDocument();
  });

  it("shows only the restriction when the reviewer can take no action", () => {
    renderPanel({
      canDecide: false,
      canEscalate: false,
      restriction: "Only a manager can decide this refund. Escalated refunds are decided by a manager.",
    });

    expect(screen.getByText(/^Only a manager can decide this refund/)).toBeInTheDocument();
    expect(screen.queryAllByRole("button")).toHaveLength(0);
    expect(screen.queryByRole("textbox")).not.toBeInTheDocument();
  });

  it("disables partial approval when nothing is smaller than the requested amount", () => {
    renderPanel({ requestedAmountCents: 1 });
    expect(button(/^partially approve$/i)).toBeDisabled();
    expect(screen.queryByLabelText(/partial amount/i)).not.toBeInTheDocument();
  });

  it("sends the note with the chosen action", async () => {
    renderPanel();
    fireEvent.change(screen.getByLabelText(/note/i), { target: { value: "Looks fine" } });
    fireEvent.click(button(/^reject$/i)!);

    expect(actions.rejectRefund).toHaveBeenCalledWith("RF-1", { note: "Looks fine" });
    expect(actions.approveRefund).not.toHaveBeenCalled();
  });

  it("sends a typed partial amount in cents", () => {
    renderPanel();
    fireEvent.change(screen.getByLabelText(/partial amount/i), { target: { value: "62.5" } });
    fireEvent.click(button(/^partially approve$/i)!);

    expect(actions.partiallyApproveRefund).toHaveBeenCalledWith("RF-1", {
      note: "",
      amountCents: 6_250,
    });
  });

  it.each([
    ["empty", "", "Enter a valid amount, e.g. 125.00 or 1,250.00."],
    ["ambiguous", "1,00", "Enter a valid amount, e.g. 125.00 or 1,250.00."],
    ["zero", "0.00", "Enter a partial amount greater than zero."],
    [
      "the full amount",
      "125",
      "Partial amount must be less than the requested $125.00. Use Approve for the full amount.",
    ],
  ])("shows an error without calling the server for an %s amount", async (_, value, message) => {
    renderPanel();
    fireEvent.change(screen.getByLabelText(/partial amount/i), { target: { value } });
    fireEvent.click(button(/^partially approve$/i)!);

    expect(await errorAlert()).toHaveTextContent(message);
    expect(actions.partiallyApproveRefund).not.toHaveBeenCalled();
  });

  it("shows the error the action returns", async () => {
    actions.approveRefund.mockResolvedValue({
      ok: false,
      error: "This refund is already approved and can't be changed.",
    });
    renderPanel();
    fireEvent.click(button(/^approve/i)!);

    expect(await errorAlert()).toHaveTextContent(
      "This refund is already approved and can't be changed.",
    );
    // The form stays usable so the reviewer can try something else.
    expect(button(/^approve/i)).toBeEnabled();
  });

  it("shows a connection error when the action throws", async () => {
    actions.escalateRefund.mockRejectedValue(new Error("network down"));
    renderPanel();
    fireEvent.click(button(/^escalate$/i)!);

    expect(await errorAlert()).toHaveTextContent("Couldn't reach the server. Please try again.");
  });

  it("clears the previous error when another action is tried", async () => {
    actions.approveRefund.mockResolvedValue({ ok: false, error: "Nope." });
    renderPanel();
    fireEvent.click(button(/^approve/i)!);
    expect(await errorAlert()).toHaveTextContent("Nope.");

    fireEvent.click(button(/^reject$/i)!);
    await vi.waitFor(() => expect(screen.queryByRole("alert")).not.toBeInTheDocument());
  });

  it("disables the form while an action is in flight", async () => {
    let finish!: (value: { ok: true }) => void;
    actions.approveRefund.mockReturnValue(new Promise((resolve) => (finish = resolve)));
    renderPanel();
    fireEvent.click(button(/^approve/i)!);

    expect(await screen.findByRole("button", { name: "Approving…" })).toBeDisabled();
    for (const b of screen.getAllByRole("button")) expect(b).toBeDisabled();
    expect(screen.getByLabelText(/note/i)).toBeDisabled();

    finish({ ok: true });
    expect(await screen.findByRole("button", { name: /^approve \$125\.00$/i })).toBeEnabled();
    expect(screen.queryByText("Approving…")).not.toBeInTheDocument();
  });
});
