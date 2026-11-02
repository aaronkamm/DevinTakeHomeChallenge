import Link from "next/link";

import { PageShell } from "@/app/_components/page-shell";

export default function RefundNotFound() {
  return (
    <PageShell title="Refund not found" showBackLink>
      <section className="rounded-lg border border-dashed border-slate-300 bg-white px-6 py-12 text-center shadow-sm">
        <p className="text-base font-medium text-slate-800">There is no refund with this ID.</p>
        <p className="mt-1 text-sm text-slate-500">
          It may have been entered incorrectly, or the link you followed is out of date.
        </p>
        <Link
          href="/"
          className="mt-6 inline-flex items-center rounded-md bg-sky-700 px-4 py-2 text-sm font-medium text-white hover:bg-sky-800"
        >
          Return to Refunds
        </Link>
      </section>
    </PageShell>
  );
}
