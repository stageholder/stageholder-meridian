"use client";

import { format } from "date-fns";
import { Flame } from "lucide-react";
import { useUser } from "@/hooks/use-user";
import { useUserLight } from "@/lib/api/light";

function getGreeting(hour: number): string {
  if (hour < 5) return "Good night";
  if (hour < 12) return "Good morning";
  if (hour < 17) return "Good afternoon";
  if (hour < 21) return "Good evening";
  return "Good night";
}

export function GreetingBar() {
  const { data: user } = useUser();
  const { data: userLight } = useUserLight();
  const now = new Date();
  const greeting = getGreeting(now.getHours());
  const dateStr = format(now, "EEEE, MMMM d");
  const streak = userLight?.perfectDayStreak ?? 0;

  return (
    <div className="flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between">
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-foreground">
          {greeting}
          {user?.name ? `, ${user.name.split(" ")[0]}` : ""}
        </h1>
        <p className="text-sm text-muted-foreground">{dateStr}</p>
      </div>
      {streak > 0 && (
        <div className="flex items-center gap-1.5 rounded-full bg-amber-100 px-3 py-1.5 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400">
          <Flame className="h-4 w-4" />
          <span className="text-sm font-semibold tabular-nums">
            {streak} day streak
          </span>
        </div>
      )}
    </div>
  );
}
