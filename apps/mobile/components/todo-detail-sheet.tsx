// apps/mobile/components/todo-detail-sheet.tsx
//
// Data wiring for the native todo detail sheet (@repo/features/todos
// `TodoDetailSheet`): per-field optimistic PATCHes, the done/undone toggle,
// the "⋯" action sheet (Delete, confirmed) and the instant-commit subtasks
// block. Replaces the old EditTodoDialog (shared TodoForm + Save/Cancel +
// a body-level Delete button, 2026-10-20) — the hosts (todos tab, Today
// widget, calendar agenda) keep the same `open / onOpenChange / todo` props.

import { useEffect, useRef } from "react";
import { Alert } from "react-native";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "@stageholder/ui";
import { TodoDetailSheet as TodoDetailSheetView } from "@repo/features/todos";
import type { TodoDetailPatch } from "@repo/features/todos";
import type { Todo } from "@repo/core/types";

import { SubtaskSection } from "@/components/subtask-section";
import {
  useDeleteTodo,
  useTodo,
  useToggleTodo,
  useTodoLists,
  useUpdateTodo,
  todoKeys,
} from "@/lib/api";
import { IGNITION } from "@/lib/ignition-palette";

interface TodoDetailSheetProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** The todo on screen; hosts keep the last one through the close slide. */
  todo: Todo | null;
}

export function TodoDetailSheet({
  open,
  onOpenChange,
  todo,
}: TodoDetailSheetProps) {
  const updateTodo = useUpdateTodo();
  const toggleTodo = useToggleTodo();
  const deleteTodo = useDeleteTodo();
  const { data: lists } = useTodoLists();
  const qc = useQueryClient();

  // LIVE ROW. Hosts hand us a SNAPSHOT of the tapped row (state, so it
  // survives the close slide), but every pill/toggle commits optimistically
  // into the query cache — read back through the detail key so the sheet
  // flips on the tap frame instead of showing the stale snapshot. Seeded from
  // the snapshot on each open; `useUpdateTodo` mirrors its patches + the
  // server echo into the same key. `enabled: false` = no GET per open.
  //
  // Until THIS snapshot has been seeded, the snapshot wins over the mirror:
  // the key may still hold an older copy of the same todo from an earlier
  // open (another tab, a refetch since), and the fresh sheet instance seeds
  // its title/notes drafts from its first render — a stale mirror there was
  // autosaved back over the todo.
  const seededFor = useRef<Todo | null>(null);
  useEffect(() => {
    if (open && todo) {
      qc.setQueryData<Todo>(todoKeys.detail(todo.id), todo);
      seededFor.current = todo;
    }
  }, [open, todo, qc]);
  const live = useTodo(todo?.id, { enabled: false }).data;

  if (!todo) return null;
  const current = seededFor.current === todo && live ? live : todo;

  // Each field commits on its own (the hook patches every cached list
  // optimistically, so the sheet — which reads off `todo` — flips at once).
  // Only failures surface; a successful save is the expected, silent case.
  function handlePatch(patch: TodoDetailPatch) {
    updateTodo.mutate(
      { id: current.id, patch },
      { onError: () => toast.error("Couldn't save change") },
    );
  }

  function handleToggleStatus() {
    toggleTodo.mutate(
      { id: current.id, status: current.status },
      { onError: () => toast.error("Couldn't update todo") },
    );
  }

  function confirmDelete() {
    Alert.alert(
      `Delete "${current.title}"?`,
      "This todo and its subtasks will be removed. This cannot be undone.",
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Delete",
          style: "destructive",
          onPress: () =>
            deleteTodo.mutate(current.id, {
              onSuccess: () => {
                toast.success("Todo deleted");
                onOpenChange(false);
              },
              onError: () => toast.error("Couldn't delete todo"),
            }),
        },
      ],
    );
  }

  // "⋯" rows — an in-app sheet nested in the detail sheet (see
  // features/_internal/more-actions-sheet.native.tsx), not ActionSheetIOS.
  const moreActions = [
    {
      label: current.status === "done" ? "Mark as not done" : "Mark as done",
      onPress: handleToggleStatus,
    },
    { label: "Delete todo", destructive: true, onPress: confirmDelete },
  ];

  return (
    <TodoDetailSheetView
      open={open}
      onOpenChange={onOpenChange}
      todo={current}
      lists={lists}
      // Resolved hex — native can't parse the web `var(--ring-todo)`.
      accentColor={IGNITION.todo.base}
      onPatch={handlePatch}
      onToggleStatus={handleToggleStatus}
      moreActions={moreActions}
      // Keyed per todo so the local subtask list re-seeds when switching.
      subtasks={<SubtaskSection key={`sub-${current.id}`} todo={current} />}
    />
  );
}
