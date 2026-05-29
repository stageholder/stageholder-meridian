import { Dialog, useToast } from "@stageholder/ui";
import {
  HabitForm,
  HABIT_FORM_DEFAULTS,
  type HabitFormValues,
} from "@repo/features/habits";
import { useCreateHabit } from "@/lib/api/habits";

interface CreateHabitDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
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
}: CreateHabitDialogProps) {
  const createHabit = useCreateHabit();
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
    <Dialog open={open} onOpenChange={onOpenChange}>
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
            // Re-seed on each open — empty defaults on re-open after submit.
            key={open ? "open" : "closed"}
            initial={HABIT_FORM_DEFAULTS}
            submitLabel="Create"
            submittingLabel="Creating…"
            isSubmitting={createHabit.isPending}
            accentColor="var(--ring-habit)"
            onSubmit={handleSubmit}
            onCancel={() => onOpenChange(false)}
          />
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog>
  );
}
