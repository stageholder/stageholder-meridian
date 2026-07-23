// apps/mobile/components/create-todo-dialog.tsx
//
// Native mirror of the PWA's CreateTodoDialog (apps/pwa/src/components/todos/
// create-todo-dialog.tsx). Same shared `TodoForm` from @repo/features/todos and
// the same submit/invalidate behavior; the host is a kit Sheet (FormSheet)
// rather than the PWA's Dialog + DialogSheetAdapt for why
// (the inner Select's Adapt can't survive a double teleport on native). The
// form re-mounts on each open (`key={open}`) so it resets by remount.

import { FormSheet, Sheet, toast } from "@stageholder/ui";

import { FormSheetSkeleton } from "@/components/form-sheet-skeleton";
import {
  TodoForm,
  makeTodoFormDefaults,
  type TodoFormValues,
} from "@repo/features/todos";

import { useCreateTodo, useTodoLists, type TodoPriority } from "@/lib/api";
import { useOpenEpoch } from "@/lib/hooks/use-open-epoch";
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
  // Fresh-form key that moves only on closed→open (see the hook header —
  // keying on `open` itself remounted the form mid-close-animation).
  const openEpoch = useOpenEpoch(open);

  // When `listId` is passed, hide the List select by feeding a single-list
  // shape (the form shows the select only when lists.length > 1).
  const lookupLists = listId ? lists?.filter((l) => l.id === listId) : lists;

  const initial: TodoFormValues = {
    ...makeTodoFormDefaults(),
    ...(defaultDueDate ? { dueDate: defaultDueDate } : {}),
    listId: listId ?? lists?.find((l) => l.isDefault)?.id ?? lists?.[0]?.id,
  };

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
    <FormSheet
      // The shared form renders its own accent-colored Cancel/Create
      // buttons, so hide the kit footer; we keep the kit FormSheet for its
      // keyboard-stretch handling + frame + title.
      hideFooter
      // Default mountChildren ('open'): closed = nothing mounted, open =
      // mount fresh. `first-open` was tried and reverted — the form's
      // reset-per-open epoch key remounts it at every open anyway, so warm-
      // keeping only added a permanently-mounted form to the screen (the
      // smooth sibling apps also run sheets on the default).
      //
      // `scrollable` + constant snap is the "dim → wait → slide" fix: a
      // `fit` sheet can't START its slide until the whole TodoForm has
      // mounted AND been measured (the kit's documented fit-mode mechanic),
      // so the overlay dimmed, then nothing, then a late slide. A constant
      // height starts the slide on the open frame and the form mounts
      // DURING the motion; fields scroll if a small phone runs out of room.
      scrollable
      snapPoints={[560]}
      open={open}
      onOpenChange={onOpenChange}
      title="New Todo"
      description="Create a new todo with optional details, priority, and dates."
    >
      {/* Kit open choreography (alpha.121): the sheet slides IMMEDIATELY
          with this skeleton; the real form (2 Selects + 2 date pickers +
          smart input) cross-fades in when the spring settles — the form
          mount never competes with the slide. Safe with `scrollable`
          (constant snap); never pair LazyBody with fit. */}
      <Sheet.LazyBody fallback={<FormSheetSkeleton />}>
        <TodoForm
          // Include the seed date in the key so re-opening from a DIFFERENT
          // calendar day re-seeds the form (not just per-open).
          key={`${openEpoch}-${defaultDueDate ?? ""}`}
          initial={initial}
          lists={lookupLists}
          submitLabel="Create"
          submittingLabel="Creating…"
          isSubmitting={createTodo.isPending}
          // Resolved hex — native can't parse the web `var(--ring-todo)` default.
          accentColor={IGNITION.todo.base}
          onSubmit={handleSubmit}
          onCancel={() => onOpenChange(false)}
        />
      </Sheet.LazyBody>
    </FormSheet>
  );
}
