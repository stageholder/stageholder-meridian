"use client";

import { useRef, useState, useEffect, useCallback } from "react";
import { useCreateTodo, useTodoLists } from "@/lib/api/todos";
import { CreateTodoDialog } from "./create-todo-dialog";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";
import { toast } from "sonner";
import { format, parseISO, addDays, nextMonday } from "date-fns";
import { cn } from "@/lib/utils";

interface QuickAddTodoProps {
  listId: string;
}

const PRIORITIES = [
  { value: "none", label: "None", color: "" },
  { value: "low", label: "Low", color: "bg-blue-500" },
  { value: "medium", label: "Medium", color: "bg-yellow-500" },
  { value: "high", label: "High", color: "bg-orange-500" },
  { value: "urgent", label: "Urgent", color: "bg-red-500" },
] as const;

const PRIORITY_BADGE: Record<string, { label: string; className: string }> = {
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
};

function getToday() {
  return format(new Date(), "yyyy-MM-dd");
}

export function QuickAddTodo({ listId }: QuickAddTodoProps) {
  const [title, setTitle] = useState("");
  const [isEditing, setIsEditing] = useState(false);
  const [showFullDialog, setShowFullDialog] = useState(false);
  const [doDate, setDoDate] = useState("");
  const [dueDate, setDueDate] = useState("");
  const [priority, setPriority] = useState("none");
  const [selectedListId, setSelectedListId] = useState(listId);
  const inputRef = useRef<HTMLInputElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const createTodo = useCreateTodo();
  const { data: lists } = useTodoLists();

  function resetForm() {
    setTitle("");
    setDoDate("");
    setDueDate("");
    setPriority("none");
    setSelectedListId(listId);
  }

  function handleCancel() {
    setIsEditing(false);
    resetForm();
  }

  const handleSubmit = useCallback(() => {
    if (!title.trim() || createTodo.isPending) return;

    createTodo.mutate(
      {
        listId: selectedListId,
        data: {
          title: title.trim(),
          priority: priority !== "none" ? priority : undefined,
          doDate: doDate || undefined,
          dueDate: dueDate || undefined,
        },
      },
      {
        onSuccess: () => {
          resetForm();
          setDoDate(getToday());
          setIsEditing(true);
          setTimeout(() => inputRef.current?.focus(), 0);
        },
        onError: () => {
          toast.error("Failed to create todo");
        },
      },
    );
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [title, selectedListId, priority, doDate, dueDate, createTodo.isPending]);

  const [justActivated, setJustActivated] = useState(false);

  function handleActivate() {
    setIsEditing(true);
    setShowFullDialog(false);
    setSelectedListId(listId);
    setDoDate(getToday());
    setJustActivated(true);
    setTimeout(() => {
      inputRef.current?.focus();
      setJustActivated(false);
    }, 100);
  }

  // Close on Escape
  useEffect(() => {
    if (!isEditing) return;
    function onKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") handleCancel();
    }
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isEditing]);

  const selectedList = lists?.find((l) => l.id === selectedListId);

  const doDateInfo = doDate
    ? (() => {
        const today = getToday();
        const tomorrow = format(addDays(new Date(), 1), "yyyy-MM-dd");
        if (doDate < today)
          return {
            label: format(parseISO(doDate), "MMM d"),
            color: "text-red-600 dark:text-red-400",
          };
        if (doDate === today)
          return {
            label: "Today",
            color: "text-green-600 dark:text-green-400",
          };
        if (doDate === tomorrow)
          return {
            label: "Tomorrow",
            color: "text-amber-600 dark:text-amber-400",
          };
        return {
          label: format(parseISO(doDate), "MMM d"),
          color: "text-blue-600 dark:text-blue-400",
        };
      })()
    : null;

  const formattedDueDate = dueDate
    ? (() => {
        const today = getToday();
        const tomorrow = format(addDays(new Date(), 1), "yyyy-MM-dd");
        if (dueDate === today) return "Today";
        if (dueDate === tomorrow) return "Tomorrow";
        return format(parseISO(dueDate), "MMM d");
      })()
    : null;

  if (!isEditing) {
    return (
      <button
        type="button"
        onClick={handleActivate}
        className="flex w-full items-center gap-2 rounded-lg border border-dashed border-border px-3 py-2 text-sm text-muted-foreground transition-colors hover:border-primary hover:text-foreground"
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
          <path d="M5 12h14" />
          <path d="M12 5v14" />
        </svg>
        Add a todo...
      </button>
    );
  }

  return (
    <>
      <div
        ref={containerRef}
        className="rounded-lg border border-border bg-card px-4 py-3"
      >
        <div className="flex items-start gap-3">
          {/* Checkbox placeholder */}
          <div className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full border-2 border-muted-foreground/30" />

          <div className="flex-1 min-w-0">
            {/* Title input */}
            <form
              onSubmit={(e) => {
                e.preventDefault();
                handleSubmit();
              }}
            >
              <input
                ref={inputRef}
                type="text"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="Todo title..."
                className="w-full bg-transparent text-sm font-medium text-foreground placeholder:text-muted-foreground focus:outline-none"
              />
            </form>

            {/* Metadata chips row — same style as TodoItem */}
            <div className="mt-1.5 flex flex-wrap items-center gap-2">
              {/* Priority */}
              <Popover>
                <PopoverTrigger asChild>
                  <button
                    type="button"
                    className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground transition-colors"
                  >
                    {PRIORITY_BADGE[priority] ? (
                      <span
                        className={cn(
                          "inline-flex rounded-full px-2 py-0.5 text-xs font-medium",
                          PRIORITY_BADGE[priority].className,
                        )}
                      >
                        {PRIORITY_BADGE[priority].label}
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1 rounded-full border border-dashed border-border px-2 py-0.5 text-xs text-muted-foreground hover:border-foreground/30">
                        <svg
                          xmlns="http://www.w3.org/2000/svg"
                          width="10"
                          height="10"
                          viewBox="0 0 24 24"
                          fill="none"
                          stroke="currentColor"
                          strokeWidth="2"
                          strokeLinecap="round"
                          strokeLinejoin="round"
                        >
                          <path d="M4 15s1-1 4-1 5 2 8 2 4-1 4-1V3s-1 1-4 1-5-2-8-2-4 1-4 1z" />
                          <line x1="4" x2="4" y1="22" y2="15" />
                        </svg>
                        Priority
                      </span>
                    )}
                  </button>
                </PopoverTrigger>
                <PopoverContent align="start" className="w-36 p-1">
                  {PRIORITIES.map((p) => (
                    <button
                      key={p.value}
                      type="button"
                      onClick={() => setPriority(p.value)}
                      className={cn(
                        "flex w-full items-center gap-2 rounded-sm px-2 py-1.5 text-xs transition-colors hover:bg-accent",
                        priority === p.value && "bg-accent font-medium",
                      )}
                    >
                      {p.color ? (
                        <span className={cn("h-2 w-2 rounded-full", p.color)} />
                      ) : (
                        <span className="h-2 w-2" />
                      )}
                      {p.label}
                    </button>
                  ))}
                </PopoverContent>
              </Popover>

              {/* Do Date */}
              <Popover>
                <PopoverTrigger asChild>
                  <button
                    type="button"
                    className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground transition-colors"
                  >
                    {doDateInfo ? (
                      <span
                        className={cn(
                          "inline-flex items-center gap-1",
                          doDateInfo.color,
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
                          <circle cx="12" cy="12" r="10" />
                          <polyline points="12 6 12 12 16 14" />
                        </svg>
                        {doDateInfo.label}
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1 rounded-full border border-dashed border-border px-2 py-0.5 hover:border-foreground/30">
                        <svg
                          xmlns="http://www.w3.org/2000/svg"
                          width="10"
                          height="10"
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
                        Do date
                      </span>
                    )}
                  </button>
                </PopoverTrigger>
                <PopoverContent align="start" className="w-auto p-2">
                  <div className="flex flex-wrap gap-1 pb-2">
                    {[
                      { label: "Today", date: new Date() },
                      { label: "Tomorrow", date: addDays(new Date(), 1) },
                      { label: "Next Week", date: nextMonday(new Date()) },
                    ].map((shortcut) => {
                      const iso = format(shortcut.date, "yyyy-MM-dd");
                      const isActive = doDate === iso;
                      return (
                        <button
                          key={shortcut.label}
                          type="button"
                          onClick={() => setDoDate(isActive ? "" : iso)}
                          className={cn(
                            "rounded-full border px-2.5 py-0.5 text-xs font-medium transition-colors",
                            isActive
                              ? "border-primary bg-primary text-primary-foreground"
                              : "border-border text-muted-foreground hover:bg-accent hover:text-foreground",
                          )}
                        >
                          {shortcut.label}
                        </button>
                      );
                    })}
                    {doDate && (
                      <button
                        type="button"
                        onClick={() => setDoDate("")}
                        className="rounded-full border border-border px-2.5 py-0.5 text-xs font-medium text-muted-foreground hover:bg-accent hover:text-foreground"
                      >
                        Clear
                      </button>
                    )}
                  </div>
                  <Calendar
                    mode="single"
                    selected={doDate ? parseISO(doDate) : undefined}
                    onSelect={(date) =>
                      setDoDate(date ? format(date, "yyyy-MM-dd") : "")
                    }
                    defaultMonth={doDate ? parseISO(doDate) : undefined}
                  />
                </PopoverContent>
              </Popover>

              {/* Due Date */}
              <Popover>
                <PopoverTrigger asChild>
                  <button
                    type="button"
                    className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground transition-colors"
                  >
                    {formattedDueDate ? (
                      <span
                        className={cn(
                          "inline-flex items-center gap-1",
                          dueDate && dueDate < getToday()
                            ? "text-red-600 dark:text-red-400"
                            : "",
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
                          <rect
                            width="18"
                            height="18"
                            x="3"
                            y="4"
                            rx="2"
                            ry="2"
                          />
                          <line x1="16" x2="16" y1="2" y2="6" />
                          <line x1="8" x2="8" y1="2" y2="6" />
                          <line x1="3" x2="21" y1="10" y2="10" />
                        </svg>
                        {formattedDueDate}
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1 rounded-full border border-dashed border-border px-2 py-0.5 hover:border-foreground/30">
                        <svg
                          xmlns="http://www.w3.org/2000/svg"
                          width="10"
                          height="10"
                          viewBox="0 0 24 24"
                          fill="none"
                          stroke="currentColor"
                          strokeWidth="2"
                          strokeLinecap="round"
                          strokeLinejoin="round"
                        >
                          <rect
                            width="18"
                            height="18"
                            x="3"
                            y="4"
                            rx="2"
                            ry="2"
                          />
                          <line x1="16" x2="16" y1="2" y2="6" />
                          <line x1="8" x2="8" y1="2" y2="6" />
                          <line x1="3" x2="21" y1="10" y2="10" />
                        </svg>
                        Due date
                      </span>
                    )}
                  </button>
                </PopoverTrigger>
                <PopoverContent align="start" className="w-auto p-2">
                  <div className="flex flex-wrap gap-1 pb-2">
                    {[
                      { label: "Today", date: new Date() },
                      { label: "Tomorrow", date: addDays(new Date(), 1) },
                      { label: "Next Week", date: nextMonday(new Date()) },
                    ].map((shortcut) => {
                      const iso = format(shortcut.date, "yyyy-MM-dd");
                      const isActive = dueDate === iso;
                      return (
                        <button
                          key={shortcut.label}
                          type="button"
                          onClick={() => setDueDate(isActive ? "" : iso)}
                          className={cn(
                            "rounded-full border px-2.5 py-0.5 text-xs font-medium transition-colors",
                            isActive
                              ? "border-primary bg-primary text-primary-foreground"
                              : "border-border text-muted-foreground hover:bg-accent hover:text-foreground",
                          )}
                        >
                          {shortcut.label}
                        </button>
                      );
                    })}
                    {dueDate && (
                      <button
                        type="button"
                        onClick={() => setDueDate("")}
                        className="rounded-full border border-border px-2.5 py-0.5 text-xs font-medium text-muted-foreground hover:bg-accent hover:text-foreground"
                      >
                        Clear
                      </button>
                    )}
                  </div>
                  <Calendar
                    mode="single"
                    selected={dueDate ? parseISO(dueDate) : undefined}
                    onSelect={(date) =>
                      setDueDate(date ? format(date, "yyyy-MM-dd") : "")
                    }
                    defaultMonth={dueDate ? parseISO(dueDate) : undefined}
                  />
                </PopoverContent>
              </Popover>

              {/* List selector */}
              {lists && lists.length > 1 && (
                <Popover>
                  <PopoverTrigger asChild>
                    <button
                      type="button"
                      className="inline-flex items-center gap-1 rounded-full border border-dashed border-border px-2 py-0.5 text-xs text-muted-foreground hover:border-foreground/30 hover:text-foreground transition-colors"
                    >
                      {selectedList && !selectedList.isDefault ? (
                        <span
                          className="h-2 w-2 rounded-full"
                          style={{
                            backgroundColor: selectedList.color || "#6b7280",
                          }}
                        />
                      ) : (
                        <svg
                          xmlns="http://www.w3.org/2000/svg"
                          width="10"
                          height="10"
                          viewBox="0 0 24 24"
                          fill="none"
                          stroke="currentColor"
                          strokeWidth="2"
                          strokeLinecap="round"
                          strokeLinejoin="round"
                        >
                          <line x1="8" x2="21" y1="6" y2="6" />
                          <line x1="8" x2="21" y1="12" y2="12" />
                          <line x1="8" x2="21" y1="18" y2="18" />
                          <line x1="3" x2="3.01" y1="6" y2="6" />
                          <line x1="3" x2="3.01" y1="12" y2="12" />
                          <line x1="3" x2="3.01" y1="18" y2="18" />
                        </svg>
                      )}
                      {selectedList?.name || "List"}
                    </button>
                  </PopoverTrigger>
                  <PopoverContent align="start" className="w-44 p-1">
                    {lists.map((list) => (
                      <button
                        key={list.id}
                        type="button"
                        onClick={() => setSelectedListId(list.id)}
                        className={cn(
                          "flex w-full items-center gap-2 rounded-sm px-2 py-1.5 text-xs transition-colors hover:bg-accent",
                          selectedListId === list.id && "bg-accent font-medium",
                        )}
                      >
                        {list.isDefault ? (
                          <svg
                            xmlns="http://www.w3.org/2000/svg"
                            width="10"
                            height="10"
                            viewBox="0 0 24 24"
                            fill="none"
                            stroke="currentColor"
                            strokeWidth="2"
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            className="text-primary"
                          >
                            <polyline points="22 12 16 12 14 15 10 15 8 12 2 12" />
                            <path d="M5.45 5.11 2 12v6a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2v-6l-3.45-6.89A2 2 0 0 0 16.76 4H7.24a2 2 0 0 0-1.79 1.11z" />
                          </svg>
                        ) : (
                          <span
                            className="h-2 w-2 rounded-full"
                            style={{ backgroundColor: list.color || "#6b7280" }}
                          />
                        )}
                        {list.name}
                      </button>
                    ))}
                  </PopoverContent>
                </Popover>
              )}
            </div>
          </div>

          {/* Action buttons */}
          <div className="flex shrink-0 items-center gap-1">
            <button
              type="button"
              onClick={() => {
                if (!justActivated) setShowFullDialog(true);
              }}
              className="flex items-center gap-1 rounded-md px-2 py-1 text-xs text-muted-foreground hover:bg-accent hover:text-foreground"
              title="Open full editor"
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
                <path d="M12 3H5a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" />
                <path d="M18.375 2.625a1 1 0 0 1 3 3l-9.013 9.014a2 2 0 0 1-.853.505l-2.873.84a.5.5 0 0 1-.62-.62l.84-2.873a2 2 0 0 1 .506-.852z" />
              </svg>
              More
            </button>
            <button
              type="button"
              onClick={handleCancel}
              className="rounded-md px-2 py-1 text-xs text-muted-foreground hover:bg-accent hover:text-foreground"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={handleSubmit}
              disabled={!title.trim() || createTodo.isPending}
              className="rounded-md bg-primary px-3 py-1 text-xs font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
            >
              {createTodo.isPending ? "Adding..." : "Add"}
            </button>
          </div>
        </div>
      </div>

      <CreateTodoDialog
        open={showFullDialog}
        onOpenChange={setShowFullDialog}
        listId={selectedListId}
      />
    </>
  );
}
