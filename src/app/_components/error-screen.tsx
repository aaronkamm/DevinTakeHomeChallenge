"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { startTransition, useEffect } from "react";

import { PageShell } from "@/app/_components/page-shell";

export type ErrorBoundaryProps = {
  error: Error & { digest?: string };
  reset: () => void;
};

/**
 * The recovery screen shown by the `error.tsx` boundaries. "Try again" refreshes the route before
 * calling `reset()`: on its own, `reset()` re-renders the server output that already failed, so a
 * database error would just show up again.
 */
export function ErrorScreen({
  error,
  reset,
  title,
  message,
  showBackLink = false,
}: ErrorBoundaryProps & {
  title: string;
  message: string;
  showBackLink?: boolean;
}) {
  const router = useRouter();

  useEffect(() => {
    console.error(error);
  }, [error]);

  function tryAgain() {
    startTransition(() => {
      router.refresh();
      reset();
    });
  }

  return (
    <PageShell title={title} showBackLink={showBackLink}>
      <section className="rounded-lg border border-dashed border-slate-300 bg-white px-6 py-12 text-center shadow-sm">
        <p className="text-base font-medium text-slate-800">Something went wrong.</p>
        <p className="mx-auto mt-1 max-w-md text-sm text-slate-500">{message}</p>
        {process.env.NODE_ENV !== "production" && (error?.message || error?.digest) && (
          <dl className="mx-auto mt-4 max-w-xl rounded-md bg-slate-50 px-4 py-3 text-left font-mono text-xs text-slate-600">
            {error.message && (
              <div>
                <dt className="inline font-semibold">Error: </dt>
                <dd className="inline break-words">{error.message}</dd>
              </div>
            )}
            {error.digest && (
              <div>
                <dt className="inline font-semibold">Digest: </dt>
                <dd className="inline">{error.digest}</dd>
              </div>
            )}
          </dl>
        )}
        <div className="mt-6 flex flex-wrap items-center justify-center gap-3">
          <button
            type="button"
            onClick={tryAgain}
            className="inline-flex items-center rounded-md bg-sky-700 px-4 py-2 text-sm font-medium text-white hover:bg-sky-800"
          >
            Try again
          </button>
          <Link
            href="/"
            className="inline-flex items-center rounded-md border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
          >
            Return to Refunds
          </Link>
        </div>
      </section>
    </PageShell>
  );
}
