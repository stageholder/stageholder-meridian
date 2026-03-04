"use client";

import { useState } from "react";
import { useParams } from "next/navigation";
import { TodoListSidebar } from "@/components/todos/todo-list-sidebar";
import { TodoItem } from "@/components/todos/todo-item";
import { CreateTodoDialog } from "@/components/todos/create-todo-dialog";
import { useTodoList, useTodos } from "@/lib/api/todos";
import type { Todo } from "@repo/core/types";

export default function TodoListPage() {
  const params = useParams<{ listId: string }>();
  const listId = params.listId;
  const { data: list } = useTodoList(listId);
  const { data: todos, isLoading } = useTodos(listId);
  const [showCreateTodo, setShowCreateTodo] = useState(false);

  const pendingTodos = todos?.filter((t: Todo) => t.status !== "done") || [];
  const doneTodos = todos?.filter((t: Todo) => t.status === "done") || [];

  return (
    <div className="flex h-[calc(100vh-7rem)]">
      <TodoListSidebar />

      <div className="flex-1 overflow-y-auto p-4">
        <div className="mb-6 flex items-center justify-between">
          <div className="flex items-center gap-3">
            {list?.color && (
              <span
                className="inline-block h-4 w-4 rounded-full"
                style={{ backgroundColor: list.color }}
              />
            )}
            <div>
              <h1 className="text-xl font-bold text-foreground">
                {list?.name || "Loading..."}
              </h1>
              <p className="mt-1 text-sm text-muted-foreground">
                {pendingTodos.length} pending, {doneTodos.length} completed
              </p>
            </div>
          </div>
          <button
            onClick={() => setShowCreateTodo(true)}
            className="flex items-center gap-2 rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90"
          >
            <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M5 12h14" />
              <path d="M12 5v14" />
            </svg>
            Add Todo
          </button>
        </div>

        {isLoading ? (
          <div className="text-sm text-muted-foreground">Loading todos...</div>
        ) : (
          <div className="space-y-2">
            {pendingTodos.map((todo: Todo) => (
              <TodoItem key={todo.id} todo={todo} listId={listId} />
            ))}
            {doneTodos.length > 0 && (
              <div className="pt-4">
                <h3 className="mb-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                  Completed ({doneTodos.length})
                </h3>
                {doneTodos.map((todo: Todo) => (
                  <TodoItem key={todo.id} todo={todo} listId={listId} />
                ))}
              </div>
            )}
            {pendingTodos.length === 0 && doneTodos.length === 0 && (
              <div className="py-12 text-center">
                <p className="text-sm text-muted-foreground">
                  No todos in this list. Add one to get started.
                </p>
              </div>
            )}
          </div>
        )}

        <CreateTodoDialog
          open={showCreateTodo}
          onOpenChange={setShowCreateTodo}
          listId={listId}
        />
      </div>
    </div>
  );
}
