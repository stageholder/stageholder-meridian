// apps/mobile/components/create-habit-dialog.tsx
//
// Native mirror of the PWA's CreateHabitDialog (apps/pwa/src/components/habits/
// create-habit-dialog.tsx). The shared `HabitForm` from @repo/features/habits
// carries its own icon picker (the kit EmojiPickerSheet on mobile), frequency,
// day scheduler, and color. Host is a kit Sheet (FormSheet) rather than the
// PWA's Dialog + DialogSheetAdapt. Re-mounts on each open.
//
// accentColor: the PWA passes the `--ring-habit` CSS var; on native CSS vars
// don't resolve in style objects, so the resolved IGNITION hex is passed.

import { FormSheet, useToast } from "@stageholder/ui";
import {
  HabitForm,
  HABIT_FORM_DEFAULTS,
  type HabitFormValues,
} from "@repo/features/habits";

import { useCreateHabit } from "@/lib/api";
import { IGNITION } from "@/lib/ignition-palette";

interface CreateHabitDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

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
    <FormSheet
      // The shared form renders its own accent-colored Cancel/Create
      // buttons, so hide the kit footer; we keep the kit FormSheet for its
      // keyboard-stretch handling + frame + title.
      hideFooter
      open={open}
      onOpenChange={onOpenChange}
      title="New Habit"
    >
      <HabitForm
        key={open ? "open" : "closed"}
        initial={HABIT_FORM_DEFAULTS}
        submitLabel="Create"
        submittingLabel="Creating…"
        isSubmitting={createHabit.isPending}
        accentColor={IGNITION.habit.base}
        onSubmit={handleSubmit}
        onCancel={() => onOpenChange(false)}
      />
    </FormSheet>
  );
}
