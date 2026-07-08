import { format } from "date-fns";
import { AnimatePresence, Skeleton, Text, YStack } from "@stageholder/ui";
import { TodoItem } from "@/components/todos/todo-item";
import { useAllTodos } from "@/lib/api/todos";
import type { Todo } from "@repo/core/types";

const MAX_ROWS = 5;

/**
 * Today's todos on the dashboard — the SAME real `TodoItem` used on the /todos
 * Today page (checkbox + burn animation, actions menu, detail dialog), in its
 * `compact` variant so it fits the widget. Shows overdue + due-today, overdue
 * first, capped at {@link MAX_ROWS}. "View all" nav is owned by the host
 * `Dashboard.Widget`.
 */
export function TodayTodos() {
  const { data: todos, isLoading } = useAllTodos();
  const today = format(new Date(), "yyyy-MM-dd");

  if (isLoading) {
    return (
      <YStack gap="$2">
        {Array.from({ length: 3 }, (_, i) => (
          <Skeleton key={i} height={28} width="100%" rounded="$3" />
        ))}
      </YStack>
    );
  }

  // Same today/overdue rule as the real Today page (today-content.tsx).
  const dueByToday = (todos ?? []).filter((t: Todo) => {
    if (t.status === "done") return false;
    const due = t.dueDate?.split("T")[0];
    const doDate = t.doDate?.split("T")[0];
    return (!!due && due <= today) || (!!doDate && doDate <= today);
  });
  const isOverdue = (t: Todo) => {
    const due = t.dueDate?.split("T")[0];
    const doDate = t.doDate?.split("T")[0];
    return (!!due && due < today) || (!!doDate && doDate < today);
  };
  const ordered = [
    ...dueByToday.filter(isOverdue),
    ...dueByToday.filter((t) => !isOverdue(t)),
  ];
  const shown = ordered.slice(0, MAX_ROWS);

  if (shown.length === 0) {
    return (
      <YStack py="$4" items="center">
        <Text fontSize="$2" color="$mutedForeground">
          Nothing due today — you&apos;re all caught up!
        </Text>
      </YStack>
    );
  }

  return (
    <YStack gap="$2">
      <AnimatePresence>
        {shown.map((todo) => (
          <TodoItem
            key={todo.id}
            todo={todo}
            listId={todo.listId}
            showList
            compact
          />
        ))}
      </AnimatePresence>
      {ordered.length > shown.length ? (
        <Text mt="$1.5" ml="$2.5" fontSize="$1" color="$mutedForeground">
          +{ordered.length - shown.length} more
        </Text>
      ) : null}
    </YStack>
  );
}
