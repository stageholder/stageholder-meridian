// apps/mobile/components/create-todo-dialog.tsx
//
// Native mirror of the PWA's CreateTodoDialog (apps/pwa/src/components/todos/
// create-todo-dialog.tsx). Same shared `TodoForm` from @repo/features/todos and
// the same submit/invalidate behavior; the host is a kit Sheet (FormSheet)
// rather than the PWA's Dialog + DialogSheetAdapt — see form-sheet.tsx for why
// (the inner Select's Adapt can't survive a double teleport on native). The
// form re-mounts on each open (`key={open}`) so it resets by remount.

import { useToast } from "@stageholder/ui";
import {
  TodoForm,
  makeTodoFormDefaults,
  type TodoFormValues,
} from "@repo/features/todos";

import { useCreateTodo, useTodoLists, type TodoPriority } from "@/lib/api";
import { FormSheet } from "@/components/form-sheet";

interface CreateTodoDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Force this list as the destination (hides the List select). */
  listId?: string;
}

export function CreateTodoDialog({
  open,
  onOpenChange,
  listId,
}: CreateTodoDialogProps) {
  const createTodo = useCreateTodo();
  const { data: lists } = useTodoLists();
  const toast = useToast();

  // When `listId` is passed, hide the List select by feeding a single-list
  // shape (the form shows the select only when lists.length > 1).
  const lookupLists = listId ? lists?.filter((l) => l.id === listId) : lists;

  const initial: TodoFormValues = {
    ...makeTodoFormDefaults(),
    listId: listId ?? lists?.find((l) => l.isDefault)?.id ?? lists?.[0]?.id,
  };

  function handleSubmit(values: TodoFormValues) {
    const destListId =
      values.listId ??
      lists?.find((l) => l.isDefault)?.id ??
      lists?.[0]?.id ??
      "";
    if (!destListId) return;

    createTodo.mutate(
      {
        title: values.title,
        description: values.description,
        // The form's "none" sentinel → omit (mirrors the PWA quick-add). The
        // form types priority as a bare string; narrow to the API's union.
        priority:
          values.priority !== "none"
            ? (values.priority as TodoPriority)
            : undefined,
        dueDate: values.dueDate || undefined,
        doDate: values.doDate || undefined,
        listId: destListId,
      },
      {
        onSuccess: () => {
          toast.show({ title: "Todo created", intent: "success" });
          onOpenChange(false);
        },
        onError: () => {
          toast.show({ title: "Failed to create todo", intent: "danger" });
        },
      },
    );
  }

  return (
    <FormSheet
      open={open}
      onOpenChange={onOpenChange}
      title="New Todo"
      description="Create a new todo with optional details, priority, and dates."
    >
      <TodoForm
        key={open ? "open" : "closed"}
        initial={initial}
        lists={lookupLists}
        submitLabel="Create"
        submittingLabel="Creating…"
        isSubmitting={createTodo.isPending}
        onSubmit={handleSubmit}
        onCancel={() => onOpenChange(false)}
      />
    </FormSheet>
  );
}
