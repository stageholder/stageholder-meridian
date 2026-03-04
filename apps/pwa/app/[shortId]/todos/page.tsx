"use client";

import { useState } from "react";
import { TodoListSidebar } from "@/components/todos/todo-list-sidebar";
import { TodoItem } from "@/components/todos/todo-item";
import { QuickAddTodo } from "@/components/todos/quick-add-todo";
import { useTodoLists, useTodos } from "@/lib/api/todos";
import type { Todo } from "@repo/core/types";

export default function TodosPage() {
  const { data: lists } = useTodoLists();
  const firstListId = lists?.[0]?.id || "";
  const { data: todos, isLoading } = useTodos(firstListId);

  const pendingTodos = todos?.filter((t: Todo) => t.status !== "done") || [];
  const doneTodos = todos?.filter((t: Todo) => t.status === "done") || [];

  return (
    <div className="flex h-[calc(100vh-7rem)]">
      <TodoListSidebar />

      <div className="flex-1 overflow-y-auto p-4">
        {firstListId ? (
          <>
            <div className="mb-6">
              <h1 className="text-xl font-bold text-foreground">
                {lists?.[0]?.name || "Todos"}
              </h1>
              <p className="mt-1 text-sm text-muted-foreground">
                {pendingTodos.length} pending, {doneTodos.length} completed
              </p>
            </div>

            {isLoading ? (
              <div className="text-sm text-muted-foreground">Loading todos...</div>
            ) : (
              <div className="space-y-2">
                {pendingTodos.map((todo: Todo) => (
                  <TodoItem key={todo.id} todo={todo} listId={firstListId} />
                ))}
                {doneTodos.length > 0 && (
                  <div className="pt-4">
                    <h3 className="mb-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                      Completed ({doneTodos.length})
                    </h3>
                    {doneTodos.map((todo: Todo) => (
                      <TodoItem key={todo.id} todo={todo} listId={firstListId} />
                    ))}
                  </div>
                )}
                {pendingTodos.length === 0 && doneTodos.length === 0 && (
                  <div className="py-12 text-center">
                    <p className="text-sm text-muted-foreground">
                      No todos yet. Type below to add one.
                    </p>
                  </div>
                )}
              </div>
            )}

            <QuickAddTodo listId={firstListId} />
          </>
        ) : (
          <div className="flex h-full items-center justify-center">
            <div className="text-sm text-muted-foreground">Loading...</div>
          </div>
        )}
      </div>
    </div>
  );
}
