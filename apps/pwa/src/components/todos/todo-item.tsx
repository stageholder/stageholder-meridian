import { useState } from "react";
import { Trash2 } from "lucide-react";
import { IconButton, Text, View, XStack, YStack } from "@stageholder/ui";
import { parseDateLocal } from "@/lib/date";
import { useUpdateTodo, useDeleteTodo } from "@/lib/api/todos";
import { TodoDetailDialog } from "./todo-detail-dialog";
import { EmberBurst } from "./ember-burst";
import type { Todo } from "@repo/core/types";

// Priority badge intent tokens. The shadcn version used per-color
// bg-{c}-100/text-{c}-700 pairs; mapped onto the kit's intent palette:
// urgent→destructive, high/medium→warning (amber), low→primary (azure).
// `as const` keeps the values as literal token strings so they satisfy
// Tamagui's strict color-prop typing (arbitrary `string` is rejected).
const priorityConfig = {
  urgent: { label: "Urgent", bg: "$destructiveMuted", color: "$destructive" },
  high: { label: "High", bg: "$warningMuted", color: "$warning" },
  medium: { label: "Medium", bg: "$warningMuted", color: "$warning" },
  low: { label: "Low", bg: "$primaryMuted", color: "$primary" },
  none: { label: "", bg: "$muted", color: "$mutedForeground" },
} as const;

// The vivid completion-flash orange has no kit token; it lives only on the
// transient check animation, so it's applied via the `style` escape hatch.
const COMPLETING_EMBER = "oklch(0.72 0.22 40)";

interface TodoItemProps {
  todo: Todo;
  listId: string;
  /** When true, the item plays the check + exit animation (driven by parent) */
  isCompleting?: boolean;
}

export function TodoItem({
  todo,
  listId,
  isCompleting = false,
}: TodoItemProps) {
  const [detailOpen, setDetailOpen] = useState(false);
  const updateTodo = useUpdateTodo();
  const deleteTodo = useDeleteTodo();
  const isDone = todo.status === "done";
  const priority =
    priorityConfig[todo.priority as keyof typeof priorityConfig] ??
    priorityConfig.none;

  function handleToggle(e: { stopPropagation: () => void }) {
    e.stopPropagation();
    updateTodo.mutate({
      listId,
      todoId: todo.id,
      data: { status: isDone ? "todo" : "done" },
    });
  }

  function handleDelete(e: { stopPropagation: () => void }) {
    e.stopPropagation();
    deleteTodo.mutate({ listId, todoId: todo.id });
  }

  const formattedDueDate = todo.dueDate
    ? parseDateLocal(todo.dueDate).toLocaleDateString("en-US", {
        month: "short",
        day: "numeric",
      })
    : null;

  const formattedDoDate = todo.doDate
    ? parseDateLocal(todo.doDate).toLocaleDateString("en-US", {
        month: "short",
        day: "numeric",
      })
    : null;

  const isOverdue =
    todo.dueDate && !isDone && parseDateLocal(todo.dueDate) < new Date();

  return (
    <>
      <XStack
        group
        onPress={() => !isCompleting && setDetailOpen(true)}
        cursor="pointer"
        items="center"
        gap="$3"
        rounded="$lg"
        borderWidth={1}
        borderColor="$borderColor"
        bg="$card"
        px="$4"
        py="$3"
        transition="quick"
        hoverStyle={{ bg: "$accent" }}
        // allowlist: todo-item-completing — bespoke incinerate keyframe (no token equivalent)
        className={isCompleting ? "todo-item-completing" : undefined}
        role="button"
        aria-label="Open todo details"
      >
        <View position="relative" shrink={0}>
          <View
            onPress={handleToggle}
            width={20}
            height={20}
            items="center"
            justify="center"
            rounded={9999}
            borderWidth={2}
            transition="quick"
            // allowlist: todo-check-pop — bespoke check-pop keyframe (no token equivalent)
            className={isCompleting ? "todo-check-pop" : undefined}
            borderColor={isDone ? "$primary" : "$mutedForeground"}
            bg={isDone ? "$primary" : "transparent"}
            // Completion flash: vivid ember has no token, applied via style.
            style={
              isCompleting
                ? {
                    borderColor: COMPLETING_EMBER,
                    backgroundColor: COMPLETING_EMBER,
                  }
                : undefined
            }
            hoverStyle={
              !isCompleting && !isDone ? { borderColor: "$primary" } : undefined
            }
            role="checkbox"
            aria-checked={isDone || isCompleting}
            aria-label={isDone ? "Mark as incomplete" : "Mark as complete"}
          >
            {(isDone || isCompleting) && (
              // currentColor for the check stroke comes from this Text's color.
              <Text color="$primaryForeground" lineHeight={0}>
                <svg
                  // allowlist: todo-check-draw — bespoke check-draw keyframe (no token equivalent)
                  className={isCompleting ? "todo-check-draw" : ""}
                  xmlns="http://www.w3.org/2000/svg"
                  width="12"
                  height="12"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="3"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                >
                  <polyline points="20 6 9 17 4 12" />
                </svg>
              </Text>
            )}
          </View>
          {/* allowlist: todo-check-ring — bespoke check-ring keyframe (no token equivalent) */}
          {isCompleting && <span className="todo-check-ring" />}
          <EmberBurst active={isCompleting} />
        </View>

        <YStack flex={1} minW={0}>
          <Text
            fontSize="$3"
            fontWeight="500"
            color={isDone ? "$mutedForeground" : "$color"}
            textDecorationLine={isDone ? "line-through" : "none"}
          >
            {todo.title}
          </Text>
          {todo.description && (
            <Text
              mt="$0.5"
              fontSize="$1"
              color="$mutedForeground"
              numberOfLines={1}
            >
              {todo.description}
            </Text>
          )}
          {(priority.label ||
            formattedDueDate ||
            formattedDoDate ||
            (todo.subtasks && todo.subtasks.length > 0)) && (
            <XStack mt="$1.5" flexWrap="wrap" items="center" gap="$2">
              {priority.label && (
                <Text
                  bg={priority.bg}
                  color={priority.color}
                  rounded={9999}
                  px="$2"
                  py="$0.5"
                  fontSize="$1"
                  fontWeight="500"
                >
                  {priority.label}
                </Text>
              )}
              {formattedDueDate && (
                <XStack items="center" gap="$1">
                  <Text
                    color={isOverdue ? "$destructive" : "$mutedForeground"}
                    lineHeight={0}
                  >
                    <svg
                      xmlns="http://www.w3.org/2000/svg"
                      width="12"
                      height="12"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="2"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    >
                      <rect width="18" height="18" x="3" y="4" rx="2" ry="2" />
                      <line x1="16" x2="16" y1="2" y2="6" />
                      <line x1="8" x2="8" y1="2" y2="6" />
                      <line x1="3" x2="21" y1="10" y2="10" />
                    </svg>
                  </Text>
                  <Text
                    fontSize="$1"
                    color={isOverdue ? "$destructive" : "$mutedForeground"}
                  >
                    {formattedDueDate}
                  </Text>
                </XStack>
              )}
              {formattedDoDate && (
                <XStack items="center" gap="$1">
                  <Text color="$mutedForeground" lineHeight={0}>
                    <svg
                      xmlns="http://www.w3.org/2000/svg"
                      width="12"
                      height="12"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="2"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    >
                      <circle cx="12" cy="12" r="10" />
                      <polyline points="12 6 12 12 16 14" />
                    </svg>
                  </Text>
                  <Text fontSize="$1" color="$mutedForeground">
                    {formattedDoDate}
                  </Text>
                </XStack>
              )}
              {todo.subtasks && todo.subtasks.length > 0 && (
                <XStack items="center" gap="$1">
                  <Text color="$mutedForeground" lineHeight={0}>
                    <svg
                      xmlns="http://www.w3.org/2000/svg"
                      width="12"
                      height="12"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="2"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    >
                      <polyline points="9 11 12 14 22 4" />
                      <path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11" />
                    </svg>
                  </Text>
                  <Text fontSize="$1" color="$mutedForeground">
                    {todo.subtasks.filter((s) => s.status === "done").length}/
                    {todo.subtasks.length}
                  </Text>
                </XStack>
              )}
            </XStack>
          )}
        </YStack>

        <IconButton
          variant="ghost"
          size="sm"
          intent="danger"
          onPress={handleDelete}
          aria-label="Delete todo"
          opacity={0}
          transition="quick"
          $group-hover={{ opacity: 1 }}
        >
          <Trash2 size={14} />
        </IconButton>
      </XStack>

      <TodoDetailDialog
        open={detailOpen}
        onOpenChange={setDetailOpen}
        todo={todo}
        listId={listId}
      />
    </>
  );
}
