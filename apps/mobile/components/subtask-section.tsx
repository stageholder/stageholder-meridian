// apps/mobile/components/subtask-section.tsx
//
// Subtasks editor for the todo edit sheet — native counterpart of the
// subtasks block in the PWA's TodoDetailDialog (apps/pwa/src/components/
// todos/todo-detail-dialog.tsx). Same semantics: every action commits
// IMMEDIATELY via its own mutation (independent of the surrounding form's
// Save) — toggle status, delete, add-by-title.
//
// State model: local list seeded from the tapped todo's snapshot (the host
// passes a frozen `todo` object), then replaced by the SERVER ECHO each
// mutation returns (the subtask endpoints respond with the full updated
// Todo). This keeps the section live without coupling to the lists-cache
// shape the hooks optimistically patch. The host re-mounts the section per
// todo via `key`, so stale state can't leak between todos.

import { useState } from "react";
import {
  Button,
  Checkbox,
  IconButton,
  Input,
  Text,
  XStack,
  YStack,
  useToast,
} from "@stageholder/ui";
import type { Subtask, Todo } from "@repo/core/types";
import { Check, Plus, X } from "@tamagui/lucide-icons-2";

import { useAddSubtask, useDeleteSubtask, useUpdateSubtask } from "@/lib/api";

export function SubtaskSection({ todo }: { todo: Todo }) {
  const toast = useToast();
  const addSubtask = useAddSubtask();
  const updateSubtask = useUpdateSubtask();
  const deleteSubtask = useDeleteSubtask();

  const [subtasks, setSubtasks] = useState<Subtask[]>(
    Array.isArray(todo.subtasks) ? todo.subtasks : [],
  );
  const [draft, setDraft] = useState("");

  const sorted = [...subtasks].sort((a, b) => a.order - b.order);
  const doneCount = subtasks.filter((s) => s.status === "done").length;

  function syncFromServer(updated: Todo) {
    setSubtasks(Array.isArray(updated.subtasks) ? updated.subtasks : []);
  }

  function handleAdd() {
    const title = draft.trim();
    if (!title) return;
    setDraft("");
    addSubtask.mutate(
      { todoId: todo.id, title },
      {
        onSuccess: syncFromServer,
        onError: () => {
          setDraft(title); // give the text back for retry
          toast.show({ title: "Couldn't add subtask", intent: "danger" });
        },
      },
    );
  }

  function handleToggle(subtask: Subtask) {
    const next = subtask.status === "done" ? "todo" : "done";
    // Optimistic local flip; server echo confirms (or error reverts).
    setSubtasks((prev) =>
      prev.map((s) => (s.id === subtask.id ? { ...s, status: next } : s)),
    );
    updateSubtask.mutate(
      { todoId: todo.id, subtaskId: subtask.id, patch: { status: next } },
      {
        onSuccess: syncFromServer,
        onError: () => {
          setSubtasks((prev) =>
            prev.map((s) =>
              s.id === subtask.id ? { ...s, status: subtask.status } : s,
            ),
          );
          toast.show({ title: "Couldn't update subtask", intent: "danger" });
        },
      },
    );
  }

  function handleDelete(subtask: Subtask) {
    const prevList = subtasks;
    setSubtasks((prev) => prev.filter((s) => s.id !== subtask.id));
    deleteSubtask.mutate(
      { todoId: todo.id, subtaskId: subtask.id },
      {
        onError: () => {
          setSubtasks(prevList);
          toast.show({ title: "Couldn't delete subtask", intent: "danger" });
        },
      },
    );
  }

  return (
    <YStack gap="$2">
      <XStack items="center" justify="space-between">
        <Text fontSize="$2" fontWeight="600" color="$color">
          Subtasks
        </Text>
        {subtasks.length > 0 ? (
          <Text fontSize="$1" color="$mutedForeground">
            {doneCount}/{subtasks.length}
          </Text>
        ) : null}
      </XStack>

      {sorted.map((subtask) => {
        const done = subtask.status === "done";
        return (
          // The ROW is the toggle target (UserMenuContent switch-row
          // pattern): one press surface with a real 44pt hit area, and no
          // reliance on TamaguiCheckbox's internal press inside a portaled
          // sheet (where it proved unreliable). The checkbox is visual-only.
          <XStack
            key={subtask.id}
            items="center"
            gap="$2.5"
            py="$1"
            onPress={() => handleToggle(subtask)}
            pressStyle={{ opacity: 0.7 }}
            role="checkbox"
            aria-checked={done}
          >
            <Checkbox checked={done} pointerEvents="none">
              <Checkbox.Indicator>
                <Check size={12} color="$primaryForeground" />
              </Checkbox.Indicator>
            </Checkbox>
            <Text
              flex={1}
              minW={0}
              fontSize="$3"
              color={done ? "$mutedForeground" : "$color"}
              textDecorationLine={done ? "line-through" : "none"}
              numberOfLines={2}
            >
              {subtask.title}
            </Text>
            <IconButton
              variant="ghost"
              size="sm"
              aria-label="Delete subtask"
              onPress={() => handleDelete(subtask)}
            >
              <X size={14} color="$mutedForeground" />
            </IconButton>
          </XStack>
        );
      })}

      {/* Add row — immediate POST on submit, like the PWA's inline form. */}
      <XStack items="center" gap="$2">
        <Input
          flex={1}
          size="sm"
          value={draft}
          onChangeText={setDraft}
          placeholder="Add a subtask"
          onSubmitEditing={handleAdd}
          returnKeyType="done"
        />
        <Button
          intent="outline"
          size="sm"
          icon={<Plus size={14} />}
          disabled={!draft.trim() || addSubtask.isPending}
          loading={addSubtask.isPending}
          onPress={handleAdd}
        >
          Add
        </Button>
      </XStack>
    </YStack>
  );
}
