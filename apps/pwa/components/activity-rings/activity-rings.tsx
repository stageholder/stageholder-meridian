"use client";

import { cn } from "@/lib/utils";
import { CheckSquare, Target, BookOpen } from "lucide-react";
import { useActivityRings } from "@/lib/hooks/use-activity-rings";
import { ActivityRingsVisual, RING_COLORS } from "./activity-rings-visual";
import type { ActivityRingsSize } from "./activity-rings-visual";

interface ActivityRingsProps {
  date: string;
  size?: ActivityRingsSize;
  showLabels?: boolean;
  bare?: boolean;
  className?: string;
}

const CATEGORIES = [
  { key: "todo" as const, label: "Todos", color: RING_COLORS.todo.color, icon: CheckSquare },
  { key: "habit" as const, label: "Habits", color: RING_COLORS.habit.color, icon: Target },
  { key: "journal" as const, label: "Journal", color: RING_COLORS.journal.color, icon: BookOpen },
] as const;

export function ActivityRings({ date, size = "xl", showLabels, bare, className }: ActivityRingsProps) {
  const { data, isLoading, details } = useActivityRings(date);

  if (isLoading) {
    return (
      <div className={cn("flex items-center justify-center", className)} style={{ minHeight: size === "xl" ? 160 : 96 }}>
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-muted-foreground/20 border-t-primary" />
      </div>
    );
  }

  if (!showLabels) {
    return <ActivityRingsVisual data={data} size={size} className={className} />;
  }

  const fractions: Record<string, string> = {
    todo: `${details.todoDone}/${details.todoTarget}`,
    habit: `${details.habitDone}/${details.habitTotal}`,
    journal: `${details.journalWords}/${details.journalTarget} words`,
  };

  const percentages: Record<string, number> = {
    todo: Math.round(data.todo),
    habit: Math.round(data.habit),
    journal: data.journal,
  };

  return (
    <div className={cn(!bare && "rounded-xl border border-border bg-card p-5", className)}>
      <div className="flex flex-col items-center gap-5 sm:flex-row">
        <ActivityRingsVisual data={data} size={size} />
        <div className="flex min-w-0 flex-1 flex-col gap-3">
          {CATEGORIES.map(({ key, label, color, icon: Icon }) => (
            <div key={key} className="flex items-center gap-3">
              <Icon className="size-4 shrink-0" style={{ color }} />
              <div className="min-w-0 flex-1">
                <p className="text-sm font-medium text-foreground">{label}</p>
                <p className="text-xs tabular-nums text-muted-foreground">
                  {fractions[key]} · {percentages[key]}%
                </p>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
