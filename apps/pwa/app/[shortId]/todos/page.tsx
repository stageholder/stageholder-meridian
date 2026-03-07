"use client";

import { TodoListSidebar } from "@/components/todos/todo-list-sidebar";
import { TodayContent } from "@/components/todos/today-content";

export default function TodosPage() {
  return (
    <div className="flex h-full">
      <TodoListSidebar />

      <div className="flex-1 overflow-y-auto p-4">
        <TodayContent />
      </div>
    </div>
  );
}
