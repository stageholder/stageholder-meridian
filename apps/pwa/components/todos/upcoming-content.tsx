"use client";

import { TodoItem } from "./todo-item";
import { QuickAddTodo } from "./quick-add-todo";
import { useAllTodos, useTodoLists } from "@/lib/api/todos";
import type { Todo, TodoList } from "@repo/core/types";

export function UpcomingContent() {
  const { data: todos, isLoading: todosLoading } = useAllTodos();
  const { data: lists, isLoading: listsLoading } = useTodoLists();

  const isLoading = todosLoading || listsLoading;

  const today = new Date().toISOString().split("T")[0]!;

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
    return hasFutureDue || hasFutureDo;
  });

  // Group by earliest date, then by list within each date
  const getEarliestDate = (todo: Todo): string => {
    const dueDateStr = todo.dueDate?.split("T")[0];
    const doDateStr = todo.doDate?.split("T")[0];
    const dates = [dueDateStr, doDateStr].filter((d): d is string => d !== undefined && d > today);
    dates.sort();
    return dates[0] || "";
  };

  const groupedByDate = new Map<string, Todo[]>();
  for (const todo of upcomingTodos) {
    const date = getEarliestDate(todo);
    const group = groupedByDate.get(date) || [];
    group.push(todo);
    groupedByDate.set(date, group);
  }

  const sortedDates = [...groupedByDate.keys()].sort();

  const formatDate = (dateStr: string) => {
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

  const defaultList = lists?.find((l) => l.isDefault) || lists?.[0];

  return (
    <>
      <div className="mb-6">
        <h1 className="text-xl font-bold text-foreground">Upcoming</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          {upcomingTodos.length} upcoming todo{upcomingTodos.length !== 1 ? "s" : ""}
        </p>
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
                  {formatDate(date)}
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
