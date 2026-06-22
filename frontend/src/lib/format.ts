// Shared display formatting for analytics values.
//
// The backend returns monetary and average-progress values as DECIMAL STRINGS
// (e.g. "1800.00", "66.7") so the frontend never accumulates float drift. These
// helpers parse the string only at the display boundary and never feed it back
// through lossy float arithmetic before rendering.

const currencyFormatter = new Intl.NumberFormat("en-US", {
  style: "currency",
  currency: "USD",
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

/** Format a decimal string (or number) as USD currency, e.g. "1800.00" -> "$1,800.00". */
export function formatCurrency(value: string | number): string {
  const n = typeof value === "number" ? value : Number(value);
  if (!Number.isFinite(n)) return currencyFormatter.format(0);
  return currencyFormatter.format(n);
}

/** Format a decimal string (or number) as a percentage, e.g. "66.7" -> "66.7%". */
export function formatPercent(value: string | number): string {
  const n = typeof value === "number" ? value : Number(value);
  if (!Number.isFinite(n)) return "0%";
  // Drop a trailing ".0" so whole values read cleanly (100 -> "100%", 66.7 -> "66.7%").
  const rounded = Math.round(n * 10) / 10;
  const text = Number.isInteger(rounded) ? String(rounded) : rounded.toFixed(1);
  return `${text}%`;
}

/**
 * Format an ISO timestamp as a compact relative time, e.g. "just now",
 * "2m ago", "3h ago", "5d ago". Falls back to a short absolute date beyond a
 * week. Pure — takes an optional `now` for deterministic testing.
 */
export function formatRelativeTime(iso: string, now: Date = new Date()): string {
  const then = new Date(iso);
  const ms = now.getTime() - then.getTime();
  if (!Number.isFinite(ms)) return "";
  if (ms < 0) return "just now";

  const sec = Math.floor(ms / 1000);
  if (sec < 45) return "just now";
  const min = Math.floor(sec / 60);
  if (min < 60) return `${min}m ago`;
  const hr = Math.floor(min / 60);
  if (hr < 24) return `${hr}h ago`;
  const day = Math.floor(hr / 24);
  if (day < 7) return `${day}d ago`;

  return then.toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

/** Format an ISO timestamp as an absolute date-time for detail views. */
export function formatDateTime(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  return d.toLocaleString("en-US", {
    year: "numeric",
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}
