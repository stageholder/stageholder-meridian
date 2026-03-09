"use client";

import { useState, useEffect } from "react";
import { useUpdateHabit } from "@/lib/api/habits";
import { toast } from "sonner";
import type { Habit } from "@repo/core/types";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

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

const iconOptions: { emoji: string; keywords: string }[] = [
  { emoji: "💧", keywords: "water drink hydrate" },
  { emoji: "🏃", keywords: "run jog exercise cardio" },
  { emoji: "🧘", keywords: "yoga meditate stretch calm" },
  { emoji: "💪", keywords: "strength workout gym muscle" },
  { emoji: "🚴", keywords: "bike cycle ride" },
  { emoji: "🏊", keywords: "swim pool" },
  { emoji: "🤸", keywords: "gymnastics flexibility" },
  { emoji: "⚽", keywords: "soccer football sport" },
  { emoji: "🎾", keywords: "tennis sport" },
  { emoji: "🧗", keywords: "climb rock" },
  { emoji: "🚶", keywords: "walk step" },
  { emoji: "🏋️", keywords: "weight lift gym" },
  { emoji: "📚", keywords: "read book study learn" },
  { emoji: "🧠", keywords: "brain think focus mind" },
  { emoji: "✍️", keywords: "write journal pen" },
  { emoji: "📝", keywords: "note write plan" },
  { emoji: "🔬", keywords: "science research study" },
  { emoji: "🎯", keywords: "goal target focus aim" },
  { emoji: "💡", keywords: "idea learn think" },
  { emoji: "📖", keywords: "read book story" },
  { emoji: "🎓", keywords: "study learn school education" },
  { emoji: "🧩", keywords: "puzzle game brain" },
  { emoji: "🎨", keywords: "art paint draw creative" },
  { emoji: "🎵", keywords: "music song listen" },
  { emoji: "🎸", keywords: "guitar music play instrument" },
  { emoji: "📷", keywords: "photo camera picture" },
  { emoji: "🎬", keywords: "film movie video" },
  { emoji: "🖊️", keywords: "pen write draw" },
  { emoji: "🪡", keywords: "sew craft stitch" },
  { emoji: "🎭", keywords: "theater act perform" },
  { emoji: "💤", keywords: "sleep rest nap bed" },
  { emoji: "🧖", keywords: "spa relax self-care skin" },
  { emoji: "💊", keywords: "medicine vitamin supplement pill" },
  { emoji: "🫧", keywords: "clean wash bubble" },
  { emoji: "🌸", keywords: "flower bloom calm" },
  { emoji: "🕯️", keywords: "candle relax calm" },
  { emoji: "☕", keywords: "coffee morning drink" },
  { emoji: "🍵", keywords: "tea drink calm" },
  { emoji: "🍎", keywords: "apple fruit eat healthy" },
  { emoji: "🥗", keywords: "salad eat healthy food" },
  { emoji: "🥤", keywords: "drink smoothie juice" },
  { emoji: "🍳", keywords: "cook breakfast egg meal" },
  { emoji: "🥑", keywords: "avocado healthy food" },
  { emoji: "🫐", keywords: "berry fruit healthy" },
  { emoji: "🧹", keywords: "clean sweep tidy home" },
  { emoji: "💰", keywords: "money save budget finance" },
  { emoji: "📅", keywords: "calendar plan schedule" },
  { emoji: "✅", keywords: "check done task complete" },
  { emoji: "🏡", keywords: "home house chore" },
  { emoji: "👔", keywords: "work professional dress" },
  { emoji: "🌱", keywords: "plant grow garden nature" },
  { emoji: "☀️", keywords: "sun morning outdoor" },
  { emoji: "🌙", keywords: "moon night evening" },
  { emoji: "🌊", keywords: "ocean wave swim outdoor" },
  { emoji: "🌿", keywords: "nature leaf green outdoor" },
  { emoji: "🐕", keywords: "dog pet walk" },
  { emoji: "❤️", keywords: "love heart care" },
  { emoji: "🙏", keywords: "pray grateful meditate spiritual" },
  { emoji: "👥", keywords: "social people friend group" },
  { emoji: "💬", keywords: "chat talk communicate" },
  { emoji: "📞", keywords: "call phone contact" },
  { emoji: "🤝", keywords: "handshake connect network" },
  { emoji: "🎮", keywords: "game play fun" },
  { emoji: "✈️", keywords: "travel fly trip" },
  { emoji: "🧸", keywords: "toy play kid" },
  { emoji: "🌈", keywords: "rainbow color happy" },
  { emoji: "🧘‍♂️", keywords: "meditate man mindful" },
  { emoji: "🎧", keywords: "headphone music listen podcast" },
  { emoji: "🛌", keywords: "bed sleep rest early" },
  { emoji: "🪥", keywords: "toothbrush teeth hygiene brush" },
];

export function EditHabitSheet({ habit, open, onOpenChange }: EditHabitSheetProps) {
  const [name, setName] = useState(habit.name);
  const [description, setDescription] = useState(habit.description || "");
  const [frequency, setFrequency] = useState(habit.frequency);
  const [targetCount, setTargetCount] = useState(habit.targetCount);
  const [unit, setUnit] = useState(habit.unit || "");
  const [color, setColor] = useState(habit.color || "#3b82f6");
  const [icon, setIcon] = useState(habit.icon || "");
  const [scheduledDays, setScheduledDays] = useState<number[]>(habit.scheduledDays || []);
  const [iconPickerOpen, setIconPickerOpen] = useState(false);
  const [iconSearch, setIconSearch] = useState("");
  const updateHabit = useUpdateHabit();

  useEffect(() => {
    if (open) {
      setName(habit.name);
      setDescription(habit.description || "");
      setFrequency(habit.frequency);
      setTargetCount(habit.targetCount);
      setScheduledDays(habit.scheduledDays || []);
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
          scheduledDays: scheduledDays.length > 0 ? scheduledDays : null,
          unit: unit.trim() || undefined,
          color,
          icon: icon || undefined,
        },
      },
      {
        onSuccess: () => {
          toast.success("Habit updated");
          onOpenChange(false);
        },
        onError: () => {
          toast.error("Failed to update habit");
        },
      }
    );
  }

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="overflow-y-auto">
        <SheetHeader>
          <SheetTitle>Edit Habit</SheetTitle>
        </SheetHeader>
        <form onSubmit={handleSubmit} className="space-y-4 px-4 pb-4">
          <div>
            <label htmlFor="edit-habit-name" className="block text-sm font-medium text-foreground">
              Name
            </label>
            <input
              id="edit-habit-name"
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="mt-1 block w-full rounded-lg border border-border bg-background px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
              autoFocus
            />
          </div>

          <div>
            <label htmlFor="edit-habit-desc" className="block text-sm font-medium text-foreground">
              Description
            </label>
            <textarea
              id="edit-habit-desc"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Optional details"
              rows={2}
              className="mt-1 block w-full rounded-lg border border-border bg-background px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
            />
          </div>

          <div className="flex gap-4">
            <div className="flex-1">
              <label htmlFor="edit-habit-freq" className="block text-sm font-medium text-foreground">
                Frequency
              </label>
              <Select
                value={frequency}
                onValueChange={(value) => {
                  setFrequency(value as Habit["frequency"]);
                  if (value === "daily") setScheduledDays([]);
                }}
              >
                <SelectTrigger className="mt-1 w-full rounded-lg border-border bg-background">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="daily">Daily</SelectItem>
                  <SelectItem value="weekly">Specific days</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="w-24">
              <label htmlFor="edit-habit-target" className="block text-sm font-medium text-foreground">
                Target
              </label>
              <input
                id="edit-habit-target"
                type="number"
                min="1"
                value={targetCount}
                onChange={(e) => setTargetCount(Number(e.target.value))}
                className="mt-1 block w-full rounded-lg border border-border bg-background px-3 py-2 text-sm text-foreground focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
              />
            </div>
            <div className="flex-1">
              <label htmlFor="edit-habit-unit" className="block text-sm font-medium text-foreground">
                Unit
              </label>
              <input
                id="edit-habit-unit"
                type="text"
                value={unit}
                onChange={(e) => setUnit(e.target.value)}
                placeholder="e.g. minutes"
                className="mt-1 block w-full rounded-lg border border-border bg-background px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
              />
            </div>
          </div>

          {frequency === "weekly" && (
            <div>
              <label className="block text-sm font-medium text-foreground">Days</label>
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
                            : [...scheduledDays, day.value].sort()
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
            <label className="block text-sm font-medium text-foreground">Icon</label>
            <button
              type="button"
              onClick={() => setIconPickerOpen(!iconPickerOpen)}
              className="mt-1 flex h-10 w-full items-center gap-2 rounded-lg border border-border bg-background px-3 text-sm text-foreground hover:bg-accent"
            >
              {icon ? (
                <span className="text-lg">{icon}</span>
              ) : (
                <span className="text-muted-foreground">Pick an icon...</span>
              )}
            </button>
            {iconPickerOpen && (
              <div className="mt-2 rounded-lg border border-border">
                <div className="border-b border-border px-2 py-1.5">
                  <input
                    type="text"
                    value={iconSearch}
                    onChange={(e) => setIconSearch(e.target.value)}
                    placeholder="Search icons..."
                    className="w-full bg-transparent text-sm text-foreground placeholder:text-muted-foreground focus:outline-none"
                  />
                </div>
                <div className="max-h-40 overflow-y-auto p-2 [&::-webkit-scrollbar]:w-1.5 [&::-webkit-scrollbar-thumb]:rounded-full [&::-webkit-scrollbar-thumb]:bg-muted-foreground/20 [&::-webkit-scrollbar-track]:bg-transparent">
                  <div className="grid grid-cols-7 gap-1.5">
                    {iconOptions
                      .filter((opt) =>
                        !iconSearch || opt.keywords.includes(iconSearch.toLowerCase())
                      )
                      .map((opt) => (
                        <button
                          key={opt.emoji}
                          type="button"
                          onClick={() => {
                            setIcon(icon === opt.emoji ? "" : opt.emoji);
                            setIconPickerOpen(false);
                            setIconSearch("");
                          }}
                          className={`flex h-9 w-9 items-center justify-center rounded-lg text-lg transition-all ${
                            icon === opt.emoji
                              ? "bg-primary/10 ring-2 ring-primary"
                              : "hover:bg-accent"
                          }`}
                        >
                          {opt.emoji}
                        </button>
                      ))}
                  </div>
                </div>
              </div>
            )}
          </div>

          <div>
            <label className="block text-sm font-medium text-foreground">Color</label>
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
            <button
              type="button"
              onClick={() => onOpenChange(false)}
              className="rounded-lg border border-border px-4 py-2 text-sm font-medium text-foreground hover:bg-accent"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={!name.trim() || updateHabit.isPending}
              className="rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
            >
              {updateHabit.isPending ? "Saving..." : "Save"}
            </button>
          </div>
        </form>
      </SheetContent>
    </Sheet>
  );
}
