import { Dialog, useToast } from "@stageholder/ui";
import {
  TodoListForm,
  TODO_LIST_FORM_DEFAULTS,
  type TodoListFormValues,
} from "@repo/features/todos";
import { useCreateTodoList, useUpdateTodoList } from "@/lib/api/todos";
import type { TodoList } from "@repo/core/types";

interface CreateListDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** When provided, the dialog edits this list instead of creating one. */
  list?: TodoList;
}

/**
 * PWA wrapper: kit `Dialog` chrome + the shared `TodoListForm` view from
 * `@repo/features/todos`. The form re-mounts on each open (`key={open}`)
 * so reset / re-seed happens by remount rather than a useEffect dance.
 */
export function CreateListDialog({
  open,
  onOpenChange,
  list,
}: CreateListDialogProps) {
  const isEdit = !!list;
  const createList = useCreateTodoList();
  const updateList = useUpdateTodoList();
  const toast = useToast();
  const pending = createList.isPending || updateList.isPending;

  const initial: TodoListFormValues = list
    ? { name: list.name, color: list.color ?? "#3b82f6" }
    : TODO_LIST_FORM_DEFAULTS;

  function handleSubmit(values: TodoListFormValues) {
    if (isEdit && list) {
      updateList.mutate(
        { listId: list.id, data: { name: values.name, color: values.color } },
        {
          onSuccess: () => {
            toast.show({ title: "List updated", intent: "success" });
            onOpenChange(false);
          },
          onError: () =>
            toast.show({ title: "Failed to update list", intent: "danger" }),
        },
      );
      return;
    }

    createList.mutate(
      { name: values.name, color: values.color },
      {
        onSuccess: () => {
          toast.show({ title: "List created", intent: "success" });
          onOpenChange(false);
        },
        onError: () =>
          toast.show({ title: "Failed to create list", intent: "danger" }),
      },
    );
  }

  return (
    // disableRemoveScroll: the kit's modal scroll-lock sets scrollbar-gutter +
    // overflow:hidden on <html>, but this PWA scrolls in an inner container
    // (app-shell's <main>), so the lock just reserves a phantom gutter and
    // shifts the background on open. The full-screen scrim already blocks
    // background interaction, so the lock is redundant here.
    <Dialog open={open} onOpenChange={onOpenChange} disableRemoveScroll>
      <Dialog.Portal>
        <Dialog.Overlay />
        <Dialog.Content width="90%" maxW={420}>
          <Dialog.Title>{isEdit ? "Edit List" : "New List"}</Dialog.Title>
          <Dialog.Description>
            {isEdit
              ? "Update this list's name and color."
              : "Name your list and pick a color."}
          </Dialog.Description>
          <TodoListForm
            // Re-seed on each open (React idiom — no useEffect needed in the view).
            key={open ? "open" : "closed"}
            initial={initial}
            submitLabel={isEdit ? "Save" : "Create"}
            submittingLabel={isEdit ? "Saving…" : "Creating…"}
            isSubmitting={pending}
            onSubmit={handleSubmit}
            onCancel={() => onOpenChange(false)}
          />
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog>
  );
}
