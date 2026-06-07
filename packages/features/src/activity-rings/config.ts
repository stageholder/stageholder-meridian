import type { ActivityRing } from "@stageholder/ui";
import { RING_CATEGORY, type RingColorMap } from "./ring-colors";

// Platform-split colors (web CSS vars / native resolved hex — Metro picks
// `ring-colors.native.ts`) — re-exported so existing `from "./config"` /
// barrel imports keep working.
export { RING_CATEGORY, type RingColorMap };

/** Per-day completion (0–100) for the three Meridian activity rings. */
export interface ActivityRingsData {
  todo: number;
  habit: number;
  journal: number;
}

/**
 * Granular per-ring counts used by the legend below the rings (fractions
 * like `3/5` for Todos, `75/100 words` for Journal). The host's hook
 * computes this from its own calendar/habits/light fetches.
 */
export interface ActivityRingsDetails {
  todoDone: number;
  todoTarget: number;
  habitDone: number;
  habitTotal: number;
  hasJournal: boolean;
  journalWords: number;
  journalTarget: number;
}

/**
 * Maps computed completion to the kit `<ActivityRings>` ring config. Order
 * is outer→inner: journal, habit, todo (the kit renders `rings[0]`
 * outermost), preserving the prior Meridian ring stacking.
 *
 * `colors` defaults to `RING_CATEGORY`, which is platform-resolved (CSS
 * vars on web, resolved hex/rgba on native via `ring-colors.native.ts`) —
 * omitting it is safe on both runtimes. Pass an explicit map only to
 * override the standard palette.
 */
export function activityRingsConfig(
  data: ActivityRingsData,
  colors: RingColorMap = RING_CATEGORY,
): ActivityRing[] {
  return [
    {
      value: data.journal,
      max: 100,
      color: colors.journal.color,
      trackColor: colors.journal.track,
      label: "Journal",
    },
    {
      value: data.habit,
      max: 100,
      color: colors.habit.color,
      trackColor: colors.habit.track,
      label: "Habits",
    },
    {
      value: data.todo,
      max: 100,
      color: colors.todo.color,
      trackColor: colors.todo.track,
      label: "Todos",
    },
  ];
}
