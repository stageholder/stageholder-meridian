import { Dialog, Text, View, XStack, YStack, useToast } from "@stageholder/ui";
import { Check } from "lucide-react";
import { DialogSheetAdapt } from "@/components/shared/dialog-sheet-adapt";
import { useUpdateHabit } from "@/lib/api/habits";
import { useHabitGroups } from "@/lib/api/habit-groups";
import type { Habit } from "@repo/core/types";

interface MoveToGroupDialogProps {
  habit: Habit | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

/**
 * "Move to group" picker — a kit Dialog listing every group plus "Ungrouped".
 * Choosing a target PATCHes the habit's `groupId` (null for Ungrouped) and
 * closes. Opens as a bottom sheet on mobile via `DialogSheetAdapt`.
 */
export function MoveToGroupDialog({
  habit,
  open,
  onOpenChange,
}: MoveToGroupDialogProps) {
  const { data: groups } = useHabitGroups();
  const updateHabit = useUpdateHabit();
  const toast = useToast();

  function moveTo(groupId: string | null, name: string) {
    if (!habit) return;
    updateHabit.mutate(
      { id: habit.id, data: { groupId } },
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

  const currentGroupId = habit?.groupId ?? null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange} disableRemoveScroll>
      <DialogSheetAdapt />
      <Dialog.Portal>
        <Dialog.Overlay />
        <Dialog.Content width="90%" maxW={420}>
          <Dialog.Title>Move to group</Dialog.Title>
          <Dialog.Description>
            Choose a group for &ldquo;{habit?.name}&rdquo;.
          </Dialog.Description>
          <YStack mt="$3" gap="$1">
            <GroupRow
              label="Ungrouped"
              color="#6b7280"
              selected={currentGroupId === null}
              onPress={() => moveTo(null, "Ungrouped")}
            />
            {(groups ?? []).map((g) => (
              <GroupRow
                key={g.id}
                label={g.name}
                color={g.color || "#6b7280"}
                selected={currentGroupId === g.id}
                onPress={() => moveTo(g.id, g.name)}
              />
            ))}
          </YStack>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog>
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
      cursor="pointer"
      items="center"
      gap="$3"
      height={44}
      px="$3"
      rounded="$3"
      hoverStyle={{ bg: "$accent" }}
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
      <Text flex={1} fontSize={14} color="$color" numberOfLines={1}>
        {label}
      </Text>
      {selected && (
        <Text color="$primary" lineHeight={0}>
          <Check size={16} />
        </Text>
      )}
    </XStack>
  );
}
