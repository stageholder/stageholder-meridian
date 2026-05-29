import { useState } from "react";
import { TodoItem as TodoItemView } from "@repo/features/todos";
import type { Todo } from "@repo/core/types";
import { useUpdateTodo, useDeleteTodo } from "@/lib/api/todos";
import { TodoDetailDialog } from "./todo-detail-dialog";

interface TodoItemProps {
  todo: Todo;
  listId: string;
}

/**
 * PWA wrapper: hooks `useUpdateTodo` + `useDeleteTodo`, manages the
 * detail-dialog open state, and renders the shared cross-platform view.
 *
 * The view owns the burn-then-mutate timing (presentation concern); this
 * wrapper just supplies the mutation calls. The detail dialog stays
 * here — it's a heavy interactive surface that will get its own lift
 * later if/when mobile needs the same UX.
 */
export function TodoItem({ todo, listId }: TodoItemProps) {
  const [detailOpen, setDetailOpen] = useState(false);
  const updateTodo = useUpdateTodo();
  const deleteTodo = useDeleteTodo();

  const isDone = todo.status === "done";

  return (
    <>
      <TodoItemView
        todo={todo}
        onToggle={() =>
          updateTodo.mutate({
            listId,
            todoId: todo.id,
            data: { status: isDone ? "todo" : "done" },
          })
        }
        onDelete={() => deleteTodo.mutate({ listId, todoId: todo.id })}
        onOpenDetail={() => setDetailOpen(true)}
      />
      <TodoDetailDialog
        open={detailOpen}
        onOpenChange={setDetailOpen}
        todo={todo}
        listId={listId}
      />
    </>
  );
}
