// apps/mobile/components/habit-move-to-group-sheet.tsx
//
// "Move to group" picker — native counterpart of the PWA's MoveToGroupDialog
// (apps/pwa/src/components/habits/move-to-group-dialog.tsx). Lists every group
// plus "Ungrouped"; choosing a target PATCHes the habit's groupId (null for
// Ungrouped) and closes. Hosted in a kit FormSheet (the same chrome every other
// mobile picker uses) instead of the PWA's Dialog + DialogSheetAdapt.

import {
  FormSheet,
  Text,
  View,
  XStack,
  YStack,
  useToast,
} from "@stageholder/ui";
import type { Habit } from "@repo/core/types";
import { Check } from "@tamagui/lucide-icons-2";

import { useHabitGroups, useUpdateHabit } from "@/lib/api";

interface HabitMoveToGroupSheetProps {
  habit: Habit | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function HabitMoveToGroupSheet({
  habit,
  open,
  onOpenChange,
}: HabitMoveToGroupSheetProps) {
  const groupsQuery = useHabitGroups();
  const updateHabit = useUpdateHabit();
  const toast = useToast();

  const groups = groupsQuery.data ?? [];
  const currentGroupId = habit?.groupId ?? null;

  function moveTo(groupId: string | null, name: string) {
    if (!habit) return;
    updateHabit.mutate(
      { id: habit.id, patch: { groupId } },
      {
        onSuccess: () => {
          toast.show({ title: `Moved to ${name}`, intent: "success" });
          onOpenChange(false);
        },
        onError: () =>
          toast.show({ title: "Failed to move habit", intent: "danger" }),
      },
    );
  }

  return (
    <FormSheet
      hideFooter
      open={open}
      onOpenChange={onOpenChange}
      title="Move to group"
      description={habit ? `Choose a group for "${habit.name}".` : undefined}
    >
      <YStack gap="$1">
        <GroupRow
          label="Ungrouped"
          color="#6b7280"
          selected={currentGroupId === null}
          onPress={() => moveTo(null, "Ungrouped")}
        />
        {groups.map((g) => (
          <GroupRow
            key={g.id}
            label={g.name}
            color={g.color || "#6b7280"}
            selected={currentGroupId === g.id}
            onPress={() => moveTo(g.id, g.name)}
          />
        ))}
      </YStack>
    </FormSheet>
  );
}

function GroupRow({
  label,
  color,
  selected,
  onPress,
}: {
  label: string;
  color: string;
  selected: boolean;
  onPress: () => void;
}) {
  return (
    <XStack
      role="button"
      aria-pressed={selected}
      items="center"
      gap="$3"
      height={48}
      px="$3"
      rounded="$3"
      pressStyle={{ bg: "$accent", opacity: 0.85 }}
      onPress={onPress}
    >
      <View
        width={12}
        height={12}
        rounded={9999}
        shrink={0}
        style={{ backgroundColor: color }}
      />
      <Text flex={1} fontSize="$3" color="$color" numberOfLines={1}>
        {label}
      </Text>
      {selected ? <Check size={16} color="$primary" /> : null}
    </XStack>
  );
}
