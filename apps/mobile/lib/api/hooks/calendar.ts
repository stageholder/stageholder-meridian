// apps/mobile/lib/api/hooks/calendar.ts
//
// Calendar data layer — mobile port of apps/pwa/src/lib/api/calendar.ts
// (online-only, same /calendar endpoint + month-window merging) plus the
// pure ring-percentage math from the PWA's use-activity-rings. The kit
// `<EventCalendar>` owns its month navigation internally with no
// onMonthChange, so we feed it a pre-merged ±3-month window — each month
// stays an independently-cached react-query entry.
//
// Event colors use IGNITION (resolved hex) instead of the web's
// var(--ring-*) CSS custom properties.

import { useMemo } from "react";
import { useQueries, useQuery } from "@tanstack/react-query";
import { addMonths, format } from "date-fns";
import type { CalendarEvent } from "@stageholder/ui";
import type { Habit } from "@repo/core/types";
import {
  computeRingPercentages,
  type ActivityRingsData,
} from "@repo/features/activity-rings";

import { apiClient } from "../client";
import { useHabits } from "./habits";
import { IGNITION } from "@/lib/ignition-palette";

export interface CalendarDayData {
  todos: Array<{
    id: string;
    title: string;
    status: string;
    priority: string;
    dueDate?: string;
    doDate?: string;
    listId: string;
  }>;
  journals: Array<{
    id: string;
    title: string;
    date: string;
    wordCount: number;
  }>;
  habitEntries: Array<{
    id: string;
    habitId: string;
    habitName: string;
    value: number;
    type?: string;
    date: string;
    targetCountSnapshot?: number;
    scheduledDaysSnapshot?: number[];
  }>;
}

export type CalendarData = Record<string, CalendarDayData>;

export const EMPTY_DAY: CalendarDayData = {
  todos: [],
  journals: [],
  habitEntries: [],
};

async function fetchCalendarMonth(month: string): Promise<CalendarData> {
  const res = await apiClient.get(`/calendar`, { params: { month } });
  const data: CalendarData = res.data?.data ?? res.data;
  // Persisted-cache trap: a rehydrated day could carry a non-array
  // `habitEntries` (or the day object could be malformed). Normalize the
  // per-day arrays so consumers can iterate without an Array.isArray guard.
  if (data && typeof data === "object") {
    for (const day of Object.values(data)) {
      if (!day) continue;
      if (!Array.isArray(day.habitEntries)) day.habitEntries = [];
      if (!Array.isArray(day.todos)) day.todos = [];
      if (!Array.isArray(day.journals)) day.journals = [];
    }
  }
  return data;
}

export function useCalendarData(month: string) {
  return useQuery<CalendarData>({
    queryKey: ["calendar", month],
    queryFn: () => fetchCalendarMonth(month),
    enabled: !!month,
  });
}

/** Today ±`radius` months, merged into one `{yyyy-MM-dd: day}` dataset. */
export function useCalendarRange(center: Date = new Date(), radius = 3) {
  const centerMonth = format(center, "yyyy-MM");
  const monthKeys = useMemo(() => {
    const keys: string[] = [];
    const c = new Date(centerMonth + "-01T00:00:00");
    for (let i = -radius; i <= radius; i++) {
      keys.push(format(addMonths(c, i), "yyyy-MM"));
    }
    return keys;
  }, [centerMonth, radius]);

  const results = useQueries({
    queries: monthKeys.map((month) => ({
      queryKey: ["calendar", month],
      queryFn: () => fetchCalendarMonth(month),
      enabled: !!month,
    })),
  });

  const merged = useMemo<CalendarData>(() => {
    const out: CalendarData = {};
    for (const r of results) {
      if (r.data) Object.assign(out, r.data);
    }
    return out;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [results.map((r) => r.dataUpdatedAt).join(",")]);

  return {
    data: merged,
    isLoading: results.some((r) => r.isLoading),
    isError: results.some((r) => r.isError),
  };
}

/** Flattens the merged dataset into the kit `<EventCalendar>`'s events.
 *  Category colors = IGNITION (todo red · habit orange · journal yellow). */
export function buildCalendarEvents(data: CalendarData): CalendarEvent[] {
  const events: CalendarEvent[] = [];
  for (const [dayKey, day] of Object.entries(data)) {
    const date = new Date(dayKey + "T00:00:00");
    for (const todo of day.todos) {
      events.push({
        id: `todo-${todo.id}-${dayKey}`,
        date,
        title: todo.title,
        color: IGNITION.todo.base,
        meta: { kind: "todo", id: todo.id },
      });
    }
    for (const journal of day.journals) {
      events.push({
        id: `journal-${journal.id}-${dayKey}`,
        date,
        title: journal.title || "Journal entry",
        color: IGNITION.journal.base,
        meta: { kind: "journal", id: journal.id },
      });
    }
    for (const entry of day.habitEntries) {
      events.push({
        id: `habit-${entry.id}-${dayKey}`,
        date,
        title: entry.habitName,
        color: IGNITION.habit.base,
        meta: { kind: "habit", id: entry.id },
      });
    }
  }
  return events;
}

/* ------------------ Per-day activity counts (PWA port) ------------------- */

export interface DayActivityCounts {
  /** Todos completed that day. */
  todoDone: number;
  /** Habit entries done + skipped that day (quota habits excluded). */
  habitDone: number;
  /** Total journal words written that day. */
  journalWords: number;
}

const EMPTY_COUNTS: DayActivityCounts = {
  todoDone: 0,
  habitDone: 0,
  journalWords: 0,
};

/**
 * Raw per-day activity counts from the calendar month cache — the mobile
 * counterpart of the PWA `useActivityRings(date).details` slice that feeds
 * the dashboard KPI deltas (today vs yesterday). Reads the same
 * `["calendar", month]` query the calendar screen and weekly-activity chart
 * populate, so a pair of these adds no extra network cost.
 */
export function useDayActivityCounts(date: string): {
  counts: DayActivityCounts;
  isLoading: boolean;
} {
  const month = date.slice(0, 7); // yyyy-MM
  const calQuery = useCalendarData(month);
  const habitsQuery = useHabits();

  const counts = useMemo<DayActivityCounts>(() => {
    const dayData = calQuery.data?.[date];
    if (!dayData) return EMPTY_COUNTS;

    // Quota (`weekly_target`) habits aren't day-scheduled — exclude their
    // entries from the daily count, same as computeActivityRings.
    const quotaIds = new Set(
      (habitsQuery.data ?? [])
        .filter((h) => h.frequency === "weekly_target")
        .map((h) => h.id),
    );
    const dayHabitEntries = dayData.habitEntries.filter(
      (e) => !quotaIds.has(e.habitId),
    );

    return {
      todoDone: dayData.todos.filter((t) => t.status === "done").length,
      habitDone:
        dayHabitEntries.filter((e) => e.value > 0).length +
        dayHabitEntries.filter((e) => e.type === "skip").length,
      journalWords: dayData.journals.reduce(
        (sum, j) => sum + (j.wordCount ?? 0),
        0,
      ),
    };
  }, [calQuery.data, habitsQuery.data, date]);

  return { counts, isLoading: calQuery.isLoading };
}

/* ------------------- Ring percentages (pure, PWA port) ------------------- */

interface Targets {
  todoDaily: number;
  journalDailyWords: number;
}

const DEFAULT_TARGETS: Targets = { todoDaily: 3, journalDailyWords: 75 };

/** Habits scheduled on a weekday — the habit ring's denominator. Quota
 *  (`weekly_target`) habits aren't day-scheduled and are excluded. */
export function countScheduledHabits(habits: Habit[], date: Date): number {
  const dow = date.getDay();
  return habits.filter(
    (h) =>
      h.frequency !== "weekly_target" &&
      (!h.scheduledDays?.length || h.scheduledDays.includes(dow)),
  ).length;
}

/** Per-day completion percentages for the three rings. Extracts the raw counts
 *  from the mobile `CalendarDayData`, then delegates the formula to the shared
 *  `computeRingPercentages` (@repo/features/activity-rings) — one source of
 *  truth with the PWA, which can no longer drift. */
export function computeActivityRings(
  dayData: CalendarDayData | undefined,
  scheduledHabitCount: number,
  targets: Targets = DEFAULT_TARGETS,
  quotaIds: Set<string> = new Set(),
): ActivityRingsData {
  if (!dayData) return { todo: 0, habit: 0, journal: 0 };

  const todoDone = dayData.todos.filter((t) => t.status === "done").length;

  const dayHabitEntries = dayData.habitEntries.filter(
    (e) => !quotaIds.has(e.habitId),
  );
  const habitDone = dayHabitEntries.filter((e) => e.value > 0).length;
  const habitSkipped = dayHabitEntries.filter((e) => e.type === "skip").length;

  const journalWords = dayData.journals.reduce(
    (sum, j) => sum + (j.wordCount ?? 0),
    0,
  );

  return computeRingPercentages({
    todo: { done: todoDone, target: targets.todoDaily },
    habit: { done: habitDone + habitSkipped, scheduled: scheduledHabitCount },
    journal: { words: journalWords, target: targets.journalDailyWords },
  });
}
