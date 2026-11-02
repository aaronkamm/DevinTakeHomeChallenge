import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { connection } from "next/server";
import { Suspense, type ReactNode } from "react";

import { PageShell } from "@/app/_components/page-shell";
import { HIGH_RISK_THRESHOLD, isHighRisk, RiskScore } from "@/app/_components/risk-score";
import { StatusBadge } from "@/app/_components/status-badge";
import { getCurrentActor } from "@/lib/actor";
import { formatCents } from "@/lib/format";
import { getRefundWithAuditTrail } from "@/lib/queries";
import type { AuditAction, AuditEvent, PaymentMethod, Refund } from "@/lib/schema";

import { DecisionCard } from "./decision-card";
import {
  ACTOR_ROLE_LABELS,
  ApprovedAmount,
  Card,
  EmptyState,
  Field,
  FieldList,
  Timestamp,
} from "./detail-ui";

type Params = PageProps<"/refunds/[id]">["params"];

const PAYMENT_METHOD_LABELS: Record<PaymentMethod, string> = {
  card: "Card",
  ach: "ACH transfer",
  wire: "Wire transfer",
  atm: "ATM withdrawal",
  account_fee: "Account fee",
};

const AUDIT_ACTION_LABELS: Record<AuditAction, string> = {
  created: "Refund requested",
  approved: "Approved",
  partially_approved: "Partially approved",
  rejected: "Rejected",
  escalated: "Escalated",
};

// Built from the URL alone so the tab title doesn't cost a second database read.
export async function generateMetadata({ params }: { params: Params }): Promise<Metadata> {
  const { id } = await params;
  return { title: `Refund ${id} · Refunds Dashboard` };
}

export default function RefundDetailPage({ params }: PageProps<"/refunds/[id]">) {
  return (
    <PageShell
      title="Refund detail"
      description="Review the request, its risk profile and the full history of actions taken on it."
      showBackLink
    >
      <Suspense fallback={<RefundDetailSkeleton />}>
        <RefundDetail params={params} />
      </Suspense>
    </PageShell>
  );
}

async function RefundDetail({ params }: { params: Params }) {
  const { id } = await params;
  // Refund data is read from the live database on every request, never prerendered.
  await connection();
  const [result, actor] = await Promise.all([getRefundWithAuditTrail(id), getCurrentActor()]);
  // This runs after the page shell has started streaming, so the response is a 200 with a
  // noindex tag rather than a real 404. Next documents this; the user still sees not-found.tsx.
  if (!result) notFound();
  const { refund, auditEvents } = result;

  return (
    <div className="flex flex-col gap-6">
      <Overview refund={refund} />

      <div className="grid gap-6 lg:grid-cols-2">
        <Card title="Customer and Payment Details">
          <FieldList>
            <Field label="Customer">{refund.customerName}</Field>
            <Field label="Email">
              <a href={`mailto:${refund.customerEmail}`} className="text-sky-700 hover:underline">
                {refund.customerEmail}
              </a>
            </Field>
            <Field label="Merchant">{refund.merchantName}</Field>
            <Field label="Payment method">{PAYMENT_METHOD_LABELS[refund.paymentMethod]}</Field>
            <Field label="Account ID" mono>
              {refund.accountId}
            </Field>
            <Field label="Transaction ID" mono>
              {refund.transactionId}
            </Field>
            <Field label="Original transaction">
              {formatCents(refund.originalAmountCents, refund.currency)}
            </Field>
            <Field label="Currency">{refund.currency}</Field>
          </FieldList>
        </Card>

        <Card title="Refund and Risk Details">
          <FieldList>
            <Field label="Reason" wide>
              {refund.reason}
            </Field>
            <Field label="Requested amount">
              <span className="font-medium">
                {formatCents(refund.requestedAmountCents, refund.currency)}
              </span>
              <span className="ml-2 text-xs text-slate-500">
                {percentOf(refund.requestedAmountCents, refund.originalAmountCents)} of original
              </span>
            </Field>
            <Field label="Risk score">
              <RiskMeter score={refund.riskScore} />
            </Field>
            <Field label="Requested at">
              <Timestamp date={refund.createdAt} />
            </Field>
            <Field label="Last updated">
              <Timestamp date={refund.updatedAt} />
            </Field>
          </FieldList>
        </Card>
      </div>

      <DecisionCard refund={refund} actor={actor} />

      <Card
        title="Audit History"
        description={
          auditEvents.length === 0
            ? undefined
            : `${auditEvents.length} ${auditEvents.length === 1 ? "event" : "events"}, oldest first`
        }
      >
        <AuditTimeline events={auditEvents} currency={refund.currency} />
      </Card>
    </div>
  );
}

function Overview({ refund }: { refund: Refund }) {
  return (
    <section
      aria-labelledby="refund-overview"
      className="rounded-lg border border-slate-200 bg-white p-6 shadow-sm"
    >
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="min-w-0">
          <p className="text-xs font-medium uppercase tracking-wide text-slate-500">Refund ID</p>
          <h2 id="refund-overview" className="mt-1 break-all font-mono text-xl font-semibold">
            {refund.id}
          </h2>
          <p className="mt-1 text-sm text-slate-600">
            {refund.customerName}
            {refund.merchantName && <> · {refund.merchantName}</>}
            {" · "}
            {PAYMENT_METHOD_LABELS[refund.paymentMethod]}
          </p>
        </div>
        <div className="flex flex-col items-start gap-1 sm:items-end">
          <span className="text-xs font-medium uppercase tracking-wide text-slate-500">Status</span>
          <StatusBadge status={refund.status} />
        </div>
      </div>

      <dl className="mt-6 grid gap-4 border-t border-slate-100 pt-6 sm:grid-cols-2 lg:grid-cols-4">
        <Stat label="Requested amount" emphasis>
          {formatCents(refund.requestedAmountCents, refund.currency)}
        </Stat>
        <Stat label="Approved amount">
          <ApprovedAmount refund={refund} />
        </Stat>
        <Stat label="Risk score">
          <span className="text-lg tabular-nums">
            <RiskScore score={refund.riskScore} />
          </span>
          <span className="ml-2 text-xs text-slate-500">
            {isHighRisk(refund.riskScore) ? "High risk" : "Standard"}
          </span>
        </Stat>
        <Stat label="Requested at">
          <Timestamp date={refund.createdAt} />
        </Stat>
      </dl>
    </section>
  );
}

function AuditTimeline({ events, currency }: { events: AuditEvent[]; currency: string }) {
  if (events.length === 0) {
    return (
      <EmptyState>
        No audit events have been recorded for this refund yet. Events will appear here as the
        request is reviewed.
      </EmptyState>
    );
  }

  // The query returns events oldest first, so the last one is the current state.
  const latestIndex = events.length - 1;

  return (
    <ol className="relative ml-2 border-l border-slate-200">
      {events.map((event, index) => {
        const isLatest = index === latestIndex;
        return (
          <li key={event.id} className="relative pb-8 pl-8 last:pb-0">
            <span
              aria-hidden="true"
              className={`absolute -left-[7px] top-1.5 h-3.5 w-3.5 rounded-full border-2 border-white ring-1 ${
                isLatest ? "bg-sky-600 ring-sky-600" : "bg-slate-300 ring-slate-300"
              }`}
            />
            <div
              className={`rounded-lg border p-4 ${
                isLatest ? "border-sky-200 bg-sky-50/50" : "border-slate-200 bg-white"
              }`}
            >
              <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-1">
                <div className="flex flex-wrap items-center gap-2">
                  <h3 className="text-sm font-semibold text-slate-900">
                    {AUDIT_ACTION_LABELS[event.action]}
                  </h3>
                  {isLatest && (
                    <span className="rounded-full bg-sky-600 px-2 py-0.5 text-[11px] font-semibold uppercase tracking-wide text-white">
                      Latest
                    </span>
                  )}
                </div>
                <Timestamp date={event.createdAt} className="text-xs text-slate-500" />
              </div>

              <p className="mt-1 text-sm text-slate-600">
                <span className="font-medium text-slate-800">{event.actor}</span>
                <span className="text-slate-400"> · </span>
                {ACTOR_ROLE_LABELS[event.actorRole]}
              </p>

              <div className="mt-3 flex flex-wrap items-center gap-x-6 gap-y-2 text-sm">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="text-xs font-medium uppercase tracking-wide text-slate-500">
                    Status
                  </span>
                  {event.fromStatus ? (
                    <StatusBadge status={event.fromStatus} />
                  ) : (
                    <span className="text-xs text-slate-400">None</span>
                  )}
                  <span aria-hidden="true" className="text-slate-400">
                    →
                  </span>
                  <span className="sr-only">to</span>
                  <StatusBadge status={event.toStatus} />
                </div>
                {event.amountCents !== null && (
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-medium uppercase tracking-wide text-slate-500">
                      Amount
                    </span>
                    <span className="font-medium tabular-nums">
                      {formatCents(event.amountCents, currency)}
                    </span>
                  </div>
                )}
              </div>

              {event.note && (
                <p className="mt-3 break-words border-t border-slate-100 pt-3 text-sm text-slate-700">
                  {event.note}
                </p>
              )}
            </div>
          </li>
        );
      })}
    </ol>
  );
}

function RiskMeter({ score }: { score: number }) {
  const high = isHighRisk(score);
  return (
    <div className="flex items-center gap-3">
      <span className="tabular-nums">
        <RiskScore score={score} />
        <span className="text-slate-400"> / 100</span>
      </span>
      <div
        role="meter"
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={score}
        aria-label="Risk score"
        className="relative h-1.5 w-32 overflow-hidden rounded-full bg-slate-200"
      >
        <div
          className={`h-full rounded-full ${high ? "bg-rose-500" : "bg-emerald-500"}`}
          style={{ width: `${score}%` }}
        />
        {/* Thin tick at the threshold so you can see how close a score is to needing review. */}
        <div
          aria-hidden="true"
          title={`Review threshold (${HIGH_RISK_THRESHOLD})`}
          className="absolute top-0 h-full w-px bg-slate-500"
          style={{ left: `${HIGH_RISK_THRESHOLD}%` }}
        />
      </div>
    </div>
  );
}

// The schema requires original > 0, but guard anyway so a bad row can't render "Infinity%".
function percentOf(part: number, whole: number) {
  if (whole <= 0) return "—";
  return `${Math.round((part / whole) * 100)}%`;
}

function Stat({
  label,
  children,
  emphasis = false,
}: {
  label: string;
  children: ReactNode;
  emphasis?: boolean;
}) {
  return (
    <div className="min-w-0">
      <dt className="text-xs font-medium uppercase tracking-wide text-slate-500">{label}</dt>
      <dd
        className={`mt-1 break-words tabular-nums ${
          emphasis ? "text-2xl font-semibold tracking-tight" : "text-base text-slate-800"
        }`}
      >
        {children}
      </dd>
    </div>
  );
}

function RefundDetailSkeleton() {
  return (
    <div className="flex flex-col gap-6" aria-busy="true" aria-label="Loading refund">
      <div className="rounded-lg border border-slate-200 bg-white p-6 shadow-sm">
        <div className="h-6 w-56 animate-pulse rounded bg-slate-200" />
        <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {Array.from({ length: 4 }, (_, i) => (
            <div key={i} className="h-12 animate-pulse rounded bg-slate-100" />
          ))}
        </div>
      </div>
      <div className="grid gap-6 lg:grid-cols-2">
        {Array.from({ length: 2 }, (_, i) => (
          <div key={i} className="h-64 animate-pulse rounded-lg border border-slate-200 bg-white" />
        ))}
      </div>
      <div className="h-40 animate-pulse rounded-lg border border-slate-200 bg-white" />
    </div>
  );
}
