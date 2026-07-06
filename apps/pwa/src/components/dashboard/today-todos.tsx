import { TodayTodos as TodayTodosView } from "@repo/features/dashboard";
import { useAllTodos, useUpdateTodo } from "@/lib/api/todos";
import { useTodoStats } from "@/lib/hooks/use-todo-stats";
import type { Todo } from "@repo/core/types";

/**
 * PWA data wrapper: hooks `useAllTodos` + `useTodoStats` + `useUpdateTodo` and
 * renders the shared CONTENT-ONLY view. Card chrome + "View all" navigation are
 * owned by the host route's kit `Dashboard.Widget`.
 */
export function TodayTodos() {
  const { data: todos, isLoading } = useAllTodos();
  const { total, percentage } = useTodoStats();
  const updateTodo = useUpdateTodo();

  return (
    <TodayTodosView
      todos={todos ?? []}
      isLoading={isLoading}
      total={total}
      percentage={percentage}
      onToggleTodo={(todo: Todo) =>
        updateTodo.mutate({
          listId: todo.listId,
          todoId: todo.id,
          data: { status: "done" },
        })
      }
    />
  );
}
