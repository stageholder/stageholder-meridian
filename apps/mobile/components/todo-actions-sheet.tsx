// apps/mobile/components/todo-actions-sheet.tsx
//
// The todo actions menu — what a LONG-PRESS on a todo row opens on native,
// the touch counterpart of the web row's right-click / "…" DropdownMenu
// (apps/pwa/src/components/todos/todo-item.tsx `renderMenuItems`): the same
// Do-date presets (Today / Tomorrow / This weekend / Next week / No date),
// Edit, Mark done, Duplicate, Delete. One sheet hosted per screen; the host
// hands it the long-pressed todo.
//
// Every row is a Tamagui press (the pattern proven inside the app's sheets);
// a pick closes the sheet first, then runs — the delete confirm is a native
// alert, which presents cleanly once the sheet is gone.

import { Alert } from "react-native";
import { addDays, format, nextMonday, nextSaturday } from "date-fns";
import { Calendar } from "@tamagui/lucide-icons-2/icons/Calendar";
import { CalendarClock } from "@tamagui/lucide-icons-2/icons/CalendarClock";
import { CalendarX } from "@tamagui/lucide-icons-2/icons/CalendarX";
import { Check } from "@tamagui/lucide-icons-2/icons/Check";
import { Copy } from "@tamagui/lucide-icons-2/icons/Copy";
import { Pencil } from "@tamagui/lucide-icons-2/icons/Pencil";
import { RotateCcw } from "@tamagui/lucide-icons-2/icons/RotateCcw";
import { Sofa } from "@tamagui/lucide-icons-2/icons/Sofa";
import { Sun } from "@tamagui/lucide-icons-2/icons/Sun";
import { Trash2 } from "@tamagui/lucide-icons-2/icons/Trash2";
import { Sheet, Text, View, XStack, YStack, toast } from "@stageholder/ui";
import type { Todo } from "@repo/core/types";
import type { ReactNode } from "react";

import {
  useCreateTodo,
  useDeleteTodo,
  useToggleTodo,
  useUpdateTodo,
} from "@/lib/api";
import { useLocalDayKey } from "@/lib/hooks/use-local-day";

export interface TodoActionsSheetProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** The long-pressed todo; hosts keep the last one through the close slide. */
  todo: Todo | null;
  /** "Edit" → the host opens its todo detail sheet for this todo. */
  onEdit: (todo: Todo) => void;
}

export function TodoActionsSheet({
  open,
  onOpenChange,
  todo,
  onEdit,
}: TodoActionsSheetProps) {
  const updateTodo = useUpdateTodo();
  const toggleTodo = useToggleTodo();
  const deleteTodo = useDeleteTodo();
  const createTodo = useCreateTodo();
  const today = useLocalDayKey();
  const now = new Date(today + "T00:00:00");

  const presets: {
    label: string;
    value: string | null;
    icon: ReactNode;
  }[] = [
    // Per-preset colors (Todoist-style), same as the web menu.
    {
      label: "Today",
      value: format(now, "yyyy-MM-dd"),
      icon: <Calendar size={18} color="#22c55e" />,
    },
    {
      label: "Tomorrow",
      value: format(addDays(now, 1), "yyyy-MM-dd"),
      icon: <Sun size={18} color="#f59e0b" />,
    },
    {
      // "Weekend" — "This weekend" truncates in a five-up chip row.
      label: "Weekend",
      value: format(nextSaturday(now), "yyyy-MM-dd"),
      icon: <Sofa size={18} color="#8b5cf6" />,
    },
    {
      label: "Next week",
      value: format(nextMonday(now), "yyyy-MM-dd"),
      icon: <CalendarClock size={18} color="#3b82f6" />,
    },
    {
      label: "No date",
      value: null,
      icon: <CalendarX size={18} color="#9ca3af" />,
    },
  ];
  const currentDo = todo?.doDate ? todo.doDate.slice(0, 10) : null;

  const close = () => onOpenChange(false);

  function setDoDate(value: string | null, label: string) {
    if (!todo) return;
    close();
    updateTodo.mutate(
      { id: todo.id, patch: { doDate: value } },
      {
        onSuccess: () =>
          toast.success(value ? `Do date set: ${label}` : "Do date cleared"),
        onError: () => toast.error("Couldn't change the date"),
      },
    );
  }

  function toggle() {
    if (!todo) return;
    close();
    toggleTodo.mutate(
      { id: todo.id, status: todo.status },
      { onError: () => toast.error("Couldn't update todo") },
    );
  }

  function duplicate() {
    if (!todo) return;
    close();
    createTodo.mutate(
      {
        title: todo.title,
        description: todo.description,
        priority: todo.priority !== "none" ? todo.priority : undefined,
        dueDate: todo.dueDate,
        doDate: todo.doDate,
        listId: todo.listId,
      },
      {
        onSuccess: () => toast.success("Todo duplicated"),
        onError: () => toast.error("Couldn't duplicate todo"),
      },
    );
  }

  function confirmDelete() {
    if (!todo) return;
    const target = todo;
    close();
    Alert.alert(
      `Delete "${target.title}"?`,
      "This todo and its subtasks will be removed. This cannot be undone.",
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Delete",
          style: "destructive",
          onPress: () =>
            deleteTodo.mutate(target.id, {
              onSuccess: () => toast.success("Todo deleted"),
              onError: () => toast.error("Couldn't delete todo"),
            }),
        },
      ],
    );
  }

  const done = todo?.status === "done";

  return (
    <Sheet
      modal
      open={open}
      onOpenChange={onOpenChange}
      snapPointsMode="fit"
      dismissOnSnapToBottom
      transition="medium"
      // Root kept while closed; the body mounts per open (see the nested
      // picker sheets for why a root mounted in its open commit is unsafe).
      mountChildren="open"
    >
      <Sheet.Overlay />
      <Sheet.Frame pt={0} pb="$6" px="$4" gap="$2">
        {todo ? (
          <>
            <Text
              fontSize="$5"
              fontWeight="600"
              color="$color"
              numberOfLines={1}
              pb="$1"
            >
              {todo.title}
            </Text>

            {/* Do date — the five presets as one row of chips, the active
                one filled. */}
            <Text
              fontSize={11}
              fontWeight="600"
              color="$mutedForeground"
              textTransform="uppercase"
              letterSpacing={0.5}
            >
              Do date
            </Text>
            <XStack gap="$2" pb="$1">
              {presets.map((p) => {
                const active = p.value === currentDo;
                return (
                  <YStack
                    key={p.label}
                    role="button"
                    aria-label={p.label}
                    flex={1}
                    items="center"
                    gap="$1"
                    py="$2"
                    rounded="$3"
                    bg={active ? "$secondary" : "transparent"}
                    borderWidth={1}
                    borderColor={active ? "$primary" : "$borderColor"}
                    pressStyle={{ bg: "$secondary" }}
                    onPress={() => setDoDate(p.value, p.label)}
                  >
                    {p.icon}
                    <Text fontSize={10} color="$color" numberOfLines={1}>
                      {p.label}
                    </Text>
                  </YStack>
                );
              })}
            </XStack>

            <YStack gap="$1">
              <ActionRow
                label="Edit"
                icon={<Pencil size={18} color="$color" />}
                onPress={() => {
                  close();
                  onEdit(todo);
                }}
              />
              <ActionRow
                label={done ? "Mark as not done" : "Mark as done"}
                icon={
                  done ? (
                    <RotateCcw size={18} color="$color" />
                  ) : (
                    <Check size={18} color="$color" />
                  )
                }
                onPress={toggle}
              />
              <ActionRow
                label="Duplicate"
                icon={<Copy size={18} color="$color" />}
                onPress={duplicate}
              />
              <ActionRow
                label="Delete"
                destructive
                icon={<Trash2 size={18} color="$destructive" />}
                onPress={confirmDelete}
              />
              <View
                role="button"
                aria-label="Cancel"
                items="center"
                py="$3"
                rounded="$3"
                pressStyle={{ bg: "$secondary" }}
                onPress={close}
              >
                <Text fontSize="$4" fontWeight="500" color="$mutedForeground">
                  Cancel
                </Text>
              </View>
            </YStack>
          </>
        ) : null}
      </Sheet.Frame>
    </Sheet>
  );
}

function ActionRow({
  label,
  icon,
  destructive,
  onPress,
}: {
  label: string;
  icon: ReactNode;
  destructive?: boolean;
  onPress: () => void;
}) {
  return (
    <XStack
      role="button"
      aria-label={label}
      items="center"
      gap="$3"
      py="$3"
      px="$2"
      rounded="$3"
      pressStyle={{ bg: "$secondary" }}
      onPress={onPress}
    >
      {icon}
      <Text fontSize="$4" color={destructive ? "$destructive" : "$color"}>
        {label}
      </Text>
    </XStack>
  );
}
