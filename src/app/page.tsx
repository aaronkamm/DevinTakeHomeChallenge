import Link from "next/link";
import { connection } from "next/server";
import { Suspense, type ReactNode } from "react";

import { RiskScore } from "@/app/_components/risk-score";
import { STATUS_LABELS, StatusBadge } from "@/app/_components/status-badge";
import { formatCents, formatDateTime } from "@/lib/format";
import { isRefundStatus, listRefunds } from "@/lib/queries";
import { REFUND_STATUSES, type RefundStatus } from "@/lib/schema";

type SearchParams = PageProps<"/">["searchParams"];

export default function Home({ searchParams }: PageProps<"/">) {
  return (
    <main className="flex flex-1 flex-col bg-slate-50 text-slate-900">
      <header className="border-b border-slate-200 bg-white">
        <div className="mx-auto w-full max-w-7xl px-6 py-5">
          <p className="text-xs font-medium uppercase tracking-wide text-slate-500">
            Operations
          </p>
          <h1 className="text-2xl font-semibold tracking-tight">Refunds</h1>
          <p className="mt-1 text-sm text-slate-600">
            Browse refund requests and select one to review its details.
          </p>
        </div>
      </header>

      <div className="mx-auto w-full max-w-7xl flex-1 px-6 py-6">
        <Suspense fallback={<RefundsBrowserSkeleton />}>
          <RefundsBrowser searchParams={searchParams} />
        </Suspense>
      </div>
    </main>
  );
}

// Next gives us an array when a param is repeated (?status=a&status=b). We just take the first one.
function firstValue(value: string | string[] | undefined): string | undefined {
  return Array.isArray(value) ? value[0] : value;
}

// Builds a link back to this page. Page 1 and "All" are the defaults, so we leave them out to keep URLs short.
function hrefFor(status: RefundStatus | undefined, page = 1) {
  const query: Record<string, string> = {};
  if (status) query.status = status;
  if (page > 1) query.page = String(page);
  return { pathname: "/", query };
}

async function RefundsBrowser({ searchParams }: { searchParams: SearchParams }) {
  const params = await searchParams;
  // Refunds are read from the live database on every request, never prerendered.
  await connection();
  // An unknown status falls back to "All" (with a notice below) rather than throwing.
  // Bad page values like "abc" or "-1" are handled inside listRefunds, which resets them to 1.
  const rawStatus = firstValue(params.status);
  const status = isRefundStatus(rawStatus) ? rawStatus : undefined;
  const page = Number(firstValue(params.page) ?? 1);

  // If someone lands on a page past the end (old link, data changed), show the last page
  // instead of an empty table. The URL keeps the old number, but the Prev/Next links are correct.
  let result = await listRefunds({ status, page });
  if (result.page > result.totalPages && result.totalPages > 0) {
    result = await listRefunds({ status, page: result.totalPages });
  }
  const { items, page: currentPage, pageSize, total, totalPages } = result;

  const firstShown = total === 0 ? 0 : (currentPage - 1) * pageSize + 1;
  const lastShown = Math.min(currentPage * pageSize, total);

  return (
    <section className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <StatusFilter active={status} />
        <p className="text-sm text-slate-600" aria-live="polite">
          {total === 0
            ? "No refunds"
            : `Showing ${firstShown}–${lastShown} of ${total} ${total === 1 ? "refund" : "refunds"}`}
        </p>
      </div>

      {rawStatus !== undefined && !status && (
        <p className="rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-800">
          Unknown status &ldquo;{rawStatus}&rdquo; — showing all refunds.
        </p>
      )}

      <div className="overflow-x-auto rounded-lg border border-slate-200 bg-white shadow-sm">
        <table className="min-w-full text-sm">
          <caption className="sr-only">
            Refund requests{status ? ` with status ${STATUS_LABELS[status]}` : ""}
          </caption>
          <thead className="border-b border-slate-200 bg-slate-50 text-left text-xs font-semibold uppercase tracking-wide text-slate-600">
            <tr>
              <th scope="col" className="px-4 py-3">Refund ID</th>
              <th scope="col" className="px-4 py-3">Customer</th>
              <th scope="col" className="px-4 py-3">Merchant</th>
              <th scope="col" className="px-4 py-3 text-right">Requested Amount</th>
              <th scope="col" className="px-4 py-3">Status</th>
              <th scope="col" className="px-4 py-3 text-right">Risk Score</th>
              <th scope="col" className="px-4 py-3">Created At</th>
              <th scope="col" className="w-10 px-4 py-3">
                <span className="sr-only">Open</span>
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {items.length === 0 ? (
              <tr>
                <td colSpan={8} className="px-4 py-12 text-center text-slate-500">
                  No refunds match this filter.
                </td>
              </tr>
            ) : (
              items.map((refund) => (
                <tr
                  key={refund.id}
                  className="relative transition-colors hover:bg-slate-50 focus-within:bg-slate-50"
                >
                  <td className="whitespace-nowrap px-4 py-3 font-mono text-xs font-medium">
                    {/* Stretched link: the whole row is the click target. */}
                    <Link
                      href={`/refunds/${encodeURIComponent(refund.id)}`}
                      prefetch={false}
                      className="text-sky-700 after:absolute after:inset-0 hover:underline focus-visible:outline-none focus-visible:after:ring-2 focus-visible:after:ring-inset focus-visible:after:ring-sky-500"
                    >
                      {refund.id}
                    </Link>
                  </td>
                  <td className="px-4 py-3">
                    <div className="font-medium text-slate-900">{refund.customerName}</div>
                    <div className="text-xs text-slate-500">{refund.customerEmail}</div>
                  </td>
                  <td className="px-4 py-3 text-slate-700">
                    {refund.merchantName ?? <span className="text-slate-400">—</span>}
                  </td>
                  <td className="whitespace-nowrap px-4 py-3 text-right font-medium tabular-nums">
                    {formatCents(refund.requestedAmountCents, refund.currency)}
                  </td>
                  <td className="px-4 py-3">
                    <StatusBadge status={refund.status} />
                  </td>
                  <td className="whitespace-nowrap px-4 py-3 text-right tabular-nums">
                    <RiskScore score={refund.riskScore} />
                  </td>
                  <td className="whitespace-nowrap px-4 py-3 text-slate-600">
                    <time dateTime={refund.createdAt.toISOString()}>
                      {formatDateTime(refund.createdAt)}
                    </time>
                  </td>
                  <td className="px-4 py-3 text-right text-slate-400" aria-hidden="true">
                    ›
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {totalPages > 1 && (
        <nav
          aria-label="Pagination"
          className="flex items-center justify-between text-sm text-slate-600"
        >
          <span>
            Page {currentPage} of {totalPages}
          </span>
          <div className="flex gap-2">
            <PageLink href={hrefFor(status, currentPage - 1)} disabled={currentPage <= 1}>
              Previous
            </PageLink>
            <PageLink href={hrefFor(status, currentPage + 1)} disabled={currentPage >= totalPages}>
              Next
            </PageLink>
          </div>
        </nav>
      )}
    </section>
  );
}

function StatusFilter({ active }: { active: RefundStatus | undefined }) {
  const options: { value: RefundStatus | undefined; label: string }[] = [
    { value: undefined, label: "All" },
    ...REFUND_STATUSES.map((value) => ({ value, label: STATUS_LABELS[value] })),
  ];

  return (
    <nav aria-label="Filter by status" className="flex flex-wrap gap-1 rounded-lg bg-slate-200/60 p-1">
      {options.map(({ value, label }) => {
        const isActive = value === active;
        return (
          <Link
            key={label}
            href={hrefFor(value)}
            aria-current={isActive ? "page" : undefined}
            className={`rounded-md px-3 py-1.5 text-sm font-medium transition-colors ${
              isActive
                ? "bg-white text-slate-900 shadow-sm"
                : "text-slate-600 hover:bg-white/60 hover:text-slate-900"
            }`}
          >
            {label}
          </Link>
        );
      })}
    </nav>
  );
}

function PageLink({
  href,
  disabled,
  children,
}: {
  href: ReturnType<typeof hrefFor>;
  disabled: boolean;
  children: ReactNode;
}) {
  const className = "rounded-md border border-slate-300 bg-white px-3 py-1.5 font-medium";
  // At either end we render a plain span instead of a link, so there's nothing to click.
  if (disabled) {
    return (
      <span aria-disabled="true" className={`${className} cursor-not-allowed text-slate-400`}>
        {children}
      </span>
    );
  }
  return (
    <Link href={href} className={`${className} text-slate-700 hover:bg-slate-50`}>
      {children}
    </Link>
  );
}

function RefundsBrowserSkeleton() {
  return (
    <div className="flex flex-col gap-4" aria-busy="true" aria-label="Loading refunds">
      <div className="h-9 w-96 max-w-full animate-pulse rounded-lg bg-slate-200" />
      <div className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
        {Array.from({ length: 8 }, (_, i) => (
          <div key={i} className="my-3 h-5 animate-pulse rounded bg-slate-100" />
        ))}
      </div>
    </div>
  );
}
