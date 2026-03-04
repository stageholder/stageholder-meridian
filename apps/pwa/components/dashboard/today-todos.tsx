"use client";

import Link from "next/link";
import { cn } from "@/lib/utils";
import { useTodoLists, useTodos, useUpdateTodo } from "@/lib/api/todos";
import { useWorkspace } from "@/lib/workspace-context";
import type { TodoList, Todo } from "@repo/core/types";

export function TodayTodos() {
  const { workspace } = useWorkspace();
  const { data: lists } = useTodoLists();
  const firstListId = lists?.[0]?.id || "";
  const { data: todos, isLoading } = useTodos(firstListId);
  const updateTodo = useUpdateTodo();

  const today = new Date().toISOString().split("T")[0]!;

  const todayTodos = (todos || []).filter((t: Todo) => {
    if (t.status === "done") return false;
    if (!t.dueDate) return false;
    const dueDateStr = t.dueDate.split("T")[0];
    return dueDateStr !== undefined && dueDateStr <= today;
  });

  function handleToggle(todo: Todo) {
    updateTodo.mutate({
      listId: todo.listId,
      todoId: todo.id,
      data: { status: "done" },
    });
  }

  return (
    <div className="rounded-xl border border-border bg-card p-5">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold text-foreground">Today&apos;s Todos</h3>
        <Link href={`/${workspace.shortId}/todos`} className="text-xs text-primary hover:underline">
          View all
        </Link>
      </div>

      <div className="mt-4 space-y-2">
        {isLoading ? (
          <p className="text-xs text-muted-foreground">Loading...</p>
        ) : todayTodos.length > 0 ? (
          todayTodos.slice(0, 5).map((todo: Todo) => {
            const isOverdue = todo.dueDate ? new Date(todo.dueDate) < new Date(today) : false;
            return (
              <div key={todo.id} className="flex items-center gap-3">
                <button
                  onClick={() => handleToggle(todo)}
                  className="flex h-4 w-4 shrink-0 items-center justify-center rounded-full border-2 border-muted-foreground/40 hover:border-primary"
                  aria-label="Mark as complete"
                />
                <span className="flex-1 truncate text-sm text-foreground">{todo.title}</span>
                {isOverdue && (
                  <span className="text-xs text-red-600 dark:text-red-400">Overdue</span>
                )}
              </div>
            );
          })
        ) : (
          <p className="text-xs text-muted-foreground">No todos due today. You&apos;re all caught up!</p>
        )}
      </div>
    </div>
  );
}
