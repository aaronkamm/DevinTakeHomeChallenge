"use client";

import { useRouter } from "next/navigation";

import { hasVisitedDashboard } from "@/app/_components/dashboard-visit-marker";

/**
 * Takes the user back to wherever they were in the dashboard before the broken link. If they never
 * reached a dashboard page in this tab (say, a link pasted into a new tab), going back would leave
 * the app, so we send them to the Refunds list instead.
 */
export function GoBackButton() {
  const router = useRouter();

  function goBack() {
    if (hasVisitedDashboard()) {
      router.back();
    } else {
      router.push("/");
    }
  }

  return (
    <button
      type="button"
      onClick={goBack}
      className="inline-flex items-center rounded-md bg-sky-700 px-4 py-2 text-sm font-medium text-white hover:bg-sky-800"
    >
      Go back
    </button>
  );
}
