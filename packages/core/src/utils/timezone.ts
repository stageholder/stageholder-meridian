// packages/core/src/utils/timezone.ts
//
// The device's IANA timezone, sent to the Meridian API as `X-Timezone` on
// every request (PWA ServiceWrapper, mobile createMeridianClient) so the
// server computes "today" — Light rings, streak days, journal/todo dates —
// in the user's zone rather than one server-wide default.

let cached: string | null | undefined;

/** e.g. "Asia/Jakarta"; null when the runtime can't tell. */
export function deviceTimeZone(): string | null {
  if (cached !== undefined) return cached;
  try {
    // Hermes supports resolvedOptions().timeZone (unlike supportedValuesOf).
    cached = Intl.DateTimeFormat().resolvedOptions().timeZone || null;
  } catch {
    cached = null;
  }
  return cached;
}
