import type { ActivityRing } from "@stageholder/ui";

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
 * Meridian's standard category colors — theme-aware CSS vars on web,
 * shared by the calendar rings, the day panel, and the daily-target
 * header rings. Passed straight to the kit `<ActivityRings>` as raw SVG
 * stroke colors.
 *   todo = red · habit = orange · journal = yellow
 */
export const RING_CATEGORY = {
  todo: { color: "var(--ring-todo)", track: "var(--ring-todo-track)" },
  habit: { color: "var(--ring-habit)", track: "var(--ring-habit-track)" },
  journal: { color: "var(--ring-journal)", track: "var(--ring-journal-track)" },
} as const;

/**
 * Per-category ring colors (stroke `color` + `track` background), keyed the
 * same as `RING_CATEGORY`. Widened to plain `string` (not the CSS-var literal
 * types of `RING_CATEGORY`) so native callers can pass resolved hex/rgba —
 * react-native-svg can't resolve `var(...)`.
 */
export interface RingColorMap {
  todo: { color: string; track: string };
  habit: { color: string; track: string };
  journal: { color: string; track: string };
}

/**
 * Maps computed completion to the kit `<ActivityRings>` ring config. Order
 * is outer→inner: journal, habit, todo (the kit renders `rings[0]`
 * outermost), preserving the prior Meridian ring stacking.
 *
 * `colors` defaults to `RING_CATEGORY` (web CSS vars). On native, pass a map
 * of resolved colors — the kit feeds these straight to react-native-svg as
 * stroke colors, which does not resolve CSS custom properties.
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
