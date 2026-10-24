export interface UserLight {
  id: string;
  userSub: string;
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
  userSub: string;
  action:
    | "todo_complete"
    | "todo_create"
    | "habit_checkin"
    | "journal_entry"
    | "perfect_day"
    | "ring_streak_bonus"
    | "ring_completion_bonus";
  baseLight: number;
  multiplier: number;
  totalLight: number;
  date: string;
  metadata?: Record<string, unknown>;
  createdAt: string;
  updatedAt: string;
}

export interface LightStatDay {
  date: string;
  light: number;
}

export interface LightStats {
  baseline: {
    totalLight: number;
  };
  days: LightStatDay[];
}

export interface LightTier {
  tier: number;
  title: string;
  lightRequired: number;
  /** One line, grounded in time ("Two weeks in"), shown on the path. */
  shortDescription: string;
  /** The tier note — what this stretch of the journey actually looks like. */
  description: string;
  /**
   * When a typical daily user reaches this tier ("About a month"). A static
   * hint for people without enough history for a pace estimate; surfaces
   * swap it for the live ETA once `getLightPace` has data.
   */
  typicalWindow: string;
}

export const LIGHT_TIERS: LightTier[] = [
  {
    tier: 1,
    title: "Stargazer",
    lightRequired: 0,
    shortDescription: "Day one. You showed up.",
    typicalWindow: "Day one",
    description:
      "Everything starts here. There is nothing to prove yet: add a task, check a habit, write a few lines. Light counts every one of them, and the first tiers arrive quickly on purpose.",
  },
  {
    tier: 2,
    title: "Spark",
    lightRequired: 50,
    shortDescription: "A couple of good days in a row.",
    typicalWindow: "The first few days",
    description:
      "Fifty Light is about two days of using Meridian the way you meant to. It is early, and that is fine. Sparks go out easily, so the whole job right now is small: do tomorrow what you did today.",
  },
  {
    tier: 3,
    title: "Ember",
    lightRequired: 150,
    shortDescription: "The routine is starting to hold.",
    typicalWindow: "The first week",
    description:
      "Roughly a week of steady days. You have found a rhythm that fits your life instead of a plan copied from someone else. Embers do not flare up, they stay lit, and staying lit is exactly what this tier rewards.",
  },
  {
    tier: 4,
    title: "Flame",
    lightRequired: 400,
    shortDescription: "Two weeks of showing up.",
    typicalWindow: "Two weeks in",
    description:
      "A lot of people stop before this point. You did not. Your rings close more days than they miss, your habits have real streaks behind them, and the journal has entries you would actually reread. From here, perfect-day streaks multiply everything you earn.",
  },
  {
    tier: 5,
    title: "Radiant",
    lightRequired: 800,
    shortDescription: "About a month of consistency.",
    typicalWindow: "About a month",
    description:
      "Around a month of steady work. The habit is no longer the app, it is the days themselves. Your own history shows the pattern now: slow weeks, strong weeks, and the fact that you kept going through both.",
  },
  {
    tier: 6,
    title: "Flare",
    lightRequired: 1500,
    shortDescription: "Six to eight weeks. It is how you live now.",
    typicalWindow: "Six to eight weeks",
    description:
      "Two months in, the streak multiplier is doing real work and your streaks are measured in weeks. Missing a day still happens. What changed is that it no longer ends anything. You come back the next morning.",
  },
  {
    tier: 7,
    title: "Nova",
    lightRequired: 2800,
    shortDescription: "A full season of steady days.",
    typicalWindow: "Around three months",
    description:
      "A season. Three months of tasks finished, habits kept and thoughts written down. Read your first entries again: the person who wrote them would be surprised by the one reading them now.",
  },
  {
    tier: 8,
    title: "Pulsar",
    lightRequired: 5000,
    shortDescription: "Five months. Clockwork.",
    typicalWindow: "Around five months",
    description:
      "Pulsars are known for one thing: they keep time. Your days have that quality now. The system runs without you thinking about it, which leaves you free to think about what the tasks are for.",
  },
  {
    tier: 9,
    title: "Supernova",
    lightRequired: 8500,
    shortDescription: "Most of a year, and it shows.",
    typicalWindow: "Eight or nine months",
    description:
      "Most of a year of showing up. The streaks, the perfect days and the thousands of small choices behind them add up to something other people can see. This is the tier where they start asking what you have been doing differently.",
  },
  {
    tier: 10,
    title: "Meridian",
    lightRequired: 13000,
    shortDescription: "The highest point. Keep it there.",
    typicalWindow: "About a year",
    description:
      "The meridian is the highest point the sun reaches in the sky, and you have reached yours: a year or more of deliberate days. There is no next tier. There is only the next day, and you already know how to do that.",
  },
];

export function getNextTier(currentTier: number): LightTier | null {
  if (currentTier >= 10) return null;
  return LIGHT_TIERS[currentTier] ?? null;
}

/**
 * The tier a given total-Light value has reached. Tiers are CUMULATIVE —
 * `lightRequired` is the TOTAL accumulated Light needed to reach that tier
 * (Ember = 150 total, NOT 50 + 150). This is the single source of truth the
 * backend also computes `currentTier`/`currentTitle` from.
 */
export function getTierForLight(totalLight: number): LightTier {
  for (let i = LIGHT_TIERS.length - 1; i >= 0; i--) {
    if (totalLight >= LIGHT_TIERS[i]!.lightRequired) return LIGHT_TIERS[i]!;
  }
  return LIGHT_TIERS[0]!;
}

export function getTierProgress(
  totalLight: number,
  currentTier: number,
): number {
  const current = LIGHT_TIERS[currentTier - 1];
  const next = LIGHT_TIERS[currentTier];
  if (!current || !next) return 100;
  const range = next.lightRequired - current.lightRequired;
  const progress = totalLight - current.lightRequired;
  // Clamp both ends: >100 guards a total past the next threshold, <0 guards a
  // total below the current tier's floor (e.g. a Light rollback while
  // currentTier lags) so the bar never renders a negative width.
  return Math.max(0, Math.min(100, Math.round((progress / range) * 100)));
}

/**
 * Within-tier progress detail — the single helper every "level progress"
 * surface should use so the bar FILL and its numeric caption always encode the
 * SAME fraction. `earnedInTier`/`tierSize` match the bar's numerator/
 * denominator; `remaining` is the Light still needed to reach the next tier.
 * At max tier: percent 100, remaining 0, next null.
 */
export function getTierProgressDetail(
  totalLight: number,
  currentTier: number,
): {
  percent: number;
  earnedInTier: number;
  tierSize: number;
  remaining: number;
  next: LightTier | null;
} {
  const current = LIGHT_TIERS[currentTier - 1];
  const next = LIGHT_TIERS[currentTier] ?? null;
  if (!current || !next) {
    return {
      percent: 100,
      earnedInTier: 0,
      tierSize: 0,
      remaining: 0,
      next: null,
    };
  }
  const tierSize = next.lightRequired - current.lightRequired;
  const earnedInTier = Math.max(
    0,
    Math.min(tierSize, totalLight - current.lightRequired),
  );
  return {
    percent: getTierProgress(totalLight, currentTier),
    earnedInTier,
    tierSize,
    remaining: Math.max(0, next.lightRequired - totalLight),
    next,
  };
}

// ---------------------------------------------------------------------------
// Streak multiplier — CANONICAL. The backend applies these exact thresholds
// when awarding Light (perfectDayStreak-based), so every display MUST read
// from here rather than hand-rolling a ladder (which drifted: an old copy
// showed 3x at 14 days while the server applied 2.5x). minDays DESCENDING;
// the first entry whose threshold the streak meets wins.
// ---------------------------------------------------------------------------
export const STREAK_MULTIPLIERS: ReadonlyArray<{
  minDays: number;
  multiplier: number;
}> = [
  { minDays: 30, multiplier: 3.0 },
  { minDays: 14, multiplier: 2.5 },
  { minDays: 7, multiplier: 2.0 },
  { minDays: 3, multiplier: 1.5 },
  { minDays: 1, multiplier: 1.0 },
];

/** Numeric multiplier for a perfect-day streak (1.0 when no streak). */
export function getMultiplier(perfectDayStreak: number): number {
  for (const entry of STREAK_MULTIPLIERS) {
    if (perfectDayStreak >= entry.minDays) return entry.multiplier;
  }
  return 1.0;
}

/** Display label for the multiplier, e.g. `"2.5x"`. */
export function getMultiplierLabel(perfectDayStreak: number): string {
  return `${getMultiplier(perfectDayStreak)}x`;
}

// ---------------------------------------------------------------------------
// Pace — "how long until the next tier at the rate you're actually going".
// Every surface that shows an ETA derives it from these so the Journey hero,
// the path and the web rail never disagree.
// ---------------------------------------------------------------------------

/**
 * Average Light earned per day over a recent window (typically the 7-day
 * trend). Days with nothing earned count as zero — the estimate should
 * reflect real life, not best days only. Returns 0 with no data.
 */
export function getLightPace(days: ReadonlyArray<{ earned: number }>): number {
  if (days.length === 0) return 0;
  const total = days.reduce((sum, d) => sum + Math.max(0, d.earned), 0);
  return total / days.length;
}

/**
 * Whole days from `totalLight` to `targetLight` at `pace` Light/day.
 * `null` when there is no pace to project from (new accounts, idle weeks),
 * 0 once the target is already met.
 */
export function estimateDaysToLight(
  totalLight: number,
  targetLight: number,
  pace: number,
): number | null {
  if (targetLight <= totalLight) return 0;
  if (!(pace > 0)) return null;
  return Math.ceil((targetLight - totalLight) / pace);
}

/** Human label for an ETA in days: "today", "2 days", "3 weeks", "4 months". */
export function formatDaysEta(days: number): string {
  if (days <= 0) return "today";
  if (days === 1) return "1 day";
  if (days < 14) return `${days} days`;
  if (days < 60) return `${Math.round(days / 7)} weeks`;
  if (days < 365) return `${Math.round(days / 30)} months`;
  const years = Math.round((days / 365) * 10) / 10;
  return years === 1 ? "1 year" : `${years} years`;
}
