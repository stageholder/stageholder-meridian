"use client";

import { TodoListSidebar } from "@/components/todos/todo-list-sidebar";
import { InboxContent } from "@/components/todos/inbox-content";

export default function InboxPage() {
  return (
    <div className="flex h-[calc(100vh-7rem)]">
      <TodoListSidebar />

      <div className="flex-1 overflow-y-auto p-4">
        <InboxContent />
      </div>
    </div>
  );
}
