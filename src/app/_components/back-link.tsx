import Link from "next/link";

/** Navigation back to the Refunds Operations Dashboard. */
export function BackLink() {
  return (
    <Link
      href="/"
      className="inline-flex items-center gap-1.5 text-sm font-medium text-sky-700 hover:underline"
    >
      <span aria-hidden="true">←</span>
      Back to Refunds
    </Link>
  );
}
