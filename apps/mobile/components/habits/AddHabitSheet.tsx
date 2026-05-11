// apps/mobile/components/habits/AddHabitSheet.tsx
//
// Sheet for creating a new habit. Sends name + color + scheduledDays to
// the API; the server fills in defaults (frequency: "daily", targetCount: 1)
// when omitted.

import {
  Button,
  Input,
  Label,
  Sheet,
  Text,
  View,
  XStack,
  YStack,
  useToast,
} from "@stageholder/ui";
import { useState } from "react";

import { useCreateHabit } from "@/lib/api";

const HABIT_COLOR_PALETTE = [
  "#ef4444", // red
  "#f59e0b", // amber
  "#22c55e", // emerald
  "#3b82f6", // blue
  "#a855f7", // purple
  "#ec4899", // pink
];

const WEEKDAYS = ["S", "M", "T", "W", "T", "F", "S"];

export type AddHabitSheetProps = {
  open: boolean;
  onClose: () => void;
};

export function AddHabitSheet({ open, onClose }: AddHabitSheetProps) {
  const create = useCreateHabit();
  const toast = useToast();

  const [name, setName] = useState("");
  const [color, setColor] = useState<string>(HABIT_COLOR_PALETTE[0]!);
  const [days, setDays] = useState<number[]>([]); // empty = every day

  function reset() {
    setName("");
    setColor(HABIT_COLOR_PALETTE[0]!);
    setDays([]);
  }

  function handleCreate() {
    if (!name.trim()) return;
    create.mutate(
      {
        name: name.trim(),
        color,
        scheduledDays: days.length > 0 ? days : undefined,
        frequency: days.length > 0 ? "custom" : "daily",
      },
      {
        onSuccess: () => {
          reset();
          onClose();
        },
        onError: (err) => {
          toast.show({
            title: "Couldn't create habit",
            message: (err as Error).message ?? "Tap to retry.",
            intent: "danger",
          });
        },
      },
    );
  }

  function toggleDay(d: number) {
    setDays((prev) =>
      prev.includes(d) ? prev.filter((x) => x !== d) : [...prev, d].sort(),
    );
  }

  return (
    <Sheet
      modal
      open={open}
      onOpenChange={(o: boolean) => {
        if (!o) reset();
        onClose();
      }}
      snapPoints={[72]}
      dismissOnSnapToBottom
    >
      <Sheet.Overlay />
      <Sheet.Handle />
      <Sheet.Frame>
        <YStack gap="$4">
          <Text fontSize="$6" fontWeight="700" color="$color12">
            New habit
          </Text>

          <YStack gap="$2">
            <Label htmlFor="habit-name">Name</Label>
            <Input
              id="habit-name"
              autoFocus
              placeholder="e.g. Read 30 minutes"
              value={name}
              onChangeText={setName}
              size="$4"
            />
          </YStack>

          <YStack gap="$2">
            <Label>Color</Label>
            <XStack gap="$2" flexWrap="wrap">
              {HABIT_COLOR_PALETTE.map((c) => (
                <View
                  key={c}
                  width={32}
                  height={32}
                  rounded={1000}
                  bg={c as never}
                  borderWidth={2}
                  borderColor={
                    color === c ? ("white" as never) : ("transparent" as never)
                  }
                  cursor="pointer"
                  onPress={() => setColor(c)}
                />
              ))}
            </XStack>
          </YStack>

          <YStack gap="$2">
            <Label>
              Days ·{" "}
              {days.length === 0 ? "every day" : `${days.length} per week`}
            </Label>
            <XStack gap={6}>
              {WEEKDAYS.map((label, i) => {
                const active = days.includes(i);
                return (
                  <View
                    key={i}
                    flex={1}
                    height={36}
                    rounded={6}
                    bg={(active ? color : "$color3") as never}
                    items="center"
                    justify="center"
                    cursor="pointer"
                    onPress={() => toggleDay(i)}
                  >
                    <Text
                      fontSize="$2"
                      fontWeight="600"
                      color={(active ? "white" : "$color11") as never}
                    >
                      {label}
                    </Text>
                  </View>
                );
              })}
            </XStack>
          </YStack>

          <XStack gap="$2" pt="$2">
            <Button intent="ghost" onPress={onClose} flex={1}>
              Cancel
            </Button>
            <Button
              key={name.trim() ? "ready" : "empty"}
              intent="primary"
              onPress={handleCreate}
              flex={1}
              disabled={!name.trim() || create.isPending}
            >
              {create.isPending ? "Adding…" : "Add habit"}
            </Button>
          </XStack>
        </YStack>
      </Sheet.Frame>
    </Sheet>
  );
}
