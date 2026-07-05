import { useEffect } from "react";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { View } from "@stageholder/ui";
import { TodoListContent } from "@/components/todos/todo-list-content";
import { useTodoList } from "@/lib/api/todos";

export const Route = createFileRoute("/_app/todos/$listId")({
  component: TodoListPage,
});

function TodoListPage() {
  const { listId } = Route.useParams();
  const navigate = useNavigate();
  const { data: list, isLoading, isError } = useTodoList(listId);

  // A deep link to a deleted/unknown list 404s. Bounce back to the todos home
  // rather than sit on a permanent "Loading…" header.
  useEffect(() => {
    if (isError) void navigate({ to: "/todos", replace: true });
  }, [isError, navigate]);

  return (
    <View flex={1} overflowY={"auto" as never} p="$4">
      <TodoListContent
        listId={listId}
        listName={list?.name ?? (isLoading ? "Loading…" : "")}
        listColor={list?.color}
        showColorDot={!list?.isDefault}
      />
    </View>
  );
}
