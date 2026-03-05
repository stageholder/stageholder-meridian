"use client";

import { TodoListSidebar } from "@/components/todos/todo-list-sidebar";
import { UpcomingContent } from "@/components/todos/upcoming-content";

export default function UpcomingPage() {
  return (
    <div className="flex h-[calc(100vh-7rem)]">
      <TodoListSidebar />

      <div className="flex-1 overflow-y-auto p-4">
        <UpcomingContent />
      </div>
    </div>
  );
}
