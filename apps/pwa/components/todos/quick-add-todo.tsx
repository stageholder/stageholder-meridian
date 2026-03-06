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
          inputRef.current?.focus();
        },
        onError: () => {
          toast.error("Failed to create todo");
        },
      }
    );
  }, [title, selectedListId, priority, doDate, dueDate, createTodo.isPending]);

  function handleActivate() {
    setIsEditing(true);
    setSelectedListId(listId);
    setTimeout(() => inputRef.current?.focus(), 0);
  }

  // Close on Escape key
  useEffect(() => {
    if (!isEditing) return;
    function onKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") {
        handleCancel();
      }
    }
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [isEditing]);

  // Click outside to close (portal-aware)
  useEffect(() => {
    if (!isEditing) return;
    function onPointerDown(e: PointerEvent) {
      const target = e.target as HTMLElement;
      // Inside the quick-add container
      if (containerRef.current?.contains(target)) return;
      // Inside a popover portal
      if (target.closest("[data-slot='popover-content']")) return;
      // Inside a select portal
      if (target.closest("[data-slot='select-content']")) return;
      // Clicked outside — collapse only if empty
      if (!title.trim()) {
        handleCancel();
      }
    }
    document.addEventListener("pointerdown", onPointerDown);
    return () => document.removeEventListener("pointerdown", onPointerDown);
  }, [isEditing, title]);

  const currentPriority = PRIORITIES.find((p) => p.value === priority) || PRIORITIES[0];
  const selectedList = lists?.find((l) => l.id === selectedListId);

  if (!isEditing) {
    return (
      <>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={handleActivate}
            className="flex flex-1 items-center gap-2 rounded-lg border border-dashed border-border px-3 py-2 text-sm text-muted-foreground transition-colors hover:border-primary hover:text-foreground"
          >
            <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M5 12h14" />
              <path d="M12 5v14" />
            </svg>
            Add a todo...
          </button>
          <button
            type="button"
            onClick={() => setShowFullDialog(true)}
            className="flex h-9 shrink-0 items-center gap-1.5 rounded-lg border border-border px-2.5 text-xs text-muted-foreground hover:bg-accent hover:text-foreground"
            aria-label="Add todo with details"
            title="Add with details"
          >
            <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M12 3H5a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" />
              <path d="M18.375 2.625a1 1 0 0 1 3 3l-9.013 9.014a2 2 0 0 1-.853.505l-2.873.84a.5.5 0 0 1-.62-.62l.84-2.873a2 2 0 0 1 .506-.852z" />
            </svg>
            More
          </button>
        </div>

        <CreateTodoDialog
          open={showFullDialog}
          onOpenChange={setShowFullDialog}
          listId={listId}
        />
      </>
    );
  }

  return (
    <>
      <div ref={containerRef} className="rounded-lg border border-border bg-background p-2">
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
            placeholder="Add a todo..."
            className="w-full bg-transparent px-1 py-1 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none"
          />
        </form>

        {/* Inline options row */}
        <div className="mt-1.5 flex flex-wrap items-center gap-1.5">
          {/* Do Date */}
          <Popover>
            <PopoverTrigger asChild>
              <button
                type="button"
                className={cn(
                  "flex items-center gap-1 rounded-md border px-2 py-1 text-xs transition-colors",
                  doDate
                    ? "border-amber-500/30 bg-amber-500/10 text-amber-600 dark:text-amber-400"
                    : "border-border text-muted-foreground hover:bg-accent hover:text-foreground"
                )}
              >
                <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <circle cx="12" cy="12" r="4" />
                  <path d="M12 2v2" />
                  <path d="M12 20v2" />
                  <path d="m4.93 4.93 1.41 1.41" />
                  <path d="m17.66 17.66 1.41 1.41" />
                  <path d="M2 12h2" />
                  <path d="M20 12h2" />
                  <path d="m6.34 17.66-1.41 1.41" />
                  <path d="m19.07 4.93-1.41 1.41" />
                </svg>
                {doDate ? format(parseISO(doDate), "MMM d") : "Do date"}
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
                          : "border-border text-muted-foreground hover:bg-accent hover:text-foreground"
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
                onSelect={(date) => {
                  setDoDate(date ? format(date, "yyyy-MM-dd") : "");
                }}
                defaultMonth={doDate ? parseISO(doDate) : undefined}
              />
            </PopoverContent>
          </Popover>

          {/* Due Date */}
          <Popover>
            <PopoverTrigger asChild>
              <button
                type="button"
                className={cn(
                  "flex items-center gap-1 rounded-md border px-2 py-1 text-xs transition-colors",
                  dueDate
                    ? "border-blue-500/30 bg-blue-500/10 text-blue-600 dark:text-blue-400"
                    : "border-border text-muted-foreground hover:bg-accent hover:text-foreground"
                )}
              >
                <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M8 2v4" />
                  <path d="M16 2v4" />
                  <rect width="18" height="18" x="3" y="4" rx="2" />
                  <path d="M3 10h18" />
                </svg>
                {dueDate ? format(parseISO(dueDate), "MMM d") : "Due date"}
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
                          : "border-border text-muted-foreground hover:bg-accent hover:text-foreground"
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
                onSelect={(date) => {
                  setDueDate(date ? format(date, "yyyy-MM-dd") : "");
                }}
                defaultMonth={dueDate ? parseISO(dueDate) : undefined}
              />
            </PopoverContent>
          </Popover>

          {/* Priority */}
          <Popover>
            <PopoverTrigger asChild>
              <button
                type="button"
                className={cn(
                  "flex items-center gap-1 rounded-md border px-2 py-1 text-xs transition-colors",
                  priority !== "none"
                    ? "border-current/20 bg-current/5"
                    : "border-border text-muted-foreground hover:bg-accent hover:text-foreground",
                  priority === "low" && "text-blue-500",
                  priority === "medium" && "text-yellow-500",
                  priority === "high" && "text-orange-500",
                  priority === "urgent" && "text-red-500"
                )}
              >
                <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M4 15s1-1 4-1 5 2 8 2 4-1 4-1V3s-1 1-4 1-5-2-8-2-4 1-4 1z" />
                  <line x1="4" x2="4" y1="22" y2="15" />
                </svg>
                {currentPriority.label === "None" ? "Priority" : currentPriority.label}
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
                    priority === p.value && "bg-accent font-medium"
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

          {/* List selector (only if multiple lists) */}
          {lists && lists.length > 1 && (
            <Popover>
              <PopoverTrigger asChild>
                <button
                  type="button"
                  className={cn(
                    "flex items-center gap-1 rounded-md border px-2 py-1 text-xs transition-colors",
                    selectedListId !== listId
                      ? "border-purple-500/30 bg-purple-500/10 text-purple-600 dark:text-purple-400"
                      : "border-border text-muted-foreground hover:bg-accent hover:text-foreground"
                  )}
                >
                  <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <line x1="8" x2="21" y1="6" y2="6" />
                    <line x1="8" x2="21" y1="12" y2="12" />
                    <line x1="8" x2="21" y1="18" y2="18" />
                    <line x1="3" x2="3.01" y1="6" y2="6" />
                    <line x1="3" x2="3.01" y1="12" y2="12" />
                    <line x1="3" x2="3.01" y1="18" y2="18" />
                  </svg>
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
                      selectedListId === list.id && "bg-accent font-medium"
                    )}
                  >
                    {list.isDefault ? (
                      <svg xmlns="http://www.w3.org/2000/svg" width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-primary">
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

          {/* Spacer + actions */}
          <div className="ml-auto flex items-center gap-1">
            <button
              type="button"
              onClick={() => setShowFullDialog(true)}
              className="flex items-center gap-1 rounded-md px-2 py-1 text-xs text-muted-foreground hover:bg-accent hover:text-foreground"
              title="Open full editor"
            >
              <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
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
