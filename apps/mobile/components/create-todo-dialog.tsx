// apps/mobile/components/create-todo-dialog.tsx
//
// Native create-todo flow — a Todoist-style compact quick-add: type a title
// (smart NL parse fills the pills), everything else is a pill with a default.
// The PWA's create dialog keeps the full `TodoForm`; this native flow uses the
// shared `QuickAddTodoSheet` from @repo/features/todos, which resets by state
// (no remount key / LazyBody / skeleton).

import { toast } from "@stageholder/ui";

import { QuickAddTodoSheet, type TodoFormValues } from "@repo/features/todos";

import { useCreateTodo, useTodoLists, type TodoPriority } from "@/lib/api";
import { IGNITION } from "@/lib/ignition-palette";

interface CreateTodoDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Force this list as the destination (hides the List select). */
  listId?: string;
  /**
   * Pre-fill the due date (`yyyy-MM-dd`). Used by the calendar's "Add Todo" so a
   * todo created from a tapped day is actually DUE that day (PWA parity —
   * `create-todo-dialog.tsx`'s `defaultDueDate`); without it the new todo lands
   * on the form default and never shows up on the day the user tapped.
   */
  defaultDueDate?: string;
}

export function CreateTodoDialog({
  open,
  onOpenChange,
  listId,
  defaultDueDate,
}: CreateTodoDialogProps) {
  const createTodo = useCreateTodo();
  const { data: lists } = useTodoLists();

  // When `listId` is passed, hide the List pill by feeding a single-list shape
  // (the sheet shows the List pill only when lists.length > 1).
  const lookupLists = listId ? lists?.filter((l) => l.id === listId) : lists;

  function handleSubmit(values: TodoFormValues) {
    const destListId =
      values.listId ??
      lists?.find((l) => l.isDefault)?.id ??
      lists?.[0]?.id ??
      "";
    // No destination yet means the lists query hasn't resolved. Tell the user
    // instead of failing silently — a retry usually lands once lists load.
    if (!destListId) {
      toast.warning("Lists still loading, try again");
      return;
    }

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
          toast.success("Todo created");
          onOpenChange(false);
        },
        onError: () => {
          toast.error("Failed to create todo");
        },
      },
    );
  }

  return (
    <QuickAddTodoSheet
      open={open}
      onOpenChange={onOpenChange}
      lists={lookupLists}
      defaultDueDate={defaultDueDate}
      // Resolved hex — native can't parse the web `var(--ring-todo)` default.
      accentColor={IGNITION.todo.base}
      isSubmitting={createTodo.isPending}
      onSubmit={handleSubmit}
    />
  );
}
