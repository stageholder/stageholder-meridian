export const LIGHT_TIERS = [
  { tier: 1, title: "Stargazer", lightRequired: 0 },
  { tier: 2, title: "Spark", lightRequired: 50 },
  { tier: 3, title: "Ember", lightRequired: 150 },
  { tier: 4, title: "Flame", lightRequired: 400 },
  { tier: 5, title: "Radiant", lightRequired: 800 },
  { tier: 6, title: "Flare", lightRequired: 1500 },
  { tier: 7, title: "Nova", lightRequired: 2800 },
  { tier: 8, title: "Pulsar", lightRequired: 5000 },
  { tier: 9, title: "Supernova", lightRequired: 8500 },
  { tier: 10, title: "Meridian", lightRequired: 13000 },
] as const;

export type LightTier = (typeof LIGHT_TIERS)[number];

export const DEFAULT_TARGETS = {
  todoDaily: 3,
  journalDailyWords: 150,
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

export const STREAK_MULTIPLIERS = [
  { minDays: 30, multiplier: 3.0 },
  { minDays: 14, multiplier: 2.5 },
  { minDays: 7, multiplier: 2.0 },
  { minDays: 3, multiplier: 1.5 },
  { minDays: 1, multiplier: 1.0 },
] as const;

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

export function getTierForLight(totalLight: number): LightTier {
  for (let i = LIGHT_TIERS.length - 1; i >= 0; i--) {
    if (totalLight >= LIGHT_TIERS[i].lightRequired) return LIGHT_TIERS[i];
  }
  return LIGHT_TIERS[0];
}

export function getMultiplier(perfectDayStreak: number): number {
  for (const entry of STREAK_MULTIPLIERS) {
    if (perfectDayStreak >= entry.minDays) return entry.multiplier;
  }
  return 1.0;
}

export function getTodoLight(priority: string): number {
  if (priority === "high" || priority === "urgent")
    return LIGHT_ACTIONS.TODO_COMPLETE_HIGH;
  if (priority === "medium") return LIGHT_ACTIONS.TODO_COMPLETE_MEDIUM;
  return LIGHT_ACTIONS.TODO_COMPLETE_LOW;
}
