"use client";

import { TodoItem } from "./todo-item";
import { QuickAddTodo } from "./quick-add-todo";
import { useTodos } from "@/lib/api/todos";
import type { Todo } from "@repo/core/types";

interface TodoListContentProps {
  listId: string;
  listName: string;
  listColor?: string | null;
  showColorDot?: boolean;
}

export function TodoListContent({
  listId,
  listName,
  listColor,
  showColorDot,
}: TodoListContentProps) {
  const { data: todos, isLoading } = useTodos(listId);

  const pendingTodos = todos?.filter((t: Todo) => t.status !== "done") || [];

  return (
    <>
      <div className="mb-6">
        <div className="flex items-center gap-3">
          {showColorDot && listColor && (
            <span
              className="inline-block h-4 w-4 rounded-full"
              style={{ backgroundColor: listColor }}
            />
          )}
          <div>
            <h1 className="text-xl font-bold text-foreground">{listName}</h1>
            <p className="mt-1 text-sm text-muted-foreground">
              {pendingTodos.length} todo{pendingTodos.length !== 1 ? "s" : ""}
            </p>
          </div>
        </div>
      </div>

      <QuickAddTodo listId={listId} />

      {isLoading ? (
        <div className="mt-3 text-sm text-muted-foreground">Loading todos...</div>
      ) : (
        <div className="mt-3 space-y-2">
          {pendingTodos.map((todo: Todo) => (
            <TodoItem key={todo.id} todo={todo} listId={listId} />
          ))}
          {pendingTodos.length === 0 && (
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
