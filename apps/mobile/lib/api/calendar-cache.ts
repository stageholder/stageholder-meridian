// Surgical writes into the ["calendar", "yyyy-MM"] month caches.
//
// WHY (the app-wide interaction-lag fix): every habit check-in / skip / fail /
// undo and every todo toggle used to `invalidateQueries({queryKey:
// ["calendar"]})` in onSettled — a broad prefix that refetched ALL ~7 cached
// month queries (useCalendarRange radius 3). Each refetch handed every
// consumer a fresh array identity, defeating row/section memoization, so one
// tap re-rendered every mounted habit card, todo row, and Today's charts +
// KPIs — and queued 7 network requests. The optimistic entry write was
// already correct; the broad invalidation was pure amplification.
//
// These helpers instead write the server's authoritative response into the
// ONE affected month (habit entries) or patch the todo's summary fields
// in-place across cached months — no network, no unrelated identity churn.
// `setQueryData` still bumps that query's `dataUpdatedAt`, so every derived
// memo keyed on the month's data (useCalendarRange's merge, KPI counts,
// To-do/Done sectioning, WeeklyActivityChart) recomputes exactly once.

import type { QueryClient } from "@tanstack/react-query";
import type { Habit, HabitEntry, Todo } from "@repo/core/types";

import type { CalendarData, CalendarDayData } from "./hooks/calendar";
import { habitKeys } from "./keys";

const EMPTY_DAY: CalendarDayData = {
  todos: [],
  journals: [],
  habitEntries: [],
};

/** First cached habits list — for resolving a habit's display name. */
function cachedHabitName(qc: QueryClient, habitId: string): string {
  for (const [, data] of qc.getQueriesData<Habit[]>({
    queryKey: habitKeys.lists(),
  })) {
    const hit = Array.isArray(data)
      ? data.find((h) => h.id === habitId)
      : undefined;
    if (hit) return hit.name;
  }
  return "";
}

/**
 * Write one server habit entry into its month's calendar cache (create-or-
 * update by habitId+day — the calendar holds ONE entry per habit per day,
 * same invariant as the entries API). A month that isn't cached is left
 * alone: it fetches fresh whenever it's first needed.
 */
export function writeHabitEntryToCalendar(
  qc: QueryClient,
  entry: HabitEntry,
): void {
  const day = entry.date.slice(0, 10);
  const month = day.slice(0, 7);
  qc.setQueryData<CalendarData>(["calendar", month], (old) => {
    if (!old) return old;
    const prevDay = old[day] ?? EMPTY_DAY;
    const existing = prevDay.habitEntries.find(
      (e) => e.habitId === entry.habitId,
    );
    const next = {
      id: entry.id,
      habitId: entry.habitId,
      habitName: existing?.habitName || cachedHabitName(qc, entry.habitId),
      value: entry.value,
      type: entry.type,
      date: entry.date,
      targetCountSnapshot:
        entry.targetCountSnapshot ?? existing?.targetCountSnapshot,
      scheduledDaysSnapshot:
        entry.scheduledDaysSnapshot ?? existing?.scheduledDaysSnapshot,
    };
    const habitEntries = existing
      ? prevDay.habitEntries.map((e) =>
          e.habitId === entry.habitId ? next : e,
        )
      : [...prevDay.habitEntries, next];
    return { ...old, [day]: { ...prevDay, habitEntries } };
  });
}

/**
 * Patch a todo's SUMMARY fields (status/title/priority) in-place wherever it
 * appears across the cached months. Correct only while the todo's day buckets
 * are unchanged — a due/do-date change moves buckets, so callers must fall
 * back to invalidating the affected months for date edits.
 */
export function writeTodoToCalendar(qc: QueryClient, todo: Todo): void {
  for (const [key, data] of qc.getQueriesData<CalendarData>({
    queryKey: ["calendar"],
  })) {
    if (!data) continue;
    let changed = false;
    const next: CalendarData = {};
    for (const [dayKey, dayData] of Object.entries(data)) {
      if (dayData?.todos?.some((t) => t.id === todo.id)) {
        changed = true;
        next[dayKey] = {
          ...dayData,
          todos: dayData.todos.map((t) =>
            t.id === todo.id
              ? {
                  ...t,
                  title: todo.title,
                  status: todo.status,
                  priority: todo.priority,
                  dueDate: todo.dueDate,
                  doDate: todo.doDate,
                  listId: todo.listId,
                }
              : t,
          ),
        };
      } else {
        next[dayKey] = dayData;
      }
    }
    if (changed) qc.setQueryData<CalendarData>(key, next);
  }
}

/** Remove a deleted todo from every cached month it appears in. */
export function removeTodoFromCalendar(qc: QueryClient, todoId: string): void {
  for (const [key, data] of qc.getQueriesData<CalendarData>({
    queryKey: ["calendar"],
  })) {
    if (!data) continue;
    let changed = false;
    const next: CalendarData = {};
    for (const [dayKey, dayData] of Object.entries(data)) {
      if (dayData?.todos?.some((t) => t.id === todoId)) {
        changed = true;
        next[dayKey] = {
          ...dayData,
          todos: dayData.todos.filter((t) => t.id !== todoId),
        };
      } else {
        next[dayKey] = dayData;
      }
    }
    if (changed) qc.setQueryData<CalendarData>(key, next);
  }
}

/** Invalidate only the month(s) a dated todo can appear in (create / date
 *  edits) — never the whole ["calendar"] prefix. */
export function invalidateCalendarMonthsFor(
  qc: QueryClient,
  dates: Array<string | null | undefined>,
): void {
  const months = new Set(
    dates.filter((d): d is string => !!d).map((d) => d.slice(0, 7)),
  );
  for (const month of months) {
    void qc.invalidateQueries({ queryKey: ["calendar", month] });
  }
}
