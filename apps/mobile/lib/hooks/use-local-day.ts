// apps/mobile/lib/hooks/use-local-day.ts
//
// The current LOCAL day (yyyy-mm-dd) as reactive state.
//
// WHY: `localDateKey()` called during render is a snapshot, not a subscription.
// The Today screen is a TAB ROOT — it mounts once and never unmounts — so a
// plain `const today = localDateKey()` freezes at whatever day the app was
// launched on. Cross midnight with the app open and the screen keeps rendering
// yesterday: `/dashboard/today` stays keyed on the old day (so it never even
// refetches), the check-in rows act on the old `activeDate`, and the KPI/ring
// derivations drift from what the user sees on the calendar.
//
// Two triggers, because neither alone is sufficient on mobile:
//   - a coarse interval, for the app sitting open across midnight;
//   - AppState → "active", because timers are throttled/suspended in the
//     background, so returning to a foregrounded app must re-check immediately.
// Both funnel through a setState that BAILS when the key is unchanged, so this
// costs one comparison a minute and re-renders only on an actual day change.

import { useEffect, useRef, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { AppState } from "react-native";
import { localDateKey } from "@repo/core/habits/streak";

/** Poll cadence. A minute is far finer than the thing being detected (a date
 *  rollover) and cheap enough to be invisible. */
const TICK_MS = 60 * 1000;

export function useLocalDayKey(): string {
  const [day, setDay] = useState(localDateKey);

  useEffect(() => {
    // setState with an identical string is a no-op re-render-wise (React bails
    // out on Object.is equality), so this is safe to call unconditionally.
    const sync = () => setDay(localDateKey());

    const timer = setInterval(sync, TICK_MS);
    const sub = AppState.addEventListener("change", (next) => {
      if (next === "active") sync();
    });

    return () => {
      clearInterval(timer);
      sub.remove();
    };
  }, []);

  return day;
}

/**
 * Mounted once at the app root: when the local day changes, every cached
 * query is yesterday's answer (and several keys embed the day), so refetch
 * all of them once. One invalidation per rollover, only for queries with a
 * mounted screen; the minute tick itself never touches the network.
 */
export function DayRollover() {
  const day = useLocalDayKey();
  const qc = useQueryClient();
  const seen = useRef(day);
  useEffect(() => {
    if (seen.current === day) return;
    seen.current = day;
    void qc.invalidateQueries();
  }, [day, qc]);
  return null;
}
