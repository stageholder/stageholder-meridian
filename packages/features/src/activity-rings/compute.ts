// packages/features/src/activity-rings/compute.ts
//
// The shape-AGNOSTIC per-day ring percentage math. Both apps used to carry a
// verbatim copy of this formula inside their own `computeActivityRings`
// (apps/pwa/src/lib/hooks/use-activity-rings.ts + apps/mobile/lib/api/hooks/
// calendar.ts) because each consumes its own platform-local `CalendarDayData`
// shape. The SHAPE differs; the MATH doesn't — so the math lives here and each
// platform's `computeActivityRings` just extracts the primitives from its
// calendar day, then calls this.

import type { ActivityRingsData } from "./config";

/** Raw counts for one day's three rings. */
export interface RingInputs {
  /** Todos completed vs the daily target. */
  todo: { done: number; target: number };
  /** Scheduled habits acted-on (completed OR skipped both fill the ring) vs
   *  the count scheduled that day. */
  habit: { done: number; scheduled: number };
  /** Journal words written vs the daily word target. */
  journal: { words: number; target: number };
}

/** Completion percentage in [0, 100]; a non-positive denominator reads as 0. */
function pct(numerator: number, denominator: number): number {
  if (denominator <= 0) return 0;
  return Math.min(100, (numerator / denominator) * 100);
}

/**
 * Per-day completion (0–100) for the three activity rings from raw counts.
 * Pure + platform-agnostic — the single source of truth for the ring formula.
 */
export function computeRingPercentages(inputs: RingInputs): ActivityRingsData {
  return {
    todo: pct(inputs.todo.done, inputs.todo.target),
    habit: pct(inputs.habit.done, inputs.habit.scheduled),
    journal: pct(inputs.journal.words, inputs.journal.target),
  };
}
