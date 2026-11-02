// @vitest-environment jsdom
import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { STATUS_LABELS, StatusBadge } from "@/app/_components/status-badge";
import { REFUND_STATUSES, type RefundStatus } from "@/lib/schema";

const EXPECTED: Record<RefundStatus, { label: string; color: string }> = {
  pending: { label: "Pending", color: "amber" },
  escalated: { label: "Escalated", color: "violet" },
  approved: { label: "Approved", color: "emerald" },
  partially_approved: { label: "Partially approved", color: "sky" },
  rejected: { label: "Rejected", color: "rose" },
};

describe("StatusBadge", () => {
  it("has a label for every status", () => {
    expect(Object.keys(STATUS_LABELS).sort()).toEqual([...REFUND_STATUSES].sort());
  });

  it.each(REFUND_STATUSES)("renders %s with its label and color", (status) => {
    const { label, color } = EXPECTED[status];
    render(<StatusBadge status={status} />);

    const badge = screen.getByText(label);
    expect(badge.tagName).toBe("SPAN");
    expect(badge).toHaveClass(`bg-${color}-50`, `text-${color}-800`, `ring-${color}-600/20`);
    expect(badge).toHaveClass("rounded-full", "ring-1", "ring-inset");
  });

  it("gives each status a different color", () => {
    const classNames = REFUND_STATUSES.map((status) => {
      const { container } = render(<StatusBadge status={status} />);
      return container.firstElementChild!.className;
    });
    expect(new Set(classNames).size).toBe(REFUND_STATUSES.length);
  });
});
