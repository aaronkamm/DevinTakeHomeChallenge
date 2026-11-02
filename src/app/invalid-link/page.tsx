import type { Metadata } from "next";
import Link from "next/link";

import { PageShell } from "@/app/_components/page-shell";
import { GoBackButton } from "@/app/invalid-link/go-back-button";

export const metadata: Metadata = {
  title: "Link not working · Refunds Dashboard",
  robots: { index: false },
};

/** Where `src/proxy.ts` sends links it can't make sense of. */
export default function InvalidLinkPage() {
  return (
    <PageShell title="We couldn't open that link">
      <section className="rounded-lg border border-dashed border-slate-300 bg-white px-6 py-12 text-center shadow-sm">
        <p className="text-base font-medium text-slate-800">
          The web address you followed isn&apos;t quite right.
        </p>
        <p className="mx-auto mt-1 max-w-md text-sm text-slate-500">
          It may have a typo, or part of it got cut off when it was copied or shared.
        </p>
        <div className="mt-6 flex flex-wrap items-center justify-center gap-3">
          <GoBackButton />
          <Link
            href="/"
            className="inline-flex items-center rounded-md border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
          >
            Return home
          </Link>
        </div>
      </section>
    </PageShell>
  );
}
