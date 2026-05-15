import { format } from "date-fns";

const DATE_ONLY_RE = /^\d{4}-\d{2}-\d{2}$/;

/**
 * Parse a YYYY-MM-DD domain date string as local midnight.
 *
 * Bare date strings ("2026-03-29") are interpreted as the local calendar date
 * at 00:00:00, not UTC midnight. This avoids the classic off-by-one bug in
 * positive-UTC timezones where `new Date("2026-03-29")` resolves to the
 * previous local day.
 *
 * Full ISO-8601 strings (e.g. createdAt timestamps) pass through unchanged.
 */
export function parseDateLocal(value: string): Date {
  if (DATE_ONLY_RE.test(value)) {
    return new Date(value + "T00:00:00");
  }
  return new Date(value);
}

/**
 * Return today's date as a YYYY-MM-DD string using the local clock.
 *
 * Replaces `new Date().toISOString().slice(0, 10)` which returns the UTC date
 * and drifts from the user's local calendar date near midnight.
 */
export function todayLocal(): string {
  return format(new Date(), "yyyy-MM-dd");
}
