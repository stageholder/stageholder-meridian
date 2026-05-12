// apps/mobile/components/todos/AddTodoSheet.tsx
//
// Bottom-sheet form for creating a new todo. Mirrors the field set in
// PWA's QuickAddTodo (apps/pwa/components/todos/quick-add-todo.tsx):
//   - title, description (notes)
//   - priority (5 levels including "none")
//   - dueDate via preset pills
//   - doDate via preset pills
//   - list picker (defaults to user's Inbox = the list with isDefault: true)
//
// The list picker is required by the API (CreateTodoDto.listId is mandatory;
// see apps/api/src/modules/todo/todo.dto.ts:13). We resolve the default list
// from useTodoLists() and let the user switch via a chip row.

import {
  Button,
  Input,
  Label,
  Sheet,
  Text,
  TextArea,
  View,
  XStack,
  YStack,
  useToast,
} from "@stageholder/ui";
import type { Todo, TodoList } from "@repo/core/types";
import { useEffect, useMemo, useState } from "react";

import {
  extractServerMessage,
  useCreateTodo,
  useTodoLists,
  type CreateTodoInput,
} from "@/lib/api";
import { localDateKey } from "@/lib/streak";

const PRIORITIES: { value: Todo["priority"]; label: string; color: string }[] =
  [
    { value: "none", label: "None", color: "#475569" },
    { value: "low", label: "Low", color: "#3b82f6" },
    { value: "medium", label: "Medium", color: "#eab308" },
    { value: "high", label: "High", color: "#f97316" },
    { value: "urgent", label: "Urgent", color: "#ef4444" },
  ];

const DATE_PRESETS: { label: string; offset: number | null }[] = [
  { label: "Today", offset: 0 },
  { label: "Tomorrow", offset: 1 },
  { label: "Next week", offset: 7 },
  { label: "No date", offset: null },
];

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
  const [dueOffset, setDueOffset] = useState<number | null>(0);
  const [doOffset, setDoOffset] = useState<number | null>(null);
  const [listId, setListId] = useState<string | undefined>(defaultListId);

  // Resolve a sensible default list once the lists query lands. PWA does
  // the same in QuickAddTodo — see apps/pwa/components/todos/quick-add-todo.tsx
  // (defaults to isDefault list, falls back to first list).
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
    setDueOffset(0);
    setDoOffset(null);
    setListId(defaultListId ?? inboxList?.id);
  }

  function resolveDate(offset: number | null): string | undefined {
    if (offset == null) return undefined;
    const d = new Date();
    d.setDate(d.getDate() + offset);
    return localDateKey(d);
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
      dueDate: resolveDate(dueOffset),
      doDate: resolveDate(doOffset),
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
          // Surface the server's actual validation message — NestJS wraps
          // Zod errors as { message: "...", ... } in the response body.
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
      snapPoints={[88]}
      dismissOnSnapToBottom
    >
      <Sheet.Overlay />
      <Sheet.Handle />
      <Sheet.Frame>
        <Sheet.ScrollView showsVerticalScrollIndicator={false}>
          <YStack gap="$4" pb="$6">
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

            {/* ---- List picker ---- */}
            <YStack gap="$2">
              <Label>List</Label>
              {lists.length === 0 ? (
                <Text fontSize="$2" color="$color11" fontStyle="italic">
                  {listsQuery.isLoading
                    ? "Loading lists…"
                    : "No lists found. Defaulting to Inbox on save."}
                </Text>
              ) : (
                <XStack gap="$2" flexWrap="wrap">
                  {lists.map((l) => {
                    const active = l.id === listId;
                    return (
                      <PillButton
                        key={l.id}
                        active={active}
                        onPress={() => setListId(l.id)}
                      >
                        <XStack items="center" gap="$1.5">
                          {l.color ? (
                            <View
                              width={6}
                              height={6}
                              rounded={3}
                              bg={l.color as never}
                            />
                          ) : null}
                          <Text fontSize="$2" color="$color12">
                            {l.name}
                          </Text>
                        </XStack>
                      </PillButton>
                    );
                  })}
                </XStack>
              )}
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
                {DATE_PRESETS.map((d) => (
                  <PillButton
                    key={`due-${d.label}`}
                    active={dueOffset === d.offset}
                    onPress={() => setDueOffset(d.offset)}
                  >
                    {d.label}
                  </PillButton>
                ))}
              </XStack>
            </YStack>

            <YStack gap="$2">
              <Label>Plan to do</Label>
              <XStack gap="$2" flexWrap="wrap">
                {DATE_PRESETS.map((d) => (
                  <PillButton
                    key={`do-${d.label}`}
                    active={doOffset === d.offset}
                    onPress={() => setDoOffset(d.offset)}
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
                intent="primary"
                onPress={handleCreate}
                flex={1}
                disabled={!title.trim() || !listId || create.isPending}
              >
                {create.isPending
                  ? "Adding…"
                  : activeList
                    ? `Add to ${activeList.name}`
                    : "Add"}
              </Button>
            </XStack>
          </YStack>
        </Sheet.ScrollView>
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
      {...(active && color ? { backgroundColor: color as never } : {})}
    >
      {children}
    </Button>
  );
}
