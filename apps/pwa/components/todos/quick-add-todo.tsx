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

  return (
    <>
      <form onSubmit={handleSubmit} className="mt-3 flex items-center gap-2">
        <input
          ref={inputRef}
          type="text"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="Add a todo..."
          className="flex-1 rounded-lg border border-border bg-background px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
        />
        <button
          type="button"
          onClick={() => setShowFullDialog(true)}
          className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-border text-muted-foreground hover:bg-accent hover:text-foreground"
          aria-label="Add todo with details"
          title="Add with details"
        >
          <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="m7 15 5 5 5-5" />
            <path d="m7 9 5-5 5 5" />
          </svg>
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
