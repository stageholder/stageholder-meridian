// apps/mobile/components/todos/TodoRow.tsx
//
// One row in the todos list. SwipeableRow gives swipe-to-complete (left)
// and swipe-to-delete (right). The checkbox in the row is the primary
// "done" affordance for users who don't discover the swipe — both call
// the same mutations.
//
// Optimistic mutations from @/lib/api mean the UI updates instantly; if
// the API rejects the change, the previous state snapshot rolls back
// and a toast surfaces the error.

import {
  Checkbox,
  Paragraph,
  SwipeableRow,
  Text,
  View,
  XStack,
  YStack,
  useHaptic,
  useToast,
} from "@stageholder/ui";
import type { Todo } from "@repo/core/types";
import { useState } from "react";
import { Pressable } from "react-native";

import { EmberBurst } from "@/components/EmberBurst";
import { useDeleteTodo, useToggleTodo } from "@/lib/api";
import { localDateKey } from "@/lib/streak";

const PRIORITY_COLOR: Record<Todo["priority"], string> = {
  none: "#475569",
  low: "#64748b",
  medium: "#3b82f6",
  high: "#f59e0b",
  urgent: "#ef4444",
};

export type TodoRowProps = {
  todo: Todo;
  /** Tap the row body (not the checkbox) to open the detail sheet. */
  onPress?: (todo: Todo) => void;
};

export function TodoRow({ todo, onPress }: TodoRowProps) {
  const haptic = useHaptic();
  const toast = useToast();
  const toggle = useToggleTodo();
  const remove = useDeleteTodo();
  const [burstAt, setBurstAt] = useState<number | null>(null);

  const isDone = todo.status === "done";
  const dueLabel = todo.dueDate ? formatDue(todo.dueDate) : null;

  function complete() {
    if (!isDone) {
      haptic.notification("success");
      setBurstAt(Date.now());
    } else {
      haptic.impact("light");
    }
    toggle.mutate(todo, {
      onError: () => {
        toast.show({
          title: "Couldn't save",
          message: "Tap to retry.",
          intent: "danger",
        });
      },
    });
  }

  function handleDelete() {
    haptic.impact("medium");
    remove.mutate(todo.id, {
      onError: () => {
        toast.show({
          title: "Delete failed",
          message: "Restored. Tap to retry.",
          intent: "danger",
        });
      },
    });
  }

  return (
    <SwipeableRow
      rightActions={[
        { label: "Delete", color: "#ef4444", onPress: handleDelete },
      ]}
      leftActions={
        isDone ? [] : [{ label: "Done", color: "#22c55e", onPress: complete }]
      }
    >
      <XStack px="$4" py="$3" gap="$3" items="center" bg="$background">
        <View>
          <Checkbox size="$4" checked={isDone} onCheckedChange={complete}>
            <Checkbox.Indicator>
              <Text
                color="white"
                fontWeight="700"
                fontSize="$3"
                lineHeight="$1"
              >
                ✓
              </Text>
            </Checkbox.Indicator>
          </Checkbox>
          <EmberBurst
            trigger={burstAt}
            color={PRIORITY_COLOR[todo.priority]}
            x={12}
            y={12}
          />
        </View>

        {/* Row body is the tap target for the detail sheet — checkbox and
            swipe gestures sit outside it so they don't fight each other. */}
        <Pressable style={{ flex: 1 }} onPress={() => onPress?.(todo)}>
          <YStack gap={2}>
            <Text
              fontSize="$3"
              fontWeight={isDone ? "400" : "500"}
              color={isDone ? "$color10" : "$color12"}
              numberOfLines={1}
              style={
                isDone ? { textDecorationLine: "line-through" } : undefined
              }
            >
              {todo.title}
            </Text>
            {dueLabel ||
            todo.description ||
            (todo.subtasks?.length ?? 0) > 0 ? (
              <XStack gap="$2" items="center" flexWrap="wrap">
                {dueLabel ? (
                  <Text fontSize="$1" color="$color11">
                    {dueLabel}
                  </Text>
                ) : null}
                {(todo.subtasks?.length ?? 0) > 0 ? (
                  <Text fontSize="$1" color="$color11">
                    · {todo.subtasks!.filter((s) => s.status === "done").length}
                    /{todo.subtasks!.length}
                  </Text>
                ) : null}
                {todo.description ? (
                  <Paragraph
                    fontSize="$1"
                    color="$color11"
                    numberOfLines={1}
                    flex={1}
                  >
                    · {todo.description}
                  </Paragraph>
                ) : null}
              </XStack>
            ) : null}
          </YStack>
        </Pressable>

        {/* Priority dot — only shown for high/urgent open todos */}
        {(todo.priority === "high" || todo.priority === "urgent") && !isDone ? (
          <View
            width={6}
            height={6}
            rounded={3}
            bg={PRIORITY_COLOR[todo.priority] as never}
          />
        ) : null}
      </XStack>
    </SwipeableRow>
  );
}

function formatDue(due: string): string {
  const today = localDateKey();
  const tomorrow = (() => {
    const d = new Date();
    d.setDate(d.getDate() + 1);
    return localDateKey(d);
  })();
  if (due === today) return "Today";
  if (due === tomorrow) return "Tomorrow";
  const target = new Date(due);
  const diff = Math.round(
    (target.getTime() - new Date().setHours(0, 0, 0, 0)) / 86400000,
  );
  if (diff < 0)
    return `Overdue · ${target.toLocaleDateString(undefined, { month: "short", day: "numeric" })}`;
  if (diff < 7)
    return target.toLocaleDateString(undefined, { weekday: "long" });
  return target.toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
  });
}
