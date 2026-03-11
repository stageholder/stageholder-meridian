"use client";

import { cn } from "@/lib/utils";

interface HabitProgressProps {
  value: number;
  targetCount: number;
  color?: string;
  streak: number;
}

export function HabitProgress({
  value,
  targetCount,
  color,
  streak,
}: HabitProgressProps) {
  const percentage =
    targetCount > 0 ? Math.min((value / targetCount) * 100, 100) : 0;
  const isComplete = value >= targetCount;
  const habitColor = color || "#3b82f6";

  return (
    <div className="flex items-center gap-3">
      <div className="flex flex-1 flex-col gap-1">
        <div className="flex items-center justify-between">
          <span className="text-xs text-muted-foreground">
            {value}/{targetCount}
          </span>
          {isComplete && (
            <span className="text-xs font-medium text-green-600 dark:text-green-400">
              Complete
            </span>
          )}
        </div>
        <div className="h-2 overflow-hidden rounded-full bg-muted">
          <div
            className={cn(
              "h-full rounded-full transition-all duration-500 ease-out",
              isComplete && "shadow-[0_0_8px_rgba(34,197,94,0.4)]",
            )}
            style={{
              width: `${percentage}%`,
              backgroundColor: isComplete ? "#22c55e" : habitColor,
            }}
          />
        </div>
      </div>
      {streak > 0 && (
        <div className="flex items-center gap-1 rounded-full bg-orange-100 px-2 py-0.5 dark:bg-orange-900/30">
          <svg
            xmlns="http://www.w3.org/2000/svg"
            width="12"
            height="12"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
            className="text-orange-500"
          >
            <path d="M8.5 14.5A2.5 2.5 0 0 0 11 12c0-1.38-.5-2-1-3-1.072-2.143-.224-4.054 2-6 .5 2.5 2 4.9 4 6.5 2 1.6 3 3.5 3 5.5a7 7 0 1 1-14 0c0-1.153.433-2.294 1-3a2.5 2.5 0 0 0 2.5 2.5z" />
          </svg>
          <span className="text-xs font-semibold text-orange-600 dark:text-orange-400">
            {streak}
          </span>
        </div>
      )}
    </div>
  );
}
