import { Link } from "@tanstack/react-router";
import { format } from "date-fns";
import { Text, View, XStack, YStack } from "@stageholder/ui";
import { parseDateLocal } from "@/lib/date";
import { useAllTodos, useUpdateTodo } from "@/lib/api/todos";
import { useTodoStats } from "@/lib/hooks/use-todo-stats";
import { BentoCard } from "./bento-card";
import type { Todo } from "@repo/core/types";

// Priority dot tokens. shadcn used per-color bg-{red/orange/yellow/blue};
// mapped onto the kit intent palette (urgent→destructive, high/medium→warning
// amber, low→primary azure) — same mapping as todo-item.tsx. `as const` keeps
// the values literal so they satisfy strict color-prop typing.
const PRIORITY_COLORS = {
  urgent: "$destructive",
  high: "$warning",
  medium: "$warning",
  low: "$primary",
} as const;

export function TodayTodos({
  index = 0,
  className,
}: {
  index?: number;
  className?: string;
}) {
  const { data: todos, isLoading } = useAllTodos();
  const { total, percentage } = useTodoStats();
  const updateTodo = useUpdateTodo();

  const today = format(new Date(), "yyyy-MM-dd");

  const todayTodos = (todos || []).filter((t: Todo) => {
    if (t.status === "done") return false;
    const dueDateStr = t.dueDate?.split("T")[0];
    const doDateStr = t.doDate?.split("T")[0];
    const hasDueToday = dueDateStr !== undefined && dueDateStr <= today;
    const hasDoToday = doDateStr !== undefined && doDateStr <= today;
    return hasDueToday || hasDoToday;
  });

  function handleToggle(todo: Todo) {
    updateTodo.mutate({
      listId: todo.listId,
      todoId: todo.id,
      data: { status: "done" },
    });
  }

  return (
    <BentoCard
      title="Today's Todos"
      href="/todos"
      index={index}
      className={className}
      action={
        <XStack items="center" gap="$2">
          {total > 0 && (
            <Text
              rounded={9999}
              bg="$muted"
              px="$2"
              py="$0.5"
              fontSize="$1"
              fontWeight="500"
              color="$mutedForeground"
            >
              {todayTodos.length} due
            </Text>
          )}
          <Link to="/todos" style={{ textDecoration: "none" }}>
            <Text
              fontSize="$1"
              color="$primary"
              hoverStyle={{ textDecorationLine: "underline" }}
            >
              View all
            </Text>
          </Link>
        </XStack>
      }
    >
      {total > 0 && (
        <XStack mb="$3" items="center" gap="$2">
          <View height={6} flex={1} rounded={9999} bg="$muted">
            <View
              height="100%"
              rounded={9999}
              bg="$primary"
              transition="medium"
              style={{ width: `${percentage}%` }}
            />
          </View>
          <Text
            fontSize="$1"
            color="$mutedForeground"
            style={{ fontVariant: ["tabular-nums"] }}
          >
            {percentage}%
          </Text>
        </XStack>
      )}

      <YStack gap="$2">
        {isLoading ? (
          <Text fontSize="$1" color="$mutedForeground">
            Loading...
          </Text>
        ) : todayTodos.length > 0 ? (
          todayTodos.slice(0, 5).map((todo: Todo) => {
            const isOverdue = todo.dueDate
              ? parseDateLocal(todo.dueDate) < parseDateLocal(today)
              : false;
            const priorityColor =
              todo.priority &&
              PRIORITY_COLORS[todo.priority as keyof typeof PRIORITY_COLORS];
            return (
              <XStack key={todo.id} items="center" gap="$3">
                <View
                  onPress={() => handleToggle(todo)}
                  height={16}
                  width={16}
                  shrink={0}
                  items="center"
                  justify="center"
                  rounded={9999}
                  borderWidth={2}
                  borderColor="$mutedForeground"
                  cursor="pointer"
                  transition="quick"
                  hoverStyle={{ borderColor: "$primary" }}
                  role="checkbox"
                  aria-label="Mark as complete"
                />
                {priorityColor && (
                  <View
                    height={8}
                    width={8}
                    shrink={0}
                    rounded={9999}
                    bg={priorityColor}
                  />
                )}
                <Text flex={1} numberOfLines={1} fontSize="$3" color="$color">
                  {todo.title}
                </Text>
                {isOverdue && (
                  <Text fontSize="$1" color="$destructive">
                    Overdue
                  </Text>
                )}
              </XStack>
            );
          })
        ) : (
          <Text fontSize="$1" color="$mutedForeground">
            No todos due today. You&apos;re all caught up!
          </Text>
        )}
      </YStack>
    </BentoCard>
  );
}
