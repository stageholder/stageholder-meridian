"use client";

import { useUpdateTodo, useDeleteTodo } from "@/lib/api/todos";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import type { Todo } from "@repo/core/types";

const priorityConfig: Record<string, { label: string; dotClass: string; badgeClass: string }> = {
  urgent: { label: "Urgent", dotClass: "bg-red-500", badgeClass: "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400" },
  high: { label: "High", dotClass: "bg-orange-500", badgeClass: "bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-400" },
  medium: { label: "Medium", dotClass: "bg-yellow-500", badgeClass: "bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400" },
  low: { label: "Low", dotClass: "bg-blue-500", badgeClass: "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400" },
  none: { label: "None", dotClass: "bg-muted-foreground/40", badgeClass: "" },
};

interface TodoDetailDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  todo: Todo;
  listId: string;
}

export function TodoDetailDialog({ open, onOpenChange, todo, listId }: TodoDetailDialogProps) {
  const updateTodo = useUpdateTodo();
  const deleteTodo = useDeleteTodo();
  const isDone = todo.status === "done";
  const priority = priorityConfig[todo.priority] ?? priorityConfig.none!;

  function handleToggleStatus() {
    updateTodo.mutate({
      listId,
      todoId: todo.id,
      data: { status: isDone ? "todo" : "done" },
    });
  }

  function handleDelete() {
    deleteTodo.mutate(
      { listId, todoId: todo.id },
      {
        onSuccess: () => {
          toast.success("Todo deleted");
          onOpenChange(false);
        },
        onError: () => {
          toast.error("Failed to delete todo");
        },
      }
    );
  }

  const formattedDueDate = todo.dueDate
    ? new Date(todo.dueDate).toLocaleDateString("en-US", {
        weekday: "short",
        month: "short",
        day: "numeric",
        year: "numeric",
      })
    : null;

  const isOverdue =
    todo.dueDate && !isDone && new Date(todo.dueDate) < new Date();

  const formattedCreatedAt = new Date(todo.createdAt).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });

  const formattedUpdatedAt = new Date(todo.updatedAt).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div className="fixed inset-0 bg-black/50" onClick={() => onOpenChange(false)} />
      <div className="relative z-50 w-full max-w-md rounded-xl border border-border bg-card shadow-lg">
        {/* Header */}
        <div className="flex items-start gap-3 border-b border-border p-5">
          <button
            type="button"
            onClick={handleToggleStatus}
            className={cn(
              "mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full border-2 transition-colors",
              isDone
                ? "border-primary bg-primary text-primary-foreground"
                : "border-muted-foreground/40 hover:border-primary"
            )}
            aria-label={isDone ? "Mark as incomplete" : "Mark as complete"}
          >
            {isDone && (
              <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
                <polyline points="20 6 9 17 4 12" />
              </svg>
            )}
          </button>
          <div className="flex-1 min-w-0">
            <h2 className={cn(
              "text-base font-semibold text-foreground",
              isDone && "line-through text-muted-foreground"
            )}>
              {todo.title}
            </h2>
            {isDone && (
              <span className="mt-1 inline-flex items-center gap-1 text-xs text-green-600 dark:text-green-400">
                <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14" />
                  <polyline points="22 4 12 14.01 9 11.01" />
                </svg>
                Completed
              </span>
            )}
          </div>
          <button
            type="button"
            onClick={() => onOpenChange(false)}
            className="flex h-7 w-7 shrink-0 items-center justify-center rounded-md text-muted-foreground hover:bg-accent"
            aria-label="Close"
          >
            <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <line x1="18" x2="6" y1="6" y2="18" />
              <line x1="6" x2="18" y1="6" y2="18" />
            </svg>
          </button>
        </div>

        {/* Body */}
        <div className="space-y-4 p-5">
          {/* Description */}
          {todo.description ? (
            <div>
              <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Description</p>
              <p className="mt-1.5 whitespace-pre-wrap text-sm text-foreground">{todo.description}</p>
            </div>
          ) : (
            <p className="text-sm italic text-muted-foreground">No description</p>
          )}

          {/* Details grid */}
          <div className="grid grid-cols-2 gap-4 rounded-lg border border-border bg-muted/30 p-4">
            {/* Priority */}
            <div>
              <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Priority</p>
              <div className="mt-1.5 flex items-center gap-2">
                <span className={cn("h-2 w-2 rounded-full", priority.dotClass)} />
                {priority.badgeClass ? (
                  <span className={cn("inline-flex rounded-full px-2 py-0.5 text-xs font-medium", priority.badgeClass)}>
                    {priority.label}
                  </span>
                ) : (
                  <span className="text-sm text-muted-foreground">{priority.label}</span>
                )}
              </div>
            </div>

            {/* Status */}
            <div>
              <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Status</p>
              <p className="mt-1.5 text-sm text-foreground capitalize">
                {todo.status === "in_progress" ? "In Progress" : todo.status === "done" ? "Done" : "To Do"}
              </p>
            </div>

            {/* Due Date */}
            <div>
              <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Due Date</p>
              {formattedDueDate ? (
                <p className={cn(
                  "mt-1.5 flex items-center gap-1.5 text-sm",
                  isOverdue ? "text-red-600 dark:text-red-400" : "text-foreground"
                )}>
                  <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <rect width="18" height="18" x="3" y="4" rx="2" ry="2" />
                    <line x1="16" x2="16" y1="2" y2="6" />
                    <line x1="8" x2="8" y1="2" y2="6" />
                    <line x1="3" x2="21" y1="10" y2="10" />
                  </svg>
                  {formattedDueDate}
                  {isOverdue && <span className="text-xs font-medium">(Overdue)</span>}
                </p>
              ) : (
                <p className="mt-1.5 text-sm text-muted-foreground">No due date</p>
              )}
            </div>

            {/* Created */}
            <div>
              <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Created</p>
              <p className="mt-1.5 text-sm text-foreground">{formattedCreatedAt}</p>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between border-t border-border px-5 py-3">
          <span className="text-xs text-muted-foreground">
            Updated {formattedUpdatedAt}
          </span>
          <button
            type="button"
            onClick={handleDelete}
            className="inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-medium text-destructive hover:bg-destructive/10"
          >
            <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M3 6h18" />
              <path d="M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6" />
              <path d="M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2" />
            </svg>
            Delete
          </button>
        </div>
      </div>
    </div>
  );
}
