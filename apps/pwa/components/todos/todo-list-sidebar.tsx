"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";
import { cn } from "@/lib/utils";
import { useTodoLists } from "@/lib/api/todos";
import { CreateListDialog } from "./create-list-dialog";
import type { TodoList } from "@repo/core/types";

interface TodoListSidebarProps {
  onNavigate?: () => void;
}

export function TodoListSidebar({ onNavigate }: TodoListSidebarProps = {}) {
  const pathname = usePathname();
  const { data: lists, isLoading } = useTodoLists();
  const [showCreateDialog, setShowCreateDialog] = useState(false);

  const basePath = "/app/todos";

  const sortedLists = lists
    ? [...lists].sort((a, b) =>
        a.isDefault === b.isDefault ? 0 : a.isDefault ? -1 : 1,
      )
    : [];

  return (
    <div className="flex h-full w-full flex-col bg-card">
      <div className="sticky top-0 z-10 border-b border-border bg-card px-4 py-3">
        <h2 className="text-sm font-semibold text-foreground">Todos</h2>
      </div>

      <nav className="flex-1 space-y-1 overflow-y-auto p-2">
        {isLoading && (
          <div className="px-3 py-2 text-xs text-muted-foreground">
            Loading...
          </div>
        )}

        {/* Today */}
        <Link
          href={basePath}
          onClick={onNavigate}
          className={cn(
            "flex items-center gap-2 rounded-md px-3 py-2 text-sm font-medium transition-colors",
            pathname === basePath
              ? "bg-accent text-accent-foreground"
              : "text-muted-foreground hover:bg-accent hover:text-foreground",
          )}
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
            className="text-amber-500"
          >
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
          Today
        </Link>

        {/* Upcoming */}
        <Link
          href={`${basePath}/upcoming`}
          onClick={onNavigate}
          className={cn(
            "flex items-center gap-2 rounded-md px-3 py-2 text-sm font-medium transition-colors",
            pathname === `${basePath}/upcoming`
              ? "bg-accent text-accent-foreground"
              : "text-muted-foreground hover:bg-accent hover:text-foreground",
          )}
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
            className="text-blue-500"
          >
            <path d="M8 2v4" />
            <path d="M16 2v4" />
            <rect width="18" height="18" x="3" y="4" rx="2" />
            <path d="M3 10h18" />
            <path d="m14 14 2 2 4-4" />
          </svg>
          Upcoming
        </Link>

        {/* Inbox */}
        <Link
          href={`${basePath}/inbox`}
          onClick={onNavigate}
          className={cn(
            "flex items-center gap-2 rounded-md px-3 py-2 text-sm font-medium transition-colors",
            pathname === `${basePath}/inbox`
              ? "bg-accent text-accent-foreground"
              : "text-muted-foreground hover:bg-accent hover:text-foreground",
          )}
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
            className="text-primary"
          >
            <polyline points="22 12 16 12 14 15 10 15 8 12 2 12" />
            <path d="M5.45 5.11 2 12v6a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2v-6l-3.45-6.89A2 2 0 0 0 16.76 4H7.24a2 2 0 0 0-1.79 1.11z" />
          </svg>
          Inbox
        </Link>

        {/* Completed */}
        <Link
          href={`${basePath}/completed`}
          onClick={onNavigate}
          className={cn(
            "flex items-center gap-2 rounded-md px-3 py-2 text-sm font-medium transition-colors",
            pathname === `${basePath}/completed`
              ? "bg-accent text-accent-foreground"
              : "text-muted-foreground hover:bg-accent hover:text-foreground",
          )}
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
            className="text-green-500"
          >
            <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14" />
            <polyline points="22 4 12 14.01 9 11.01" />
          </svg>
          Completed
        </Link>

        <div className="mx-3 my-1.5 h-px bg-border" />

        <div className="flex items-center justify-between px-3 py-1.5">
          <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
            Lists
          </span>
          <button
            onClick={() => {
              setShowCreateDialog(true);
              onNavigate?.();
            }}
            className="flex h-5 w-5 items-center justify-center rounded text-muted-foreground hover:bg-accent hover:text-foreground"
            aria-label="Create list"
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
              <path d="M5 12h14" />
              <path d="M12 5v14" />
            </svg>
          </button>
        </div>

        {sortedLists
          .filter((list: TodoList) => !list.isDefault)
          .map((list: TodoList) => (
            <Link
              key={list.id}
              href={`${basePath}/${list.id}`}
              onClick={onNavigate}
              className={cn(
                "flex items-center gap-2 rounded-md px-3 py-2 text-sm font-medium transition-colors",
                pathname === `${basePath}/${list.id}`
                  ? "bg-accent text-accent-foreground"
                  : "text-muted-foreground hover:bg-accent hover:text-foreground",
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
