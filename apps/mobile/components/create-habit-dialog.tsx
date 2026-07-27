// apps/mobile/components/create-habit-dialog.tsx
//
// Native create-habit flow — a Todoist-style compact quick-add: icon + name on
// top, everything else (frequency, target, color, group) a pill with a default,
// so a name alone can create. The PWA's create dialog keeps the full
// `HabitForm`; this native flow uses the shared `QuickAddHabitSheet` from
// @repo/features/habits, which resets by state (no remount key / LazyBody).
//
// accentColor: the PWA passes the `--ring-habit` CSS var; on native CSS vars
// don't resolve in style objects, so the resolved IGNITION hex is passed.

import { toast } from "@stageholder/ui";

import {
  QuickAddHabitSheet,
  type HabitFormValues,
} from "@repo/features/habits";

import { useCreateHabit, useHabitGroups } from "@/lib/api";
import { IGNITION } from "@/lib/ignition-palette";

interface CreateHabitDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Pre-select a group (e.g. the active group chip on the habits screen). */
  groupId?: string;
}

export function CreateHabitDialog({
  open,
  onOpenChange,
  groupId,
}: CreateHabitDialogProps) {
  const createHabit = useCreateHabit();
  const groupsQuery = useHabitGroups();

  // The Group pill is HIDDEN at 0 groups; the user always has the four seeded
  // time-of-day groups, so it normally shows.
  const groupOptions = (groupsQuery.data ?? []).map((g) => ({
    id: g.id,
    name: g.name,
  }));

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
        groupId: values.groupId ?? null,
      },
      {
        onSuccess: () => {
          toast.success("Habit created");
          onOpenChange(false);
        },
        onError: () => {
          toast.error("Failed to create habit");
        },
      },
    );
  }

  return (
    <QuickAddHabitSheet
      open={open}
      onOpenChange={onOpenChange}
      groups={groupOptions}
      defaultGroupId={groupId ?? null}
      accentColor={IGNITION.habit.base}
      isSubmitting={createHabit.isPending}
      onSubmit={handleSubmit}
    />
  );
}
