"use client";

import { useState, useRef, useEffect } from "react";
import {
  useUpdateTodo,
  useDeleteTodo,
  useAddSubtask,
  useUpdateSubtask,
  useRemoveSubtask,
} from "@/lib/api/todos";
import { DatePicker } from "@/components/ui/date-picker";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import type { Todo } from "@repo/core/types";

const priorityConfig: Record<
  string,
  { label: string; dotClass: string; badgeClass: string }
> = {
  urgent: {
    label: "Urgent",
    dotClass: "bg-red-500",
    badgeClass: "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400",
  },
  high: {
    label: "High",
    dotClass: "bg-orange-500",
    badgeClass:
      "bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-400",
  },
  medium: {
    label: "Medium",
    dotClass: "bg-yellow-500",
    badgeClass:
      "bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400",
  },
  low: {
    label: "Low",
    dotClass: "bg-blue-500",
    badgeClass:
      "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400",
  },
  none: { label: "None", dotClass: "bg-muted-foreground/40", badgeClass: "" },
};

const priorityOptions = ["urgent", "high", "medium", "low", "none"] as const;

interface TodoDetailDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  todo: Todo;
  listId: string;
}

export function TodoDetailDialog({
  open,
  onOpenChange,
  todo,
  listId,
}: TodoDetailDialogProps) {
  const updateTodo = useUpdateTodo();
  const deleteTodo = useDeleteTodo();
  const addSubtask = useAddSubtask();
  const updateSubtask = useUpdateSubtask();
  const removeSubtask = useRemoveSubtask();
  const [newSubtaskTitle, setNewSubtaskTitle] = useState("");
  const [priorityOpen, setPriorityOpen] = useState(false);
  const [editingDesc, setEditingDesc] = useState(false);
  const [descDraft, setDescDraft] = useState(todo.description ?? "");
  const descRef = useRef<HTMLTextAreaElement>(null);
  const priorityRef = useRef<HTMLDivElement>(null);
  const isDone = todo.status === "done";
  const priority = priorityConfig[todo.priority] ?? priorityConfig.none!;

  // Sync description draft when todo changes externally
  useEffect(() => {
    if (!editingDesc) setDescDraft(todo.description ?? "");
  }, [todo.description, editingDesc]);

  // Auto-focus textarea when entering edit mode
  useEffect(() => {
    if (editingDesc && descRef.current) {
      descRef.current.focus();
      descRef.current.selectionStart = descRef.current.value.length;
    }
  }, [editingDesc]);

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (
        priorityRef.current &&
        !priorityRef.current.contains(e.target as Node)
      )
        setPriorityOpen(false);
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  function handleUpdateField(data: Record<string, unknown>) {
    updateTodo.mutate({ listId, todoId: todo.id, data });
  }

  function handleSaveDescription() {
    const trimmed = descDraft.trim();
    const current = todo.description ?? "";
    if (trimmed !== current) {
      handleUpdateField({ description: trimmed || undefined });
    }
    setEditingDesc(false);
  }

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
      },
    );
  }

  const isOverdue =
    todo.dueDate && !isDone && new Date(todo.dueDate) < new Date();

  const formattedCreatedAt = new Date(todo.createdAt).toLocaleDateString(
    "en-US",
    {
      month: "short",
      day: "numeric",
      year: "numeric",
    },
  );

  const formattedUpdatedAt = new Date(todo.updatedAt).toLocaleDateString(
    "en-US",
    {
      month: "short",
      day: "numeric",
      year: "numeric",
    },
  );

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div
        className="fixed inset-0 bg-black/50"
        onClick={() => onOpenChange(false)}
      />
      <div
        role="dialog"
        aria-modal="true"
        className="relative z-50 mx-4 w-full max-w-2xl rounded-xl border border-border bg-card shadow-lg max-h-[90vh] overflow-y-auto"
      >
        {/* Header */}
        <div className="flex items-start gap-3 border-b border-border p-5">
          <button
            type="button"
            onClick={handleToggleStatus}
            className={cn(
              "mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full border-2 transition-colors",
              isDone
                ? "border-primary bg-primary text-primary-foreground"
                : "border-muted-foreground/40 hover:border-primary",
            )}
            aria-label={isDone ? "Mark as incomplete" : "Mark as complete"}
          >
            {isDone && (
              <svg
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
          </button>
          <div className="flex-1 min-w-0">
            <h2
              className={cn(
                "text-base font-semibold text-foreground",
                isDone && "line-through text-muted-foreground",
              )}
            >
              {todo.title}
            </h2>
            {isDone && (
              <span className="mt-1 inline-flex items-center gap-1 text-xs text-green-600 dark:text-green-400">
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
            <svg
              xmlns="http://www.w3.org/2000/svg"
              width="16"
              height="16"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <line x1="18" x2="6" y1="6" y2="18" />
              <line x1="6" x2="18" y1="6" y2="18" />
            </svg>
          </button>
        </div>

        {/* Body — two columns */}
        <div className="flex flex-col divide-y divide-border md:flex-row md:divide-x md:divide-y-0">
          {/* Left column: Description & Subtasks */}
          <div className="flex-1 space-y-4 p-5 min-w-0">
            {/* Description (editable) */}
            <div>
              <div className="flex items-center justify-between">
                <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                  Description
                </p>
                {!editingDesc && (
                  <button
                    type="button"
                    onClick={() => setEditingDesc(true)}
                    className="text-xs text-muted-foreground hover:text-foreground transition-colors"
                  >
                    {todo.description ? "Edit" : "Add"}
                  </button>
                )}
              </div>
              {editingDesc ? (
                <div className="mt-1.5">
                  <textarea
                    ref={descRef}
                    value={descDraft}
                    onChange={(e) => setDescDraft(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) {
                        handleSaveDescription();
                      }
                      if (e.key === "Escape") {
                        setDescDraft(todo.description ?? "");
                        setEditingDesc(false);
                      }
                    }}
                    placeholder="Add a description..."
                    rows={3}
                    className="w-full resize-none rounded-md border border-border bg-transparent px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-ring"
                  />
                  <div className="mt-1.5 flex items-center gap-2">
                    <button
                      type="button"
                      onClick={handleSaveDescription}
                      className="rounded-md bg-primary px-3 py-1 text-xs font-medium text-primary-foreground hover:bg-primary/90"
                    >
                      Save
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setDescDraft(todo.description ?? "");
                        setEditingDesc(false);
                      }}
                      className="rounded-md px-3 py-1 text-xs font-medium text-muted-foreground hover:bg-accent"
                    >
                      Cancel
                    </button>
                    <span className="ml-auto text-[10px] text-muted-foreground">
                      Cmd+Enter to save
                    </span>
                  </div>
                </div>
              ) : todo.description ? (
                <p
                  className="mt-1.5 whitespace-pre-wrap text-sm text-foreground cursor-pointer rounded-md px-2 py-1.5 -mx-2 hover:bg-accent/50 transition-colors"
                  onClick={() => setEditingDesc(true)}
                >
                  {todo.description}
                </p>
              ) : (
                <p
                  className="mt-1.5 text-sm italic text-muted-foreground cursor-pointer rounded-md px-2 py-1.5 -mx-2 hover:bg-accent/50 transition-colors"
                  onClick={() => setEditingDesc(true)}
                >
                  Click to add a description...
                </p>
              )}
            </div>

            {/* Subtasks */}
            <div>
              <div className="flex items-center justify-between">
                <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                  Subtasks
                  {todo.subtasks &&
                    todo.subtasks.length > 0 &&
                    ` ${todo.subtasks.filter((s) => s.status === "done").length}/${todo.subtasks.length}`}
                </p>
              </div>
              {todo.subtasks && todo.subtasks.length > 0 && (
                <div className="mt-2 space-y-1">
                  {[...todo.subtasks]
                    .sort((a, b) => a.order - b.order)
                    .map((subtask) => (
                      <div
                        key={subtask.id}
                        className="group/subtask flex items-center gap-2 rounded-md px-1 py-1 hover:bg-accent/50"
                      >
                        <button
                          type="button"
                          onClick={() =>
                            updateSubtask.mutate({
                              listId,
                              todoId: todo.id,
                              subtaskId: subtask.id,
                              data: {
                                status:
                                  subtask.status === "done" ? "todo" : "done",
                              },
                            })
                          }
                          className={cn(
                            "flex h-4 w-4 shrink-0 items-center justify-center rounded border transition-colors",
                            subtask.status === "done"
                              ? "border-primary bg-primary text-primary-foreground"
                              : "border-muted-foreground/40 hover:border-primary",
                          )}
                          aria-label={
                            subtask.status === "done"
                              ? "Mark subtask incomplete"
                              : "Mark subtask complete"
                          }
                        >
                          {subtask.status === "done" && (
                            <svg
                              xmlns="http://www.w3.org/2000/svg"
                              width="10"
                              height="10"
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
                        </button>
                        <span
                          className={cn(
                            "flex-1 text-sm",
                            subtask.status === "done" &&
                              "line-through text-muted-foreground",
                          )}
                        >
                          {subtask.title}
                        </span>
                        <button
                          type="button"
                          onClick={() =>
                            removeSubtask.mutate({
                              listId,
                              todoId: todo.id,
                              subtaskId: subtask.id,
                            })
                          }
                          className="flex h-5 w-5 shrink-0 items-center justify-center rounded text-muted-foreground opacity-100 transition-opacity hover:text-destructive md:opacity-0 md:group-hover/subtask:opacity-100"
                          aria-label="Delete subtask"
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
                            <line x1="18" x2="6" y1="6" y2="18" />
                            <line x1="6" x2="18" y1="6" y2="18" />
                          </svg>
                        </button>
                      </div>
                    ))}
                </div>
              )}
              <form
                className="mt-2"
                onSubmit={(e) => {
                  e.preventDefault();
                  const title = newSubtaskTitle.trim();
                  if (!title) return;
                  addSubtask.mutate(
                    { listId, todoId: todo.id, data: { title } },
                    {
                      onSuccess: () => setNewSubtaskTitle(""),
                    },
                  );
                }}
              >
                <input
                  type="text"
                  value={newSubtaskTitle}
                  onChange={(e) => setNewSubtaskTitle(e.target.value)}
                  placeholder="Add subtask..."
                  className="w-full rounded-md border border-border bg-transparent px-3 py-1.5 text-sm placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-ring"
                />
              </form>
            </div>
          </div>

          {/* Right column: Task details (interactive) */}
          <div className="w-full space-y-1 p-3 md:w-60 md:shrink-0">
            {/* Priority */}
            <div ref={priorityRef} className="relative">
              <p className="px-2 text-[10px] font-medium uppercase tracking-wide text-muted-foreground">
                Priority
              </p>
              <button
                type="button"
                onClick={() => setPriorityOpen(!priorityOpen)}
                className="mt-0.5 flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-sm text-foreground transition-colors hover:bg-accent"
              >
                <span
                  className={cn("h-2.5 w-2.5 rounded-full", priority.dotClass)}
                />
                <span>{priority.label}</span>
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
                  className="ml-auto text-muted-foreground"
                >
                  <path d="m6 9 6 6 6-6" />
                </svg>
              </button>
              {priorityOpen && (
                <div className="absolute left-0 right-0 z-10 mt-1 rounded-lg border border-border bg-popover p-1 shadow-md">
                  {priorityOptions.map((key) => {
                    const p = priorityConfig[key]!;
                    return (
                      <button
                        key={key}
                        type="button"
                        onClick={() => {
                          handleUpdateField({ priority: key });
                          setPriorityOpen(false);
                        }}
                        className={cn(
                          "flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-sm transition-colors hover:bg-accent",
                          todo.priority === key && "bg-accent",
                        )}
                      >
                        <span
                          className={cn("h-2.5 w-2.5 rounded-full", p.dotClass)}
                        />
                        <span>{p.label}</span>
                        {todo.priority === key && (
                          <svg
                            xmlns="http://www.w3.org/2000/svg"
                            width="12"
                            height="12"
                            viewBox="0 0 24 24"
                            fill="none"
                            stroke="currentColor"
                            strokeWidth="2.5"
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            className="ml-auto text-primary"
                          >
                            <polyline points="20 6 9 17 4 12" />
                          </svg>
                        )}
                      </button>
                    );
                  })}
                </div>
              )}
            </div>

            <div className="!mt-3 border-t border-border" />

            {/* Due Date */}
            <div>
              <p className="px-2 text-[10px] font-medium uppercase tracking-wide text-muted-foreground">
                Due Date
              </p>
              <div className="mt-0.5 px-1">
                <DatePicker
                  value={todo.dueDate ?? ""}
                  onChange={(value) =>
                    handleUpdateField({ dueDate: value || null })
                  }
                  placeholder="Set due date"
                  clearable={false}
                  className={cn(
                    "h-8 w-full text-xs",
                    isOverdue &&
                      "border-red-500/50 text-red-600 dark:text-red-400",
                  )}
                />
              </div>
            </div>

            {/* Do Date */}
            <div>
              <p className="px-2 text-[10px] font-medium uppercase tracking-wide text-muted-foreground">
                Do Date
              </p>
              <div className="mt-0.5 px-1">
                <DatePicker
                  value={todo.doDate ?? ""}
                  onChange={(value) =>
                    handleUpdateField({ doDate: value || null })
                  }
                  placeholder="Set do date"
                  clearable={false}
                  className="h-8 w-full text-xs"
                />
              </div>
            </div>

            {/* Timestamps & Delete */}
            <div className="!mt-3 space-y-2 border-t border-border pt-3">
              <div className="flex items-center justify-between px-2">
                <span className="text-[10px] font-medium uppercase tracking-wide text-muted-foreground">
                  Created
                </span>
                <span className="text-xs text-muted-foreground">
                  {formattedCreatedAt}
                </span>
              </div>
              <div className="flex items-center justify-between px-2">
                <span className="text-[10px] font-medium uppercase tracking-wide text-muted-foreground">
                  Updated
                </span>
                <span className="text-xs text-muted-foreground">
                  {formattedUpdatedAt}
                </span>
              </div>
            </div>

            <button
              type="button"
              onClick={handleDelete}
              className="!mt-3 inline-flex w-full items-center justify-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-medium text-destructive transition-colors hover:bg-destructive/10"
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
                <path d="M3 6h18" />
                <path d="M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6" />
                <path d="M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2" />
              </svg>
              Delete
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
