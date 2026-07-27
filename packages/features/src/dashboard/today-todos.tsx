import { format } from "date-fns";
import { Text, View, XStack, YStack } from "@stageholder/ui";
import type { Todo } from "@repo/core/types";
import { tabularNums } from "../_internal/text-styles";

// Priority dot tokens. shadcn used per-color bg-{red/orange/yellow/blue};
// mapped onto the kit intent palette (urgent→destructive, high/medium→warning
// amber, low→primary azure). `as const` keeps the values literal so they
// satisfy strict color-prop typing.
const PRIORITY_COLORS = {
  urgent: "$destructive",
  high: "$warning",
  medium: "$warning",
  low: "$primary",
} as const;

/** Parse a `yyyy-MM-dd` or full ISO date string as the LOCAL day. */
function parseDateLocal(input: string): Date {
  const ymd = input.length >= 10 ? input.slice(0, 10) : input;
  return new Date(ymd + "T00:00:00");
}

export interface TodayTodosProps {
  /** All todos the host's data layer returns; the view filters to "today". */
  todos: Todo[];
  isLoading?: boolean;
  /** Total todo count today (used for the progress bar denominator). */
  total: number;
  /** Completion percentage today (0–100, used for the progress bar fill). */
  percentage: number;
  /** Toggle a todo to "done". The host wires the mutation. */
  onToggleTodo: (todo: Todo) => void;
}

/**
 * CONTENT-ONLY dashboard cell body — the progress bar + the first 5 due-today
 * todos as a checklist. Card chrome (title, "View all", grid position) is owned
 * by the host's kit `Dashboard.Widget`, so this renders no outer card. The view
 * owns the "due today" filter; the host supplies `todos` + derived
 * `total`/`percentage` + the toggle callback.
 */
export function TodayTodos({
  todos,
  isLoading,
  total,
  percentage,
  onToggleTodo,
}: TodayTodosProps) {
  const today = format(new Date(), "yyyy-MM-dd");

  const todayTodos = todos.filter((t) => {
    if (t.status === "done") return false;
    const dueDateStr = t.dueDate?.split("T")[0];
    const doDateStr = t.doDate?.split("T")[0];
    const hasDueToday = dueDateStr !== undefined && dueDateStr <= today;
    const hasDoToday = doDateStr !== undefined && doDateStr <= today;
    return hasDueToday || hasDoToday;
  });

  return (
    <YStack>
      {total > 0 ? (
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
          <Text fontSize="$1" color="$mutedForeground" style={tabularNums}>
            {percentage}%
          </Text>
        </XStack>
      ) : null}

      <YStack gap="$2">
        {isLoading ? (
          <Text fontSize="$1" color="$mutedForeground">
            Loading...
          </Text>
        ) : todayTodos.length > 0 ? (
          todayTodos.slice(0, 5).map((todo) => {
            const isOverdue = todo.dueDate
              ? parseDateLocal(todo.dueDate) < parseDateLocal(today)
              : false;
            const priorityColor =
              todo.priority &&
              PRIORITY_COLORS[todo.priority as keyof typeof PRIORITY_COLORS];
            return (
              <XStack key={todo.id} items="center" gap="$3">
                <View
                  onPress={() => onToggleTodo(todo)}
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
                  // No lingering blue focus ring after a tap (see todo-item).
                  focusStyle={{ outlineWidth: 0 }}
                  focusVisibleStyle={{ outlineWidth: 0 }}
                  role="checkbox"
                  aria-label="Mark as complete"
                />
                {priorityColor ? (
                  <View
                    height={8}
                    width={8}
                    shrink={0}
                    rounded={9999}
                    bg={priorityColor}
                  />
                ) : null}
                <Text flex={1} numberOfLines={1} fontSize="$3" color="$color">
                  {todo.title}
                </Text>
                {isOverdue ? (
                  <Text fontSize="$1" color="$destructive">
                    Overdue
                  </Text>
                ) : null}
              </XStack>
            );
          })
        ) : (
          <Text fontSize="$1" color="$mutedForeground">
            No todos due today. You&apos;re all caught up!
          </Text>
        )}
      </YStack>
    </YStack>
  );
}
