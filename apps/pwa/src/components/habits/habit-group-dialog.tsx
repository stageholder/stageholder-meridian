import { Dialog, useToast } from "@stageholder/ui";
import { DialogSheetAdapt } from "@/components/shared/dialog-sheet-adapt";
import {
  HabitGroupForm,
  HABIT_GROUP_FORM_DEFAULTS,
  type HabitGroupFormValues,
} from "@repo/features/habits";
import {
  useCreateHabitGroup,
  useUpdateHabitGroup,
} from "@/lib/api/habit-groups";
import type { HabitGroup } from "@repo/core/types";

interface HabitGroupDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** When set, the dialog edits this group; otherwise it creates a new one. */
  group?: HabitGroup | null;
}

/**
 * PWA wrapper: kit `Dialog` chrome + the shared `HabitGroupForm` view from
 * `@repo/features/habits`. Mirrors `create-list-dialog.tsx` exactly —
 * `DialogSheetAdapt` makes it a bottom sheet on mobile (<md) and a centered
 * dialog at md+. The form re-mounts when the target group changes (`key`) so
 * controlled-state reset happens by remount rather than a useEffect dance.
 */
export function HabitGroupDialog({
  open,
  onOpenChange,
  group,
}: HabitGroupDialogProps) {
  const isEdit = !!group;
  const createGroup = useCreateHabitGroup();
  const updateGroup = useUpdateHabitGroup();
  const toast = useToast();
  const pending = createGroup.isPending || updateGroup.isPending;

  const initial: HabitGroupFormValues = group
    ? {
        name: group.name,
        color: group.color ?? HABIT_GROUP_FORM_DEFAULTS.color,
        icon: group.icon,
      }
    : HABIT_GROUP_FORM_DEFAULTS;

  function handleSubmit(values: HabitGroupFormValues) {
    if (isEdit && group) {
      updateGroup.mutate(
        {
          id: group.id,
          data: { name: values.name, color: values.color, icon: values.icon },
        },
        {
          onSuccess: () => {
            toast.show({ title: "Group updated", intent: "success" });
            onOpenChange(false);
          },
          onError: () =>
            toast.show({ title: "Failed to update group", intent: "danger" }),
        },
      );
      return;
    }

    createGroup.mutate(
      { name: values.name, color: values.color, icon: values.icon },
      {
        onSuccess: () => {
          toast.show({ title: "Group created", intent: "success" });
          onOpenChange(false);
        },
        onError: () =>
          toast.show({ title: "Failed to create group", intent: "danger" }),
      },
    );
  }

  return (
    // disableRemoveScroll: mirrors create-list-dialog.tsx — the PWA scrolls in
    // an inner container, so the modal scroll-lock just reserves a phantom
    // gutter and shifts the background on open. The scrim already blocks
    // background interaction.
    <Dialog open={open} onOpenChange={onOpenChange} disableRemoveScroll>
      {/* Opens as a bottom sheet on mobile (<md), a centered dialog at md+. */}
      <DialogSheetAdapt />
      <Dialog.Portal>
        <Dialog.Overlay />
        <Dialog.Content width="90%" maxW={420}>
          <Dialog.Title>{isEdit ? "Edit Group" : "New Group"}</Dialog.Title>
          <Dialog.Description>
            {isEdit
              ? "Update this group's icon, name, and color."
              : "Name your group, pick an icon, and choose a color."}
          </Dialog.Description>
          <HabitGroupForm
            // Re-seed on each open/group-change (React idiom — no useEffect).
            key={group?.id ?? (open ? "open" : "closed")}
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
