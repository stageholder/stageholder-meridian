"use client";

import { format } from "date-fns";
import { TodoItem } from "./todo-item";
import { QuickAddTodo } from "./quick-add-todo";
import { useAllTodos, useTodoLists } from "@/lib/api/todos";
import type { Todo, TodoList } from "@repo/core/types";

export function TodayContent() {
  const { data: todos, isLoading: todosLoading } = useAllTodos();
  const { data: lists, isLoading: listsLoading } = useTodoLists();

  const isLoading = todosLoading || listsLoading;

  const today = format(new Date(), "yyyy-MM-dd");

  const listMap = new Map<string, TodoList>();
  for (const list of lists || []) {
    listMap.set(list.id, list);
  }

  const todayTodos = (todos || []).filter((t: Todo) => {
    if (t.status === "done") return false;
    const dueDateStr = t.dueDate?.split("T")[0];
    const doDateStr = t.doDate?.split("T")[0];
    const hasDueToday = dueDateStr !== undefined && dueDateStr <= today;
    const hasDoToday = doDateStr !== undefined && doDateStr <= today;
    return hasDueToday || hasDoToday;
  });

  // Group by list
  const groupedByList = new Map<string, Todo[]>();
  for (const todo of todayTodos) {
    const group = groupedByList.get(todo.listId) || [];
    group.push(todo);
    groupedByList.set(todo.listId, group);
  }

  const sortedListIds = [...groupedByList.keys()].sort((a, b) => {
    const listA = listMap.get(a);
    const listB = listMap.get(b);
    if (listA?.isDefault) return -1;
    if (listB?.isDefault) return 1;
    return (listA?.name || "").localeCompare(listB?.name || "");
  });

  const defaultList = lists?.find((l) => l.isDefault) || lists?.[0];

  return (
    <>
      <div className="mb-6">
        <h1 className="text-xl font-bold text-foreground">Today</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          {todayTodos.length} todo{todayTodos.length !== 1 ? "s" : ""} due today or overdue
        </p>
      </div>

      {defaultList && <QuickAddTodo listId={defaultList.id} />}

      {isLoading ? (
        <div className="mt-3 text-sm text-muted-foreground">Loading todos...</div>
      ) : (
        <div className="mt-3 space-y-6">
          {sortedListIds.map((listId) => {
            const list = listMap.get(listId);
            const listTodos = groupedByList.get(listId) || [];
            return (
              <div key={listId}>
                <div className="mb-2 flex items-center gap-2">
                  <span
                    className="inline-block h-3 w-3 rounded-full"
                    style={{ backgroundColor: list?.color || "#6b7280" }}
                  />
                  <h2 className="text-sm font-semibold text-foreground">
                    {list?.name || "Unknown List"}
                  </h2>
                  <span className="text-xs text-muted-foreground">
                    ({listTodos.length})
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

          {todayTodos.length === 0 && (
            <div className="py-12 text-center">
              <p className="text-sm text-muted-foreground">
                Nothing due today. You&apos;re all caught up!
              </p>
            </div>
          )}
        </div>
      )}
    </>
  );
}
