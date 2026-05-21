import { useState } from "react";
import { useCreateHabit } from "@/lib/api/habits";
import { toast } from "sonner";
import {
  Button,
  Drawer,
  Input,
  Label,
  Select,
  TextArea,
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
          className="overflow-y-auto"
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
          <div className="p-4">
            <Drawer.Title>New Habit</Drawer.Title>
          </div>
          <form onSubmit={handleSubmit} className="space-y-4 px-4 pb-4">
            <div className="flex gap-2">
              <div>
                <label className="block text-sm font-medium text-foreground">
                  Icon
                </label>
                <div className="mt-1">
                  <EmojiPicker value={icon} onChange={setIcon} />
                </div>
              </div>
              <div className="flex-1">
                <Label htmlFor="habit-name">Name</Label>
                <Input
                  id="habit-name"
                  className="mt-1"
                  value={name}
                  onChangeText={setName}
                  placeholder="e.g. Read for 30 minutes"
                  autoFocus
                />
              </div>
            </div>

            <div>
              <Label htmlFor="habit-description">Description</Label>
              <TextArea
                id="habit-description"
                className="mt-1"
                value={description}
                onChangeText={setDescription}
                placeholder="Optional details"
                rows={2}
              />
            </div>

            <div className="flex gap-4">
              <div className="flex-1">
                <Label htmlFor="habit-frequency">Frequency</Label>
                <Select
                  value={frequency}
                  onValueChange={(value) => {
                    setFrequency(value);
                    if (value === "daily") setScheduledDays([]);
                  }}
                >
                  <Select.Trigger className="mt-1 w-full rounded-lg border-border bg-background" />
                  <Select.Content>
                    <Select.Item value="daily">Daily</Select.Item>
                    <Select.Item value="weekly">Specific days</Select.Item>
                  </Select.Content>
                </Select>
              </div>
              <div className="w-24">
                <Label htmlFor="habit-target">Target</Label>
                <Input
                  id="habit-target"
                  className="mt-1"
                  keyboardType="number-pad"
                  value={String(targetCount)}
                  onChangeText={(text) => setTargetCount(Number(text) || 1)}
                />
              </div>
              <div className="flex-1">
                <Label htmlFor="habit-unit">Unit</Label>
                <Input
                  id="habit-unit"
                  className="mt-1"
                  value={unit}
                  onChangeText={setUnit}
                  placeholder="e.g. minutes"
                />
              </div>
            </div>

            {frequency === "weekly" && (
              <div>
                <label className="block text-sm font-medium text-foreground">
                  Days
                </label>
                <div className="mt-2 flex gap-1.5">
                  {DAY_OPTIONS.map((day) => {
                    const active = scheduledDays.includes(day.value);
                    return (
                      <button
                        key={day.value}
                        type="button"
                        onClick={() =>
                          setScheduledDays(
                            active
                              ? scheduledDays.filter((d) => d !== day.value)
                              : [...scheduledDays, day.value].sort(),
                          )
                        }
                        className={`flex h-9 w-9 items-center justify-center rounded-lg text-xs font-medium transition-all ${
                          active
                            ? "bg-primary text-primary-foreground"
                            : "border border-border text-muted-foreground hover:bg-accent"
                        }`}
                      >
                        {day.label}
                      </button>
                    );
                  })}
                </div>
              </div>
            )}

            <div>
              <label className="block text-sm font-medium text-foreground">
                Color
              </label>
              <div className="mt-2 flex gap-2">
                {colorOptions.map((opt) => (
                  <button
                    key={opt.value}
                    type="button"
                    onClick={() => setColor(opt.value)}
                    className={`h-7 w-7 rounded-full border-2 transition-all ${
                      color === opt.value
                        ? "border-foreground scale-110"
                        : "border-transparent"
                    }`}
                    style={{ backgroundColor: opt.value }}
                    aria-label={opt.label}
                  />
                ))}
              </div>
            </div>

            <div className="flex justify-end gap-3 pt-2">
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
            </div>
          </form>
        </Drawer.Content>
      </Drawer.Portal>
    </Drawer>
  );
}
