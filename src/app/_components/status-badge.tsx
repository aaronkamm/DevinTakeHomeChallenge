import type { RefundStatus } from "@/lib/schema";

export const STATUS_LABELS: Record<RefundStatus, string> = {
  pending: "Pending",
  escalated: "Escalated",
  approved: "Approved",
  partially_approved: "Partially approved",
  rejected: "Rejected",
};

const STATUS_STYLES: Record<RefundStatus, string> = {
  pending: "bg-amber-50 text-amber-800 ring-amber-600/20",
  escalated: "bg-violet-50 text-violet-800 ring-violet-600/20",
  approved: "bg-emerald-50 text-emerald-800 ring-emerald-600/20",
  partially_approved: "bg-sky-50 text-sky-800 ring-sky-600/20",
  rejected: "bg-rose-50 text-rose-800 ring-rose-600/20",
};

export function StatusBadge({ status }: { status: RefundStatus }) {
  return (
    <span
      className={`inline-flex items-center whitespace-nowrap rounded-full px-2 py-0.5 text-xs font-medium ring-1 ring-inset ${STATUS_STYLES[status]}`}
    >
      {STATUS_LABELS[status]}
    </span>
  );
}
