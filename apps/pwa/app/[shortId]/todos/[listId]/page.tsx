"use client";

import { useParams } from "next/navigation";
import { TodoListSidebar } from "@/components/todos/todo-list-sidebar";
import { TodoListContent } from "@/components/todos/todo-list-content";
import { useTodoList } from "@/lib/api/todos";

export default function TodoListPage() {
  const params = useParams<{ listId: string }>();
  const listId = params.listId;
  const { data: list } = useTodoList(listId);

  return (
    <div className="flex h-[calc(100vh-7rem)]">
      <TodoListSidebar />

      <div className="flex-1 overflow-y-auto p-4">
        <TodoListContent
          listId={listId}
          listName={list?.name || "Loading..."}
          listColor={list?.color}
          showColorDot={!list?.isDefault}
        />
      </div>
    </div>
  );
}
