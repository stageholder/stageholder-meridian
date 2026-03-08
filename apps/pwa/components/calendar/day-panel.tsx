"use client";

import { useState } from "react";
import { format } from "date-fns";
import { Plus, BookOpen } from "lucide-react";
import { useQueryClient } from "@tanstack/react-query";
import { cn } from "@/lib/utils";
import { useUpdateTodo, useTodoLists } from "@/lib/api/todos";
import { useWorkspace } from "@/lib/workspace-context";
import { CreateTodoDialog } from "@/components/todos/create-todo-dialog";
import type { CalendarDayData } from "@/lib/api/calendar";
import { ActivityRingsVisual } from "@/components/activity-rings";
import { computeActivityRings } from "@/components/activity-rings";
import Link from "next/link";
import type { Habit } from "@repo/core/types";

const priorityConfig: Record<string, { label: string; className: string }> = {
  urgent: { label: "Urgent", className: "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400" },
  high: { label: "High", className: "bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-400" },
  medium: { label: "Medium", className: "bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400" },
  low: { label: "Low", className: "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400" },
  none: { label: "", className: "" },
};

function countScheduledHabits(habits: Habit[], date: Date): number {
  const dow = date.getDay();
  return habits.filter((h) => {
    if (!h.scheduledDays || h.scheduledDays.length === 0) return true;
    return h.scheduledDays.includes(dow);
  }).length;
}

interface DayPanelProps {
  date: Date;
  dayData: CalendarDayData;
  habits: Habit[];
}

export function DayPanel({ date, dayData, habits }: DayPanelProps) {
  const { workspace } = useWorkspace();
  const queryClient = useQueryClient();
  const updateTodo = useUpdateTodo();
  const { data: lists } = useTodoLists();
  const defaultList = lists?.find((l) => l.isDefault) || lists?.[0];
  const [showCreateTodo, setShowCreateTodo] = useState(false);

  const dateStr = format(date, "yyyy-MM-dd");

  function handleToggleTodo(todoId: string, listId: string, currentStatus: string) {
    updateTodo.mutate(
      { listId, todoId, data: { status: currentStatus === "done" ? "todo" : "done" } },
      { onSuccess: () => { void queryClient.invalidateQueries({ queryKey: ["calendar"] }); } },
    );
  }

  return (
    <div className="rounded-xl border border-border bg-card p-5">
      <div className="flex items-center gap-3">
        <ActivityRingsVisual data={computeActivityRings(dayData, countScheduledHabits(habits, date))} size="md" />
        <h3 className="text-sm font-semibold text-foreground">
          {format(date, "EEEE, MMMM d, yyyy")}
        </h3>
      </div>

      {/* Todos Section */}
      <div className="mt-4">
        <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
          <span className="h-2 w-2 rounded-full bg-blue-500" />
          Todos ({dayData.todos.length})
        </div>
        {dayData.todos.length > 0 ? (
          <div className="mt-2 space-y-1.5">
            {dayData.todos.map((todo) => {
              const isDone = todo.status === "done";
              const priority = priorityConfig[todo.priority] ?? { label: "", className: "" };
              return (
                <div
                  key={todo.id}
                  onClick={() => handleToggleTodo(todo.id, todo.listId, todo.status)}
                  className="flex cursor-pointer items-center gap-2 rounded-md px-2 py-1.5 hover:bg-accent/50"
                >
                  <div
                    className={cn(
                      "flex h-4 w-4 shrink-0 items-center justify-center rounded-full border-2 transition-colors",
                      isDone ? "border-primary bg-primary text-primary-foreground" : "border-muted-foreground/40"
                    )}
                  >
                    {isDone && (
                      <svg xmlns="http://www.w3.org/2000/svg" width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
                        <polyline points="20 6 9 17 4 12" />
                      </svg>
                    )}
                  </div>
                  <span className={cn("flex-1 text-sm", isDone && "line-through text-muted-foreground")}>
                    {todo.title}
                  </span>
                  {priority.label && (
                    <span className={cn("rounded-full px-1.5 py-0.5 text-[10px] font-medium", priority.className)}>
                      {priority.label}
                    </span>
                  )}
                </div>
              );
            })}
          </div>
        ) : (
          <p className="mt-2 text-xs text-muted-foreground">No todos</p>
        )}
      </div>

      {/* Journals Section */}
      <div className="mt-4">
        <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
          <span className="h-2 w-2 rounded-full bg-green-500" />
          Journal ({dayData.journals.length})
        </div>
        {dayData.journals.length > 0 ? (
          <div className="mt-2 space-y-1.5">
            {dayData.journals.map((journal) => (
              <Link
                key={journal.id}
                href={`/${workspace.shortId}/journal/${journal.id}`}
                className="block rounded-md px-2 py-1.5 text-sm text-foreground hover:bg-accent/50"
              >
                {journal.title}
              </Link>
            ))}
          </div>
        ) : (
          <p className="mt-2 text-xs text-muted-foreground">No journal entries</p>
        )}
      </div>

      {/* Habits Section */}
      <div className="mt-4">
        <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
          <span className="h-2 w-2 rounded-full bg-orange-500" />
          Habits ({dayData.habitEntries.length})
        </div>
        {dayData.habitEntries.length > 0 ? (
          <div className="mt-2 flex flex-wrap gap-2">
            {dayData.habitEntries.map((entry) => (
              <span
                key={entry.id}
                className={cn(
                  "inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-medium",
                  entry.value > 0
                    ? "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400"
                    : "bg-muted text-muted-foreground"
                )}
              >
                {entry.value > 0 ? "\u2713" : "\u2717"} {entry.habitName}
              </span>
            ))}
          </div>
        ) : (
          <p className="mt-2 text-xs text-muted-foreground">No habit entries</p>
        )}
      </div>

      {/* Quick Actions */}
      <div className="mt-5 flex gap-2">
        <button
          onClick={() => setShowCreateTodo(true)}
          className="inline-flex items-center gap-1.5 rounded-md border border-border px-3 py-1.5 text-xs font-medium text-foreground hover:bg-accent"
        >
          <Plus className="h-3.5 w-3.5" />
          Add Todo
        </button>
        <Link
          href={`/${workspace.shortId}/journal/new?date=${dateStr}`}
          className="inline-flex items-center gap-1.5 rounded-md border border-border px-3 py-1.5 text-xs font-medium text-foreground hover:bg-accent"
        >
          <BookOpen className="h-3.5 w-3.5" />
          New Journal
        </Link>
      </div>

      {defaultList && (
        <CreateTodoDialog
          open={showCreateTodo}
          onOpenChange={setShowCreateTodo}
          listId={defaultList.id}
          defaultDueDate={dateStr}
        />
      )}
    </div>
  );
}
