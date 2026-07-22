// apps/mobile/components/todo-list-sheet.tsx
//
// Create / edit a todo LIST — native counterpart of the PWA's
// CreateListDialog + list edit menu (apps/pwa/src/components/todos/
// create-list-dialog.tsx, todo-list-sidebar.tsx). Hosts the SAME shared
// TodoListForm (name + color swatches) from @repo/features/todos in a kit
// FormSheet, like every other mobile form flow.
//
//   list == null  → CREATE  (POST /todo-lists)
//   list != null  → EDIT    (PUT /todo-lists/:id) + a Delete action that
//                   confirms via the platform Alert (RN destructive idiom).

import { Button, FormSheet, Separator, toast } from "@stageholder/ui";
import {
  TODO_LIST_FORM_DEFAULTS,
  TodoListForm,
  type TodoListFormValues,
} from "@repo/features/todos";
import type { TodoList } from "@repo/core/types";
import { Trash2 } from "@tamagui/lucide-icons-2";
import { Alert } from "react-native";

import {
  useCreateTodoList,
  useDeleteTodoList,
  useUpdateTodoList,
} from "@/lib/api";
import { useOpenEpoch } from "@/lib/hooks/use-open-epoch";

interface TodoListSheetProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** null → create a new list; a list → edit (rename / recolor / delete). */
  list: TodoList | null;
  /** Fired after the edited/created list is gone or changed — the host can
   *  reset its active-list filter if it pointed at a deleted list. */
  onDeleted?: (id: string) => void;
}

export function TodoListSheet({
  open,
  onOpenChange,
  list,
  onDeleted,
}: TodoListSheetProps) {
  const createList = useCreateTodoList();
  const updateList = useUpdateTodoList();
  const deleteList = useDeleteTodoList();
  // Fresh-form key that moves only on closed→open (keying on `open` itself
  // remounted the form mid-close-animation).
  const openEpoch = useOpenEpoch(open);

  const isEdit = list !== null;

  function handleSubmit(values: TodoListFormValues) {
    const onError = () =>
      toast.error(isEdit ? "Couldn't update list" : "Couldn't create list");
    if (isEdit) {
      updateList.mutate(
        { id: list.id, patch: values },
        {
          onSuccess: () => {
            toast.success("List updated");
            onOpenChange(false);
          },
          onError,
        },
      );
    } else {
      createList.mutate(values, {
        onSuccess: () => {
          toast.success("List created");
          onOpenChange(false);
        },
        onError,
      });
    }
  }

  function confirmDelete() {
    if (!list) return;
    Alert.alert(
      `Delete "${list.name}"?`,
      "Todos in this list will be removed with it. This cannot be undone.",
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Delete",
          style: "destructive",
          onPress: () =>
            deleteList.mutate(list.id, {
              onSuccess: () => {
                toast.success("List deleted");
                onOpenChange(false);
                onDeleted?.(list.id);
              },
              onError: () => toast.error("Couldn't delete list"),
            }),
        },
      ],
    );
  }

  return (
    <FormSheet
      hideFooter
      open={open}
      onOpenChange={onOpenChange}
      title={isEdit ? "Edit List" : "New List"}
      description={
        isEdit
          ? "Rename the list or pick a new color."
          : "Group todos under a named, colored list."
      }
    >
      <TodoListForm
        // Create mode keys on the open EPOCH (not `open` itself): each fresh
        // open still remounts a blank form — covering a reopen that lands
        // before the closing sheet unmounts — without the old
        // mid-close-animation remount.
        key={list?.id ?? `create-${openEpoch}`}
        initial={
          list
            ? { name: list.name, color: list.color ?? "#3b82f6" }
            : TODO_LIST_FORM_DEFAULTS
        }
        submitLabel={isEdit ? "Save" : "Create"}
        submittingLabel={isEdit ? "Saving…" : "Creating…"}
        isSubmitting={createList.isPending || updateList.isPending}
        onSubmit={handleSubmit}
        onCancel={() => onOpenChange(false)}
      />
      {isEdit && !list.isDefault ? (
        <>
          <Separator />
          <Button
            intent="destructive"
            icon={<Trash2 size={14} />}
            loading={deleteList.isPending}
            loadingText="Deleting…"
            onPress={confirmDelete}
          >
            Delete list
          </Button>
        </>
      ) : null}
    </FormSheet>
  );
}
