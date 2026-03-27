"use client";

import { useState, useEffect } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { useCreateTodo, useTodoLists } from "@/lib/api/todos";
import { DatePicker } from "@/components/ui/date-picker";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { toast } from "sonner";
import { format, addDays, nextMonday } from "date-fns";
import { cn } from "@/lib/utils";

interface CreateTodoDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  listId?: string;
  defaultDueDate?: string;
}

export function CreateTodoDialog({
  open,
  onOpenChange,
  listId,
  defaultDueDate,
}: CreateTodoDialogProps) {
  const [selectedListId, setSelectedListId] = useState(listId || "");
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [priority, setPriority] = useState("none");
  const [dueDate, setDueDate] = useState(defaultDueDate || "");
  const [doDate, setDoDate] = useState(format(new Date(), "yyyy-MM-dd"));
  const queryClient = useQueryClient();
  const createTodo = useCreateTodo();
  const { data: lists } = useTodoLists();

  const defaultListId =
    lists?.find((l) => l.isDefault)?.id || lists?.[0]?.id || "";

  useEffect(() => {
    if (open) {
      setSelectedListId(listId || defaultListId);
      if (defaultDueDate) setDueDate(defaultDueDate);
    }
  }, [open, listId, defaultDueDate, defaultListId]);

  // Ensure selectedListId is always valid when lists are loaded
  useEffect(() => {
    if (open && !selectedListId && defaultListId) {
      setSelectedListId(defaultListId);
    }
  }, [open, selectedListId, defaultListId]);

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!title.trim()) return;

    createTodo.mutate(
      {
        listId: selectedListId || defaultListId,
        data: {
          title: title.trim(),
          description: description.trim() || undefined,
          priority,
          dueDate: dueDate || undefined,
          doDate: doDate || undefined,
        },
      },
      {
        onSuccess: () => {
          toast.success("Todo created");
          setTitle("");
          setDescription("");
          setPriority("none");
          setDueDate("");
          setDoDate(format(new Date(), "yyyy-MM-dd"));
          onOpenChange(false);
          void queryClient.invalidateQueries({ queryKey: ["calendar"] });
        },
        onError: () => {
          toast.error("Failed to create todo");
        },
      },
    );
  }

  useEffect(() => {
    if (!open) return;
    function onKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") {
        e.stopPropagation();
        onOpenChange(false);
      }
    }
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [open, onOpenChange]);

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
        className="relative z-50 mx-4 w-full max-w-md rounded-xl border border-border bg-card p-4 shadow-lg sm:p-6 max-h-[90vh] overflow-y-auto"
      >
        <h2 className="text-lg font-semibold text-foreground">New Todo</h2>
        <form onSubmit={handleSubmit} className="mt-4 space-y-4">
          {lists && lists.length > 1 && (
            <div>
              <label className="block text-sm font-medium text-foreground">
                List
              </label>
              <div className="mt-1">
                <Select
                  value={selectedListId || defaultListId}
                  onValueChange={setSelectedListId}
                >
                  <SelectTrigger className="w-full rounded-lg border-border bg-background">
                    <SelectValue placeholder="Select list" />
                  </SelectTrigger>
                  <SelectContent>
                    {lists.map((list) => (
                      <SelectItem key={list.id} value={list.id}>
                        <span className="flex items-center gap-2">
                          <span className="flex h-3 w-3 shrink-0 items-center justify-center">
                            {list.isDefault ? (
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
                                className="text-primary"
                              >
                                <polyline points="22 12 16 12 14 15 10 15 8 12 2 12" />
                                <path d="M5.45 5.11 2 12v6a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2v-6l-3.45-6.89A2 2 0 0 0 16.76 4H7.24a2 2 0 0 0-1.79 1.11z" />
                              </svg>
                            ) : (
                              <span
                                className="h-2 w-2 rounded-full"
                                style={{
                                  backgroundColor: list.color || "#6b7280",
                                }}
                              />
                            )}
                          </span>
                          {list.name}
                        </span>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
          )}

          <div>
            <label
              htmlFor="todo-title"
              className="block text-sm font-medium text-foreground"
            >
              Title
            </label>
            <input
              id="todo-title"
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="What needs to be done?"
              className="mt-1 block w-full rounded-lg border border-border bg-background px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
              autoFocus
            />
          </div>

          <div>
            <label
              htmlFor="todo-description"
              className="block text-sm font-medium text-foreground"
            >
              Description
            </label>
            <textarea
              id="todo-description"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Add details..."
              rows={3}
              className="mt-1 block w-full rounded-lg border border-border bg-background px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-foreground">
              Priority
            </label>
            <div className="mt-1">
              <Select value={priority} onValueChange={setPriority}>
                <SelectTrigger className="w-full rounded-lg border-border bg-background">
                  <SelectValue placeholder="None" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">None</SelectItem>
                  <SelectItem value="low">
                    <span className="flex items-center gap-2">
                      <span className="h-2 w-2 rounded-full bg-blue-500" />
                      Low
                    </span>
                  </SelectItem>
                  <SelectItem value="medium">
                    <span className="flex items-center gap-2">
                      <span className="h-2 w-2 rounded-full bg-yellow-500" />
                      Medium
                    </span>
                  </SelectItem>
                  <SelectItem value="high">
                    <span className="flex items-center gap-2">
                      <span className="h-2 w-2 rounded-full bg-orange-500" />
                      High
                    </span>
                  </SelectItem>
                  <SelectItem value="urgent">
                    <span className="flex items-center gap-2">
                      <span className="h-2 w-2 rounded-full bg-red-500" />
                      Urgent
                    </span>
                  </SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="space-y-3">
            <div>
              <div className="flex flex-col gap-1.5 sm:flex-row sm:items-center sm:gap-3">
                <label className="block text-sm font-medium text-foreground sm:w-20 sm:shrink-0">
                  Due Date
                </label>
                <div className="flex-1">
                  <DatePicker
                    value={dueDate}
                    onChange={setDueDate}
                    placeholder="No due date"
                  />
                </div>
              </div>
              <div className="mt-1.5 sm:ml-[calc(5rem+0.75rem)] flex flex-wrap gap-1.5">
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
              </div>
            </div>

            <div>
              <div className="flex flex-col gap-1.5 sm:flex-row sm:items-center sm:gap-3">
                <label className="block text-sm font-medium text-foreground sm:w-20 sm:shrink-0">
                  Do Date
                </label>
                <div className="flex-1">
                  <DatePicker
                    value={doDate}
                    onChange={setDoDate}
                    placeholder="No do date"
                  />
                </div>
              </div>
              <div className="mt-1.5 sm:ml-[calc(5rem+0.75rem)] flex flex-wrap gap-1.5">
                {[
                  { label: "Today", date: new Date() },
                  { label: "Tomorrow", date: addDays(new Date(), 1) },
                  { label: "Next Week", date: nextMonday(new Date()) },
                ].map((shortcut) => {
                  const iso = format(shortcut.date, "yyyy-MM-dd");
                  const isActive = doDate === iso;
                  return (
                    <button
                      key={`do-${shortcut.label}`}
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
              </div>
            </div>
          </div>

          <div className="flex justify-end gap-3 pt-2">
            <button
              type="button"
              onClick={() => onOpenChange(false)}
              className="rounded-lg border border-border px-4 py-2 text-sm font-medium text-foreground hover:bg-accent"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={!title.trim() || createTodo.isPending}
              className="rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
            >
              {createTodo.isPending ? "Creating..." : "Create"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
