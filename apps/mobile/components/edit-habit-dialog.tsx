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

import { FormSheet, Sheet, toast } from "@stageholder/ui";

import { FormSheetSkeleton } from "@/components/form-sheet-skeleton";
import { HabitForm, type HabitFormValues } from "@repo/features/habits";
import type { Habit } from "@repo/core/types";

import { useHabitGroups, useUpdateHabit } from "@/lib/api";
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
  const groupsQuery = useHabitGroups();

  const groupOptions = (groupsQuery.data ?? []).map((g) => ({
    id: g.id,
    name: g.name,
  }));

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
    groupId: habit.groupId ?? null,
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
          groupId: values.groupId ?? null,
        },
      },
      {
        onSuccess: () => {
          toast.success("Habit updated");
          onOpenChange(false);
        },
        onError: () => {
          toast.error("Failed to update habit");
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
      // HabitForm is the app's tallest form — capped snap + scrolling fields
      // (alpha.121) instead of growing past the status bar.
      scrollable
      open={open}
      onOpenChange={onOpenChange}
      title="Edit Habit"
    >
      {/* Kit open choreography — see create-todo-dialog. */}
      <Sheet.LazyBody fallback={<FormSheetSkeleton rows={4} />}>
        <HabitForm
          // Re-seed per habit (the kit Sheet unmounts content on close, so a
          // fresh open re-seeds anyway; keying on `open` remounted the form
          // mid-close-animation for nothing).
          key={habit.id}
          initial={initial}
          groups={groupOptions}
          submitLabel="Save"
          submittingLabel="Saving…"
          isSubmitting={updateHabit.isPending}
          accentColor={IGNITION.habit.base}
          onSubmit={handleSubmit}
          onCancel={() => onOpenChange(false)}
        />
      </Sheet.LazyBody>
    </FormSheet>
  );
}
