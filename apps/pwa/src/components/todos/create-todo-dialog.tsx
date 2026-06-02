import { useQueryClient } from "@tanstack/react-query";
import { Dialog, useToast } from "@stageholder/ui";
import {
  TodoForm,
  makeTodoFormDefaults,
  type TodoFormValues,
} from "@repo/features/todos";
import { useCreateTodo, useTodoLists } from "@/lib/api/todos";

interface CreateTodoDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Force this list as the destination (hides the List select even when >1 lists exist). */
  listId?: string;
  /** Pre-fill the due date (date-pages launch the dialog with their date). */
  defaultDueDate?: string;
}

/**
 * PWA wrapper: kit `Dialog` chrome (with the popover-click-through guard)
 * + the shared `TodoForm` view from `@repo/features/todos`. The form
 * re-mounts on each open (`key={open}`) so reset-on-close happens by
 * remount rather than a manual reset pass.
 *
 * Owns the calendar query invalidation on successful create — calendar
 * grouping needs to refresh when a new todo lands on a date.
 */
export function CreateTodoDialog({
  open,
  onOpenChange,
  listId,
  defaultDueDate,
}: CreateTodoDialogProps) {
  const queryClient = useQueryClient();
  const createTodo = useCreateTodo();
  const { data: lists } = useTodoLists();
  const toast = useToast();

  // When `listId` is passed in (page already scoped to a list), hide the
  // List select by feeding a single-list shape to the view — the view
  // shows the select only when `lists.length > 1`.
  const lookupLists = listId ? lists?.filter((l) => l.id === listId) : lists;

  const initial: TodoFormValues = {
    ...makeTodoFormDefaults(),
    listId: listId ?? lists?.find((l) => l.isDefault)?.id ?? lists?.[0]?.id,
    dueDate: defaultDueDate ?? "",
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
        listId: destListId,
        data: {
          title: values.title,
          description: values.description,
          priority: values.priority,
          dueDate: values.dueDate,
          doDate: values.doDate,
        },
      },
      {
        onSuccess: () => {
          toast.show({ title: "Todo created", intent: "success" });
          onOpenChange(false);
          void queryClient.invalidateQueries({ queryKey: ["calendar"] });
        },
        onError: () => {
          toast.show({ title: "Failed to create todo", intent: "danger" });
        },
      },
    );
  }

  return (
    // `disableRemoveScroll`: the kit's modal scroll-lock sets overflow:hidden +
    // scrollbar-gutter:stable on <html>, but this PWA scrolls in an inner
    // container (app-shell's <main>), so the lock only reserves a phantom gutter
    // and shifts the background when the dialog opens. The full-screen scrim
    // already blocks background interaction, so the lock is redundant.
    <Dialog open={open} onOpenChange={onOpenChange} disableRemoveScroll>
      <Dialog.Portal>
        <Dialog.Overlay />
        <Dialog.Content
          width="90%"
          // 560 (not the old 448) so the Priority · Due · Do row sits three
          // across with each date pill wide enough to keep "No due date" on a
          // single line. `width="90%"` still caps it on small screens.
          maxW={560}
          maxH={"86vh" as never}
          overflow={"auto" as never}
          onPointerDownOutside={(e: {
            target: EventTarget | null;
            preventDefault: () => void;
          }) => {
            const target = e.target as Element;
            if (target.closest('[data-slot="popover-content"]')) {
              e.preventDefault();
            }
          }}
          onInteractOutside={(e: {
            target: EventTarget | null;
            preventDefault: () => void;
          }) => {
            const target = e.target as Element;
            if (target.closest('[data-slot="popover-content"]')) {
              e.preventDefault();
            }
          }}
        >
          <Dialog.Title>New Todo</Dialog.Title>
          <Dialog.Description>
            Create a new todo with optional details, priority, and dates.
          </Dialog.Description>
          <TodoForm
            // Re-seed on each open — empty defaults on re-open after submit.
            key={open ? "open" : "closed"}
            initial={initial}
            lists={lookupLists}
            submitLabel="Create"
            submittingLabel="Creating…"
            isSubmitting={createTodo.isPending}
            onSubmit={handleSubmit}
            onCancel={() => onOpenChange(false)}
          />
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog>
  );
}
