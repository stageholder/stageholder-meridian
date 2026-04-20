export interface Habit {
  id: string;
  userSub: string;
  name: string;
  description?: string;
  frequency: "daily" | "weekly" | "custom";
  targetCount: number;
  scheduledDays?: number[];
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
  type?: "completion" | "skip";
  skipReason?: string;
  notes?: string;
  /** Snapshot of the habit's targetCount at the time this entry was recorded. */
  targetCountSnapshot?: number;
  /** Snapshot of the habit's scheduledDays at the time this entry was recorded. */
  scheduledDaysSnapshot?: number[];
  createdAt: string;
  updatedAt: string;
}
