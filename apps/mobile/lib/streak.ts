// apps/mobile/lib/streak.ts
//
// Streak math moved to @repo/core/habits/streak (shared with the PWA + the API's
// server-computed currentStreak). This file re-exports so existing imports
// ("@/lib/streak") keep resolving; prefer importing from @repo/core in new code.

export {
  computeStreak,
  computeStreakCached,
  localDateKey,
  fromDateKey,
  isCheckedToday,
  isScheduledToday,
} from "@repo/core/habits/streak";
