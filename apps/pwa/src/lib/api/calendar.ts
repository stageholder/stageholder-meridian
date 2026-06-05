// Calendar data layer — ONLINE-ONLY.
//
// The offline feature (Dexie cache + local calendar assembly) was removed
// wholesale and will be rebuilt from scratch later. These hooks used to fall
// back to `assembleCalendarDataLocally` (from the now-deleted `@repo/offline`)
// whenever the browser was offline; that local-assembly branch and its
// `useNetworkStatus` gate are gone. Both hooks now always fetch from `/calendar`
// via plain `@tanstack/react-query`, and their return shapes are unchanged.
//
// When the offline rebuild lands it will reintroduce the local fallback BEHIND
// these same hook names, so consumers should not need to change again.
import { useQuery, useQueries } from "@tanstack/react-query";
import { useMemo } from "react";
import { addMonths, format } from "date-fns";
import type { CalendarEvent } from "@stageholder/ui";
import apiClient from "@/lib/api-client";
import { parseDateLocal } from "@/lib/date";

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

export function useCalendarData(month: string) {
  return useQuery<CalendarData>({
    queryKey: ["calendar", month],
    queryFn: async () => {
      const res = await apiClient.get(`/calendar`, { params: { month } });
      return res.data?.data ?? res.data;
    },
    enabled: !!month,
  });
}

/**
 * Fetches a window of calendar months centred on `center` (default today),
 * `radius` months on each side, and merges them into one keyed dataset.
 *
 * Why a window rather than a single month: the kit `<EventCalendar>` owns its
 * own month navigation internally and exposes no `onMonthChange`, so we can't
 * react to the user paging between months. Feeding it a pre-merged multi-month
 * dataset lets its built-in prev/next roam freely across the realistic range
 * without a per-page refetch. Each month stays an independently-cached
 * react-query entry (same key as `useCalendarData`), so navigating elsewhere
 * and back is instant.
 */
export function useCalendarRange(center: Date = new Date(), radius = 3) {
  const monthKeys = useMemo(() => {
    const keys: string[] = [];
    for (let i = -radius; i <= radius; i++) {
      keys.push(format(addMonths(center, i), "yyyy-MM"));
    }
    return keys;
    // center is a Date; key off its month so the window only rebuilds when the
    // centred month actually changes, not on every render.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [format(center, "yyyy-MM"), radius]);

  const results = useQueries({
    queries: monthKeys.map((month) => ({
      queryKey: ["calendar", month],
      queryFn: async (): Promise<CalendarData> => {
        const res = await apiClient.get(`/calendar`, { params: { month } });
        return res.data?.data ?? res.data;
      },
      enabled: !!month,
    })),
  });

  const merged = useMemo<CalendarData>(() => {
    const out: CalendarData = {};
    for (const r of results) {
      if (r.data) Object.assign(out, r.data);
    }
    return out;
  }, [results]);

  return {
    data: merged,
    isLoading: results.some((r) => r.isLoading),
    isError: results.some((r) => r.isError),
  };
}

const EVENT_CATEGORY = {
  // Meridian's standard category palette — shared with the activity rings and
  // the DayPanel dots so the whole calendar speaks one color language.
  //   todo = red · habit = orange · journal = yellow
  todo: "var(--ring-todo)",
  journal: "var(--ring-journal)",
  habit: "var(--ring-habit)",
} as const;

/**
 * Flattens the merged calendar dataset into the flat `CalendarEvent[]` the kit
 * `<EventCalendar>` consumes. Each day's todos / journals / habit entries
 * become category-colored events; ids are namespaced by kind + day so a todo
 * that appears under both its due and do dates stays unique.
 */
export function buildCalendarEvents(data: CalendarData): CalendarEvent[] {
  const events: CalendarEvent[] = [];
  for (const [dayKey, day] of Object.entries(data)) {
    const date = parseDateLocal(dayKey);
    for (const todo of day.todos) {
      events.push({
        id: `todo-${todo.id}-${dayKey}`,
        date,
        title: todo.title,
        color: EVENT_CATEGORY.todo,
        meta: { kind: "todo", id: todo.id },
      });
    }
    for (const journal of day.journals) {
      events.push({
        id: `journal-${journal.id}-${dayKey}`,
        date,
        title: journal.title || "Journal entry",
        color: EVENT_CATEGORY.journal,
        meta: { kind: "journal", id: journal.id },
      });
    }
    for (const entry of day.habitEntries) {
      events.push({
        id: `habit-${entry.id}-${dayKey}`,
        date,
        title: entry.habitName,
        color: EVENT_CATEGORY.habit,
        meta: { kind: "habit", id: entry.id },
      });
    }
  }
  return events;
}
