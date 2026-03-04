"use client";

import { useRef, useState } from "react";
import { useCreateTodo } from "@/lib/api/todos";
import { CreateTodoDialog } from "./create-todo-dialog";
import { toast } from "sonner";

interface QuickAddTodoProps {
  listId: string;
}

export function QuickAddTodo({ listId }: QuickAddTodoProps) {
  const [title, setTitle] = useState("");
  const [isEditing, setIsEditing] = useState(false);
  const [showFullDialog, setShowFullDialog] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const createTodo = useCreateTodo();

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!title.trim() || createTodo.isPending) return;

    createTodo.mutate(
      { listId, data: { title: title.trim() } },
      {
        onSuccess: () => {
          setTitle("");
          inputRef.current?.focus();
        },
        onError: () => {
          toast.error("Failed to create todo");
        },
      }
    );
  }

  function handleActivate() {
    setIsEditing(true);
    setTimeout(() => inputRef.current?.focus(), 0);
  }

  function handleBlur() {
    if (!title.trim()) {
      setIsEditing(false);
    }
  }

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
      <form onSubmit={handleSubmit} className="flex items-center gap-2">
        <div className="relative flex-1">
          <input
            ref={inputRef}
            type="text"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            onBlur={handleBlur}
            placeholder="Add a todo..."
            className="w-full rounded-lg border border-border bg-background px-3 py-2 pr-16 text-sm text-foreground placeholder:text-muted-foreground focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
          />
          {title.trim() && (
            <span className="pointer-events-none absolute right-2 top-1/2 -translate-y-1/2 flex items-center gap-1 text-xs text-muted-foreground">
              <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <polyline points="9 10 4 15 9 20" />
                <path d="M20 4v7a4 4 0 0 1-4 4H4" />
              </svg>
              Enter
            </span>
          )}
        </div>
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
      </form>

      <CreateTodoDialog
        open={showFullDialog}
        onOpenChange={setShowFullDialog}
        listId={listId}
      />
    </>
  );
}
