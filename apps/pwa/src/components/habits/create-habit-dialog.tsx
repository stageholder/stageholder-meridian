import { useState } from "react";
import { useCreateHabit } from "@/lib/api/habits";
import { toast } from "sonner";
import {
  Button,
  Drawer,
  Input,
  Label,
  Select,
  Text,
  TextArea,
  View,
  XStack,
  YStack,
} from "@stageholder/ui";
import { EmojiPicker } from "@/components/ui/emoji-picker";

interface CreateHabitDialogProps {
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

export function CreateHabitDialog({
  open,
  onOpenChange,
}: CreateHabitDialogProps) {
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [frequency, setFrequency] = useState("daily");
  const [targetCount, setTargetCount] = useState(1);
  const [unit, setUnit] = useState("");
  const [color, setColor] = useState("#3b82f6");
  const [icon, setIcon] = useState("🎯");
  const [scheduledDays, setScheduledDays] = useState<number[]>([]);
  const createHabit = useCreateHabit();

  function resetForm() {
    setName("");
    setDescription("");
    setFrequency("daily");
    setTargetCount(1);
    setUnit("");
    setColor("#3b82f6");
    setIcon("🎯");
    setScheduledDays([]);
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim()) return;

    createHabit.mutate(
      {
        name: name.trim(),
        description: description.trim() || undefined,
        frequency,
        targetCount,
        scheduledDays: scheduledDays.length > 0 ? scheduledDays : undefined,
        unit: unit.trim() || undefined,
        color,
        icon: icon || undefined,
      },
      {
        onSuccess: () => {
          toast.success("Habit created");
          resetForm();
          onOpenChange(false);
        },
        onError: () => {
          toast.error("Failed to create habit");
        },
      },
    );
  }

  return (
    <Drawer
      open={open}
      onOpenChange={(v) => {
        if (!v) resetForm();
        onOpenChange(v);
      }}
    >
      <Drawer.Portal>
        <Drawer.Overlay />
        <Drawer.Content
          side="right"
          overflow="scroll"
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
          <View p="$4">
            <Drawer.Title>New Habit</Drawer.Title>
          </View>
          <form onSubmit={handleSubmit}>
            <YStack gap="$4" px="$4" pb="$4">
              <XStack gap="$2">
                <YStack>
                  <Text fontSize="$3" fontWeight="500" color="$color">
                    Icon
                  </Text>
                  <View mt="$1">
                    <EmojiPicker value={icon} onChange={setIcon} />
                  </View>
                </YStack>
                <YStack flex={1}>
                  <Label htmlFor="habit-name">Name</Label>
                  <Input
                    id="habit-name"
                    mt="$1"
                    value={name}
                    onChangeText={setName}
                    placeholder="e.g. Read for 30 minutes"
                    autoFocus
                  />
                </YStack>
              </XStack>

              <YStack>
                <Label htmlFor="habit-description">Description</Label>
                <TextArea
                  id="habit-description"
                  mt="$1"
                  value={description}
                  onChangeText={setDescription}
                  placeholder="Optional details"
                  rows={2}
                />
              </YStack>

              <XStack gap="$4">
                <YStack flex={1}>
                  <Label htmlFor="habit-frequency">Frequency</Label>
                  <Select
                    value={frequency}
                    onValueChange={(value) => {
                      setFrequency(value);
                      if (value === "daily") setScheduledDays([]);
                    }}
                  >
                    <Select.Trigger mt="$1" width="100%" />
                    <Select.Content>
                      <Select.Item value="daily">Daily</Select.Item>
                      <Select.Item value="weekly">Specific days</Select.Item>
                    </Select.Content>
                  </Select>
                </YStack>
                <YStack width={96}>
                  <Label htmlFor="habit-target">Target</Label>
                  <Input
                    id="habit-target"
                    mt="$1"
                    keyboardType="number-pad"
                    value={String(targetCount)}
                    onChangeText={(text) => setTargetCount(Number(text) || 1)}
                  />
                </YStack>
                <YStack flex={1}>
                  <Label htmlFor="habit-unit">Unit</Label>
                  <Input
                    id="habit-unit"
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
                  <XStack mt="$2" gap="$1.5">
                    {DAY_OPTIONS.map((day) => {
                      const active = scheduledDays.includes(day.value);
                      return (
                        <XStack
                          key={day.value}
                          tag="button"
                          type="button"
                          onPress={() =>
                            setScheduledDays(
                              active
                                ? scheduledDays.filter((d) => d !== day.value)
                                : [...scheduledDays, day.value].sort(),
                            )
                          }
                          cursor="pointer"
                          height={36}
                          width={36}
                          items="center"
                          justify="center"
                          rounded="$lg"
                          borderWidth={active ? 0 : 1}
                          borderColor="$borderColor"
                          bg={active ? "$primary" : "transparent"}
                          transition="quick"
                          hoverStyle={active ? undefined : { bg: "$accent" }}
                        >
                          <Text
                            fontSize="$1"
                            fontWeight="500"
                            color={
                              active ? "$primaryForeground" : "$mutedForeground"
                            }
                          >
                            {day.label}
                          </Text>
                        </XStack>
                      );
                    })}
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
                      tag="button"
                      type="button"
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
                      aria-label={opt.label}
                    />
                  ))}
                </XStack>
              </YStack>

              <XStack justify="flex-end" gap="$3" pt="$2">
                <Button
                  intent="outline"
                  type="button"
                  onPress={() => {
                    resetForm();
                    onOpenChange(false);
                  }}
                >
                  Cancel
                </Button>
                <Button
                  type="submit"
                  disabled={!name.trim() || createHabit.isPending}
                  loading={createHabit.isPending}
                  loadingText="Creating…"
                >
                  Create
                </Button>
              </XStack>
            </YStack>
          </form>
        </Drawer.Content>
      </Drawer.Portal>
    </Drawer>
  );
}
