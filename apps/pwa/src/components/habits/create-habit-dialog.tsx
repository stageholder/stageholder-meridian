import { Dialog, useToast } from "@stageholder/ui";
import { DialogSheetAdapt } from "@/components/shared/dialog-sheet-adapt";
import {
  HabitForm,
  HABIT_FORM_DEFAULTS,
  type HabitFormValues,
} from "@repo/features/habits";
import { useCreateHabit } from "@/lib/api/habits";
import { useHabitGroups } from "@/lib/api/habit-groups";

interface CreateHabitDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /**
   * Pre-select this group in the form's Group picker (e.g. creating from a
   * single-group view). `null`/omitted ⇒ Ungrouped.
   */
  defaultGroupId?: string | null;
}

/**
 * PWA wrapper: kit `Dialog` chrome + the shared `HabitForm` view. The
 * form re-mounts on each open (`key={open}`) so reset-on-close happens
 * by remount rather than a manual `resetForm()` pass.
 *
 * Create-specific: `scheduledDays` stays `undefined` (vs the edit
 * wrapper's `null`) — the create endpoint doesn't accept null, only an
 * array or omitted.
 */
export function CreateHabitDialog({
  open,
  onOpenChange,
  defaultGroupId,
}: CreateHabitDialogProps) {
  const createHabit = useCreateHabit();
  const { data: groups } = useHabitGroups();
  const toast = useToast();

  function handleSubmit(values: HabitFormValues) {
    createHabit.mutate(
      {
        name: values.name,
        description: values.description,
        frequency: values.frequency,
        targetCount: values.targetCount,
        scheduledDays: values.scheduledDays,
        weeklyTarget: values.weeklyTarget,
        unit: values.unit,
        color: values.color,
        icon: values.icon,
        groupId: values.groupId ?? null,
      },
      {
        onSuccess: () => {
          toast.show({ title: "Habit created", intent: "success" });
          onOpenChange(false);
        },
        onError: () => {
          toast.show({ title: "Failed to create habit", intent: "danger" });
        },
      },
    );
  }

  return (
    // disableRemoveScroll: the kit's modal scroll-lock sets overflow:hidden +
    // scrollbar-gutter:stable on <html>, but this PWA scrolls in an inner
    // container (app-shell's <main>), so the lock just reserves a phantom gutter
    // and shifts the background when the dialog opens. The full-screen scrim
    // already blocks background interaction, so the lock is redundant.
    <Dialog open={open} onOpenChange={onOpenChange} disableRemoveScroll>
      {/* Opens as a bottom sheet on mobile (<md), a centered dialog at md+. */}
      <DialogSheetAdapt />
      <Dialog.Portal>
        <Dialog.Overlay />
        <Dialog.Content
          width="92%"
          maxW={520}
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
          <Dialog.Title>New Habit</Dialog.Title>
          <HabitForm
            // Re-seed on each open (+ on defaultGroupId change) — empty defaults
            // on re-open after submit, with the active group pre-selected.
            key={`${open ? "open" : "closed"}-${defaultGroupId ?? ""}`}
            initial={{
              ...HABIT_FORM_DEFAULTS,
              groupId: defaultGroupId ?? null,
            }}
            submitLabel="Create"
            submittingLabel="Creating…"
            isSubmitting={createHabit.isPending}
            accentColor="var(--ring-habit)"
            groups={groups}
            onSubmit={handleSubmit}
            onCancel={() => onOpenChange(false)}
          />
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog>
  );
}
