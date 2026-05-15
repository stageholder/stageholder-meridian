import { createFileRoute } from "@tanstack/react-router";
import { TodoListContent } from "@/components/todos/todo-list-content";
import { useTodoList } from "@/lib/api/todos";

export const Route = createFileRoute("/_app/todos/$listId")({
  component: TodoListPage,
});

function TodoListPage() {
  const { listId } = Route.useParams();
  const { data: list } = useTodoList(listId);

  return (
    <div className="flex-1 overflow-y-auto p-4">
      <TodoListContent
        listId={listId}
        listName={list?.name || "Loading..."}
        listColor={list?.color}
        showColorDot={!list?.isDefault}
      />
    </div>
  );
}
