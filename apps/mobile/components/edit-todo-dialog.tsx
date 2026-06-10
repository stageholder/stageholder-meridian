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

import { FormSheet, Separator, useToast } from "@stageholder/ui";
import { TodoForm, type TodoFormValues } from "@repo/features/todos";
import type { Todo } from "@repo/core/types";

import { SubtaskSection } from "@/components/subtask-section";
import { useUpdateTodo, useTodoLists, type TodoPriority } from "@/lib/api";
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
  const { data: lists } = useTodoLists();
  const toast = useToast();

  // Nothing to edit until a row is tapped — keeps the form's `initial` honest.
  if (!todo) return null;

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
          // Empty description clears it; the API treats an empty string as
          // "no description" (mirrors the PWA's null-on-empty behavior).
          description: values.description ?? "",
          // The form types priority as a bare string; narrow to the API's
          // union ("none" is a valid value here — the API persists it).
          priority: values.priority as TodoPriority,
          dueDate: values.dueDate || undefined,
          doDate: values.doDate || undefined,
          listId: values.listId,
        },
      },
      {
        onSuccess: () => {
          toast.show({ title: "Todo updated", intent: "success" });
          onOpenChange(false);
        },
        onError: () => {
          toast.show({ title: "Failed to update todo", intent: "danger" });
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
      open={open}
      onOpenChange={onOpenChange}
      title="Edit Todo"
      description="Update the title, details, priority, dates, and list."
    >
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
    </FormSheet>
  );
}
