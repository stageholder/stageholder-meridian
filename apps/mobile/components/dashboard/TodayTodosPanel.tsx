// apps/mobile/components/dashboard/TodayTodosPanel.tsx
//
// Inline panel for the Today dashboard. Mirrors PWA's TodayTodos
// (apps/pwa/components/dashboard/today-todos.tsx):
//   - Shows open todos due/do today (or earlier — overdue)
//   - Caps at 5 rows, with "+N more" if there are more
//   - Tap the circle to mark done (optimistic via useToggleTodo)
//   - Tap the row body to navigate to the full Todos screen
//
// Differences vs PWA panel:
//   - No inline progress bar (the activity ring already shows this; one
//     visualization is enough on a small screen).
//   - Uses Tamagui Pressable + Card from @stageholder/ui — same chrome as
//     the rest of the dashboard.

import {
  Card,
  Paragraph,
  Text,
  View,
  XStack,
  YStack,
  useHaptic,
  useToast,
} from "@stageholder/ui";
import type { Todo } from "@repo/core/types";
import { useRouter } from "expo-router";
import { useMemo } from "react";
import { Pressable } from "react-native";

import { useToggleTodo, useTodos } from "@/lib/api";
import { localDateKey } from "@/lib/streak";

const PRIORITY_COLOR: Record<Todo["priority"], string | null> = {
  none: null,
  low: "#60a5fa", // blue-400
  medium: "#eab308", // yellow-500
  high: "#f97316", // orange-500
  urgent: "#ef4444", // red-500
};

const MAX_VISIBLE = 5;

export function TodayTodosPanel() {
  const todosQuery = useTodos();
  const toggle = useToggleTodo();
  const router = useRouter();
  const haptic = useHaptic();
  const toast = useToast();

  const today = localDateKey();

  const todayTodos = useMemo(() => {
    const todos = todosQuery.data ?? [];
    return todos
      .filter((t) => {
        if (t.status === "done") return false;
        const due = t.dueDate?.slice(0, 10);
        const doD = t.doDate?.slice(0, 10);
        const hasDue = due !== undefined && due <= today;
        const hasDo = doD !== undefined && doD <= today;
        return hasDue || hasDo;
      })
      .sort((a, b) => {
        // Overdue first, then by priority desc, then by due date asc.
        const aOver = !!a.dueDate && a.dueDate.slice(0, 10) < today;
        const bOver = !!b.dueDate && b.dueDate.slice(0, 10) < today;
        if (aOver !== bOver) return aOver ? -1 : 1;
        const pri = priRank(b.priority) - priRank(a.priority);
        if (pri !== 0) return pri;
        const aDue = a.dueDate ?? "9999-99-99";
        const bDue = b.dueDate ?? "9999-99-99";
        return aDue.localeCompare(bDue);
      });
  }, [todosQuery.data, today]);

  const visible = todayTodos.slice(0, MAX_VISIBLE);
  const overflow = Math.max(0, todayTodos.length - MAX_VISIBLE);

  function handleToggle(todo: Todo) {
    haptic.notification("success");
    toggle.mutate(todo, {
      onError: () => {
        toast.show({
          title: "Couldn't save",
          message: "Reverted. Tap to retry.",
          intent: "danger",
        });
      },
    });
  }

  return (
    <Card>
      <Card.Header>
        <XStack items="center" justify="space-between">
          <YStack gap="$1">
            <Paragraph
              fontFamily="$mono"
              fontSize={10}
              letterSpacing={1.6}
              textTransform="uppercase"
              color="$color11"
              fontWeight="600"
            >
              {todayTodos.length === 0
                ? "All caught up"
                : `${todayTodos.length} due`}
            </Paragraph>
            <Paragraph fontSize="$3" color="$color12" fontWeight="500">
              Today's todos
            </Paragraph>
          </YStack>
          <Pressable onPress={() => router.push("/todos")}>
            <Text fontSize="$1" color="$color11" fontWeight="500">
              View all ›
            </Text>
          </Pressable>
        </XStack>
      </Card.Header>
      <Card.Body gap="$2">
        {todosQuery.isLoading ? (
          <Paragraph fontSize="$2" color="$color11" py="$2">
            Loading…
          </Paragraph>
        ) : todayTodos.length === 0 ? (
          <Paragraph fontSize="$2" color="$color11" py="$2">
            No todos due today. You're all caught up.
          </Paragraph>
        ) : (
          <>
            {visible.map((todo) => {
              const isOverdue =
                !!todo.dueDate && todo.dueDate.slice(0, 10) < today;
              const dot = PRIORITY_COLOR[todo.priority];
              return (
                <XStack key={todo.id} items="center" gap="$3" py="$1">
                  <Pressable onPress={() => handleToggle(todo)} hitSlop={8}>
                    <View
                      width={18}
                      height={18}
                      rounded={9}
                      borderWidth={2}
                      borderColor={"$color8" as never}
                    />
                  </Pressable>
                  {dot ? (
                    <View width={6} height={6} rounded={3} bg={dot as never} />
                  ) : null}
                  <Pressable
                    style={{ flex: 1 }}
                    onPress={() => router.push("/todos")}
                  >
                    <Text fontSize="$3" color="$color12" numberOfLines={1}>
                      {todo.title}
                    </Text>
                  </Pressable>
                  {isOverdue ? (
                    <Text fontSize="$1" color="$red11" fontWeight="600">
                      Overdue
                    </Text>
                  ) : null}
                </XStack>
              );
            })}
            {overflow > 0 ? (
              <Pressable onPress={() => router.push("/todos")}>
                <Paragraph fontSize="$1" color="$color11" pt="$1">
                  + {overflow} more
                </Paragraph>
              </Pressable>
            ) : null}
          </>
        )}
      </Card.Body>
    </Card>
  );
}

function priRank(p: Todo["priority"]): number {
  return p === "urgent"
    ? 4
    : p === "high"
      ? 3
      : p === "medium"
        ? 2
        : p === "low"
          ? 1
          : 0;
}
