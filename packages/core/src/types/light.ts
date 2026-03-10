export interface UserLight {
  id: string;
  userId: string;
  totalLight: number;
  currentTier: number;
  currentTitle: string;
  perfectDayStreak: number;
  todoRingStreak: number;
  habitRingStreak: number;
  journalRingStreak: number;
  lastActiveDate: string | null;
  longestPerfectStreak: number;
  perfectDaysTotal: number;
  todoTargetDaily: number;
  journalTargetDailyWords: number;
  createdAt: string;
  updatedAt: string;
}

export interface LightEvent {
  id: string;
  userId: string;
  workspaceId: string;
  action: 'todo_complete' | 'todo_create' | 'habit_checkin' | 'journal_entry' | 'perfect_day' | 'ring_streak_bonus' | 'ring_completion_bonus';
  baseLight: number;
  multiplier: number;
  totalLight: number;
  date: string;
  metadata?: Record<string, unknown>;
  createdAt: string;
  updatedAt: string;
}

export interface LightTier {
  tier: number;
  title: string;
  lightRequired: number;
}

export const LIGHT_TIERS: LightTier[] = [
  { tier: 1, title: 'Stargazer', lightRequired: 0 },
  { tier: 2, title: 'Spark', lightRequired: 50 },
  { tier: 3, title: 'Ember', lightRequired: 150 },
  { tier: 4, title: 'Flame', lightRequired: 400 },
  { tier: 5, title: 'Radiant', lightRequired: 800 },
  { tier: 6, title: 'Flare', lightRequired: 1500 },
  { tier: 7, title: 'Nova', lightRequired: 2800 },
  { tier: 8, title: 'Pulsar', lightRequired: 5000 },
  { tier: 9, title: 'Supernova', lightRequired: 8500 },
  { tier: 10, title: 'Meridian', lightRequired: 13000 },
];

export function getNextTier(currentTier: number): LightTier | null {
  if (currentTier >= 10) return null;
  return LIGHT_TIERS[currentTier] ?? null;
}

export function getTierProgress(totalLight: number, currentTier: number): number {
  const current = LIGHT_TIERS[currentTier - 1];
  const next = LIGHT_TIERS[currentTier];
  if (!current || !next) return 100;
  const range = next.lightRequired - current.lightRequired;
  const progress = totalLight - current.lightRequired;
  return Math.min(100, Math.round((progress / range) * 100));
}
