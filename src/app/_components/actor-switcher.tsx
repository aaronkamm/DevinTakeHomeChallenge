"use client";

import { useOptimistic, useTransition } from "react";

import { setCurrentActor } from "@/app/_actions/actor";
import {
  REVIEWER_ROLE_LABELS,
  REVIEWERS,
  REVIEWERS_BY_ROLE,
  type Reviewer,
  type ReviewerRole,
} from "@/lib/reviewers";

// Names are unique across roles today, but keying on both keeps the option values unambiguous.
const keyFor = (r: Reviewer) => `${r.role}:${r.name}`;

export function ActorSwitcher({ current }: { current: Reviewer }) {
  const [isPending, startTransition] = useTransition();
  // Show the new choice straight away while the server sets the cookie and re-renders.
  const [selected, setSelected] = useOptimistic(current);

  function handleChange(key: string) {
    const next = REVIEWERS.find((r) => keyFor(r) === key);
    if (!next) return;
    startTransition(async () => {
      setSelected(next);
      await setCurrentActor(next.name, next.role);
    });
  }

  return (
    <label className="flex items-center gap-2 text-sm text-slate-600">
      <span className="text-xs font-medium uppercase tracking-wide text-slate-500">Acting as</span>
      <select
        value={keyFor(selected)}
        onChange={(e) => handleChange(e.target.value)}
        aria-busy={isPending}
        className={`rounded-md border border-slate-300 bg-white px-2.5 py-1.5 text-sm text-slate-900 shadow-sm hover:border-slate-400 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-500 ${
          isPending ? "opacity-60" : ""
        }`}
      >
        {(Object.keys(REVIEWERS_BY_ROLE) as ReviewerRole[]).map((role) => (
          <optgroup key={role} label={REVIEWER_ROLE_LABELS[role]}>
            {REVIEWERS_BY_ROLE[role].map((name) => (
              <option key={name} value={keyFor({ name, role })}>
                {name} · {REVIEWER_ROLE_LABELS[role]}
              </option>
            ))}
          </optgroup>
        ))}
      </select>
    </label>
  );
}

/** Same footprint as the switcher, shown while the actor cookie is read. */
export function ActorSwitcherSkeleton() {
  return (
    <div className="flex items-center gap-2" aria-hidden="true">
      <span className="text-xs font-medium uppercase tracking-wide text-slate-500">Acting as</span>
      <div className="h-8 w-48 animate-pulse rounded-md bg-slate-200" />
    </div>
  );
}
