// apps/mobile/components/todos/TodoDetailSheet.tsx
//
// Tap a TodoRow → this sheet opens. Mirrors PWA's TodoDetailDialog
// (apps/pwa/components/todos/todo-detail-dialog.tsx):
//   - Header: complete-toggle, title (tap to edit inline)
//   - Description (tap to edit, textarea)
//   - Subtasks list with checkbox + delete + add-form
//   - Priority pill picker
//   - Due date + Do date pickers (cross-platform DatePicker from @stageholder/ui)
//   - Timestamps + Delete button
//
// All field changes save immediately (no separate "Save" button) — matches
// the PWA's click-to-edit-then-blur-to-save pattern. The exception is
// description, which has explicit Save/Cancel buttons because users often
// type multi-paragraph notes and an accidental tap-out shouldn't lose them.

import {
  Button,
  Checkbox,
  DatePicker,
  Input,
  Paragraph,
  Sheet,
  Text,
  TextArea,
  View,
  XStack,
  YStack,
  useHaptic,
  useToast,
} from "@stageholder/ui";
import type { Todo } from "@repo/core/types";
import { useEffect, useRef, useState } from "react";
import { Alert, Pressable } from "react-native";

import {
  extractServerMessage,
  useAddSubtask,
  useDeleteSubtask,
  useDeleteTodo,
  useUpdateSubtask,
  useUpdateTodo,
} from "@/lib/api";

const PRIORITIES: { value: Todo["priority"]; label: string; color: string }[] =
  [
    { value: "urgent", label: "Urgent", color: "#ef4444" },
    { value: "high", label: "High", color: "#f97316" },
    { value: "medium", label: "Medium", color: "#eab308" },
    { value: "low", label: "Low", color: "#3b82f6" },
    { value: "none", label: "None", color: "#64748b" },
  ];

export type TodoDetailSheetProps = {
  open: boolean;
  onClose: () => void;
  todo: Todo | null;
};

export function TodoDetailSheet({ open, onClose, todo }: TodoDetailSheetProps) {
  const haptic = useHaptic();
  const toast = useToast();
  const updateTodo = useUpdateTodo();
  const deleteTodo = useDeleteTodo();
  const addSubtask = useAddSubtask();
  const updateSubtask = useUpdateSubtask();
  const deleteSubtask = useDeleteSubtask();

  // Local drafts for click-to-edit fields. Synced when the underlying todo
  // changes externally (e.g. background refetch) BUT only while not actively
  // editing — preserves in-flight user input across optimistic invalidations.
  const [editingTitle, setEditingTitle] = useState(false);
  const [titleDraft, setTitleDraft] = useState(todo?.title ?? "");
  const [editingDesc, setEditingDesc] = useState(false);
  const [descDraft, setDescDraft] = useState(todo?.description ?? "");
  const [newSubtask, setNewSubtask] = useState("");
  const titleCancelledRef = useRef(false);

  useEffect(() => {
    if (!editingTitle) setTitleDraft(todo?.title ?? "");
  }, [todo?.title, editingTitle]);
  useEffect(() => {
    if (!editingDesc) setDescDraft(todo?.description ?? "");
  }, [todo?.description, editingDesc]);

  if (!todo) return null;

  const isDone = todo.status === "done";

  function patch(data: Parameters<typeof updateTodo.mutate>[0]["patch"]) {
    if (!todo) return;
    updateTodo.mutate(
      { id: todo.id, patch: data },
      {
        onError: (err) => {
          toast.show({
            title: "Save failed",
            message:
              extractServerMessage(err) ??
              (err as Error).message ??
              "Tap to retry.",
            intent: "danger",
          });
        },
      },
    );
  }

  function handleToggleStatus() {
    if (!todo) return;
    haptic.notification("success");
    patch({ status: isDone ? "todo" : "done" });
  }

  function handleSaveTitle() {
    if (!todo) return;
    if (titleCancelledRef.current) {
      titleCancelledRef.current = false;
      setEditingTitle(false);
      return;
    }
    const trimmed = titleDraft.trim();
    if (trimmed && trimmed !== todo.title) patch({ title: trimmed });
    if (!trimmed) setTitleDraft(todo.title);
    setEditingTitle(false);
  }

  function handleSaveDescription() {
    if (!todo) return;
    const trimmed = descDraft.trim();
    const current = todo.description ?? "";
    if (trimmed !== current) patch({ description: trimmed || undefined });
    setEditingDesc(false);
  }

  function handleDelete() {
    if (!todo) return;
    Alert.alert(
      "Delete todo?",
      `"${todo.title}" will be removed permanently.`,
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Delete",
          style: "destructive",
          onPress: () => {
            haptic.impact("medium");
            deleteTodo.mutate(todo.id, {
              onSuccess: () => onClose(),
              onError: () =>
                toast.show({
                  title: "Couldn't delete",
                  message: "Restored. Tap to retry.",
                  intent: "danger",
                }),
            });
          },
        },
      ],
    );
  }

  function handleAddSubtask() {
    if (!todo) return;
    const title = newSubtask.trim();
    if (!title) return;
    addSubtask.mutate(
      { todoId: todo.id, title },
      {
        onSuccess: () => setNewSubtask(""),
        onError: () =>
          toast.show({
            title: "Couldn't add",
            message: "Tap to retry.",
            intent: "danger",
          }),
      },
    );
  }

  const priorityCfg =
    PRIORITIES.find((p) => p.value === todo.priority) ?? PRIORITIES[4]!;
  const subtaskCount = todo.subtasks?.length ?? 0;
  const subtaskDone =
    todo.subtasks?.filter((s) => s.status === "done").length ?? 0;

  return (
    <Sheet
      modal
      open={open}
      onOpenChange={(o: boolean) => {
        if (!o) onClose();
      }}
      snapPoints={[92]}
      dismissOnSnapToBottom
    >
      <Sheet.Overlay />
      <Sheet.Handle />
      <Sheet.Frame>
        <Sheet.ScrollView showsVerticalScrollIndicator={false}>
          <YStack gap="$4" pb="$6">
            {/* ---- Header: checkbox + title + close ---- */}
            <XStack items="flex-start" gap="$3">
              <Checkbox
                size="$4"
                checked={isDone}
                onCheckedChange={handleToggleStatus}
              >
                <Checkbox.Indicator>
                  <Text color="white" fontWeight="700" fontSize="$3">
                    ✓
                  </Text>
                </Checkbox.Indicator>
              </Checkbox>

              <YStack flex={1} gap="$1">
                {editingTitle ? (
                  <Input
                    autoFocus
                    value={titleDraft}
                    onChangeText={setTitleDraft}
                    onBlur={handleSaveTitle}
                    onSubmitEditing={handleSaveTitle}
                    returnKeyType="done"
                    fontSize="$5"
                    fontWeight="700"
                  />
                ) : (
                  <Pressable onPress={() => setEditingTitle(true)}>
                    <Text
                      fontSize="$5"
                      fontWeight="700"
                      color={(isDone ? "$color10" : "$color12") as never}
                      style={
                        isDone
                          ? { textDecorationLine: "line-through" }
                          : undefined
                      }
                    >
                      {todo.title}
                    </Text>
                  </Pressable>
                )}
                {isDone ? (
                  <Text fontSize="$1" color="$green11" fontWeight="500">
                    ✓ Completed
                  </Text>
                ) : null}
              </YStack>

              <Pressable onPress={onClose} hitSlop={12}>
                <Text fontSize="$6" color="$color11" fontWeight="300">
                  ✕
                </Text>
              </Pressable>
            </XStack>

            {/* ---- Description ---- */}
            <YStack gap="$2">
              <XStack items="center" justify="space-between">
                <Text
                  fontSize={10}
                  letterSpacing={1.6}
                  textTransform="uppercase"
                  color="$color11"
                  fontWeight="600"
                  fontFamily="$mono"
                >
                  Description
                </Text>
                {!editingDesc ? (
                  <Pressable onPress={() => setEditingDesc(true)}>
                    <Text fontSize="$1" color="$color11">
                      {todo.description ? "Edit" : "Add"}
                    </Text>
                  </Pressable>
                ) : null}
              </XStack>
              {editingDesc ? (
                <YStack gap="$2">
                  <TextArea
                    autoFocus
                    value={descDraft}
                    onChangeText={setDescDraft}
                    placeholder="Add a description…"
                    minH={96 as never}
                    size="$3"
                  />
                  <XStack gap="$2">
                    <Button
                      intent="primary"
                      size="$2"
                      onPress={handleSaveDescription}
                    >
                      Save
                    </Button>
                    <Button
                      intent="ghost"
                      size="$2"
                      onPress={() => {
                        setDescDraft(todo.description ?? "");
                        setEditingDesc(false);
                      }}
                    >
                      Cancel
                    </Button>
                  </XStack>
                </YStack>
              ) : todo.description ? (
                <Pressable onPress={() => setEditingDesc(true)}>
                  <Paragraph fontSize="$3" color="$color12" lineHeight="$2">
                    {todo.description}
                  </Paragraph>
                </Pressable>
              ) : (
                <Pressable onPress={() => setEditingDesc(true)}>
                  <Paragraph fontSize="$2" color="$color10" fontStyle="italic">
                    Tap to add a description…
                  </Paragraph>
                </Pressable>
              )}
            </YStack>

            {/* ---- Subtasks ---- */}
            <YStack gap="$2">
              <Text
                fontSize={10}
                letterSpacing={1.6}
                textTransform="uppercase"
                color="$color11"
                fontWeight="600"
                fontFamily="$mono"
              >
                Subtasks
                {subtaskCount > 0 ? ` · ${subtaskDone}/${subtaskCount}` : ""}
              </Text>
              {(todo.subtasks ?? [])
                .slice()
                .sort((a, b) => a.order - b.order)
                .map((s) => (
                  <XStack key={s.id} items="center" gap="$3" py="$1">
                    <Checkbox
                      size="$3"
                      checked={s.status === "done"}
                      onCheckedChange={() =>
                        updateSubtask.mutate({
                          todoId: todo.id,
                          subtaskId: s.id,
                          patch: {
                            status: s.status === "done" ? "todo" : "done",
                          },
                        })
                      }
                    >
                      <Checkbox.Indicator>
                        <Text color="white" fontWeight="700" fontSize={10}>
                          ✓
                        </Text>
                      </Checkbox.Indicator>
                    </Checkbox>
                    <Text
                      flex={1}
                      fontSize="$3"
                      color={
                        (s.status === "done" ? "$color10" : "$color12") as never
                      }
                      style={
                        s.status === "done"
                          ? { textDecorationLine: "line-through" }
                          : undefined
                      }
                    >
                      {s.title}
                    </Text>
                    <Pressable
                      onPress={() =>
                        deleteSubtask.mutate({
                          todoId: todo.id,
                          subtaskId: s.id,
                        })
                      }
                      hitSlop={8}
                    >
                      <Text fontSize="$3" color="$color10">
                        ✕
                      </Text>
                    </Pressable>
                  </XStack>
                ))}
              <XStack gap="$2" items="center">
                <Input
                  flex={1}
                  size="$3"
                  placeholder="Add subtask…"
                  value={newSubtask}
                  onChangeText={setNewSubtask}
                  onSubmitEditing={handleAddSubtask}
                  returnKeyType="done"
                />
                <Button
                  intent="ghost"
                  size="$3"
                  onPress={handleAddSubtask}
                  disabled={!newSubtask.trim()}
                >
                  Add
                </Button>
              </XStack>
            </YStack>

            {/* ---- Priority ---- */}
            <YStack gap="$2">
              <Text
                fontSize={10}
                letterSpacing={1.6}
                textTransform="uppercase"
                color="$color11"
                fontWeight="600"
                fontFamily="$mono"
              >
                Priority
              </Text>
              <XStack gap="$2" flexWrap="wrap">
                {PRIORITIES.map((p) => {
                  const active = todo.priority === p.value;
                  return (
                    <Pressable
                      key={p.value}
                      onPress={() => patch({ priority: p.value })}
                    >
                      <XStack
                        items="center"
                        gap="$1.5"
                        px="$2.5"
                        py="$1.5"
                        rounded="$3"
                        bg={(active ? "$color5" : "$color3") as never}
                        borderWidth={1}
                        borderColor={
                          (active ? "$color7" : "transparent") as never
                        }
                      >
                        <View
                          width={8}
                          height={8}
                          rounded={4}
                          bg={p.color as never}
                        />
                        <Text fontSize="$2" color="$color12">
                          {p.label}
                        </Text>
                      </XStack>
                    </Pressable>
                  );
                })}
              </XStack>
            </YStack>

            {/* ---- Dates ---- */}
            <XStack gap="$3">
              <YStack flex={1} gap="$2">
                <Text
                  fontSize={10}
                  letterSpacing={1.6}
                  textTransform="uppercase"
                  color="$color11"
                  fontWeight="600"
                  fontFamily="$mono"
                >
                  Due date
                </Text>
                <DatePicker
                  value={todo.dueDate ?? null}
                  onChange={(v: string | null) =>
                    patch({ dueDate: v ?? undefined })
                  }
                  placeholder="Set due date"
                  clearable
                />
              </YStack>
              <YStack flex={1} gap="$2">
                <Text
                  fontSize={10}
                  letterSpacing={1.6}
                  textTransform="uppercase"
                  color="$color11"
                  fontWeight="600"
                  fontFamily="$mono"
                >
                  Do date
                </Text>
                <DatePicker
                  value={todo.doDate ?? null}
                  onChange={(v: string | null) =>
                    patch({ doDate: v ?? undefined })
                  }
                  placeholder="Set do date"
                  clearable
                />
              </YStack>
            </XStack>

            {/* ---- Timestamps + delete ---- */}
            <YStack gap="$2" pt="$3" borderTopWidth={1} borderColor="$color6">
              <XStack justify="space-between">
                <Text fontSize="$1" color="$color11">
                  Created
                </Text>
                <Text fontSize="$1" color="$color11">
                  {formatDate(todo.createdAt)}
                </Text>
              </XStack>
              <XStack justify="space-between">
                <Text fontSize="$1" color="$color11">
                  Updated
                </Text>
                <Text fontSize="$1" color="$color11">
                  {formatDate(todo.updatedAt)}
                </Text>
              </XStack>
            </YStack>

            <Button intent="destructive" size="$3" onPress={handleDelete}>
              Delete todo
            </Button>
          </YStack>
        </Sheet.ScrollView>
      </Sheet.Frame>
    </Sheet>
  );
}

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}
