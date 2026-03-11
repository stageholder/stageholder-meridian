"use client";

import { CheckSquare, Heart, BookOpen, Target } from "lucide-react";
import { cn } from "@/lib/utils";

const GOALS = [
  {
    id: "productivity",
    label: "Productivity",
    description: "Manage tasks and stay organized",
    icon: CheckSquare,
  },
  {
    id: "health",
    label: "Health",
    description: "Build healthy habits and track progress",
    icon: Heart,
  },
  {
    id: "journaling",
    label: "Journaling",
    description: "Reflect and write daily entries",
    icon: BookOpen,
  },
  {
    id: "habits",
    label: "Habit Tracking",
    description: "Create routines and maintain streaks",
    icon: Target,
  },
] as const;

export function GoalsStep({
  selectedGoals,
  onGoalsChange,
  onContinue,
}: {
  selectedGoals: string[];
  onGoalsChange: (goals: string[]) => void;
  onContinue: () => void;
}) {
  function toggleGoal(id: string) {
    onGoalsChange(
      selectedGoals.includes(id)
        ? selectedGoals.filter((g) => g !== id)
        : [...selectedGoals, id],
    );
  }

  return (
    <div className="space-y-6">
      <div className="space-y-2">
        <h2 className="text-xl font-bold text-foreground">
          What are your goals?
        </h2>
        <p className="text-sm text-muted-foreground">
          Select what you&apos;d like to focus on. This helps us personalize
          your experience.
        </p>
      </div>

      <div className="grid grid-cols-2 gap-3">
        {GOALS.map((goal) => {
          const selected = selectedGoals.includes(goal.id);
          const Icon = goal.icon;
          return (
            <button
              key={goal.id}
              onClick={() => toggleGoal(goal.id)}
              className={cn(
                "flex flex-col items-center gap-2 rounded-lg border-2 p-4 text-center transition-colors",
                selected
                  ? "border-primary bg-primary/5"
                  : "border-border hover:border-primary/30",
              )}
            >
              <Icon
                className={cn(
                  "size-6",
                  selected ? "text-primary" : "text-muted-foreground",
                )}
              />
              <span className="text-sm font-medium text-foreground">
                {goal.label}
              </span>
              <span className="text-xs text-muted-foreground">
                {goal.description}
              </span>
            </button>
          );
        })}
      </div>

      <button
        onClick={onContinue}
        className="w-full rounded-lg bg-primary px-4 py-2.5 text-sm font-medium text-primary-foreground hover:bg-primary/90 transition-colors"
      >
        Continue
      </button>
    </div>
  );
}
