"use client";

import { cn } from "@/lib/utils";

const moods = [
  { value: 1, label: "Terrible", emoji: "\u{1F622}" },
  { value: 2, label: "Bad", emoji: "\u{1F641}" },
  { value: 3, label: "Okay", emoji: "\u{1F610}" },
  { value: 4, label: "Good", emoji: "\u{1F642}" },
  { value: 5, label: "Great", emoji: "\u{1F604}" },
];

interface MoodPickerProps {
  value?: number;
  onChange: (mood: number) => void;
}

export function MoodPicker({ value, onChange }: MoodPickerProps) {
  return (
    <div className="flex items-center gap-2">
      {moods.map((mood) => (
        <button
          key={mood.value}
          type="button"
          onClick={() => onChange(mood.value)}
          className={cn(
            "flex h-10 w-10 items-center justify-center rounded-lg border-2 text-xl transition-colors",
            value === mood.value
              ? "border-primary bg-primary/10"
              : "border-transparent hover:bg-accent"
          )}
          title={mood.label}
          aria-label={mood.label}
        >
          {mood.emoji}
        </button>
      ))}
    </div>
  );
}

export function MoodDisplay({ mood }: { mood?: number }) {
  if (!mood) return null;
  const moodData = moods.find((m) => m.value === mood);
  if (!moodData) return null;

  return (
    <span title={moodData.label} className="text-lg">
      {moodData.emoji}
    </span>
  );
}
