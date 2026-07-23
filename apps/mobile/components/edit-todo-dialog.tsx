// apps/mobile/components/edit-todo-dialog.tsx
//
// Native edit flow for an existing todo. The PWA edits a todo through a
// two-column inline-edit detail dialog (apps/pwa/src/components/todos/
// todo-detail-dialog.tsx) with per-field mutations and subtasks. That UI leans
// on web-only affordances (raw input refs, onKeyDown, hover-reveal). Mobile
// instead reuses the same shared `TodoForm` from @repo/features/todos that the
// create flow uses — seeded with the tapped todo's values — and submits a
// single PATCH. Same kit FormSheet host as CreateTodoDialog.
//
// Subtasks ARE edited here (PWA TodoDetailDialog parity): the SubtaskSection
// below the form commits each toggle/add/delete immediately via its own
// mutation — independent of the form's single Save PATCH.

import { Alert } from "react-native";
import { Button, FormSheet, Separator, Sheet, toast } from "@stageholder/ui";

import { FormSheetSkeleton } from "@/components/form-sheet-skeleton";
import { Trash2 } from "@tamagui/lucide-icons-2";
import { TodoForm, type TodoFormValues } from "@repo/features/todos";
import type { Todo } from "@repo/core/types";

import { SubtaskSection } from "@/components/subtask-section";
import {
  useDeleteTodo,
  useUpdateTodo,
  useTodoLists,
  type TodoPriority,
} from "@/lib/api";
import { IGNITION } from "@/lib/ignition-palette";

interface EditTodoDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** The todo being edited; the sheet only opens once one is set. */
  todo: Todo | null;
}

/**
 * Map the API's date fields to the form's `yyyy-MM-dd` shape. The create flow
 * stores bare date strings, but the column also accepts full ISO timestamps —
 * slicing the first 10 chars yields the local-day prefix either way.
 */
function toFormDate(value: string | undefined): string {
  return value ? value.slice(0, 10) : "";
}

export function EditTodoDialog({
  open,
  onOpenChange,
  todo,
}: EditTodoDialogProps) {
  const updateTodo = useUpdateTodo();
  const deleteTodo = useDeleteTodo();
  const { data: lists } = useTodoLists();

  // Nothing to edit until a row is tapped — keeps the form's `initial` honest.
  if (!todo) return null;

  // Delete lives HERE because the shared TodoItem's default row-level trash is a
  // hover-reveal (`$group-hover`) that no-ops on a touchscreen — so this sheet
  // is the only reachable delete affordance on native. Confirm first (matches
  // todo-list-sheet's own destructive pattern) — deletion can't be undone.
  function confirmDelete() {
    Alert.alert(
      `Delete "${todo!.title}"?`,
      "This todo and its subtasks will be removed. This cannot be undone.",
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Delete",
          style: "destructive",
          onPress: () =>
            deleteTodo.mutate(todo!.id, {
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

  const initial: TodoFormValues = {
    title: todo.title,
    description: todo.description ?? "",
    priority: todo.priority,
    dueDate: toFormDate(todo.dueDate),
    doDate: toFormDate(todo.doDate),
    listId: todo.listId,
  };

  function handleSubmit(values: TodoFormValues) {
    updateTodo.mutate(
      {
        id: todo!.id,
        patch: {
          title: values.title,
          // Empty clears it — send `null` so the PATCH persists the clear
          // (the API maps null/empty description to "no description").
          description: values.description || null,
          // The form types priority as a bare string; narrow to the API's
          // union ("none" is a valid value here — the API persists it).
          priority: values.priority as TodoPriority,
          // `null` clears a date; `undefined` would leave it untouched, so an
          // emptied date field must send null to actually remove it.
          dueDate: values.dueDate || null,
          doDate: values.doDate || null,
          listId: values.listId,
        },
      },
      {
        onSuccess: () => {
          toast.success("Todo updated");
          onOpenChange(false);
        },
        onError: () => {
          toast.error("Failed to update todo");
        },
      },
    );
  }

  return (
    <FormSheet
      // The shared form renders its own accent-colored Cancel/Create
      // buttons, so hide the kit footer; we keep the kit FormSheet for its
      // keyboard-stretch handling + frame + title.
      hideFooter
      // Form + growing SubtaskSection + delete button can exceed the screen —
      // capped snap + scrolling fields (alpha.121), header/footer pinned.
      scrollable
      open={open}
      onOpenChange={onOpenChange}
      title="Edit Todo"
      description="Update the title, details, priority, dates, and list."
    >
      {/* Kit open choreography — see create-todo-dialog. Wraps the WHOLE
          body (form + subtasks + delete) so the slide runs light. */}
      <Sheet.LazyBody fallback={<FormSheetSkeleton rows={4} />}>
        {/* Re-mount when switching between todos so each opens with its own
          values (the form seeds state from `initial` only on mount). */}
        <TodoForm
          key={todo.id}
          initial={initial}
          lists={lists}
          submitLabel="Save"
          submittingLabel="Saving…"
          isSubmitting={updateTodo.isPending}
          // Resolved hex — native can't parse the web `var(--ring-todo)` default.
          accentColor={IGNITION.todo.base}
          onSubmit={handleSubmit}
          onCancel={() => onOpenChange(false)}
        />

        {/* Subtasks — instant-commit section (each action is its own mutation,
          like the PWA detail dialog), so it sits OUTSIDE the form's
          Save/Cancel lifecycle. Keyed per todo so state re-seeds. */}
        <Separator />
        <SubtaskSection key={`sub-${todo.id}`} todo={todo} />

        {/* Delete — the reachable native delete affordance (row trash is
          hover-only). Destructive, confirmed via Alert. */}
        <Separator />
        <Button
          intent="destructive"
          icon={<Trash2 size={14} />}
          loading={deleteTodo.isPending}
          loadingText="Deleting…"
          onPress={confirmDelete}
        >
          Delete todo
        </Button>
      </Sheet.LazyBody>
    </FormSheet>
  );
}
