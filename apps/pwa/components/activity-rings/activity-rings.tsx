"use client";

import { cn } from "@/lib/utils";
import { useActivityRings } from "@/lib/hooks/use-activity-rings";
import { ActivityRingsVisual, RING_COLORS } from "./activity-rings-visual";
import type { ActivityRingsSize } from "./activity-rings-visual";

interface ActivityRingsProps {
  date: string;
  size?: ActivityRingsSize;
  showLabels?: boolean;
  className?: string;
}

const CATEGORIES = [
  { key: "todo" as const, label: "Todos", color: RING_COLORS.todo.color },
  { key: "habit" as const, label: "Habits", color: RING_COLORS.habit.color },
  { key: "journal" as const, label: "Journal", color: RING_COLORS.journal.color },
] as const;

export function ActivityRings({ date, size = "xl", showLabels, className }: ActivityRingsProps) {
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
    todo: `${details.todoDone}/${details.todoTotal}`,
    habit: `${details.habitDone}/${details.habitTotal}`,
    journal: details.hasJournal ? "1/1" : "0/1",
  };

  const percentages: Record<string, number> = {
    todo: Math.round(data.todo),
    habit: Math.round(data.habit),
    journal: data.journal,
  };

  return (
    <div className={cn("rounded-xl border border-border bg-card p-5", className)}>
      <div className="flex flex-col items-center gap-5 sm:flex-row">
        <ActivityRingsVisual data={data} size={size} />
        <div className="flex min-w-[180px] flex-col gap-4">
          {CATEGORIES.map(({ key, label, color }) => (
            <div key={key} className="flex items-center gap-3">
              <span className="inline-block h-3 w-3 shrink-0 rounded-full" style={{ backgroundColor: color }} />
              <span className="text-sm font-medium text-foreground">{label}</span>
              <span className="ml-auto text-sm tabular-nums text-muted-foreground">{fractions[key]}</span>
              <span className="text-sm font-semibold tabular-nums text-foreground">{percentages[key]}%</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
