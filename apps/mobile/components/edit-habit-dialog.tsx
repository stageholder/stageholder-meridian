// apps/mobile/components/edit-habit-dialog.tsx
//
// Native mirror of the PWA's EditHabitSheet (apps/pwa/src/components/habits/
// edit-habit-sheet.tsx). Same shared `HabitForm` from @repo/features/habits as
// the create flow — seeded from the tapped habit's current values — hosted in a
// kit FormSheet (@stageholder/ui) rather than the PWA's Dialog +
// DialogSheetAdapt. The form re-mounts on
// each open (`key={open}`) so it re-seeds without a useEffect dance.
//
// accentColor: the PWA passes the `--ring-habit` CSS var; on native CSS vars
// don't resolve in style objects, so the resolved IGNITION hex is passed.

import { FormSheet, useToast } from "@stageholder/ui";
import { HabitForm, type HabitFormValues } from "@repo/features/habits";
import type { Habit } from "@repo/core/types";

import { useUpdateHabit } from "@/lib/api";
import { IGNITION } from "@/lib/ignition-palette";

interface EditHabitDialogProps {
  habit: Habit;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function EditHabitDialog({
  habit,
  open,
  onOpenChange,
}: EditHabitDialogProps) {
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
        patch: {
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
    <FormSheet
      // The shared form renders its own accent-colored Cancel/Create
      // buttons, so hide the kit footer; we keep the kit FormSheet for its
      // keyboard-stretch handling + frame + title.
      hideFooter
      open={open}
      onOpenChange={onOpenChange}
      title="Edit Habit"
    >
      <HabitForm
        // Re-seed on each open (React idiom — no useEffect needed in the view).
        key={open ? "open" : "closed"}
        initial={initial}
        submitLabel="Save"
        submittingLabel="Saving…"
        isSubmitting={updateHabit.isPending}
        accentColor={IGNITION.habit.base}
        onSubmit={handleSubmit}
        onCancel={() => onOpenChange(false)}
      />
    </FormSheet>
  );
}
