// apps/mobile/components/habit-group-sheet.tsx
//
// Create / edit a habit GROUP — native counterpart of the PWA's
// HabitGroupDialog (apps/pwa/src/components/habits/habit-group-dialog.tsx).
// Hosts the SAME shared HabitGroupForm (name + color swatches) from
// @repo/features/habits in a kit FormSheet, exactly like todo-list-sheet.tsx
// does for todo lists.
//
//   group == null  → CREATE  (POST /habit-groups)
//   group != null  → EDIT    (PATCH /habit-groups/:id) + a Delete action that
//                   confirms via the platform Alert (RN destructive idiom).
//
// Deleting a group ORPHANS its habits (group_id → null) server-side rather than
// cascade-deleting them — the deleteGroup hook invalidates the habit list so
// the orphaned habits surface in the Ungrouped section.

import { Button, FormSheet, Separator, useToast } from "@stageholder/ui";
import {
  HABIT_GROUP_FORM_DEFAULTS,
  HabitGroupForm,
  type HabitGroupFormValues,
} from "@repo/features/habits";
import type { HabitGroup } from "@repo/core/types";
import { Trash2 } from "@tamagui/lucide-icons-2";
import { Alert } from "react-native";

import {
  useCreateHabitGroup,
  useDeleteHabitGroup,
  useUpdateHabitGroup,
} from "@/lib/api";

interface HabitGroupSheetProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** null → create a new group; a group → edit (rename / recolor / delete). */
  group: HabitGroup | null;
  /** Fired after the edited/created group is deleted — the host can reset its
   *  active-group filter if it pointed at the now-gone group. */
  onDeleted?: (id: string) => void;
}

export function HabitGroupSheet({
  open,
  onOpenChange,
  group,
  onDeleted,
}: HabitGroupSheetProps) {
  const toast = useToast();
  const createGroup = useCreateHabitGroup();
  const updateGroup = useUpdateHabitGroup();
  const deleteGroup = useDeleteHabitGroup();

  const isEdit = group !== null;

  function handleSubmit(values: HabitGroupFormValues) {
    const onError = () =>
      toast.show({
        title: isEdit ? "Couldn't update group" : "Couldn't create group",
        intent: "danger",
      });
    if (isEdit) {
      updateGroup.mutate(
        { id: group.id, patch: values },
        {
          onSuccess: () => {
            toast.show({ title: "Group updated", intent: "success" });
            onOpenChange(false);
          },
          onError,
        },
      );
    } else {
      createGroup.mutate(values, {
        onSuccess: () => {
          toast.show({ title: "Group created", intent: "success" });
          onOpenChange(false);
        },
        onError,
      });
    }
  }

  function confirmDelete() {
    if (!group) return;
    Alert.alert(
      `Delete "${group.name}"?`,
      "Habits in this group will keep their history and move to Ungrouped. This cannot be undone.",
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Delete",
          style: "destructive",
          onPress: () =>
            deleteGroup.mutate(group.id, {
              onSuccess: () => {
                toast.show({ title: "Group deleted", intent: "success" });
                onOpenChange(false);
                onDeleted?.(group.id);
              },
              onError: () =>
                toast.show({
                  title: "Couldn't delete group",
                  intent: "danger",
                }),
            }),
        },
      ],
    );
  }

  return (
    <FormSheet
      // The shared form renders its own Cancel/Save buttons, so hide the kit
      // footer; we keep the kit FormSheet for its keyboard-stretch handling +
      // frame + title.
      hideFooter
      open={open}
      onOpenChange={onOpenChange}
      title={isEdit ? "Edit Group" : "New Group"}
      description={
        isEdit
          ? "Change the group's icon, name, or color."
          : "Group habits under a named, colored section."
      }
    >
      <HabitGroupForm
        // Re-seed on each open (React idiom — no useEffect needed in the view).
        key={group?.id ?? "create"}
        initial={
          group
            ? {
                name: group.name,
                color: group.color ?? "#3b82f6",
                icon: group.icon,
              }
            : HABIT_GROUP_FORM_DEFAULTS
        }
        submitLabel={isEdit ? "Save" : "Create"}
        submittingLabel={isEdit ? "Saving…" : "Creating…"}
        isSubmitting={createGroup.isPending || updateGroup.isPending}
        onSubmit={handleSubmit}
        onCancel={() => onOpenChange(false)}
      />
      {isEdit ? (
        <>
          <Separator />
          <Button
            intent="destructive"
            icon={<Trash2 size={14} />}
            loading={deleteGroup.isPending}
            loadingText="Deleting…"
            onPress={confirmDelete}
          >
            Delete group
          </Button>
        </>
      ) : null}
    </FormSheet>
  );
}
