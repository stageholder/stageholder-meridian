// apps/mobile/lib/types.ts
//
// Shared shapes for the local-state implementations of todos, habits, and
// journal. Intentionally narrower than the PWA's full API model — we keep
// only what the mobile UI reads or writes. When the real Meridian API
// client lands, these types get replaced with the API's response types and
// the stores swap to React Query (the screens shouldn't need to change).

export type Priority = "low" | "normal" | "high";

export type Todo = {
  id: string;
  title: string;
  notes?: string;
  priority: Priority;
  /** ISO date string (yyyy-mm-dd). Empty = no due date. */
  dueDate?: string;
  /** ISO timestamp of completion. undefined = open. */
  completedAt?: string;
  /** ISO timestamp. */
  createdAt: string;
};

export type Habit = {
  id: string;
  title: string;
  /** Hex color. Drives the ring + heatmap fill. */
  color: string;
  /** 0-6 (Sun..Sat). Empty array = every day. */
  scheduledDays: number[];
  /**
   * Per-date check-ins keyed by yyyy-mm-dd. `true` = checked in,
   * `false` = explicitly skipped (still preserves the date so the streak
   * logic can decide how to treat it).
   */
  checkIns: Record<string, boolean>;
  createdAt: string;
};

export type Mood = 1 | 2 | 3 | 4 | 5;

export type JournalEntry = {
  id: string;
  /** yyyy-mm-dd local date. Multiple entries per day are allowed. */
  dateKey: string;
  body: string;
  mood?: Mood;
  tags: string[];
  createdAt: string;
  updatedAt: string;
};

/* ---------- Helpers used everywhere ---------- */

/** Convert a Date into a yyyy-mm-dd local-date key. */
export function dateKey(d: Date = new Date()): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

export function fromDateKey(key: string): Date {
  const [y, m, d] = key.split("-").map(Number);
  return new Date(y!, (m ?? 1) - 1, d ?? 1);
}

export function countWords(text: string): number {
  return text.trim() ? text.trim().split(/\s+/).length : 0;
}
