import type { ReactNode } from "react";

import { formatCents, formatDateTime } from "@/lib/format";
import type { ActorRole, Refund } from "@/lib/schema";

// Building blocks shared by the Detail page and its Decision card.

export const ACTOR_ROLE_LABELS: Record<ActorRole, string> = {
  agent: "Agent",
  manager: "Manager",
  fraud_analyst: "Fraud analyst",
  system: "System",
};

export function Card({
  title,
  description,
  children,
}: {
  title: string;
  description?: string;
  children: ReactNode;
}) {
  return (
    <section className="rounded-lg border border-slate-200 bg-white shadow-sm">
      <header className="flex flex-wrap items-baseline justify-between gap-2 border-b border-slate-200 px-6 py-4">
        <h2 className="text-base font-semibold">{title}</h2>
        {description && <p className="text-xs text-slate-500">{description}</p>}
      </header>
      <div className="px-6 py-5">{children}</div>
    </section>
  );
}

export function FieldList({ children, columns = 2 }: { children: ReactNode; columns?: 1 | 2 }) {
  return (
    <dl className={`grid gap-x-8 gap-y-5 ${columns === 2 ? "sm:grid-cols-2" : ""}`}>{children}</dl>
  );
}

export function Field({
  label,
  children,
  mono = false,
  wide = false,
}: {
  label: string;
  children: ReactNode;
  mono?: boolean;
  wide?: boolean;
}) {
  // Treat missing values the same everywhere: show a muted dash instead of a blank gap.
  const isEmpty =
    children === null || children === undefined || children === false || children === "";
  return (
    <div className={`min-w-0 ${wide ? "sm:col-span-2" : ""}`}>
      <dt className="text-xs font-medium uppercase tracking-wide text-slate-500">{label}</dt>
      <dd className={`mt-1 break-words text-sm text-slate-900 ${mono ? "font-mono text-xs" : ""}`}>
        {isEmpty ? <Missing /> : children}
      </dd>
    </div>
  );
}

export function Timestamp({ date, className = "" }: { date: Date; className?: string }) {
  return (
    <time dateTime={date.toISOString()} className={`whitespace-nowrap ${className}`}>
      {formatDateTime(date)}
    </time>
  );
}

export function Missing({ children = "—" }: { children?: ReactNode }) {
  return <span className="text-slate-400">{children}</span>;
}

export function EmptyState({ children }: { children: ReactNode }) {
  return (
    <p className="rounded-md border border-dashed border-slate-300 bg-slate-50 px-4 py-6 text-center text-sm text-slate-500">
      {children}
    </p>
  );
}

/** `approvedAmountCents` is null both before a decision and after a rejection; label the two cases differently. */
export function ApprovedAmount({ refund }: { refund: Refund }) {
  if (refund.approvedAmountCents !== null) {
    return <>{formatCents(refund.approvedAmountCents, refund.currency)}</>;
  }
  return <Missing>{refund.status === "rejected" ? "None (rejected)" : "Not decided"}</Missing>;
}
