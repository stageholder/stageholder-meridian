"use client";

import { cn } from "@/lib/utils";

interface HabitStreakProps {
  currentStreak: number;
  targetCount: number;
}

export function HabitStreak({ currentStreak, targetCount }: HabitStreakProps) {
  const percentage = targetCount > 0 ? Math.min((currentStreak / targetCount) * 100, 100) : 0;

  return (
    <div className="flex items-center gap-2">
      <div className="flex items-center gap-1">
        <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-orange-500">
          <path d="M8.5 14.5A2.5 2.5 0 0 0 11 12c0-1.38-.5-2-1-3-1.072-2.143-.224-4.054 2-6 .5 2.5 2 4.9 4 6.5 2 1.6 3 3.5 3 5.5a7 7 0 1 1-14 0c0-1.153.433-2.294 1-3a2.5 2.5 0 0 0 2.5 2.5z" />
        </svg>
        <span className="text-sm font-semibold text-foreground">{currentStreak}</span>
      </div>
      <div className="h-2 flex-1 overflow-hidden rounded-full bg-muted">
        <div
          className={cn(
            "h-full rounded-full transition-all",
            percentage >= 100 ? "bg-green-500" : "bg-orange-500"
          )}
          style={{ width: `${percentage}%` }}
        />
      </div>
    </div>
  );
}
