// apps/mobile/lib/mock-data.ts
//
// Temporary mock data so the Today dashboard has realistic numbers to render
// before the Meridian API client is wired in. Replace with React Query
// hooks (`useTodos`, `useHabits`, `useJournals`) once those exist.

export type DailyStats = {
  habits: { done: number; total: number };
  todos: { done: number; total: number };
  journal: { words: number; target: number };
  streak: number;
};

export const MOCK_TODAY: DailyStats = {
  habits: { done: 3, total: 5 },
  todos: { done: 4, total: 8 },
  journal: { words: 187, target: 300 },
  streak: 12,
};

/**
 * Last 30 days of fake activity. Deterministic via day-index modular math
 * so the heatmap doesn't reshuffle every render.
 */
export function generateRecentHeatmap(): { date: Date; value: number }[] {
  const today = new Date();
  const out: { date: Date; value: number }[] = [];
  for (let i = 29; i >= 0; i--) {
    const d = new Date(today);
    d.setDate(d.getDate() - i);
    const r = ((29 - i) * 17 + 7) % 100;
    let value = 0;
    if (r > 35) value = 1;
    if (r > 60) value = 2;
    if (r > 80) value = 3;
    if (r > 92) value = 4;
    if (value > 0) out.push({ date: d, value });
  }
  return out;
}

/** Greeting that matches the current local hour. */
export function greeting(): "Good morning" | "Good afternoon" | "Good evening" {
  const h = new Date().getHours();
  if (h < 12) return "Good morning";
  if (h < 18) return "Good afternoon";
  return "Good evening";
}

/** "Tuesday, December 10" style date label for the Today header. */
export function todayLabel(locale?: string): string {
  return new Intl.DateTimeFormat(locale, {
    weekday: "long",
    month: "long",
    day: "numeric",
  }).format(new Date());
}
