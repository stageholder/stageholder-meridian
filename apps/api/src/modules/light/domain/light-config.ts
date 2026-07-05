// Light economy — the SINGLE SOURCE OF TRUTH for the tier thresholds and the
// streak multiplier lives in `@repo/core/types/light`, so the backend (which
// awards Light and computes currentTier) and every client (which renders the
// progress bar / multiplier badge) read the SAME numbers and can never drift.
// (An earlier duplicated copy is exactly how the multiplier display diverged
// from what the server applied.)
//
// This module re-exports that shared economy and keeps only the SERVER-ONLY
// award constants — action point-values, ring bonuses, and daily targets — that
// no client renders.
export {
  LIGHT_TIERS,
  STREAK_MULTIPLIERS,
  getTierForLight,
  getNextTier,
  getTierProgress,
  getMultiplier,
} from "@repo/core/types/light";
export type { LightTier } from "@repo/core/types/light";

export const DEFAULT_TARGETS = {
  todoDaily: 3,
  journalDailyWords: 75,
} as const;

export const LIGHT_ACTIONS = {
  TODO_COMPLETE_LOW: 3,
  TODO_COMPLETE_MEDIUM: 4,
  TODO_COMPLETE_HIGH: 5,
  HABIT_CHECKIN: 4,
  JOURNAL_ENTRY: 6,
  TODO_CREATE: 1,
  PERFECT_DAY: 10,
} as const;

export const RING_STREAK_MILESTONES = [
  { days: 100, bonus: 50 },
  { days: 60, bonus: 30 },
  { days: 30, bonus: 15 },
  { days: 7, bonus: 5 },
] as const;

export const RING_COMPLETION_BONUS = {
  SINGLE_RING: 3,
  ALL_RINGS: 5,
} as const;

export function getTodoLight(priority: string): number {
  if (priority === "high" || priority === "urgent")
    return LIGHT_ACTIONS.TODO_COMPLETE_HIGH;
  if (priority === "medium") return LIGHT_ACTIONS.TODO_COMPLETE_MEDIUM;
  return LIGHT_ACTIONS.TODO_COMPLETE_LOW;
}
