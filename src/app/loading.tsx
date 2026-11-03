import { PageShell } from "@/app/_components/page-shell";
import { RefundsBrowserSkeleton } from "@/app/_components/refunds-browser-skeleton";

export default function Loading() {
  return (
    <PageShell
      title="Refunds"
      description="Browse refund requests and select one to review its details."
    >
      <RefundsBrowserSkeleton />
    </PageShell>
  );
}
