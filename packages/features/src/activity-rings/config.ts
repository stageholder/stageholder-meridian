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
 * Maps computed completion to the kit `<ActivityRings>` ring config. Order
 * is outer→inner: journal, habit, todo (the kit renders `rings[0]`
 * outermost), preserving the prior Meridian ring stacking.
 */
export function activityRingsConfig(data: ActivityRingsData): ActivityRing[] {
  return [
    {
      value: data.journal,
      max: 100,
      color: RING_CATEGORY.journal.color,
      trackColor: RING_CATEGORY.journal.track,
      label: "Journal",
    },
    {
      value: data.habit,
      max: 100,
      color: RING_CATEGORY.habit.color,
      trackColor: RING_CATEGORY.habit.track,
      label: "Habits",
    },
    {
      value: data.todo,
      max: 100,
      color: RING_CATEGORY.todo.color,
      trackColor: RING_CATEGORY.todo.track,
      label: "Todos",
    },
  ];
}
