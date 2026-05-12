// apps/mobile/components/habits/EditHabitSheet.tsx
//
// Edit an existing habit. Adapted from PWA's EditHabitSheet
// (apps/pwa/components/habits/edit-habit-sheet.tsx) — same field set,
// mobile-native shell (bottom sheet vs right-side panel).
//
// Fields: name, description, frequency (daily / weekly), targetCount,
// unit, scheduledDays (when frequency=weekly), color.
//
// Icon picker is deferred: cross-platform emoji-picker is its own thing.
// We accept the existing icon as-is so it doesn't get blown away on save,
// and show it as a read-only chip in the title row.

import {
  Button,
  Input,
  Label,
  NumberInput,
  Sheet,
  Text,
  TextArea,
  View,
  XStack,
  YStack,
  useToast,
} from "@stageholder/ui";
import type { Habit } from "@repo/core/types";
import { useEffect, useState } from "react";

import { extractServerMessage, useUpdateHabit } from "@/lib/api";

const COLOR_PALETTE = [
  "#ef4444",
  "#f97316",
  "#eab308",
  "#22c55e",
  "#3b82f6",
  "#8b5cf6",
  "#ec4899",
  "#14b8a6",
  "#78716c",
];

// 1=Mon..6=Sat,0=Sun — matches PWA's DAY_OPTIONS ordering so scheduledDays
// arrays round-trip identically across surfaces.
const DAY_OPTIONS: { value: number; label: string }[] = [
  { value: 1, label: "M" },
  { value: 2, label: "T" },
  { value: 3, label: "W" },
  { value: 4, label: "T" },
  { value: 5, label: "F" },
  { value: 6, label: "S" },
  { value: 0, label: "S" },
];

export type EditHabitSheetProps = {
  habit: Habit | null;
  open: boolean;
  onClose: () => void;
};

export function EditHabitSheet({ habit, open, onClose }: EditHabitSheetProps) {
  const update = useUpdateHabit();
  const toast = useToast();

  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [frequency, setFrequency] = useState<Habit["frequency"]>("daily");
  const [targetCount, setTargetCount] = useState(1);
  const [unit, setUnit] = useState("");
  const [color, setColor] = useState<string>(COLOR_PALETTE[4]!);
  const [scheduledDays, setScheduledDays] = useState<number[]>([]);

  // Re-seed local state whenever the target habit changes (sheet open or
  // user opened a different habit's edit sheet).
  useEffect(() => {
    if (!habit) return;
    setName(habit.name);
    setDescription(habit.description ?? "");
    setFrequency(habit.frequency);
    setTargetCount(habit.targetCount ?? 1);
    setUnit(habit.unit ?? "");
    setColor(habit.color ?? COLOR_PALETTE[4]!);
    setScheduledDays(habit.scheduledDays ?? []);
  }, [habit?.id, open]); // eslint-disable-line react-hooks/exhaustive-deps

  if (!habit) return null;

  function handleSave() {
    if (!habit || !name.trim()) return;
    update.mutate(
      {
        id: habit.id,
        patch: {
          name: name.trim(),
          description: description.trim() || undefined,
          frequency,
          targetCount,
          unit: unit.trim() || undefined,
          color,
          scheduledDays:
            frequency === "weekly" && scheduledDays.length > 0
              ? scheduledDays
              : undefined,
        },
      },
      {
        onSuccess: () => {
          toast.show({
            title: "Habit updated",
            intent: "success",
          });
          onClose();
        },
        onError: (err) =>
          toast.show({
            title: "Save failed",
            message:
              extractServerMessage(err) ??
              (err as Error).message ??
              "Tap to retry.",
            intent: "danger",
          }),
      },
    );
  }

  function toggleDay(d: number) {
    setScheduledDays((prev) =>
      prev.includes(d) ? prev.filter((x) => x !== d) : [...prev, d].sort(),
    );
  }

  return (
    <Sheet
      modal
      open={open}
      onOpenChange={(o: boolean) => {
        if (!o) onClose();
      }}
      snapPoints={[90]}
      dismissOnSnapToBottom
    >
      <Sheet.Overlay />
      <Sheet.Handle />
      <Sheet.Frame>
        <Sheet.ScrollView showsVerticalScrollIndicator={false}>
          <YStack gap="$4" pb="$6">
            <Text fontSize="$6" fontWeight="700" color="$color12">
              Edit habit
            </Text>

            <YStack gap="$2">
              <Label htmlFor="habit-name-edit">Name</Label>
              <Input
                id="habit-name-edit"
                value={name}
                onChangeText={setName}
                size="$4"
                autoFocus
              />
            </YStack>

            <YStack gap="$2">
              <Label htmlFor="habit-desc-edit">Description</Label>
              <TextArea
                id="habit-desc-edit"
                value={description}
                onChangeText={setDescription}
                size="$3"
                minH={56 as never}
                placeholder="Optional details"
              />
            </YStack>

            <XStack gap="$3">
              <YStack flex={1} gap="$2">
                <Label>Frequency</Label>
                <XStack gap="$2" flexWrap="wrap">
                  <PillButton
                    active={frequency === "daily"}
                    onPress={() => {
                      setFrequency("daily");
                      setScheduledDays([]);
                    }}
                  >
                    Daily
                  </PillButton>
                  <PillButton
                    active={frequency === "weekly"}
                    onPress={() => setFrequency("weekly")}
                  >
                    Specific days
                  </PillButton>
                </XStack>
              </YStack>
              <YStack width={120} gap="$2">
                <Label>Target</Label>
                <NumberInput
                  value={targetCount}
                  min={1}
                  step={1}
                  onChange={setTargetCount}
                />
              </YStack>
            </XStack>

            <YStack gap="$2">
              <Label htmlFor="habit-unit-edit">Unit (optional)</Label>
              <Input
                id="habit-unit-edit"
                value={unit}
                onChangeText={setUnit}
                size="$3"
                placeholder="e.g. minutes, pages"
              />
            </YStack>

            {frequency === "weekly" ? (
              <YStack gap="$2">
                <Label>
                  Days ·{" "}
                  {scheduledDays.length === 0
                    ? "pick at least one"
                    : `${scheduledDays.length} per week`}
                </Label>
                <XStack gap={6}>
                  {DAY_OPTIONS.map((d) => {
                    const active = scheduledDays.includes(d.value);
                    return (
                      <View
                        key={d.value}
                        flex={1}
                        height={36}
                        rounded={6}
                        bg={(active ? color : "$color3") as never}
                        items="center"
                        justify="center"
                        cursor="pointer"
                        onPress={() => toggleDay(d.value)}
                      >
                        <Text
                          fontSize="$2"
                          fontWeight="600"
                          color={(active ? "white" : "$color11") as never}
                        >
                          {d.label}
                        </Text>
                      </View>
                    );
                  })}
                </XStack>
              </YStack>
            ) : null}

            <YStack gap="$2">
              <Label>Color</Label>
              <XStack gap="$2" flexWrap="wrap">
                {COLOR_PALETTE.map((c) => (
                  <View
                    key={c}
                    width={32}
                    height={32}
                    rounded={1000}
                    bg={c as never}
                    borderWidth={2}
                    borderColor={
                      (color === c ? "white" : "transparent") as never
                    }
                    cursor="pointer"
                    onPress={() => setColor(c)}
                  />
                ))}
              </XStack>
            </YStack>

            <XStack gap="$2" pt="$2">
              <Button intent="ghost" onPress={onClose} flex={1}>
                Cancel
              </Button>
              <Button
                intent="primary"
                onPress={handleSave}
                flex={1}
                disabled={!name.trim() || update.isPending}
              >
                {update.isPending ? "Saving…" : "Save"}
              </Button>
            </XStack>
          </YStack>
        </Sheet.ScrollView>
      </Sheet.Frame>
    </Sheet>
  );
}

function PillButton({
  active,
  onPress,
  children,
}: {
  active: boolean;
  onPress: () => void;
  children: React.ReactNode;
}) {
  return (
    <Button
      size="$2"
      intent={active ? "primary" : "secondary"}
      onPress={onPress}
    >
      {children}
    </Button>
  );
}
