"use client";

import Link from "next/link";
import { format } from "date-fns";
import { cn } from "@/lib/utils";
import { useAllTodos, useUpdateTodo } from "@/lib/api/todos";
import { useWorkspace } from "@/lib/workspace-context";
import { useTodoStats } from "@/lib/hooks/use-todo-stats";
import { BentoCard } from "./bento-card";
import type { Todo } from "@repo/core/types";

const PRIORITY_COLORS: Record<string, string> = {
  urgent: "bg-red-500",
  high: "bg-orange-500",
  medium: "bg-yellow-500",
  low: "bg-blue-400",
};

export function TodayTodos({
  index = 0,
  className,
}: {
  index?: number;
  className?: string;
}) {
  const { workspace } = useWorkspace();
  const { data: todos, isLoading } = useAllTodos();
  const { total, percentage } = useTodoStats();
  const updateTodo = useUpdateTodo();

  const today = format(new Date(), "yyyy-MM-dd");

  const todayTodos = (todos || []).filter((t: Todo) => {
    if (t.status === "done") return false;
    const dueDateStr = t.dueDate?.split("T")[0];
    const doDateStr = t.doDate?.split("T")[0];
    const hasDueToday = dueDateStr !== undefined && dueDateStr <= today;
    const hasDoToday = doDateStr !== undefined && doDateStr <= today;
    return hasDueToday || hasDoToday;
  });

  function handleToggle(todo: Todo) {
    updateTodo.mutate({
      listId: todo.listId,
      todoId: todo.id,
      data: { status: "done" },
    });
  }

  return (
    <BentoCard
      title="Today's Todos"
      href={`/${workspace.shortId}/todos`}
      index={index}
      className={className}
      action={
        <div className="flex items-center gap-2">
          {total > 0 && (
            <span className="rounded-full bg-muted px-2 py-0.5 text-xs font-medium text-muted-foreground">
              {todayTodos.length} due
            </span>
          )}
          <Link
            href={`/${workspace.shortId}/todos`}
            className="text-xs text-primary hover:underline"
          >
            View all
          </Link>
        </div>
      }
    >
      {total > 0 && (
        <div className="mb-3 flex items-center gap-2">
          <div className="h-1.5 flex-1 rounded-full bg-muted">
            <div
              className="h-full rounded-full bg-primary transition-all"
              style={{ width: `${percentage}%` }}
            />
          </div>
          <span className="text-xs text-muted-foreground tabular-nums">
            {percentage}%
          </span>
        </div>
      )}

      <div className="space-y-2">
        {isLoading ? (
          <p className="text-xs text-muted-foreground">Loading...</p>
        ) : todayTodos.length > 0 ? (
          todayTodos.slice(0, 5).map((todo: Todo) => {
            const isOverdue = todo.dueDate
              ? new Date(todo.dueDate) < new Date(today)
              : false;
            return (
              <div key={todo.id} className="flex items-center gap-3">
                <button
                  onClick={() => handleToggle(todo)}
                  className="flex h-4 w-4 shrink-0 items-center justify-center rounded-full border-2 border-muted-foreground/40 hover:border-primary"
                  aria-label="Mark as complete"
                />
                {todo.priority && PRIORITY_COLORS[todo.priority] && (
                  <span
                    className={cn(
                      "h-2 w-2 shrink-0 rounded-full",
                      PRIORITY_COLORS[todo.priority],
                    )}
                  />
                )}
                <span className="flex-1 truncate text-sm text-foreground">
                  {todo.title}
                </span>
                {isOverdue && (
                  <span className="text-xs text-red-600 dark:text-red-400">
                    Overdue
                  </span>
                )}
              </div>
            );
          })
        ) : (
          <p className="text-xs text-muted-foreground">
            No todos due today. You&apos;re all caught up!
          </p>
        )}
      </div>
    </BentoCard>
  );
}
