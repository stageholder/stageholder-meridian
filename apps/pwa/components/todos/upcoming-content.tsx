"use client";

import { useState } from "react";
import { TodoItem } from "./todo-item";
import { QuickAddTodo } from "./quick-add-todo";
import { useAllTodos, useTodoLists } from "@/lib/api/todos";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";
import { format, addDays, parseISO } from "date-fns";
import type { DateRange } from "react-day-picker";
import { cn } from "@/lib/utils";
import type { Todo, TodoList } from "@repo/core/types";

const PRESETS = [
  { label: "7 days", days: 7 },
  { label: "14 days", days: 14 },
  { label: "30 days", days: 30 },
  { label: "All", days: 0 },
] as const;

export function UpcomingContent() {
  const { data: todos, isLoading: todosLoading } = useAllTodos();
  const { data: lists, isLoading: listsLoading } = useTodoLists();
  const [selectedDays, setSelectedDays] = useState<number>(7);
  const [customRange, setCustomRange] = useState<DateRange | undefined>();
  const [customOpen, setCustomOpen] = useState(false);

  const isLoading = todosLoading || listsLoading;

  const today = new Date().toISOString().split("T")[0]!;

  const hasCustomRange = customRange?.from != null;
  const customFrom = customRange?.from ? format(customRange.from, "yyyy-MM-dd") : null;
  const customTo = customRange?.to ? format(customRange.to, "yyyy-MM-dd") : null;

  // Compute filter bounds
  const rangeStart = hasCustomRange && customFrom ? customFrom : today;
  const rangeEnd = hasCustomRange && customTo
    ? customTo
    : hasCustomRange && customFrom
      ? customFrom
      : selectedDays > 0
        ? format(addDays(new Date(), selectedDays), "yyyy-MM-dd")
        : null; // null = show all

  const listMap = new Map<string, TodoList>();
  for (const list of lists || []) {
    listMap.set(list.id, list);
  }

  const upcomingTodos = (todos || []).filter((t: Todo) => {
    if (t.status === "done") return false;
    const dueDateStr = t.dueDate?.split("T")[0];
    const doDateStr = t.doDate?.split("T")[0];
    // Exclude todos already in "today" (due today or overdue)
    const isDueToday = dueDateStr !== undefined && dueDateStr <= today;
    const isDoToday = doDateStr !== undefined && doDateStr <= today;
    if (isDueToday || isDoToday) return false;
    // Include todos with a future date
    const hasFutureDue = dueDateStr !== undefined && dueDateStr > today;
    const hasFutureDo = doDateStr !== undefined && doDateStr > today;
    if (!(hasFutureDue || hasFutureDo)) return false;
    // Apply date range filter
    const earliestDate = getEarliestDate(t, today);
    if (hasCustomRange) {
      if (rangeStart && earliestDate < rangeStart) return false;
      if (rangeEnd && earliestDate > rangeEnd) return false;
    } else if (rangeEnd) {
      if (earliestDate > rangeEnd) return false;
    }
    return true;
  });

  const groupedByDate = new Map<string, Todo[]>();
  for (const todo of upcomingTodos) {
    const date = getEarliestDate(todo, today);
    const group = groupedByDate.get(date) || [];
    group.push(todo);
    groupedByDate.set(date, group);
  }

  const sortedDates = [...groupedByDate.keys()].sort();

  const formatDateLabel = (dateStr: string) => {
    const date = new Date(dateStr + "T00:00:00");
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    const tomorrowStr = tomorrow.toISOString().split("T")[0];
    if (dateStr === tomorrowStr) return "Tomorrow";
    return date.toLocaleDateString("en-US", {
      weekday: "short",
      month: "short",
      day: "numeric",
    });
  };

  function handlePreset(days: number) {
    setSelectedDays(days);
    setCustomRange(undefined);
  }

  function handleCustomRange(range: DateRange | undefined) {
    setCustomRange(range);
    if (range?.from) {
      setSelectedDays(-1); // deselect presets
    }
  }

  function clearCustomRange() {
    setCustomRange(undefined);
    setSelectedDays(7);
    setCustomOpen(false);
  }

  const isPresetActive = (days: number) => !hasCustomRange && selectedDays === days;

  const filterLabel = hasCustomRange
    ? customFrom && customTo && customFrom !== customTo
      ? `${format(parseISO(customFrom), "MMM d")} – ${format(parseISO(customTo), "MMM d")}`
      : customFrom
        ? format(parseISO(customFrom), "MMM d")
        : null
    : null;

  const defaultList = lists?.find((l) => l.isDefault) || lists?.[0];

  return (
    <>
      <div className="mb-4">
        <h1 className="text-xl font-bold text-foreground">Upcoming</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          {upcomingTodos.length} upcoming todo{upcomingTodos.length !== 1 ? "s" : ""}
        </p>
      </div>

      {/* Filter chips */}
      <div className="mb-4 flex flex-wrap items-center gap-1.5">
        {PRESETS.map((preset) => (
          <button
            key={preset.days}
            type="button"
            onClick={() => handlePreset(preset.days)}
            className={cn(
              "rounded-full border px-3 py-1 text-xs font-medium transition-colors",
              isPresetActive(preset.days)
                ? "border-primary bg-primary text-primary-foreground"
                : "border-border text-muted-foreground hover:bg-accent hover:text-foreground"
            )}
          >
            {preset.label}
          </button>
        ))}

        {/* Custom date picker */}
        <Popover open={customOpen} onOpenChange={setCustomOpen}>
          <PopoverTrigger asChild>
            <button
              type="button"
              className={cn(
                "inline-flex items-center gap-1 rounded-full border px-3 py-1 text-xs font-medium transition-colors",
                hasCustomRange
                  ? "border-primary bg-primary text-primary-foreground"
                  : "border-border text-muted-foreground hover:bg-accent hover:text-foreground"
              )}
            >
              <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M8 2v4" />
                <path d="M16 2v4" />
                <rect width="18" height="18" x="3" y="4" rx="2" />
                <path d="M3 10h18" />
              </svg>
              {filterLabel || "Custom"}
            </button>
          </PopoverTrigger>
          <PopoverContent align="start" className="w-auto p-2">
            {hasCustomRange && (
              <div className="mb-2 flex items-center justify-between">
                <span className="text-xs text-muted-foreground">
                  {customRange?.to ? "Range selected" : "Pick end date"}
                </span>
                <button
                  type="button"
                  onClick={clearCustomRange}
                  className="rounded-full border border-border px-2.5 py-0.5 text-xs font-medium text-muted-foreground hover:bg-accent hover:text-foreground"
                >
                  Clear
                </button>
              </div>
            )}
            <Calendar
              mode="range"
              selected={customRange}
              onSelect={handleCustomRange}
              defaultMonth={customRange?.from || addDays(new Date(), 1)}
              disabled={(date) => {
                const d = new Date(date);
                d.setHours(0, 0, 0, 0);
                const now = new Date();
                now.setHours(0, 0, 0, 0);
                return d < now;
              }}
            />
          </PopoverContent>
        </Popover>
      </div>

      {defaultList && <QuickAddTodo listId={defaultList.id} />}

      {isLoading ? (
        <div className="mt-3 text-sm text-muted-foreground">Loading todos...</div>
      ) : (
        <div className="mt-3 space-y-6">
          {sortedDates.map((date) => {
            const dateTodos = groupedByDate.get(date) || [];
            // Sub-group by list within each date
            const byList = new Map<string, Todo[]>();
            for (const todo of dateTodos) {
              const group = byList.get(todo.listId) || [];
              group.push(todo);
              byList.set(todo.listId, group);
            }

            return (
              <div key={date}>
                <h2 className="mb-3 text-sm font-semibold text-foreground">
                  {formatDateLabel(date)}
                </h2>
                <div className="space-y-4 pl-1">
                  {[...byList.entries()].map(([listId, listTodos]) => {
                    const list = listMap.get(listId);
                    return (
                      <div key={listId}>
                        <div className="mb-2 flex items-center gap-2">
                          <span
                            className="inline-block h-3 w-3 rounded-full"
                            style={{ backgroundColor: list?.color || "#6b7280" }}
                          />
                          <span className="text-xs font-medium text-muted-foreground">
                            {list?.name || "Unknown List"}
                          </span>
                        </div>
                        <div className="space-y-2">
                          {listTodos.map((todo) => (
                            <TodoItem key={todo.id} todo={todo} listId={listId} />
                          ))}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            );
          })}

          {upcomingTodos.length === 0 && (
            <div className="py-12 text-center">
              <p className="text-sm text-muted-foreground">
                No upcoming todos scheduled.
              </p>
            </div>
          )}
        </div>
      )}
    </>
  );
}

function getEarliestDate(todo: Todo, today: string): string {
  const dueDateStr = todo.dueDate?.split("T")[0];
  const doDateStr = todo.doDate?.split("T")[0];
  const dates = [dueDateStr, doDateStr].filter((d): d is string => d !== undefined && d > today);
  dates.sort();
  return dates[0] || "";
}
