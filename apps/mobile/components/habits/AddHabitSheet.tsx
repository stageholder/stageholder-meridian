// apps/mobile/components/habits/AddHabitSheet.tsx
//
// Sheet for creating a new habit. Title + color + scheduled days. Default
// is "every day" (empty scheduledDays array — see lib/stores/habits.ts).

import {
  Button,
  Input,
  Label,
  Sheet,
  Text,
  ToggleGroup,
  View,
  XStack,
  YStack,
} from "@stageholder/ui";
import { useState } from "react";

import { HABIT_COLOR_PALETTE } from "@/lib/stores/habits";

const WEEKDAYS = ["S", "M", "T", "W", "T", "F", "S"];

export type AddHabitSheetProps = {
  open: boolean;
  onClose: () => void;
  onCreate: (input: {
    title: string;
    color: string;
    scheduledDays: number[];
  }) => void;
};

export function AddHabitSheet({ open, onClose, onCreate }: AddHabitSheetProps) {
  const [title, setTitle] = useState("");
  const [color, setColor] = useState<string>(HABIT_COLOR_PALETTE[0]!);
  // 0 = Sunday, 6 = Saturday. Empty array = every day.
  const [days, setDays] = useState<number[]>([]);

  function reset() {
    setTitle("");
    setColor(HABIT_COLOR_PALETTE[0]!);
    setDays([]);
  }

  function handleCreate() {
    if (!title.trim()) return;
    onCreate({ title: title.trim(), color, scheduledDays: days });
    reset();
    onClose();
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
            <Label htmlFor="habit-title">Title</Label>
            <Input
              id="habit-title"
              autoFocus
              placeholder="e.g. Read 30 minutes"
              value={title}
              onChangeText={setTitle}
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
            {/* `key` keyed off disabled — see sign-in.tsx for why. */}
            <Button
              key={title.trim() ? "ready" : "empty"}
              intent="primary"
              onPress={handleCreate}
              flex={1}
              disabled={!title.trim()}
            >
              Add habit
            </Button>
          </XStack>
        </YStack>
      </Sheet.Frame>
    </Sheet>
  );
}
