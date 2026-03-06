"use client";

import { TodoListSidebar } from "@/components/todos/todo-list-sidebar";
import { CompletedContent } from "@/components/todos/completed-content";

export default function CompletedPage() {
  return (
    <div className="flex h-[calc(100vh-7rem)]">
      <TodoListSidebar />

      <div className="flex-1 overflow-y-auto p-4">
        <CompletedContent />
      </div>
    </div>
  );
}
