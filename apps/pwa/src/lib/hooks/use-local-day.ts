// apps/pwa/src/lib/hooks/use-local-day.ts
//
// The current LOCAL day (yyyy-MM-dd) as reactive state — the web twin of
// apps/mobile/lib/hooks/use-local-day.ts.
//
// WHY: `format(new Date(), "yyyy-MM-dd")` during render is a snapshot, not a
// subscription. A browser tab or the desktop app left open overnight never
// re-renders on its own, so every "today" computed that way (the dashboard
// date, habit check-in `activeDate`, todo buckets, upcoming ranges) stays on
// yesterday until something else happens to re-render — and with
// `refetchOnWindowFocus` off nothing does. Users saw yesterday's lists
// behaving as if they were today's (2026-10-21).
//
// Triggers: a coarse interval (tab sitting open across midnight) plus
// `visibilitychange` / `focus` (laptop lid closed overnight: timers are
// throttled or suspended in background tabs, so returning must re-check at
// once). Both funnel through a setState that bails when the key is unchanged.

import { useEffect, useRef, useState } from "react";
import { queryClient } from "@/lib/query-client";
import { todayLocal } from "@/lib/date";

/** Poll cadence: far finer than a date rollover, cheap enough to be invisible. */
const TICK_MS = 60 * 1000;

export function useLocalDayKey(): string {
  const [day, setDay] = useState(todayLocal);

  useEffect(() => {
    const sync = () => setDay(todayLocal());
    const timer = setInterval(sync, TICK_MS);
    const onVisible = () => {
      if (document.visibilityState === "visible") sync();
    };
    document.addEventListener("visibilitychange", onVisible);
    window.addEventListener("focus", sync);
    return () => {
      clearInterval(timer);
      document.removeEventListener("visibilitychange", onVisible);
      window.removeEventListener("focus", sync);
    };
  }, []);

  return day;
}

/**
 * Mounted once at the app root: when the local day changes, every cached
 * query is yesterday's answer (and many keys embed the day), so refetch all
 * of them. Components read the day through `useLocalDayKey()` and re-render
 * on the same tick, which rebuilds their day-keyed queries for the new day.
 */
export function DayRollover() {
  const day = useLocalDayKey();
  const seen = useRef(day);
  useEffect(() => {
    if (seen.current === day) return;
    seen.current = day;
    void queryClient.invalidateQueries();
  }, [day]);
  return null;
}
