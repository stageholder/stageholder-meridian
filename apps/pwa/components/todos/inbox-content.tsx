"use client";

import { TodoItem } from "./todo-item";
import { QuickAddTodo } from "./quick-add-todo";
import { useAllTodos, useTodoLists } from "@/lib/api/todos";
import type { Todo, TodoList } from "@repo/core/types";

export function InboxContent() {
  const { data: todos, isLoading: todosLoading } = useAllTodos();
  const { data: lists, isLoading: listsLoading } = useTodoLists();

  const isLoading = todosLoading || listsLoading;

  const listMap = new Map<string, TodoList>();
  for (const list of lists || []) {
    listMap.set(list.id, list);
  }

  const pendingTodos = (todos || []).filter((t) => t.status !== "done");
  const doneTodos = (todos || []).filter((t) => t.status === "done");

  // Group pending todos by list
  const groupedByList = new Map<string, Todo[]>();
  for (const todo of pendingTodos) {
    const group = groupedByList.get(todo.listId) || [];
    group.push(todo);
    groupedByList.set(todo.listId, group);
  }

  // Sort groups: default list first, then alphabetical
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
        <h1 className="text-xl font-bold text-foreground">Inbox</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          {pendingTodos.length} pending, {doneTodos.length} completed
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

          {doneTodos.length > 0 && (
            <div className="space-y-2 pt-4">
              <h3 className="mb-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                Completed ({doneTodos.length})
              </h3>
              {doneTodos.map((todo) => (
                <TodoItem key={todo.id} todo={todo} listId={todo.listId} />
              ))}
            </div>
          )}

          {pendingTodos.length === 0 && doneTodos.length === 0 && (
            <div className="py-12 text-center">
              <p className="text-sm text-muted-foreground">
                No todos yet. Add one above!
              </p>
            </div>
          )}
        </div>
      )}
    </>
  );
}
