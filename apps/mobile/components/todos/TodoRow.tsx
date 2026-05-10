// apps/mobile/components/todos/TodoRow.tsx
//
// One row in the todos list. SwipeableRow gives us swipe-to-complete on
// the left and swipe-to-delete on the right. The checkbox in the row
// itself is the primary "done" affordance for users who don't discover
// the swipe — the swipe is a power-user shortcut. Both fire haptic +
// EmberBurst on completion.

import {
  Checkbox,
  Paragraph,
  SwipeableRow,
  Text,
  View,
  XStack,
  YStack,
  useHaptic,
} from "@stageholder/ui";
import { useState } from "react";

import { EmberBurst } from "@/components/EmberBurst";
import { dateKey, fromDateKey, type Todo } from "@/lib/types";

const PRIORITY_COLOR: Record<Todo["priority"], string> = {
  low: "#64748b",
  normal: "#3b82f6",
  high: "#ef4444",
};

export type TodoRowProps = {
  todo: Todo;
  onToggle: (id: string) => void;
  onDelete: (id: string) => void;
};

export function TodoRow({ todo, onToggle, onDelete }: TodoRowProps) {
  const haptic = useHaptic();
  const [burstAt, setBurstAt] = useState<number | null>(null);
  const isDone = !!todo.completedAt;
  const dueLabel = todo.dueDate ? formatDue(todo.dueDate) : null;

  function complete() {
    if (!isDone) {
      haptic.notification("success");
      setBurstAt(Date.now());
    } else {
      haptic.impact("light");
    }
    onToggle(todo.id);
  }

  return (
    <SwipeableRow
      rightActions={[
        {
          label: "Delete",
          color: "#ef4444",
          onPress: () => {
            haptic.impact("medium");
            onDelete(todo.id);
          },
        },
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

        <YStack flex={1} gap={2}>
          <Text
            fontSize="$3"
            fontWeight={isDone ? "400" : "500"}
            color={isDone ? "$color10" : "$color12"}
            numberOfLines={1}
            // strikethrough only when done. Done items deserve to look retired.
            style={isDone ? { textDecorationLine: "line-through" } : undefined}
          >
            {todo.title}
          </Text>
          {dueLabel || todo.notes ? (
            <XStack gap="$2" items="center" flexWrap="wrap">
              {dueLabel ? (
                <Text fontSize="$1" color="$color11">
                  {dueLabel}
                </Text>
              ) : null}
              {todo.notes ? (
                <Paragraph
                  fontSize="$1"
                  color="$color11"
                  numberOfLines={1}
                  flex={1}
                >
                  · {todo.notes}
                </Paragraph>
              ) : null}
            </XStack>
          ) : null}
        </YStack>

        {/* Priority dot — small, monochrome-restrained, only shown for high */}
        {todo.priority === "high" && !isDone ? (
          <View
            width={6}
            height={6}
            rounded={3}
            bg={PRIORITY_COLOR.high as never}
          />
        ) : null}
      </XStack>
    </SwipeableRow>
  );
}

function formatDue(due: string): string {
  const today = dateKey();
  const tomorrow = (() => {
    const d = new Date();
    d.setDate(d.getDate() + 1);
    return dateKey(d);
  })();
  if (due === today) return "Today";
  if (due === tomorrow) return "Tomorrow";
  // Within a week → weekday name. Otherwise → short date.
  const target = fromDateKey(due);
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
