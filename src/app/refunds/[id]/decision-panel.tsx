"use client";

import { useState, useTransition } from "react";

import { formatCents } from "@/lib/format";
import type { DecisionAction } from "@/lib/decision-rules";

import {
  approveRefund,
  escalateRefund,
  partiallyApproveRefund,
  rejectRefund,
  type DecisionResult,
} from "./actions";

const PENDING_LABELS: Record<DecisionAction, string> = {
  approve: "Approving…",
  partially_approve: "Saving…",
  reject: "Rejecting…",
  escalate: "Escalating…",
};

const BUTTON_BASE =
  "inline-flex items-center justify-center rounded-md px-3.5 py-2 text-sm font-medium shadow-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-500 focus-visible:ring-offset-1 disabled:cursor-not-allowed disabled:opacity-60";

const INPUT_BASE =
  "rounded-md border border-slate-300 bg-white text-sm text-slate-900 shadow-sm hover:border-slate-400 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-500 disabled:bg-slate-50";

/**
 * Parses a typed amount such as "1,234.5" into cents, or returns null if it isn't a valid amount.
 * Commas are only accepted as real-world thousands separators ("1,000", "1,000,000"), so "1,00" or "0,100" is rejected.
 */
function parseAmountToCents(value: string): number | null {
  const match = /^([1-9]\d{0,2}(?:,\d{3})+|\d+)(?:\.(\d{0,2}))?$/.exec(value.trim());
  if (!match) return null;
  const whole = Number(match[1].replace(/,/g, ""));
  const cents = whole * 100 + Number((match[2] ?? "").padEnd(2, "0"));
  return Number.isSafeInteger(cents) ? cents : null;
}

export function DecisionPanel({
  refundId,
  requestedAmountCents,
  currency,
  canDecide,
  canEscalate,
  restriction,
}: {
  refundId: string;
  requestedAmountCents: number;
  currency: string;
  canDecide: boolean;
  canEscalate: boolean;
  /** Shown when the current actor can't decide, explaining who can. */
  restriction: string | null;
}) {
  const [note, setNote] = useState("");
  const [amount, setAmount] = useState("");
  const canPartiallyApprove = requestedAmountCents > 1;
  const [error, setError] = useState<string | null>(null);
  const [pendingAction, setPendingAction] = useState<DecisionAction | null>(null);
  const [isPending, startTransition] = useTransition();

  function run(action: DecisionAction) {
    setError(null);
    let call: () => Promise<DecisionResult>;
    if (action === "partially_approve") {
      const amountCents = parseAmountToCents(amount);
      if (amountCents === null) {
        setError("Enter a valid amount, e.g. 125.00 or 1,250.00.");
        return;
      }
      if (amountCents <= 0) {
        setError("Enter a partial amount greater than zero.");
        return;
      }
      if (amountCents >= requestedAmountCents) {
        setError(
          `Partial amount must be less than the requested ${formatCents(requestedAmountCents, currency)}. Use Approve for the full amount.`,
        );
        return;
      }
      call = () => partiallyApproveRefund(refundId, { note, amountCents });
    } else {
      const fn = { approve: approveRefund, reject: rejectRefund, escalate: escalateRefund }[action];
      call = () => fn(refundId, { note });
    }

    setPendingAction(action);
    startTransition(async () => {
      try {
        const result = await call();
        if (!result.ok) setError(result.error);
      } catch {
        setError("Couldn't reach the server. Please try again.");
      } finally {
        setPendingAction(null);
      }
    });
  }

  const label = (action: DecisionAction, idle: string) =>
    isPending && pendingAction === action ? PENDING_LABELS[action] : idle;

  if (!canDecide && !canEscalate) {
    return <Notice>{restriction ?? "You can't take any action on this refund."}</Notice>;
  }

  return (
    <div className="flex flex-col gap-5" aria-busy={isPending}>
      {restriction && <Notice>{restriction}</Notice>}

      <div>
        <label
          htmlFor="decision-note"
          className="text-xs font-medium uppercase tracking-wide text-slate-500"
        >
          Note <span className="normal-case tracking-normal text-slate-400">(optional)</span>
        </label>
        <textarea
          id="decision-note"
          value={note}
          onChange={(e) => setNote(e.target.value)}
          disabled={isPending}
          rows={3}
          maxLength={1000}
          placeholder={
            canDecide ? "Explain the decision for the audit trail" : "Explain why this needs review"
          }
          className={`${INPUT_BASE} mt-1 block w-full px-3 py-2 placeholder:text-slate-400`}
        />
      </div>

      {canDecide && canPartiallyApprove && (
        <div>
          <label
            htmlFor="partial-amount"
            className="text-xs font-medium uppercase tracking-wide text-slate-500"
          >
            Partial amount ({currency})
          </label>
          <div className="mt-1 flex flex-wrap items-center gap-3">
            <input
              id="partial-amount"
              type="text"
              inputMode="decimal"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              disabled={isPending}
              placeholder="0.00"
              aria-describedby="partial-amount-hint"
              className={`${INPUT_BASE} w-36 px-3 py-2 tabular-nums`}
            />
            <span id="partial-amount-hint" className="text-xs text-slate-500">
              Used by Partially approve · must be less than the{" "}
              {formatCents(requestedAmountCents, currency)} requested
            </span>
          </div>
        </div>
      )}

      {error && (
        <p
          role="alert"
          className="rounded-md border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-800"
        >
          {error}
        </p>
      )}

      <div className="flex flex-wrap items-center justify-between gap-3 border-t border-slate-100 pt-5">
        <div className="flex flex-wrap gap-2">
          {canDecide && (
            <>
              <button
                type="button"
                onClick={() => run("approve")}
                disabled={isPending}
                className={`${BUTTON_BASE} bg-emerald-600 text-white hover:bg-emerald-700`}
              >
                {label("approve", `Approve ${formatCents(requestedAmountCents, currency)}`)}
              </button>
              <button
                type="button"
                onClick={() => run("partially_approve")}
                disabled={isPending || !canPartiallyApprove}
                title={canPartiallyApprove ? undefined : "Nothing smaller than the requested amount"}
                className={`${BUTTON_BASE} bg-sky-600 text-white hover:bg-sky-700`}
              >
                {label("partially_approve", "Partially approve")}
              </button>
              <button
                type="button"
                onClick={() => run("reject")}
                disabled={isPending}
                className={`${BUTTON_BASE} border border-rose-300 bg-white text-rose-700 hover:bg-rose-50`}
              >
                {label("reject", "Reject")}
              </button>
            </>
          )}
        </div>
        {canEscalate && (
          <button
            type="button"
            onClick={() => run("escalate")}
            disabled={isPending}
            className={`${BUTTON_BASE} border border-violet-300 bg-white text-violet-700 hover:bg-violet-50`}
          >
            {label("escalate", "Escalate")}
          </button>
        )}
      </div>
    </div>
  );
}

function Notice({ children }: { children: React.ReactNode }) {
  return (
    <p className="rounded-md border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
      {children}
    </p>
  );
}
