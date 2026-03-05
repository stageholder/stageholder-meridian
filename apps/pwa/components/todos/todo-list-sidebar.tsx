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

  const sortedLists = lists
    ? [...lists].sort((a, b) =>
        a.isDefault === b.isDefault ? 0 : a.isDefault ? -1 : 1
      )
    : [];

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
        {isLoading && (
          <div className="px-3 py-2 text-xs text-muted-foreground">Loading...</div>
        )}

        <Link
          href={`/${workspace.shortId}/todos`}
          className={cn(
            "flex items-center gap-2 rounded-md px-3 py-2 text-sm font-medium transition-colors",
            pathname === `/${workspace.shortId}/todos`
              ? "bg-accent text-accent-foreground"
              : "text-muted-foreground hover:bg-accent hover:text-foreground"
          )}
        >
          <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-primary">
            <polyline points="22 12 16 12 14 15 10 15 8 12 2 12" />
            <path d="M5.45 5.11 2 12v6a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2v-6l-3.45-6.89A2 2 0 0 0 16.76 4H7.24a2 2 0 0 0-1.79 1.11z" />
          </svg>
          Inbox
        </Link>

        {sortedLists.filter((list: TodoList) => !list.isDefault).map((list: TodoList) => (
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
            <span className="flex h-4 w-4 shrink-0 items-center justify-center">
              <span
                className="inline-block h-3 w-3 rounded-full"
                style={{ backgroundColor: list.color || "#6b7280" }}
              />
            </span>
            {list.name}
          </Link>
        ))}
      </nav>

      <CreateListDialog
        open={showCreateDialog}
        onOpenChange={setShowCreateDialog}
      />
    </div>
  );
}
