import { CheckSquare } from "lucide-react";
import {
  AnimatePresence,
  EmptyState,
  Text,
  View,
  XStack,
  YStack,
} from "@stageholder/ui";
import { TodoItem } from "./todo-item";
import { QuickAddTodo } from "./quick-add-todo";
import { CompletedSection } from "./completed-section";
import { useTodos } from "@/lib/api/todos";
import { TodoListSkeleton } from "./todo-list-skeleton";
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
  const completedTodos = todos?.filter((t: Todo) => t.status === "done") || [];

  return (
    <>
      <XStack mb="$6" items="center" gap="$3">
        {showColorDot && listColor && (
          <View
            width={16}
            height={16}
            rounded={9999}
            style={{ backgroundColor: listColor }}
          />
        )}
        <YStack>
          <Text fontSize="$7" fontWeight="700" color="$color">
            {listName}
          </Text>
          <Text mt="$1" fontSize="$3" color="$mutedForeground">
            {pendingTodos.length} todo{pendingTodos.length !== 1 ? "s" : ""}
          </Text>
        </YStack>
      </XStack>

      <QuickAddTodo listId={listId} />

      {isLoading ? (
        <TodoListSkeleton />
      ) : (
        <YStack mt="$3" gap="$0.5">
          <AnimatePresence>
            {pendingTodos.map((todo: Todo) => (
              <TodoItem key={todo.id} todo={todo} listId={listId} />
            ))}
          </AnimatePresence>
          {pendingTodos.length === 0 && completedTodos.length === 0 && (
            <EmptyState>
              <EmptyState.IconSlot>
                <Text color="$mutedForeground">
                  <CheckSquare size={20} />
                </Text>
              </EmptyState.IconSlot>
              <EmptyState.Title>No todos yet</EmptyState.Title>
              <EmptyState.Description>Add one above!</EmptyState.Description>
            </EmptyState>
          )}
          <CompletedSection todos={completedTodos} />
        </YStack>
      )}
    </>
  );
}
