"use client";

import { useRouter } from "next/navigation";

/**
 * Takes the user back to the dashboard page they were on before the broken link. If the link came
 * from somewhere else (pasted into a new tab, typed, or followed from another site), going back
 * would leave the app, so we send them to the Refunds list instead.
 *
 * `src/proxy.ts` adds `?from=app` when the link was followed from one of our pages. We read it at
 * click time rather than with `useSearchParams` so the page can stay fully static. The history
 * check covers an in-app link opened in a new tab, which has nothing to go back to.
 */
export function GoBackButton() {
  const router = useRouter();

  function goBack() {
    const fromApp = new URLSearchParams(window.location.search).get("from") === "app";
    if (fromApp && window.history.length > 1) {
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
