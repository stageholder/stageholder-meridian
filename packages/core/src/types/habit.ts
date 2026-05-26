export interface Habit {
  id: string;
  userSub: string;
  name: string;
  description?: string;
  frequency: "daily" | "weekly" | "weekly_target" | "custom";
  targetCount: number;
  scheduledDays?: number[];
  weeklyTarget?: number;
  unit?: string;
  color?: string;
  icon?: string;
  creatorId: string;
  createdAt: string;
  updatedAt: string;
}

export interface HabitEntry {
  id: string;
  habitId: string;
  userSub: string;
  date: string;
  value: number;
  /**
   * Outcome of the habit on this date:
   *   - "completion": user did the habit (or partial; value tells the rest).
   *     `value >= targetCount` extends the streak.
   *   - "skip": user deliberately opted out for this day. Preserves the
   *     streak — neither adds nor breaks.
   *   - "fail": user explicitly admitted a miss. Breaks the streak
   *     immediately (different from leaving the day open).
   * Absence of an entry on a past scheduled day is treated as an implicit
   * fail by client-side derivation; no entry is written.
   */
  type?: "completion" | "skip" | "fail";
  skipReason?: string;
  notes?: string;
  /** Snapshot of the habit's targetCount at the time this entry was recorded. */
  targetCountSnapshot?: number;
  /** Snapshot of the habit's scheduledDays at the time this entry was recorded. */
  scheduledDaysSnapshot?: number[];
  createdAt: string;
  updatedAt: string;
}
