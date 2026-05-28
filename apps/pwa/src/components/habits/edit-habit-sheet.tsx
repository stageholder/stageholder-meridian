import { useState, useEffect } from "react";
import { useUpdateHabit } from "@/lib/api/habits";
import type { Habit } from "@repo/core/types";
import {
  Button,
  Dialog,
  EmojiPicker,
  Input,
  Label,
  NumberInput,
  Popover,
  Select,
  Text,
  TextArea,
  ToggleGroup,
  useToast,
  View,
  XStack,
  YStack,
} from "@stageholder/ui";

interface EditHabitSheetProps {
  habit: Habit;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

const DAY_OPTIONS = [
  { value: 1, label: "Mon" },
  { value: 2, label: "Tue" },
  { value: 3, label: "Wed" },
  { value: 4, label: "Thu" },
  { value: 5, label: "Fri" },
  { value: 6, label: "Sat" },
  { value: 0, label: "Sun" },
];

const colorOptions = [
  { value: "#ef4444", label: "Red" },
  { value: "#f97316", label: "Orange" },
  { value: "#eab308", label: "Yellow" },
  { value: "#22c55e", label: "Green" },
  { value: "#3b82f6", label: "Blue" },
  { value: "#8b5cf6", label: "Purple" },
  { value: "#ec4899", label: "Pink" },
  { value: "#14b8a6", label: "Teal" },
  { value: "#78716c", label: "Stone" },
];

export function EditHabitSheet({
  habit,
  open,
  onOpenChange,
}: EditHabitSheetProps) {
  const [name, setName] = useState(habit.name);
  const [description, setDescription] = useState(habit.description || "");
  const [frequency, setFrequency] = useState(habit.frequency);
  const [targetCount, setTargetCount] = useState(habit.targetCount);
  const [unit, setUnit] = useState(habit.unit || "");
  const [color, setColor] = useState(habit.color || "#3b82f6");
  const [icon, setIcon] = useState(habit.icon || "");
  const [iconPickerOpen, setIconPickerOpen] = useState(false);
  const [scheduledDays, setScheduledDays] = useState<number[]>(
    habit.scheduledDays || [],
  );
  const [weeklyTarget, setWeeklyTarget] = useState(habit.weeklyTarget ?? 2);
  const updateHabit = useUpdateHabit();
  const toast = useToast();

  useEffect(() => {
    if (open) {
      setName(habit.name);
      setDescription(habit.description || "");
      setFrequency(habit.frequency);
      setTargetCount(habit.targetCount);
      setScheduledDays(habit.scheduledDays || []);
      setWeeklyTarget(habit.weeklyTarget ?? 2);
      setUnit(habit.unit || "");
      setColor(habit.color || "#3b82f6");
      setIcon(habit.icon || "");
    }
  }, [open, habit]);

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim()) return;

    updateHabit.mutate(
      {
        id: habit.id,
        data: {
          name: name.trim(),
          description: description.trim() || undefined,
          frequency,
          targetCount,
          scheduledDays:
            frequency === "weekly" && scheduledDays.length > 0
              ? scheduledDays
              : null,
          weeklyTarget:
            frequency === "weekly_target" ? weeklyTarget : undefined,
          unit: unit.trim() || undefined,
          color,
          icon: icon || undefined,
        },
      },
      {
        onSuccess: () => {
          toast.show({ title: "Habit updated", intent: "success" });
          onOpenChange(false);
        },
        onError: () => {
          toast.show({ title: "Failed to update habit", intent: "danger" });
        },
      },
    );
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <Dialog.Portal>
        <Dialog.Overlay />
        <Dialog.Content
          width="92%"
          maxW={520}
          maxH={"86vh" as never}
          overflow={"auto" as never}
          onPointerDownOutside={(e: {
            target: EventTarget | null;
            preventDefault: () => void;
          }) => {
            const target = e.target as Element;
            if (target.closest('[data-slot="popover-content"]')) {
              e.preventDefault();
            }
          }}
          onInteractOutside={(e: {
            target: EventTarget | null;
            preventDefault: () => void;
          }) => {
            const target = e.target as Element;
            if (target.closest('[data-slot="popover-content"]')) {
              e.preventDefault();
            }
          }}
        >
          <Dialog.Title>Edit Habit</Dialog.Title>
          <form onSubmit={handleSubmit} style={{ width: "100%" }}>
            <YStack gap="$4">
              <XStack gap="$2">
                <YStack>
                  <Text fontSize="$3" fontWeight="500" color="$color">
                    Icon
                  </Text>
                  <View mt="$1">
                    <Popover
                      open={iconPickerOpen}
                      onOpenChange={setIconPickerOpen}
                      placement="bottom-start"
                    >
                      <Popover.Trigger asChild>
                        <View
                          {...({
                            role: "button",
                            "aria-label": "Pick an icon...",
                          } as object)}
                          cursor="pointer"
                          height={40}
                          width={40}
                          shrink={0}
                          items="center"
                          justify="center"
                          rounded="$lg"
                          borderWidth={1}
                          borderColor="$borderColor"
                          bg="$background"
                          hoverStyle={{ bg: "$accent" }}
                        >
                          <Text fontSize="$6" color="$color">
                            {icon || "😀"}
                          </Text>
                        </View>
                      </Popover.Trigger>
                      <Popover.Content
                        z={200}
                        width="auto"
                        p={0}
                        borderWidth={0}
                        overflow="hidden"
                        style={{ boxShadow: "0 8px 24px rgba(0,0,0,0.18)" }}
                      >
                        <EmojiPicker
                          width={350}
                          height={400}
                          onSelect={(emoji) => {
                            setIcon(emoji);
                            setIconPickerOpen(false);
                          }}
                        />
                      </Popover.Content>
                    </Popover>
                  </View>
                </YStack>
                <YStack flex={1}>
                  <Label htmlFor="edit-habit-name">Name</Label>
                  <Input
                    id="edit-habit-name"
                    mt="$1"
                    value={name}
                    onChangeText={setName}
                    autoFocus
                  />
                </YStack>
              </XStack>

              <YStack>
                <Label htmlFor="edit-habit-desc">Description</Label>
                <TextArea
                  id="edit-habit-desc"
                  mt="$1"
                  value={description}
                  onChangeText={setDescription}
                  placeholder="Optional details"
                  rows={2}
                />
              </YStack>

              <XStack gap="$4">
                <YStack flex={1}>
                  <Label htmlFor="edit-habit-freq">Frequency</Label>
                  <Select
                    value={frequency}
                    onValueChange={(value) => {
                      setFrequency(value as Habit["frequency"]);
                      if (value !== "weekly") setScheduledDays([]);
                    }}
                  >
                    <Select.Trigger mt="$1" width="100%" />
                    <Select.Content>
                      <Select.Item value="daily">Daily</Select.Item>
                      <Select.Item value="weekly">Specific days</Select.Item>
                      <Select.Item value="weekly_target">
                        Times per week
                      </Select.Item>
                    </Select.Content>
                  </Select>
                </YStack>
                <YStack width={120}>
                  <Label htmlFor="edit-habit-target">
                    {frequency === "weekly_target"
                      ? "Per session"
                      : "Times per day"}
                  </Label>
                  <Input
                    id="edit-habit-target"
                    mt="$1"
                    keyboardType="number-pad"
                    value={String(targetCount)}
                    onChangeText={(text) => setTargetCount(Number(text) || 1)}
                  />
                </YStack>
                <YStack flex={1}>
                  <Label htmlFor="edit-habit-unit">Unit</Label>
                  <Input
                    id="edit-habit-unit"
                    mt="$1"
                    value={unit}
                    onChangeText={setUnit}
                    placeholder="e.g. minutes"
                  />
                </YStack>
              </XStack>

              {frequency === "weekly" && (
                <YStack>
                  <Text fontSize="$3" fontWeight="500" color="$color">
                    Days
                  </Text>
                  <ToggleGroup
                    type="multiple"
                    mt="$2"
                    value={scheduledDays.map(String)}
                    onValueChange={(vals: string[]) =>
                      setScheduledDays(vals.map(Number).sort((a, b) => a - b))
                    }
                  >
                    {DAY_OPTIONS.map((day) => (
                      <ToggleGroup.Item
                        key={day.value}
                        value={String(day.value)}
                        aria-label={day.label}
                      >
                        <Text>{day.label}</Text>
                      </ToggleGroup.Item>
                    ))}
                  </ToggleGroup>
                </YStack>
              )}

              {frequency === "weekly_target" && (
                <YStack>
                  <Label>Times per week</Label>
                  <Text mt="$0.5" fontSize="$1" color="$mutedForeground">
                    Do it this many times a week, on any days.
                  </Text>
                  <XStack mt="$2" items="center" gap="$2">
                    <NumberInput
                      value={weeklyTarget}
                      onChange={setWeeklyTarget}
                      min={1}
                      max={7}
                      step={1}
                    />
                    <Text fontSize="$3" color="$mutedForeground">
                      × / week
                    </Text>
                  </XStack>
                </YStack>
              )}

              <YStack>
                <Text fontSize="$3" fontWeight="500" color="$color">
                  Color
                </Text>
                <XStack mt="$2" gap="$2">
                  {colorOptions.map((opt) => (
                    <View
                      key={opt.value}
                      {...({
                        role: "button",
                        "aria-pressed": color === opt.value,
                        "aria-label": opt.label,
                      } as object)}
                      onPress={() => setColor(opt.value)}
                      cursor="pointer"
                      height={28}
                      width={28}
                      rounded={9999}
                      borderWidth={2}
                      borderColor={
                        color === opt.value ? "$color" : "transparent"
                      }
                      transition="quick"
                      scale={color === opt.value ? 1.1 : 1}
                      style={{ backgroundColor: opt.value }}
                    />
                  ))}
                </XStack>
              </YStack>

              <XStack justify="flex-end" gap="$3" pt="$2">
                <Button
                  intent="outline"
                  type="button"
                  onPress={() => onOpenChange(false)}
                >
                  Cancel
                </Button>
                <Button
                  type="submit"
                  borderWidth={0}
                  color={"#ffffff" as never}
                  style={{ backgroundColor: "var(--ring-habit)" }}
                  hoverStyle={
                    {
                      backgroundColor: "var(--ring-habit)",
                      opacity: 0.9,
                    } as never
                  }
                  pressStyle={
                    {
                      backgroundColor: "var(--ring-habit)",
                      opacity: 0.82,
                    } as never
                  }
                  disabled={!name.trim() || updateHabit.isPending}
                  loading={updateHabit.isPending}
                  loadingText="Saving…"
                >
                  Save
                </Button>
              </XStack>
            </YStack>
          </form>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog>
  );
}
