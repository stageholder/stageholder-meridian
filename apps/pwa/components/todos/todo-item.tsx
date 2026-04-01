"use client";

import { useState } from "react";
import { cn } from "@/lib/utils";
import { parseDateLocal } from "@/lib/date";
import { useUpdateTodo, useDeleteTodo } from "@/lib/api/todos";
import { TodoDetailDialog } from "./todo-detail-dialog";
import { EmberBurst } from "./ember-burst";
import type { Todo } from "@repo/core/types";

const priorityConfig: Record<string, { label: string; className: string }> = {
  urgent: {
    label: "Urgent",
    className: "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400",
  },
  high: {
    label: "High",
    className:
      "bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-400",
  },
  medium: {
    label: "Medium",
    className:
      "bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400",
  },
  low: {
    label: "Low",
    className:
      "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400",
  },
  none: { label: "", className: "" },
};

interface TodoItemProps {
  todo: Todo;
  listId: string;
  /** When true, the item plays the check + exit animation (driven by parent) */
  isCompleting?: boolean;
}

export function TodoItem({
  todo,
  listId,
  isCompleting = false,
}: TodoItemProps) {
  const [detailOpen, setDetailOpen] = useState(false);
  const updateTodo = useUpdateTodo();
  const deleteTodo = useDeleteTodo();
  const isDone = todo.status === "done";
  const priority = priorityConfig[todo.priority] ?? {
    label: "",
    className: "",
  };

  function handleToggle(e: React.MouseEvent) {
    e.stopPropagation();
    updateTodo.mutate({
      listId,
      todoId: todo.id,
      data: { status: isDone ? "todo" : "done" },
    });
  }

  function handleDelete(e: React.MouseEvent) {
    e.stopPropagation();
    deleteTodo.mutate({ listId, todoId: todo.id });
  }

  const formattedDueDate = todo.dueDate
    ? parseDateLocal(todo.dueDate).toLocaleDateString("en-US", {
        month: "short",
        day: "numeric",
      })
    : null;

  const formattedDoDate = todo.doDate
    ? parseDateLocal(todo.doDate).toLocaleDateString("en-US", {
        month: "short",
        day: "numeric",
      })
    : null;

  const isOverdue =
    todo.dueDate && !isDone && parseDateLocal(todo.dueDate) < new Date();

  return (
    <>
      <div
        onClick={() => !isCompleting && setDetailOpen(true)}
        className={cn(
          "group flex cursor-pointer items-center gap-3 rounded-lg border border-border bg-card px-4 py-3 transition-colors hover:bg-accent/50",
          isCompleting && "todo-item-completing",
        )}
        role="button"
        aria-label="Open todo details"
      >
        <div className="relative shrink-0">
          <div
            onClick={handleToggle}
            className={cn(
              "flex h-5 w-5 items-center justify-center rounded-full border-2 transition-colors",
              isCompleting
                ? "border-[oklch(0.72_0.22_40)] bg-[oklch(0.72_0.22_40)] text-white todo-check-pop"
                : isDone
                  ? "border-primary bg-primary text-primary-foreground"
                  : "border-muted-foreground/40 hover:border-primary",
            )}
            role="checkbox"
            aria-checked={isDone || isCompleting}
            aria-label={isDone ? "Mark as incomplete" : "Mark as complete"}
          >
            {(isDone || isCompleting) && (
              <svg
                className={isCompleting ? "todo-check-draw" : ""}
                xmlns="http://www.w3.org/2000/svg"
                width="12"
                height="12"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="3"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <polyline points="20 6 9 17 4 12" />
              </svg>
            )}
          </div>
          {isCompleting && <span className="todo-check-ring" />}
          <EmberBurst active={isCompleting} />
        </div>

        <div className="flex-1 min-w-0">
          <p
            className={cn(
              "text-sm font-medium text-foreground",
              isDone && "line-through text-muted-foreground",
            )}
          >
            {todo.title}
          </p>
          {todo.description && (
            <p className="mt-0.5 text-xs text-muted-foreground line-clamp-1">
              {todo.description}
            </p>
          )}
          {(priority.label ||
            formattedDueDate ||
            formattedDoDate ||
            (todo.subtasks && todo.subtasks.length > 0)) && (
            <div className="mt-1.5 flex flex-wrap items-center gap-2">
              {priority.label && (
                <span
                  className={cn(
                    "inline-flex rounded-full px-2 py-0.5 text-xs font-medium",
                    priority.className,
                  )}
                >
                  {priority.label}
                </span>
              )}
              {formattedDueDate && (
                <span
                  className={cn(
                    "inline-flex items-center gap-1 text-xs",
                    isOverdue
                      ? "text-red-600 dark:text-red-400"
                      : "text-muted-foreground",
                  )}
                >
                  <svg
                    xmlns="http://www.w3.org/2000/svg"
                    width="12"
                    height="12"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  >
                    <rect width="18" height="18" x="3" y="4" rx="2" ry="2" />
                    <line x1="16" x2="16" y1="2" y2="6" />
                    <line x1="8" x2="8" y1="2" y2="6" />
                    <line x1="3" x2="21" y1="10" y2="10" />
                  </svg>
                  {formattedDueDate}
                </span>
              )}
              {formattedDoDate && (
                <span className="inline-flex items-center gap-1 text-xs text-muted-foreground">
                  <svg
                    xmlns="http://www.w3.org/2000/svg"
                    width="12"
                    height="12"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  >
                    <circle cx="12" cy="12" r="10" />
                    <polyline points="12 6 12 12 16 14" />
                  </svg>
                  {formattedDoDate}
                </span>
              )}
              {todo.subtasks && todo.subtasks.length > 0 && (
                <span className="inline-flex items-center gap-1 text-xs text-muted-foreground">
                  <svg
                    xmlns="http://www.w3.org/2000/svg"
                    width="12"
                    height="12"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  >
                    <polyline points="9 11 12 14 22 4" />
                    <path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11" />
                  </svg>
                  {todo.subtasks.filter((s) => s.status === "done").length}/
                  {todo.subtasks.length}
                </span>
              )}
            </div>
          )}
        </div>

        <button
          onClick={handleDelete}
          className="flex h-7 w-7 shrink-0 items-center justify-center rounded-md text-muted-foreground opacity-0 transition-opacity hover:bg-destructive/10 hover:text-destructive group-hover:opacity-100"
          aria-label="Delete todo"
        >
          <svg
            xmlns="http://www.w3.org/2000/svg"
            width="14"
            height="14"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <path d="M3 6h18" />
            <path d="M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6" />
            <path d="M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2" />
          </svg>
        </button>
      </div>

      <TodoDetailDialog
        open={detailOpen}
        onOpenChange={setDetailOpen}
        todo={todo}
        listId={listId}
      />
    </>
  );
}
