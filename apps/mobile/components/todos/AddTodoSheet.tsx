// apps/mobile/components/todos/AddTodoSheet.tsx
//
// Capture sheet for a new todo. Layout pass (vs. the earlier chip-only
// version):
//
//   Title              — autofocused, larger input, the headline of the sheet
//   Description        — optional, plain textarea
//   ── divider ──
//   List               — chip row when >1 list exists, hidden otherwise
//   Priority           — pill row with a colored dot per priority
//   ── divider ──
//   Due date           — quick chips (Today / Tomorrow / Next week) + a
//                        real DatePicker for arbitrary dates. Selected
//                        date shows as an active chip with an X to clear.
//   Plan to do (opt.)  — same picker pattern, separately optional.
//   ── divider ──
//   Cancel + Add       — submit shows the target list name so the user
//                        knows where the todo lands.
//
// Why the real DatePicker now: chip-only dates capped the user at four
// hardcoded offsets, which fell apart for anything beyond "next week".
// The DatePicker from @stageholder/ui (already used in TodoDetailSheet)
// gives a full popover calendar without us having to design it.

import {
  Button,
  Input,
  Label,
  Sheet,
  Separator,
  Text,
  TextArea,
  View,
  XStack,
  YStack,
  useCalendarPicker,
  useToast,
} from "@stageholder/ui";
import type { Todo, TodoList } from "@repo/core/types";
import { useEffect, useMemo, useState } from "react";
import { Pressable } from "react-native";

import {
  extractServerMessage,
  useCreateTodo,
  useTodoLists,
  type CreateTodoInput,
} from "@/lib/api";
import { localDateKey } from "@/lib/streak";

const PRIORITIES: { value: Todo["priority"]; label: string; color: string }[] =
  [
    { value: "none", label: "None", color: "#64748b" },
    { value: "low", label: "Low", color: "#3b82f6" },
    { value: "medium", label: "Medium", color: "#eab308" },
    { value: "high", label: "High", color: "#f97316" },
    { value: "urgent", label: "Urgent", color: "#ef4444" },
  ];

/** Quick chips for date fields — the long tail uses the calendar. */
function buildQuickChips(): { label: string; key: string }[] {
  const today = localDateKey();
  const tomorrow = (() => {
    const d = new Date();
    d.setDate(d.getDate() + 1);
    return localDateKey(d);
  })();
  const nextWeek = (() => {
    const d = new Date();
    d.setDate(d.getDate() + 7);
    return localDateKey(d);
  })();
  return [
    { label: "Today", key: today },
    { label: "Tomorrow", key: tomorrow },
    { label: "Next week", key: nextWeek },
  ];
}

export type AddTodoSheetProps = {
  open: boolean;
  onClose: () => void;
  /**
   * Optional override — if provided, this list is pre-selected. Otherwise the
   * user's default Inbox list is selected (resolved from useTodoLists).
   */
  defaultListId?: string;
};

export function AddTodoSheet({
  open,
  onClose,
  defaultListId,
}: AddTodoSheetProps) {
  const create = useCreateTodo();
  const toast = useToast();
  const listsQuery = useTodoLists();

  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [priority, setPriority] = useState<Todo["priority"]>("medium");
  const [dueDate, setDueDate] = useState<string | null>(localDateKey());
  const [doDate, setDoDate] = useState<string | null>(null);
  const [listId, setListId] = useState<string | undefined>(defaultListId);

  const lists = listsQuery.data ?? [];
  const inboxList = useMemo<TodoList | undefined>(
    () => lists.find((l) => l.isDefault) ?? lists[0],
    [lists],
  );
  useEffect(() => {
    if (!listId && (defaultListId ?? inboxList?.id)) {
      setListId(defaultListId ?? inboxList?.id);
    }
  }, [defaultListId, inboxList?.id, listId]);

  function reset() {
    setTitle("");
    setDescription("");
    setPriority("medium");
    setDueDate(localDateKey());
    setDoDate(null);
    setListId(defaultListId ?? inboxList?.id);
  }

  function handleCreate() {
    if (!title.trim()) return;
    if (!listId) {
      toast.show({
        title: "No list selected",
        message: "Pick a list before adding.",
        intent: "danger",
      });
      return;
    }

    const input: CreateTodoInput = {
      title: title.trim(),
      description: description.trim() || undefined,
      priority,
      dueDate: dueDate ?? undefined,
      doDate: doDate ?? undefined,
      listId,
    };

    create.mutate(input, {
      onSuccess: () => {
        reset();
        onClose();
      },
      onError: (err) => {
        toast.show({
          title: "Couldn't create todo",
          message:
            extractServerMessage(err) ??
            (err as Error).message ??
            "Tap to retry.",
          intent: "danger",
        });
      },
    });
  }

  const activeList = lists.find((l) => l.id === listId);

  return (
    <Sheet
      modal
      open={open}
      onOpenChange={(o: boolean) => {
        if (!o) reset();
        onClose();
      }}
      snapPoints={[92]}
      dismissOnSnapToBottom
    >
      <Sheet.Overlay />
      <Sheet.Handle />
      <Sheet.Frame>
        <Sheet.ScrollView
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
        >
          <YStack gap="$4" pb="$6">
            <YStack gap="$1">
              <Text
                fontFamily="$mono"
                fontSize={10}
                letterSpacing={2}
                textTransform="uppercase"
                color="$color11"
                fontWeight="600"
              >
                Capture
              </Text>
              <Text fontSize="$7" fontWeight="700" color="$color12">
                New todo
              </Text>
            </YStack>

            {/* ---- Title ---- */}
            <YStack gap="$2">
              <Label htmlFor="todo-title">Title</Label>
              <Input
                id="todo-title"
                autoFocus
                placeholder="What needs doing?"
                value={title}
                onChangeText={setTitle}
                size="$5"
                fontWeight="600"
              />
            </YStack>

            {/* ---- Notes ---- */}
            <YStack gap="$2">
              <Label htmlFor="todo-description">Notes</Label>
              <TextArea
                id="todo-description"
                placeholder="Details, links, context… (optional)"
                value={description}
                onChangeText={setDescription}
                size="$3"
                minH={72 as never}
              />
            </YStack>

            <Separator />

            {/* ---- List picker (only when user has more than the default) ---- */}
            {lists.length > 1 ? (
              <YStack gap="$2">
                <Label>List</Label>
                <XStack gap="$2" flexWrap="wrap">
                  {lists.map((l) => (
                    <ListChip
                      key={l.id}
                      active={l.id === listId}
                      color={l.color ?? "#7c89b6"}
                      label={l.name}
                      onPress={() => setListId(l.id)}
                    />
                  ))}
                </XStack>
              </YStack>
            ) : null}

            {/* ---- Priority ---- */}
            <YStack gap="$2">
              <Label>Priority</Label>
              <XStack gap="$2" flexWrap="wrap">
                {PRIORITIES.map((p) => (
                  <PriorityPill
                    key={p.value}
                    active={priority === p.value}
                    color={p.color}
                    label={p.label}
                    onPress={() => setPriority(p.value)}
                  />
                ))}
              </XStack>
            </YStack>

            <Separator />

            {/* ---- Due date ---- */}
            <YStack gap="$2">
              <Label>Due date</Label>
              <DateField
                value={dueDate}
                onChange={setDueDate}
                quickChips={buildQuickChips()}
                placeholder="No due date"
                title="Due date"
              />
            </YStack>

            {/* ---- Plan to do ---- */}
            <YStack gap="$2">
              <Label>Plan to do</Label>
              <DateField
                value={doDate}
                onChange={setDoDate}
                quickChips={buildQuickChips()}
                placeholder="Not scheduled"
                title="Plan to do"
              />
            </YStack>

            <Separator />

            {/* Stacked full-width — primary on top so it's the dominant
                target when the soft keyboard is up. Cancel beneath as
                the explicit escape hatch. Matches iOS-native sheet
                conventions for non-destructive creation flows. */}
            <YStack gap="$2" pt="$2">
              <Button
                intent="primary"
                size="$4"
                onPress={handleCreate}
                disabled={!title.trim() || !listId || create.isPending}
              >
                {create.isPending
                  ? "Adding…"
                  : activeList
                    ? `Add to ${activeList.name}`
                    : "Add"}
              </Button>
              <Button intent="ghost" size="$4" onPress={onClose}>
                Cancel
              </Button>
            </YStack>
          </YStack>
        </Sheet.ScrollView>
      </Sheet.Frame>
    </Sheet>
  );
}

/* ----------------------- Subcomponents ------------------------------------ */

function ListChip({
  active,
  color,
  label,
  onPress,
}: {
  active: boolean;
  color: string;
  label: string;
  onPress: () => void;
}) {
  return (
    <Pressable onPress={onPress}>
      <XStack
        items="center"
        gap={6}
        px="$3"
        py="$1.5"
        rounded="$3"
        bg={(active ? "$color5" : "$color3") as never}
        borderWidth={1}
        borderColor={(active ? "$color8" : "$color6") as never}
      >
        <View width={8} height={8} rounded={4} bg={color as never} />
        <Text
          fontSize="$2"
          fontWeight={active ? "600" : "500"}
          color="$color12"
        >
          {label}
        </Text>
      </XStack>
    </Pressable>
  );
}

function PriorityPill({
  active,
  color,
  label,
  onPress,
}: {
  active: boolean;
  color: string;
  label: string;
  onPress: () => void;
}) {
  // Active = filled background in the priority color (like a lit ember).
  // Inactive = subtle outline + small color dot. Reads as "you're picking
  // which fire intensity you want this todo to carry."
  return (
    <Pressable onPress={onPress}>
      <XStack
        items="center"
        gap={6}
        px="$3"
        py="$1.5"
        rounded="$3"
        bg={(active ? color : "$color3") as never}
        borderWidth={1}
        borderColor={(active ? color : "$color6") as never}
      >
        {!active ? (
          <View width={6} height={6} rounded={3} bg={color as never} />
        ) : null}
        <Text
          fontSize="$2"
          fontWeight="600"
          color={(active ? "white" : "$color12") as never}
        >
          {label}
        </Text>
      </XStack>
    </Pressable>
  );
}

/**
 * Quick chips for common dates + a trigger button that opens the
 * cross-platform CalendarSheet (a nested Sheet — stacks above this
 * sheet on mobile without the popover-clipping the inline DatePicker
 * exhibited).
 *
 *   [ Today ] [ Tomorrow ] [ Next week ] [ None ]
 *   ┌──────────────────────────────────────────┐
 *   │ 📅  Tue, May 12                       ▾  │   ← opens CalendarSheet
 *   └──────────────────────────────────────────┘
 *
 * Single source of truth (`value`) — chips and the trigger button stay
 * in sync because both read the same prop.
 */
function DateField({
  value,
  onChange,
  quickChips,
  placeholder,
  title,
}: {
  value: string | null;
  onChange: (v: string | null) => void;
  quickChips: { label: string; key: string }[];
  placeholder: string;
  title: string;
}) {
  const { pickDate } = useCalendarPicker();

  function openPicker() {
    pickDate({
      title,
      value: value ? fromDateKey(value) : null,
      onSelect: (d) => onChange(d ? toDateKey(d) : null),
    });
  }

  return (
    <YStack gap="$2">
      <XStack gap="$2" flexWrap="wrap">
        {quickChips.map((c) => (
          <DateChip
            key={c.key}
            active={value === c.key}
            label={c.label}
            onPress={() => onChange(c.key)}
          />
        ))}
        {/* "None" chip clears the value — single tap, no popover. */}
        <DateChip active={!value} label="None" onPress={() => onChange(null)} />
      </XStack>

      <Pressable onPress={openPicker}>
        <XStack
          items="center"
          justify="space-between"
          px="$3"
          py="$3"
          rounded="$3"
          bg="$color2"
          borderWidth={1}
          borderColor="$color6"
        >
          <Text
            fontSize="$3"
            color={(value ? "$color12" : "$color10") as never}
          >
            {value ? formatDateLabel(value) : placeholder}
          </Text>
          <Text fontSize="$2" color="$color11">
            ▾
          </Text>
        </XStack>
      </Pressable>
    </YStack>
  );
}

function formatDateLabel(yyyymmdd: string): string {
  const dt = fromDateKey(yyyymmdd);
  return dt.toLocaleDateString(undefined, {
    weekday: "short",
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

function DateChip({
  active,
  label,
  onPress,
}: {
  active: boolean;
  label: string;
  onPress: () => void;
}) {
  return (
    <Pressable onPress={onPress}>
      <XStack
        items="center"
        px="$3"
        py="$1.5"
        rounded="$3"
        bg={(active ? "$color5" : "$color3") as never}
        borderWidth={1}
        borderColor={(active ? "$color9" : "$color6") as never}
      >
        <Text
          fontSize="$2"
          fontWeight={active ? "600" : "500"}
          color="$color12"
        >
          {label}
        </Text>
      </XStack>
    </Pressable>
  );
}

function fromDateKey(yyyymmdd: string): Date {
  const [y, m, d] = yyyymmdd.split("-").map(Number);
  return new Date(y!, (m ?? 1) - 1, d ?? 1);
}

function toDateKey(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}
