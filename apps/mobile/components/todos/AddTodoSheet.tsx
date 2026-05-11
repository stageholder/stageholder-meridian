// apps/mobile/components/todos/AddTodoSheet.tsx
//
// Bottom-sheet form for creating a new todo. Calls useCreateTodo from the
// API layer — server is the source of truth; we just translate user
// intent into the right payload.

import {
  Button,
  Input,
  Label,
  Sheet,
  Text,
  TextArea,
  XStack,
  YStack,
  useToast,
} from "@stageholder/ui";
import type { Todo } from "@repo/core/types";
import { useState } from "react";

import { useCreateTodo, type CreateTodoInput } from "@/lib/api";
import { localDateKey } from "@/lib/streak";

const PRIORITIES: { value: Todo["priority"]; label: string; color: string }[] =
  [
    { value: "low", label: "Low", color: "#64748b" },
    { value: "medium", label: "Medium", color: "#3b82f6" },
    { value: "high", label: "High", color: "#f59e0b" },
    { value: "urgent", label: "Urgent", color: "#ef4444" },
  ];

const DUE_PRESETS: { label: string; offset: number | null }[] = [
  { label: "Today", offset: 0 },
  { label: "Tomorrow", offset: 1 },
  { label: "Next week", offset: 7 },
  { label: "No date", offset: null },
];

export type AddTodoSheetProps = {
  open: boolean;
  onClose: () => void;
  /** Optional listId — defaults to the user's default list on the server. */
  listId?: string;
};

export function AddTodoSheet({ open, onClose, listId }: AddTodoSheetProps) {
  const create = useCreateTodo();
  const toast = useToast();
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [priority, setPriority] = useState<Todo["priority"]>("medium");
  const [dueOffset, setDueOffset] = useState<number | null>(0);

  function reset() {
    setTitle("");
    setDescription("");
    setPriority("medium");
    setDueOffset(0);
  }

  function handleCreate() {
    if (!title.trim()) return;
    const dueDate =
      dueOffset == null
        ? undefined
        : (() => {
            const d = new Date();
            d.setDate(d.getDate() + dueOffset);
            return localDateKey(d);
          })();

    const input: CreateTodoInput = {
      title: title.trim(),
      description: description.trim() || undefined,
      priority,
      dueDate,
      ...(listId ? { listId } : {}),
    };

    create.mutate(input, {
      onSuccess: () => {
        reset();
        onClose();
      },
      onError: (err) => {
        toast.show({
          title: "Couldn't create todo",
          message: (err as Error).message ?? "Tap to retry.",
          intent: "danger",
        });
      },
    });
  }

  return (
    <Sheet
      modal
      open={open}
      onOpenChange={(o: boolean) => {
        if (!o) reset();
        onClose();
      }}
      snapPoints={[80]}
      dismissOnSnapToBottom
    >
      <Sheet.Overlay />
      <Sheet.Handle />
      <Sheet.Frame>
        <YStack gap="$4">
          <Text fontSize="$6" fontWeight="700" color="$color12">
            New todo
          </Text>

          <YStack gap="$2">
            <Label htmlFor="todo-title">Title</Label>
            <Input
              id="todo-title"
              autoFocus
              placeholder="What needs doing?"
              value={title}
              onChangeText={setTitle}
              size="$4"
            />
          </YStack>

          <YStack gap="$2">
            <Label htmlFor="todo-description">Notes (optional)</Label>
            <TextArea
              id="todo-description"
              placeholder="Anything else..."
              value={description}
              onChangeText={setDescription}
              size="$3"
              minH={64 as never}
            />
          </YStack>

          <YStack gap="$2">
            <Label>Priority</Label>
            <XStack gap="$2" flexWrap="wrap">
              {PRIORITIES.map((p) => (
                <PillButton
                  key={p.value}
                  active={priority === p.value}
                  color={p.color}
                  onPress={() => setPriority(p.value)}
                >
                  {p.label}
                </PillButton>
              ))}
            </XStack>
          </YStack>

          <YStack gap="$2">
            <Label>Due</Label>
            <XStack gap="$2" flexWrap="wrap">
              {DUE_PRESETS.map((d) => (
                <PillButton
                  key={d.label}
                  active={dueOffset === d.offset}
                  onPress={() => setDueOffset(d.offset)}
                >
                  {d.label}
                </PillButton>
              ))}
            </XStack>
          </YStack>

          <XStack gap="$2" pt="$2">
            <Button intent="ghost" onPress={onClose} flex={1}>
              Cancel
            </Button>
            <Button
              key={title.trim() ? "ready" : "empty"}
              intent="primary"
              onPress={handleCreate}
              flex={1}
              disabled={!title.trim() || create.isPending}
            >
              {create.isPending ? "Adding…" : "Add"}
            </Button>
          </XStack>
        </YStack>
      </Sheet.Frame>
    </Sheet>
  );
}

function PillButton({
  active,
  color,
  onPress,
  children,
}: {
  active: boolean;
  color?: string;
  onPress: () => void;
  children: React.ReactNode;
}) {
  // Tinted-when-active uses the color prop on Button; absent intent so
  // the surface respects the custom color instead of the theme accent.
  return (
    <Button
      size="$2"
      intent={active ? "primary" : "secondary"}
      onPress={onPress}
      {...(active && color ? { backgroundColor: color as never } : {})}
    >
      {children}
    </Button>
  );
}
