import { CheckSquare } from "lucide-react";
import { EmptyState } from "@stageholder/ui";
import { TodoItem } from "./todo-item";
import { QuickAddTodo } from "./quick-add-todo";
import { useTodos } from "@/lib/api/todos";
import { useAnimatedTodoList } from "@/lib/hooks/use-animated-todo-list";
import type { Todo } from "@repo/core/types";

interface TodoListContentProps {
  listId: string;
  listName: string;
  listColor?: string | null;
  showColorDot?: boolean;
}

export function TodoListContent({
  listId,
  listName,
  listColor,
  showColorDot,
}: TodoListContentProps) {
  const { data: todos, isLoading } = useTodos(listId);

  const pendingTodos = todos?.filter((t: Todo) => t.status !== "done") || [];
  const { visibleTodos, completingIds } = useAnimatedTodoList(pendingTodos);

  return (
    <>
      <div className="mb-6">
        <div className="flex items-center gap-3">
          {showColorDot && listColor && (
            <span
              className="inline-block h-4 w-4 rounded-full"
              style={{ backgroundColor: listColor }}
            />
          )}
          <div>
            <h1 className="text-xl font-bold text-foreground">{listName}</h1>
            <p className="mt-1 text-sm text-muted-foreground">
              {pendingTodos.length} todo{pendingTodos.length !== 1 ? "s" : ""}
            </p>
          </div>
        </div>
      </div>

      <QuickAddTodo listId={listId} />

      {isLoading ? (
        <div className="mt-3 text-sm text-muted-foreground">
          Loading todos...
        </div>
      ) : (
        <div className="mt-3 space-y-2">
          {visibleTodos.map((todo: Todo) => (
            <TodoItem
              key={todo.id}
              todo={todo}
              listId={listId}
              isCompleting={completingIds.has(todo.id)}
            />
          ))}
          {pendingTodos.length === 0 && (
            <EmptyState>
              <EmptyState.IconSlot>
                <CheckSquare className="size-5 text-muted-foreground" />
              </EmptyState.IconSlot>
              <EmptyState.Title>No todos yet</EmptyState.Title>
              <EmptyState.Description>Add one above!</EmptyState.Description>
            </EmptyState>
          )}
        </div>
      )}
    </>
  );
}
