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

import { FormSheet, Sheet, toast } from "@stageholder/ui";

import { FormSheetSkeleton } from "@/components/form-sheet-skeleton";
import {
  HabitForm,
  HABIT_FORM_DEFAULTS,
  type HabitFormValues,
} from "@repo/features/habits";

import { useCreateHabit, useHabitGroups } from "@/lib/api";
import { useOpenEpoch } from "@/lib/hooks/use-open-epoch";
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
  // Fresh-form key that moves only on closed→open (keying on `open` itself
  // remounted the form mid-close-animation).
  const openEpoch = useOpenEpoch(open);

  // The shared form's group picker is HIDDEN at 0 groups; the user always has
  // the four seeded time-of-day groups, so it normally shows.
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
    <FormSheet
      // The shared form renders its own accent-colored Cancel/Create
      // buttons, so hide the kit footer; we keep the kit FormSheet for its
      // keyboard-stretch handling + frame + title.
      hideFooter
      // Default mountChildren ('open') — see create-todo-dialog for why
      // `first-open` was reverted.
      // HabitForm is the app's tallest form (icon+name, frequency, schedule,
      // target, unit, color, group…) — cap the sheet and scroll the fields
      // with pinned header/footer instead of growing past the status bar.
      scrollable
      open={open}
      onOpenChange={onOpenChange}
      title="New Habit"
    >
      {/* Kit open choreography — slide immediately, form fades in on settle
          (see create-todo-dialog). Safe with `scrollable` (constant snap). */}
      <Sheet.LazyBody fallback={<FormSheetSkeleton rows={4} />}>
        <HabitForm
          key={openEpoch}
          initial={{ ...HABIT_FORM_DEFAULTS, groupId: groupId ?? null }}
          groups={groupOptions}
          submitLabel="Create"
          submittingLabel="Creating…"
          isSubmitting={createHabit.isPending}
          accentColor={IGNITION.habit.base}
          onSubmit={handleSubmit}
          onCancel={() => onOpenChange(false)}
        />
      </Sheet.LazyBody>
    </FormSheet>
  );
}
