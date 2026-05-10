// apps/mobile/components/todos/AddTodoSheet.tsx
//
// Bottom-sheet form for creating a new todo. Quick capture is the most
// important interaction in any todo app, so this stays minimal — title is
// the only required field, everything else is optional refinement.

import {
  Button,
  Input,
  Label,
  Sheet,
  Text,
  TextArea,
  XStack,
  YStack,
} from "@stageholder/ui";
import { useState } from "react";

import { dateKey, type Priority } from "@/lib/types";

const PRIORITIES: { value: Priority; label: string; color: string }[] = [
  { value: "low", label: "Low", color: "#64748b" },
  { value: "normal", label: "Normal", color: "#3b82f6" },
  { value: "high", label: "High", color: "#ef4444" },
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
  onCreate: (input: {
    title: string;
    notes?: string;
    priority: Priority;
    dueDate?: string;
  }) => void;
};

export function AddTodoSheet({ open, onClose, onCreate }: AddTodoSheetProps) {
  const [title, setTitle] = useState("");
  const [notes, setNotes] = useState("");
  const [priority, setPriority] = useState<Priority>("normal");
  const [dueOffset, setDueOffset] = useState<number | null>(0);

  function reset() {
    setTitle("");
    setNotes("");
    setPriority("normal");
    setDueOffset(0);
  }

  function handleCreate() {
    if (!title.trim()) return;
    const due =
      dueOffset == null
        ? undefined
        : (() => {
            const d = new Date();
            d.setDate(d.getDate() + dueOffset);
            return dateKey(d);
          })();
    onCreate({
      title: title.trim(),
      notes: notes.trim() || undefined,
      priority,
      dueDate: due,
    });
    reset();
    onClose();
  }

  return (
    <Sheet
      modal
      open={open}
      onOpenChange={(o: boolean) => {
        if (!o) reset();
        onClose();
      }}
      snapPoints={[78]}
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
            <Label htmlFor="todo-notes">Notes (optional)</Label>
            <TextArea
              id="todo-notes"
              placeholder="Anything else..."
              value={notes}
              onChangeText={setNotes}
              size="$3"
              minH={64 as never}
            />
          </YStack>

          <YStack gap="$2">
            <Label>Priority</Label>
            <XStack gap="$2">
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
            {/* `key` keyed off disabled — see sign-in.tsx for why. */}
            <Button
              key={title.trim() ? "ready" : "empty"}
              intent="primary"
              onPress={handleCreate}
              flex={1}
              disabled={!title.trim()}
            >
              Add
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
  return (
    <Button
      size="$2"
      intent={active ? "primary" : "secondary"}
      onPress={onPress}
      bg={active && color ? (color as never) : undefined}
    >
      {children}
    </Button>
  );
}
