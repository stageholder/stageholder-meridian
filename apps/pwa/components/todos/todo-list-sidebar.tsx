"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";
import { cn } from "@/lib/utils";
import { useTodoLists } from "@/lib/api/todos";
import { useWorkspace } from "@/lib/workspace-context";
import { CreateListDialog } from "./create-list-dialog";
import type { TodoList } from "@repo/core/types";

export function TodoListSidebar() {
  const { workspace } = useWorkspace();
  const pathname = usePathname();
  const { data: lists, isLoading } = useTodoLists();
  const [showCreateDialog, setShowCreateDialog] = useState(false);

  return (
    <div className="flex h-full w-64 flex-col border-r border-border bg-card">
      <div className="flex items-center justify-between border-b border-border px-4 py-3">
        <h2 className="text-sm font-semibold text-foreground">Lists</h2>
        <button
          onClick={() => setShowCreateDialog(true)}
          className="flex h-7 w-7 items-center justify-center rounded-md text-muted-foreground hover:bg-accent hover:text-foreground"
          aria-label="Create list"
        >
          <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M5 12h14" />
            <path d="M12 5v14" />
          </svg>
        </button>
      </div>

      <nav className="flex-1 space-y-1 overflow-y-auto p-2">
        <Link
          href={`/${workspace.shortId}/todos`}
          className={cn(
            "flex items-center gap-2 rounded-md px-3 py-2 text-sm font-medium transition-colors",
            pathname === `/${workspace.shortId}/todos`
              ? "bg-accent text-accent-foreground"
              : "text-muted-foreground hover:bg-accent hover:text-foreground"
          )}
        >
          <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <rect width="18" height="18" x="3" y="3" rx="2" />
            <path d="m9 12 2 2 4-4" />
          </svg>
          All Todos
        </Link>

        {isLoading && (
          <div className="px-3 py-2 text-xs text-muted-foreground">Loading...</div>
        )}

        {lists?.map((list: TodoList) => (
          <Link
            key={list.id}
            href={`/${workspace.shortId}/todos/${list.id}`}
            className={cn(
              "flex items-center gap-2 rounded-md px-3 py-2 text-sm font-medium transition-colors",
              pathname === `/${workspace.shortId}/todos/${list.id}`
                ? "bg-accent text-accent-foreground"
                : "text-muted-foreground hover:bg-accent hover:text-foreground"
            )}
          >
            <span
              className="inline-block h-3 w-3 rounded-full"
              style={{ backgroundColor: list.color || "#6b7280" }}
            />
            {list.name}
          </Link>
        ))}

        {!isLoading && lists?.length === 0 && (
          <p className="px-3 py-4 text-center text-xs text-muted-foreground">
            No lists yet. Create one to get started.
          </p>
        )}
      </nav>

      <CreateListDialog
        open={showCreateDialog}
        onOpenChange={setShowCreateDialog}
      />
    </div>
  );
}
