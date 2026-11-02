import Link from "next/link";

import { BackLink } from "@/app/_components/back-link";

export default function RefundNotFound() {
  return (
    <main className="flex flex-1 flex-col bg-slate-50 text-slate-900">
      <header className="border-b border-slate-200 bg-white">
        <div className="mx-auto w-full max-w-7xl px-6 py-5">
          <BackLink />
          <p className="mt-3 text-xs font-medium uppercase tracking-wide text-slate-500">
            Operations
          </p>
          <h1 className="text-2xl font-semibold tracking-tight">Refund not found</h1>
        </div>
      </header>

      <div className="mx-auto w-full max-w-7xl flex-1 px-6 py-6">
        <section className="rounded-lg border border-dashed border-slate-300 bg-white px-6 py-12 text-center shadow-sm">
          <p className="text-base font-medium text-slate-800">
            There is no refund with this ID.
          </p>
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
      </div>
    </main>
  );
}
