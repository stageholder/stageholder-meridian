// apps/mobile/components/todos/TodoRow.tsx
//
// Redesigned for the "ignition" aesthetic — every open todo is a star
// waiting to be lit. When checked, fire blooms from the checkbox; the
// row briefly glows in the priority color, then settles into a soft,
// dimmed "done" state.
//
// Layout
//   [4pt priority stripe] [checkbox] [title + meta] [optional badge] [chev]
//
//   - Priority stripe: hot for urgent, warm for high, cool for low/none.
//     Provides at-a-glance triage without needing color-blind-safe text.
//   - Checkbox: 44pt touch target, animated fill on tap. Tap fires the
//     ignite sequence (burst + ring + brief row glow).
//   - Meta line: due-date pill, list dot + name (when the parent shows
//     more than one list), subtask completion ratio.
//
// Interactions
//   - Tap row body → opens TodoDetailSheet via the parent.
//   - Tap checkbox → toggles. Marking done plays the ignition; marking
//     undone is a quiet "tap" haptic with no animation (no need to
//     celebrate undo).
//   - Swipe right → reveals "Done" action, fires the ignition when
//     released past the threshold.
//   - Swipe left → reveals "Delete" action, fires the delete.

import {
  Paragraph,
  SwipeableRow,
  Text,
  View,
  XStack,
  YStack,
  useHaptic,
  useToast,
} from "@stageholder/ui";
import type { Todo, TodoList } from "@repo/core/types";
import { useEffect, useRef, useState } from "react";
import { Animated, Pressable } from "react-native";

import { CheckboxFlame } from "@/components/todos/CheckboxFlame";
import { RowFireSweep } from "@/components/todos/RowFireSweep";
import { TodoFireBurst } from "@/components/todos/TodoFireBurst";
import { extractServerMessage, useDeleteTodo, useToggleTodo } from "@/lib/api";
import { localDateKey } from "@/lib/streak";

/** Hot→cool palette. Urgent reads as flame; none reads as a cold star. */
const PRIORITY_COLOR: Record<Todo["priority"], string> = {
  urgent: "#ef4444", // red-500
  high: "#f97316", // orange-500
  medium: "#eab308", // yellow-500
  low: "#3b82f6", // blue-500
  none: "#475569", // slate-600 — visible but neutral
};

/** Whether the stripe should be visually prominent on the left edge.
    "none" / "low" we mute so the eye doesn't get tugged everywhere. */
function stripeOpacity(p: Todo["priority"]): number {
  return p === "urgent" || p === "high" ? 1 : p === "medium" ? 0.85 : 0.45;
}

export type TodoRowProps = {
  todo: Todo;
  /** Tap the row body to open the detail sheet. Parent owns the sheet. */
  onPress?: (todo: Todo) => void;
  /** When the parent shows todos from multiple lists, pass the list so the
      row can render a small list-name + color dot in the meta line.
      When omitted, the list chip is hidden (e.g., when filtered to one list). */
  list?: Pick<TodoList, "id" | "name" | "color"> | null;
  /**
   * True while the parent is treating this row as "freshly completed":
   * the optimistic update has already flipped status to "done", but the
   * parent is keeping it in its open-list position so the burst can play
   * where the user tapped. Render as checked WITHOUT strikethrough/dim
   * during this window; the parent flips back to false after the
   * celebration and the row settles into its real done state.
   */
  completing?: boolean;
  /**
   * Called the moment the user marks the row done. Lets the parent add
   * this id to its "completing" set, holding the row's sort position
   * for the duration of the celebration.
   */
  onCelebrate?: (todo: Todo) => void;
};

export function TodoRow({
  todo,
  onPress,
  list,
  completing = false,
  onCelebrate,
}: TodoRowProps) {
  const haptic = useHaptic();
  const toast = useToast();
  const toggle = useToggleTodo();
  const remove = useDeleteTodo();

  const [burstAt, setBurstAt] = useState<number | null>(null);

  // Row-glow animation: when a todo is checked, the whole row tints with
  // the priority color for ~600ms then fades. Adds presence to the
  // completion moment without being noisy.
  const glow = useRef(new Animated.Value(0)).current;
  const igniteGlow = () => {
    glow.setValue(1);
    Animated.timing(glow, {
      toValue: 0,
      duration: 720,
      useNativeDriver: false, // animating bg color, not transform
    }).start();
  };

  // `isDone` = the data's truth. `isSettledDone` = also past the
  // celebration window, so we can apply the dim/strikethrough that
  // signals "this is yesterday's news". During the celebration we render
  // the checked visuals but keep the title bright — the win deserves
  // attention before it fades.
  const isDone = todo.status === "done";
  const isSettledDone = isDone && !completing;
  const stripeColor = PRIORITY_COLOR[todo.priority];
  const dueLabel = todo.dueDate ? formatDue(todo.dueDate) : null;
  const isOverdue =
    !isDone && !!todo.dueDate && todo.dueDate.slice(0, 10) < localDateKey();
  const subtaskCount = todo.subtasks?.length ?? 0;
  const subtaskDone =
    todo.subtasks?.filter((s) => s.status === "done").length ?? 0;

  function complete() {
    if (!isDone) {
      // Ignite — burst + glow + success haptic.
      haptic.notification("success");
      setBurstAt(Date.now());
      igniteGlow();
      // Tell the parent to hold this row's sort position. Without this
      // the optimistic flip to "done" would immediately re-sort the list
      // and the burst would play at the row's new (bottom) position
      // instead of where the user tapped.
      onCelebrate?.(todo);
    } else {
      haptic.impact("light");
    }
    toggle.mutate(todo, {
      onError: (err) => {
        toast.show({
          title: "Couldn't save",
          message:
            extractServerMessage(err) ??
            (err as Error).message ??
            "Reverted. Tap to retry.",
          intent: "danger",
        });
      },
    });
  }

  function handleDelete() {
    haptic.impact("medium");
    remove.mutate(todo.id, {
      onError: (err) =>
        toast.show({
          title: "Delete failed",
          message:
            extractServerMessage(err) ?? (err as Error).message ?? "Restored.",
          intent: "danger",
        }),
    });
  }

  // Glow tint opacity: peaks at 0.22 (the same intensity the old
  // backgroundColor interpolation reached) and rides the glow value.
  // Multiply produces an Animated.Node that's still native-drivable.
  const tintOpacity = Animated.multiply(glow, 0.22);

  return (
    <SwipeableRow
      // Delete is destructive — keep the reveal-and-tap flow so the user
      // has to confirm. A long left-swipe still reveals the red panel.
      rightActions={[
        { label: "Delete", color: "#ef4444", onPress: handleDelete },
      ]}
      // Done auto-commits on long swipe (added in @stageholder/ui
      // SwipeAction.autoCommit). A short swipe still reveals the green
      // panel as a fallback for users who don't know the gesture. A
      // full-row swipe fires `complete()` directly and snaps the row
      // closed — feels like wiping the todo off the screen.
      leftActions={
        isDone
          ? []
          : [
              {
                label: "Done",
                color: "#22c55e",
                onPress: complete,
                autoCommit: true,
              },
            ]
      }
    >
      {/* Outer wrapper provides the always-opaque row surface (so adjacent
          rows are distinguishable from the scroll bg) AND the
          positioning context for the absolute effect layers. */}
      <View style={{ position: "relative", backgroundColor: "#0a0f1f" }}>
        {/* GLOW TINT — colored overlay, animated opacity (native-driven).
            Sits behind the sweep + content so text stays crisp. */}
        <Animated.View
          pointerEvents="none"
          style={{
            position: "absolute",
            left: 0,
            right: 0,
            top: 0,
            bottom: 0,
            backgroundColor: stripeColor,
            opacity: tintOpacity,
          }}
        />

        {/* FIRE SWEEP — fills from the very left edge of the row outward.
            Native-driven via translateX + opacity. originX=0 makes the
            wave wash across the priority stripe and checkbox area too,
            so the whole row reads as "consumed by the flame". */}
        <RowFireSweep trigger={burstAt} originX={0} color={stripeColor} />

        <XStack
          py="$2.5"
          pr="$3"
          gap="$2"
          items="stretch"
          bg="transparent"
          opacity={isSettledDone ? 0.6 : 1}
        >
          {/* PRIORITY STRIPE — vertical color bar, dimmed for none/low so
              the eye isn't dragged to every row. */}
          <View
            width={4}
            rounded={2}
            ml={6 as never}
            my={2 as never}
            bg={stripeColor as never}
            opacity={stripeOpacity(todo.priority)}
          />

          {/* CHECKBOX + FIRE BURST overlay. Pressable wraps the box only,
              not the row body — the row body is its own tap target below. */}
          <Pressable
            onPress={complete}
            hitSlop={10}
            style={{
              justifyContent: "center",
              paddingLeft: 6,
              paddingRight: 4,
            }}
          >
            <CheckCircle
              done={isDone}
              celebrating={completing}
              color={stripeColor}
            />
            <TodoFireBurst
              trigger={burstAt}
              x={20}
              y={20}
              color={stripeColor}
            />
          </Pressable>

          {/* TITLE + META */}
          <Pressable style={{ flex: 1 }} onPress={() => onPress?.(todo)}>
            <YStack gap={3} py="$1">
              <Text
                fontSize="$4"
                fontWeight={isSettledDone ? "500" : "600"}
                color={isSettledDone ? "$color10" : "$color12"}
                numberOfLines={1}
                style={
                  isSettledDone
                    ? { textDecorationLine: "line-through" }
                    : undefined
                }
              >
                {todo.title}
              </Text>

              {(dueLabel || subtaskCount > 0 || list || todo.description) && (
                <XStack gap="$2" items="center" flexWrap="wrap">
                  {dueLabel ? (
                    <DueDatePill
                      label={dueLabel}
                      overdue={isOverdue}
                      done={isDone}
                    />
                  ) : null}

                  {list ? (
                    <XStack items="center" gap={4}>
                      <View
                        width={6}
                        height={6}
                        rounded={3}
                        bg={(list.color ?? "$color8") as never}
                      />
                      <Text fontSize="$1" color="$color11">
                        {list.name}
                      </Text>
                    </XStack>
                  ) : null}

                  {subtaskCount > 0 ? (
                    <Text fontSize="$1" color="$color11" fontFamily="$mono">
                      ◴ {subtaskDone}/{subtaskCount}
                    </Text>
                  ) : null}

                  {!list && todo.description ? (
                    <Paragraph
                      fontSize="$1"
                      color="$color11"
                      numberOfLines={1}
                      flex={1}
                    >
                      {todo.description}
                    </Paragraph>
                  ) : null}
                </XStack>
              )}
            </YStack>
          </Pressable>

          {/* Right-side chev hints at "tap to open detail" without
              competing with the priority stripe for attention. */}
          <View items="center" justify="center" pl="$1">
            <Text fontSize="$3" color="$color10">
              ›
            </Text>
          </View>
        </XStack>
      </View>
    </SwipeableRow>
  );
}

/**
 * Custom checkbox to control the exact ignition visuals — Tamagui's
 * Checkbox is a fine generic, but we want a hot color when done (priority
 * stripe color, not brand $color9) and a tight tap timing.
 */
function CheckCircle({
  done,
  celebrating,
  color,
}: {
  done: boolean;
  celebrating: boolean;
  color: string;
}) {
  return (
    <View
      width={26}
      height={26}
      rounded={13}
      items="center"
      justify="center"
      borderWidth={2}
      borderColor={(done ? color : "$color8") as never}
      bg={(done ? color : "transparent") as never}
      overflow="hidden"
    >
      {/* Flame layer — only animates while celebrating. Sits over the
          filled background, replacing the checkmark visually. */}
      <CheckboxFlame active={done && celebrating} size={26} />
      {/* Settled checkmark — hidden during celebration so the flame
          has the spotlight. */}
      {done && !celebrating ? (
        <Text color="white" fontWeight="700" fontSize={14} lineHeight={14}>
          ✓
        </Text>
      ) : null}
    </View>
  );
}

function DueDatePill({
  label,
  overdue,
  done,
}: {
  label: string;
  overdue: boolean;
  done: boolean;
}) {
  const isToday = label === "Today";
  // Today = warm chip; overdue = red chip; future = neutral. Settled-done
  // collapses every chip to neutral since the temporal signal no longer
  // matters — but the chip stays warm during the celebration window.
  const tint = done ? null : overdue ? "#ef4444" : isToday ? "#f59e0b" : null;
  return (
    <XStack
      items="center"
      gap={4}
      px={6 as never}
      py={2 as never}
      rounded={5 as never}
      bg={(tint ? hexToRgba(tint, 0.16) : "$color3") as never}
      borderWidth={1}
      borderColor={(tint ? hexToRgba(tint, 0.35) : "$color6") as never}
    >
      <Text
        fontSize={10}
        color={(tint ?? "$color11") as never}
        fontFamily="$mono"
        fontWeight="600"
        letterSpacing={0.5 as never}
      >
        {label.toUpperCase()}
      </Text>
    </XStack>
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

/** Tiny hex → rgba helper for animated bg interpolation. */
function hexToRgba(hex: string, alpha: number): string {
  const h = hex.replace("#", "");
  const r = parseInt(h.slice(0, 2), 16);
  const g = parseInt(h.slice(2, 4), 16);
  const b = parseInt(h.slice(4, 6), 16);
  return `rgba(${r},${g},${b},${alpha})`;
}
