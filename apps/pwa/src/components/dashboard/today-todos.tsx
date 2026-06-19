import { useNavigate } from "@tanstack/react-router";
import { TodayTodos as TodayTodosView } from "@repo/features/dashboard";
import { useAllTodos, useUpdateTodo } from "@/lib/api/todos";
import { useTodoStats } from "@/lib/hooks/use-todo-stats";
import type { Todo } from "@repo/core/types";

/**
 * PWA wrapper: hooks `useAllTodos` + `useTodoStats` + `useUpdateTodo`,
 * wires TanStack `useNavigate` to `onViewAll`, and renders the shared
 * cross-platform view.
 */
export function TodayTodos({
  index = 0,
  fill,
}: {
  index?: number;
  fill?: boolean;
}) {
  const navigate = useNavigate();
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
      onViewAll={() => void navigate({ to: "/todos" })}
      index={index}
      fill={fill}
    />
  );
}
