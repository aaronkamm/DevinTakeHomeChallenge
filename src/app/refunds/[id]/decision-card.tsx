import { STATUS_LABELS, StatusBadge } from "@/app/_components/status-badge";
import type { CurrentActor } from "@/lib/actor";
import {
  canDecide,
  canEscalate,
  isOpenStatus,
  permissionError,
  reviewRequirement,
} from "@/lib/decision-rules";
import type { Refund } from "@/lib/schema";

import { DecisionPanel } from "./decision-panel";
import {
  ACTOR_ROLE_LABELS,
  ApprovedAmount,
  Card,
  EmptyState,
  Field,
  FieldList,
  Timestamp,
} from "./detail-ui";

export function DecisionCard({ refund, actor }: { refund: Refund; actor: CurrentActor }) {
  // Decisions taken here will be recorded under this name and role.
  const actingAs = `Acting as ${actor.name} · ${ACTOR_ROLE_LABELS[actor.role]}`;

  // Any one of these being set means a reviewer has acted, even if the others are still empty.
  const hasDecision =
    refund.decidedAt !== null ||
    refund.decidedBy !== null ||
    refund.decisionNote !== null ||
    refund.approvedAmountCents !== null;

  if (!hasDecision) {
    return (
      <Card title="Decision Information" description={actingAs}>
        {isOpenStatus(refund.status) ? (
          <OpenDecision refund={refund} actor={actor} />
        ) : (
          <EmptyState>
            No decision has been recorded. This refund is currently{" "}
            <span className="font-medium text-slate-700">
              {STATUS_LABELS[refund.status].toLowerCase()}
            </span>
            .
          </EmptyState>
        )}
      </Card>
    );
  }

  return (
    <Card title="Decision Information" description={actingAs}>
      <FieldList columns={2}>
        <Field label="Decision">
          <StatusBadge status={refund.status} />
        </Field>
        <Field label="Reviewer">{refund.decidedBy}</Field>
        <Field label="Decided at">
          {refund.decidedAt && <Timestamp date={refund.decidedAt} />}
        </Field>
        <Field label="Approved amount">
          <ApprovedAmount refund={refund} />
        </Field>
        <Field label="Decision note" wide>
          {refund.decisionNote}
        </Field>
      </FieldList>
    </Card>
  );
}

function OpenDecision({ refund, actor }: { refund: Refund; actor: CurrentActor }) {
  const requirement = reviewRequirement(refund);
  const allowedToDecide = canDecide(refund, actor.role);
  return (
    <div className="flex flex-col gap-5">
      <FieldList>
        <Field label="Current status">
          <StatusBadge status={refund.status} />
        </Field>
        <Field label="Decided by">
          {ACTOR_ROLE_LABELS[requirement.role]}
          {requirement.role === "agent" && " or manager"}
          {requirement.reason && (
            <span className="ml-2 text-xs text-slate-500">{requirement.reason}</span>
          )}
        </Field>
      </FieldList>
      {/* Keyed on status so the form resets after an escalation re-renders the page. */}
      <DecisionPanel
        key={refund.status}
        refundId={refund.id}
        requestedAmountCents={refund.requestedAmountCents}
        currency={refund.currency}
        canDecide={allowedToDecide}
        canEscalate={canEscalate(refund)}
        restriction={allowedToDecide ? null : permissionError(refund, actor.role, "approve")}
      />
    </div>
  );
}
