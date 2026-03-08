"use client";

import { CheckSquare, Heart, BookOpen, Target, CalendarDays, Home } from "lucide-react";

interface Feature {
  icon: typeof Home;
  title: string;
  description: string;
  goals: string[];
}

const FEATURES: Feature[] = [
  { icon: Home, title: "Dashboard", description: "See your day at a glance with activity rings and upcoming tasks.", goals: [] },
  { icon: CheckSquare, title: "Todos", description: "Organize tasks with priorities, due dates, and subtasks.", goals: ["productivity"] },
  { icon: Target, title: "Habits", description: "Track daily habits and build streaks over time.", goals: ["health", "habits"] },
  { icon: BookOpen, title: "Journal", description: "Write daily reflections to capture your thoughts.", goals: ["journaling"] },
  { icon: CalendarDays, title: "Calendar", description: "View all your tasks and habits in a calendar view.", goals: ["productivity", "habits"] },
  { icon: Heart, title: "Health Tracking", description: "Monitor your wellness habits and see your progress.", goals: ["health"] },
];

export function TourStep({
  selectedGoals,
  onContinue,
}: {
  selectedGoals: string[];
  onContinue: () => void;
}) {
  // Show dashboard always, plus features matching selected goals. If no goals selected, show all.
  const filtered =
    selectedGoals.length === 0
      ? FEATURES
      : FEATURES.filter(
          (f) => f.goals.length === 0 || f.goals.some((g) => selectedGoals.includes(g)),
        );

  return (
    <div className="space-y-6">
      <div className="space-y-2">
        <h2 className="text-xl font-bold text-foreground">Here&apos;s what you can do</h2>
        <p className="text-sm text-muted-foreground">
          A quick look at the features tailored for you.
        </p>
      </div>

      <div className="space-y-3">
        {filtered.map((feature, i) => {
          const Icon = feature.icon;
          return (
            <div
              key={feature.title}
              className="flex items-start gap-3 rounded-lg border border-border p-3 animate-in fade-in"
              style={{ animationDelay: `${i * 100}ms`, animationFillMode: "both" }}
            >
              <div className="flex size-9 shrink-0 items-center justify-center rounded-md bg-primary/10">
                <Icon className="size-4 text-primary" />
              </div>
              <div>
                <p className="text-sm font-medium text-foreground">{feature.title}</p>
                <p className="text-xs text-muted-foreground">{feature.description}</p>
              </div>
            </div>
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
