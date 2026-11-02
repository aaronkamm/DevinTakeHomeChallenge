/** Formats an integer amount in minor units (cents) as a currency string, e.g. 12345 → "$123.45". */
export function formatCents(cents: number, currency = "USD"): string {
  try {
    return new Intl.NumberFormat("en-US", { style: "currency", currency }).format(
      cents / 100,
    );
  } catch {
    // The currency column is free text, and Intl throws on malformed codes. Rather than
    // take down the whole page over one bad row, show the raw amount with the code next to it.
    return `${(cents / 100).toFixed(2)} ${currency}`;
  }
}

const dateTimeFormat = new Intl.DateTimeFormat("en-US", {
  dateStyle: "medium",
  timeStyle: "short",
  timeZone: "UTC",
});

/** Formats a timestamp for display in UTC, e.g. "Oct 28, 2026, 3:04 PM UTC". */
export function formatDateTime(date: Date): string {
  return `${dateTimeFormat.format(date)} UTC`;
}
