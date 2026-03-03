"use client";

import { TodayTodos } from "@/components/dashboard/today-todos";
import { HabitSummary } from "@/components/dashboard/habit-summary";
import { RecentJournals } from "@/components/dashboard/recent-journals";

export default function DashboardPage() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-foreground">Dashboard</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Your personal productivity overview.
        </p>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <TodayTodos />
        <HabitSummary />
      </div>

      <RecentJournals />
    </div>
  );
}
