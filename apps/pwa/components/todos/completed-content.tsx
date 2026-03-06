"use client";

import { TodoItem } from "./todo-item";
import { useAllTodos, useTodoLists } from "@/lib/api/todos";
import type { Todo, TodoList } from "@repo/core/types";

export function CompletedContent() {
  const { data: todos, isLoading: todosLoading } = useAllTodos();
  const { data: lists, isLoading: listsLoading } = useTodoLists();

  const isLoading = todosLoading || listsLoading;

  const listMap = new Map<string, TodoList>();
  for (const list of lists || []) {
    listMap.set(list.id, list);
  }

  const sevenDaysAgo = new Date();
  sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
  sevenDaysAgo.setHours(0, 0, 0, 0);

  const completedTodos = (todos || [])
    .filter((t) => t.status === "done" && new Date(t.updatedAt) >= sevenDaysAgo)
    .sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime());

  // Group by date completed
  const groupedByDate = new Map<string, Todo[]>();
  for (const todo of completedTodos) {
    const dateKey = new Date(todo.updatedAt).toLocaleDateString("en-US", {
      weekday: "short",
      month: "short",
      day: "numeric",
    });
    const group = groupedByDate.get(dateKey) || [];
    group.push(todo);
    groupedByDate.set(dateKey, group);
  }

  return (
    <>
      <div className="mb-6">
        <h1 className="text-xl font-bold text-foreground">Completed</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          {completedTodos.length} completed in the past 7 days
        </p>
      </div>

      {isLoading ? (
        <div className="mt-3 text-sm text-muted-foreground">Loading todos...</div>
      ) : (
        <div className="mt-3 space-y-6">
          {[...groupedByDate.entries()].map(([date, dateTodos]) => {
            // Sub-group by list
            const byList = new Map<string, Todo[]>();
            for (const todo of dateTodos) {
              const group = byList.get(todo.listId) || [];
              group.push(todo);
              byList.set(todo.listId, group);
            }

            return (
              <div key={date}>
                <h2 className="mb-3 text-sm font-semibold text-foreground">{date}</h2>
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

          {completedTodos.length === 0 && (
            <div className="py-12 text-center">
              <p className="text-sm text-muted-foreground">
                No completed todos in the past 7 days.
              </p>
            </div>
          )}
        </div>
      )}
    </>
  );
}
