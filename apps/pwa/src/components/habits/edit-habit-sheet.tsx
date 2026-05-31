import { Dialog, useToast } from "@stageholder/ui";
import { HabitForm, type HabitFormValues } from "@repo/features/habits";
import { useUpdateHabit } from "@/lib/api/habits";
import type { Habit } from "@repo/core/types";

interface EditHabitSheetProps {
  habit: Habit;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

/**
 * PWA wrapper: kit `Dialog` chrome + the shared `HabitForm` view from
 * `@repo/features/habits`. The form re-mounts on each open (`key={open}`)
 * so it re-seeds from the current habit values without any manual
 * useEffect dance.
 *
 * `onPointerDownOutside` / `onInteractOutside` keep the dialog from
 * closing when the user clicks inside the icon-picker Popover (a
 * web-only chrome concern — kept here, away from the lifted view).
 */
export function EditHabitSheet({
  habit,
  open,
  onOpenChange,
}: EditHabitSheetProps) {
  const updateHabit = useUpdateHabit();
  const toast = useToast();

  const initial: HabitFormValues = {
    name: habit.name,
    description: habit.description ?? "",
    frequency: habit.frequency,
    targetCount: habit.targetCount,
    scheduledDays: habit.scheduledDays ?? [],
    weeklyTarget: habit.weeklyTarget ?? 2,
    unit: habit.unit ?? "",
    color: habit.color ?? "#3b82f6",
    icon: habit.icon ?? "",
  };

  function handleSubmit(values: HabitFormValues) {
    updateHabit.mutate(
      {
        id: habit.id,
        data: {
          name: values.name,
          description: values.description,
          frequency: values.frequency,
          targetCount: values.targetCount,
          // Edit uses `null` to wipe a previously-set schedule; the form
          // emits `undefined` for "no specific days" so we translate.
          scheduledDays: values.scheduledDays ?? null,
          weeklyTarget: values.weeklyTarget,
          unit: values.unit,
          color: values.color,
          icon: values.icon,
        },
      },
      {
        onSuccess: () => {
          toast.show({ title: "Habit updated", intent: "success" });
          onOpenChange(false);
        },
        onError: () => {
          toast.show({ title: "Failed to update habit", intent: "danger" });
        },
      },
    );
  }

  return (
    // `disableRemoveScroll`: the kit's modal scroll-lock sets overflow:hidden
    // + scrollbar-gutter:stable on <html>, but this PWA scrolls in an inner
    // container (app-shell's <main>), so the lock only reserves a phantom
    // gutter and shifts the background on open. The full-screen scrim already
    // blocks background interaction, so the lock is redundant.
    <Dialog open={open} onOpenChange={onOpenChange} disableRemoveScroll>
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
          <Dialog.Title>Edit Habit</Dialog.Title>
          <HabitForm
            // Re-seed on each open (React idiom — no useEffect needed in the view).
            key={open ? "open" : "closed"}
            initial={initial}
            submitLabel="Save"
            submittingLabel="Saving…"
            isSubmitting={updateHabit.isPending}
            accentColor="var(--ring-habit)"
            onSubmit={handleSubmit}
            onCancel={() => onOpenChange(false)}
          />
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog>
  );
}
