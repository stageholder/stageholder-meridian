"use client";

import { TodoListSidebar } from "@/components/todos/todo-list-sidebar";
import { TodoListContent } from "@/components/todos/todo-list-content";
import { useTodoLists } from "@/lib/api/todos";

export default function TodosPage() {
  const { data: lists } = useTodoLists();
  const defaultList = lists?.[0];

  return (
    <div className="flex h-[calc(100vh-7rem)]">
      <TodoListSidebar />

      <div className="flex-1 overflow-y-auto p-4">
        {defaultList ? (
          <TodoListContent
            listId={defaultList.id}
            listName={defaultList.name || "Todos"}
          />
        ) : (
          <div className="flex h-full items-center justify-center">
            <div className="text-sm text-muted-foreground">Loading...</div>
          </div>
        )}
      </div>
    </div>
  );
}
