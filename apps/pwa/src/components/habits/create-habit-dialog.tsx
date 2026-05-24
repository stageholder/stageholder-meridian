import { useState } from "react";
import { useCreateHabit } from "@/lib/api/habits";
import { toast } from "sonner";
import {
  Button,
  Dialog,
  Input,
  Label,
  Select,
  Text,
  TextArea,
  ToggleGroup,
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
    <Dialog
      open={open}
      onOpenChange={(v) => {
        if (!v) resetForm();
        onOpenChange(v);
      }}
    >
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
          <Dialog.Title>New Habit</Dialog.Title>
          <form onSubmit={handleSubmit} style={{ width: "100%" }}>
            <YStack gap="$4">
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
                        {day.label}
                      </ToggleGroup.Item>
                    ))}
                  </ToggleGroup>
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
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog>
  );
}
