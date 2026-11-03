// Placeholder widths per column, cycled across rows so the skeleton doesn't look like a solid block.
const ROW_WIDTHS = [
  { customer: "w-28", email: "w-40", merchant: "w-32", amount: "w-16", status: "w-16", created: "w-40" },
  { customer: "w-24", email: "w-36", merchant: "w-24", amount: "w-14", status: "w-20", created: "w-40" },
  { customer: "w-32", email: "w-44", merchant: "w-28", amount: "w-16", status: "w-24", created: "w-40" },
];

// Matches REFUNDS_PAGE_SIZE so a full first page swaps in without the table changing height.
const ROW_COUNT = 20;

const COLUMNS = [
  { label: "Refund ID" },
  { label: "Customer" },
  { label: "Merchant" },
  { label: "Requested Amount", align: "text-right" },
  { label: "Status" },
  { label: "Risk Score", align: "text-right" },
  { label: "Created At" },
];

/** Stand-in for the Browse table while refunds load. Mirrors its filter bar, table and pagination. */
export function RefundsBrowserSkeleton() {
  return (
    <div className="flex flex-col gap-4" aria-busy="true" aria-label="Loading refunds">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex h-10 w-[36rem] max-w-full animate-pulse rounded-lg bg-slate-200/60 p-1">
          <div className="h-8 w-12 rounded-md bg-white shadow-sm" />
        </div>
        <div className="h-4 w-44 animate-pulse rounded bg-slate-200" />
      </div>

      <div className="overflow-x-auto rounded-lg border border-slate-200 bg-white shadow-sm">
        <table className="min-w-full text-sm" aria-hidden="true">
          <thead className="border-b border-slate-200 bg-slate-50 text-left text-xs font-semibold uppercase tracking-wide text-slate-600">
            <tr>
              {COLUMNS.map(({ label, align }) => (
                <th key={label} scope="col" className={`whitespace-nowrap px-4 py-3 ${align ?? ""}`}>
                  {label}
                </th>
              ))}
              <th scope="col" className="w-10 px-4 py-3" />
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {Array.from({ length: ROW_COUNT }, (_, i) => {
              const w = ROW_WIDTHS[i % ROW_WIDTHS.length];
              return (
                <tr key={i} className="animate-pulse">
                  <td className="px-4 py-3">
                    <Bar className="w-16" />
                  </td>
                  <td className="px-4 py-3">
                    {/* Two lines like the real cell: customer name, then email in text-xs. */}
                    <Bar className={w.customer} />
                    <div className="flex h-4 items-center">
                      <div className={`h-2.5 rounded bg-slate-100 ${w.email}`} />
                    </div>
                  </td>
                  <td className="px-4 py-3">
                    <Bar className={w.merchant} />
                  </td>
                  <td className="px-4 py-3">
                    <Bar className={`ml-auto ${w.amount}`} />
                  </td>
                  <td className="px-4 py-3">
                    {/* Same height as StatusBadge's pill. */}
                    <div className={`h-5 rounded-full bg-slate-200 ${w.status}`} />
                  </td>
                  <td className="px-4 py-3">
                    <Bar className="ml-auto w-6" />
                  </td>
                  <td className="px-4 py-3">
                    <Bar className={w.created} />
                  </td>
                  <td className="px-4 py-3">
                    <Bar className="w-3" />
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      <div className="flex animate-pulse items-center justify-between" aria-hidden="true">
        <div className="h-4 w-24 rounded bg-slate-200" />
        <div className="flex gap-2">
          <div className="h-[34px] w-[84px] rounded-md border border-slate-200 bg-white" />
          <div className="h-[34px] w-[60px] rounded-md border border-slate-200 bg-white" />
        </div>
      </div>
    </div>
  );
}

// A text-line placeholder: 20px tall like a line of text-sm, with the bar itself a little shorter.
function Bar({ className }: { className: string }) {
  return (
    <div className="flex h-5 items-center">
      <div className={`h-3.5 rounded bg-slate-200 ${className}`} />
    </div>
  );
}
