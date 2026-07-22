// packages/core/src/todos/upcoming.ts
//
// Shared logic for the "Upcoming" todo view — the earliest-future-date pick,
// the date-group label, and the grouping itself. Extracted from the PWA's
// upcoming-content.tsx so the PWA and mobile group upcoming todos identically
// (one place to fix the "which date does a todo sort under" rule).

import type { Todo } from "../types";

/**
 * The earliest of a todo's do/due dates that is strictly in the FUTURE
 * (> today), as a yyyy-mm-dd string. Returns "" when the todo has no future
 * date (it doesn't belong in Upcoming). Dates are compared date-only.
 */
export function getEarliestUpcomingDate(todo: Todo, today: string): string {
  const due = todo.dueDate?.slice(0, 10);
  const doD = todo.doDate?.slice(0, 10);
  const future = [due, doD].filter(
    (d): d is string => d !== undefined && d > today,
  );
  future.sort();
  return future[0] ?? "";
}

/** "Tomorrow" for the next day, else "Wed, Mar 12" (weekday, month, day). */
export function formatUpcomingLabel(dateKey: string, todayKey: string): string {
  const date = new Date(dateKey + "T00:00:00");
  const tomorrow = new Date(todayKey + "T00:00:00");
  tomorrow.setDate(tomorrow.getDate() + 1);
  const tomorrowKey = tomorrow.toISOString().slice(0, 10);
  if (dateKey === tomorrowKey) return "Tomorrow";
  return date.toLocaleDateString("en-US", {
    weekday: "short",
    month: "short",
    day: "numeric",
  });
}

/** One date bucket of upcoming todos. */
export interface UpcomingDateGroup {
  /** yyyy-mm-dd of this group's earliest-future date. */
  date: string;
  todos: Todo[];
}

/**
 * Group upcoming todos by their earliest-future date, ascending. `rangeDays`
 * (> 0) keeps only todos whose earliest date is within that many days of today;
 * 0 (or omitted) keeps them all. Todos with no future date are dropped.
 */
export function groupUpcomingByDate(
  todos: Todo[],
  today: string,
  rangeDays = 0,
): UpcomingDateGroup[] {
  // Upper bound (inclusive) as a date-only key, when a range is set.
  let maxKey = "";
  if (rangeDays > 0) {
    const end = new Date(today + "T00:00:00");
    end.setDate(end.getDate() + rangeDays);
    maxKey = end.toISOString().slice(0, 10);
  }

  const byDate = new Map<string, Todo[]>();
  for (const todo of todos) {
    const date = getEarliestUpcomingDate(todo, today);
    if (!date) continue;
    if (maxKey && date > maxKey) continue;
    const group = byDate.get(date);
    if (group) group.push(todo);
    else byDate.set(date, [todo]);
  }

  return [...byDate.keys()]
    .sort()
    .map((date) => ({ date, todos: byDate.get(date)! }));
}
