export interface Habit {
  id: string;
  workspaceId: string;
  name: string;
  description?: string;
  frequency: 'daily' | 'weekly' | 'custom';
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
  workspaceId: string;
  date: string;
  value: number;
  notes?: string;
  createdAt: string;
  updatedAt: string;
}
