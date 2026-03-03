"use client";

import { useState } from "react";
import { useCreateHabit } from "@/lib/api/habits";
import { toast } from "sonner";

interface CreateHabitDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

const colorOptions = [
  { value: "#ef4444", label: "Red" },
  { value: "#f97316", label: "Orange" },
  { value: "#eab308", label: "Yellow" },
  { value: "#22c55e", label: "Green" },
  { value: "#3b82f6", label: "Blue" },
  { value: "#8b5cf6", label: "Purple" },
  { value: "#ec4899", label: "Pink" },
];

export function CreateHabitDialog({ open, onOpenChange }: CreateHabitDialogProps) {
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [frequency, setFrequency] = useState("daily");
  const [targetCount, setTargetCount] = useState(1);
  const [unit, setUnit] = useState("");
  const [color, setColor] = useState("#3b82f6");
  const createHabit = useCreateHabit();

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim()) return;

    createHabit.mutate(
      {
        name: name.trim(),
        description: description.trim() || undefined,
        frequency,
        targetCount,
        unit: unit.trim() || undefined,
        color,
      },
      {
        onSuccess: () => {
          toast.success("Habit created");
          setName("");
          setDescription("");
          setFrequency("daily");
          setTargetCount(1);
          setUnit("");
          setColor("#3b82f6");
          onOpenChange(false);
        },
        onError: () => {
          toast.error("Failed to create habit");
        },
      }
    );
  }

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div className="fixed inset-0 bg-black/50" onClick={() => onOpenChange(false)} />
      <div className="relative z-50 w-full max-w-md rounded-xl border border-border bg-card p-6 shadow-lg">
        <h2 className="text-lg font-semibold text-foreground">New Habit</h2>
        <form onSubmit={handleSubmit} className="mt-4 space-y-4">
          <div>
            <label htmlFor="habit-name" className="block text-sm font-medium text-foreground">
              Name
            </label>
            <input
              id="habit-name"
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. Read for 30 minutes"
              className="mt-1 block w-full rounded-lg border border-border bg-background px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
              autoFocus
            />
          </div>

          <div>
            <label htmlFor="habit-description" className="block text-sm font-medium text-foreground">
              Description
            </label>
            <textarea
              id="habit-description"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Optional details"
              rows={2}
              className="mt-1 block w-full rounded-lg border border-border bg-background px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
            />
          </div>

          <div className="flex gap-4">
            <div className="flex-1">
              <label htmlFor="habit-frequency" className="block text-sm font-medium text-foreground">
                Frequency
              </label>
              <select
                id="habit-frequency"
                value={frequency}
                onChange={(e) => setFrequency(e.target.value)}
                className="mt-1 block w-full rounded-lg border border-border bg-background px-3 py-2 text-sm text-foreground focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
              >
                <option value="daily">Daily</option>
                <option value="weekly">Weekly</option>
                <option value="custom">Custom</option>
              </select>
            </div>
            <div className="w-24">
              <label htmlFor="habit-target" className="block text-sm font-medium text-foreground">
                Target
              </label>
              <input
                id="habit-target"
                type="number"
                min="1"
                value={targetCount}
                onChange={(e) => setTargetCount(Number(e.target.value))}
                className="mt-1 block w-full rounded-lg border border-border bg-background px-3 py-2 text-sm text-foreground focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
              />
            </div>
            <div className="flex-1">
              <label htmlFor="habit-unit" className="block text-sm font-medium text-foreground">
                Unit
              </label>
              <input
                id="habit-unit"
                type="text"
                value={unit}
                onChange={(e) => setUnit(e.target.value)}
                placeholder="e.g. minutes"
                className="mt-1 block w-full rounded-lg border border-border bg-background px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
              />
            </div>
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
                    color === opt.value ? "border-foreground scale-110" : "border-transparent"
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
              disabled={!name.trim() || createHabit.isPending}
              className="rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
            >
              {createHabit.isPending ? "Creating..." : "Create"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
