// apps/mobile/components/habit-detail-sheet.tsx
//
// Data wiring for the native habit detail (edit) sheet (@repo/features/habits
// `HabitDetailSheet`): per-field optimistic PATCHes, the "⋯" action sheet
// (Archive / Unarchive, Delete — confirmed) and the live row. Replaces the old
// EditHabitDialog (full HabitForm + Save/Cancel, 2026-10-21); the hosts (habits
// tab, habit detail screen) keep `habit / open / onOpenChange` props.

import { useEffect } from "react";
import { Alert } from "react-native";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "@stageholder/ui";
import { HabitDetailSheet as HabitDetailSheetView } from "@repo/features/habits";
import type { HabitDetailPatch } from "@repo/features/habits";
import type { Habit } from "@repo/core/types";

import {
  habitKeys,
  useArchiveHabit,
  useDeleteHabit,
  useHabit,
  useHabitGroups,
  useUnarchiveHabit,
  useUpdateHabit,
} from "@/lib/api";

interface HabitDetailSheetProps {
  habit: Habit | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Fired after a successful delete (hosts pop the pushed detail screen). */
  onDeleted?: () => void;
}

export function HabitDetailSheet({
  habit,
  open,
  onOpenChange,
  onDeleted,
}: HabitDetailSheetProps) {
  const updateHabit = useUpdateHabit();
  const archiveHabit = useArchiveHabit();
  const unarchiveHabit = useUnarchiveHabit();
  const deleteHabit = useDeleteHabit();
  const groupsQuery = useHabitGroups();
  const qc = useQueryClient();

  // LIVE ROW — same mirror as the todo detail sheet: seed the detail key from
  // the host's snapshot on open and read every optimistic patch through it.
  useEffect(() => {
    if (open && habit)
      qc.setQueryData<Habit>(habitKeys.detail(habit.id), habit);
  }, [open, habit, qc]);
  const live = useHabit(habit?.id, { enabled: false }).data;

  if (!habit) return null;
  const current = live ?? habit;

  const groupOptions = (groupsQuery.data ?? []).map((g) => ({
    id: g.id,
    name: g.name,
    icon: g.icon,
    color: g.color,
  }));

  function handlePatch(patch: HabitDetailPatch) {
    updateHabit.mutate(
      { id: current.id, patch },
      { onError: () => toast.error("Couldn't save change") },
    );
  }

  function confirmDelete() {
    Alert.alert(
      `Delete "${current.name}"?`,
      "This habit and all of its check-ins will be removed. This cannot be undone.",
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Delete",
          style: "destructive",
          onPress: () =>
            deleteHabit.mutate(current.id, {
              onSuccess: () => {
                toast.success("Habit deleted");
                onOpenChange(false);
                onDeleted?.();
              },
              onError: () => toast.error("Couldn't delete habit"),
            }),
        },
      ],
    );
  }

  // "⋯" rows — an in-app sheet nested in the detail sheet, not ActionSheetIOS.
  const archived = !!current.archivedAt;
  const moreActions = [
    archived
      ? {
          label: "Unarchive",
          onPress: () =>
            unarchiveHabit.mutate(current.id, {
              onSuccess: () => toast.success("Habit unarchived"),
              onError: () => toast.error("Couldn't unarchive habit"),
            }),
        }
      : {
          label: "Archive",
          onPress: () =>
            archiveHabit.mutate(current.id, {
              onSuccess: () => {
                toast.success("Habit archived");
                onOpenChange(false);
              },
              onError: () => toast.error("Couldn't archive habit"),
            }),
        },
    { label: "Delete habit", destructive: true, onPress: confirmDelete },
  ];

  return (
    <HabitDetailSheetView
      open={open}
      onOpenChange={onOpenChange}
      habit={current}
      groups={groupOptions}
      onPatch={handlePatch}
      moreActions={moreActions}
    />
  );
}
