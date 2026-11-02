"use client";

import { useRouter } from "next/navigation";

/**
 * Takes the user back to wherever they were before the broken link. If this page was the first
 * thing they opened (say, from a pasted link), there's nothing to go back to, so we send them to
 * the Refunds list instead of leaving the button dead.
 */
export function GoBackButton() {
  const router = useRouter();

  function goBack() {
    if (window.history.length > 1) {
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
