"use client";

import { useState, useMemo } from "react";
import { useParams, useRouter } from "next/navigation";
import {
  format,
  subDays,
  startOfMonth,
  endOfMonth,
  eachDayOfInterval,
  getDay,
  addMonths,
  subMonths,
} from "date-fns";
import { ArrowLeft, ChevronLeft, ChevronRight } from "lucide-react";
import { cn } from "@/lib/utils";
import { EditHabitSheet } from "@/components/habits/edit-habit-sheet";
import {
  useHabit,
  useHabitEntries,
  useDeleteHabit,
} from "@/lib/api/habits";
import { useWorkspace } from "@/lib/workspace-context";
import { toast } from "sonner";
import type { HabitEntry } from "@repo/core/types";

export default function HabitDetailPage() {
  const { workspace } = useWorkspace();
  const params = useParams<{ id: string }>();
  const router = useRouter();

  const { data: habit, isLoading } = useHabit(params.id);
  const deleteHabit = useDeleteHabit();
  const [editOpen, setEditOpen] = useState(false);
  const [calendarMonth, setCalendarMonth] = useState(new Date());

  const today = format(new Date(), "yyyy-MM-dd");
  const ninetyDaysAgo = format(subDays(new Date(), 90), "yyyy-MM-dd");

  const { data: allEntries } = useHabitEntries(params.id, {
    startDate: ninetyDaysAgo,
    endDate: today,
  });

  // Entries for the visible calendar month
  const calMonthStart = format(startOfMonth(calendarMonth), "yyyy-MM-dd");
  const calMonthEnd = format(endOfMonth(calendarMonth), "yyyy-MM-dd");
  const { data: monthEntries } = useHabitEntries(params.id, {
    startDate: calMonthStart,
    endDate: calMonthEnd,
  });

  // Build entry map for quick lookup
  const entryMap = useMemo(() => {
    const map = new Map<string, number>();
    for (const e of allEntries || []) {
      const dateStr = e.date.split("T")[0]!;
      map.set(dateStr, (map.get(dateStr) ?? 0) + e.value);
    }
    return map;
  }, [allEntries]);

  const monthEntryMap = useMemo(() => {
    const map = new Map<string, number>();
    for (const e of monthEntries || []) {
      const dateStr = e.date.split("T")[0]!;
      map.set(dateStr, (map.get(dateStr) ?? 0) + e.value);
    }
    return map;
  }, [monthEntries]);

  // Stats
  const stats = useMemo(() => {
    if (!habit) return { streak: 0, longestStreak: 0, totalCompletions: 0, completionRate: 0 };

    const target = habit.targetCount;
    const hasSchedule = habit.scheduledDays && habit.scheduledDays.length > 0;
    const now = new Date();
    const todayStr = format(now, "yyyy-MM-dd");

    // Current streak (skips non-scheduled days)
    const todayDow = now.getDay();
    const todayIsScheduled = !hasSchedule || habit.scheduledDays!.includes(todayDow);
    const todayCompleted = todayIsScheduled && (entryMap.get(todayStr) ?? 0) >= target;
    let currentStreak = todayCompleted ? 1 : 0;
    for (let i = 1; i <= 90; i++) {
      const checkDay = subDays(now, i);
      const dow = checkDay.getDay();
      if (hasSchedule && !habit.scheduledDays!.includes(dow)) continue;
      const d = format(checkDay, "yyyy-MM-dd");
      if ((entryMap.get(d) ?? 0) >= target) currentStreak++;
      else break;
    }

    // Longest streak + total completions (skips non-scheduled days)
    let longestStreak = 0;
    let tempStreak = 0;
    let totalCompletions = 0;
    for (let i = 90; i >= 0; i--) {
      const checkDay = subDays(now, i);
      const dow = checkDay.getDay();
      if (hasSchedule && !habit.scheduledDays!.includes(dow)) continue;
      const d = format(checkDay, "yyyy-MM-dd");
      if ((entryMap.get(d) ?? 0) >= target) {
        tempStreak++;
        totalCompletions++;
        longestStreak = Math.max(longestStreak, tempStreak);
      } else {
        tempStreak = 0;
      }
    }

    // Completion rate (days with entries / total days since first entry)
    const daysWithData = Array.from(entryMap.keys()).length;
    const completionRate = daysWithData > 0
      ? Math.round((totalCompletions / Math.min(daysWithData + 10, 91)) * 100)
      : 0;

    return { streak: currentStreak, longestStreak, totalCompletions, completionRate };
  }, [entryMap, habit]);

  // Calendar grid
  const calendarDays = useMemo(() => {
    const monthStart = startOfMonth(calendarMonth);
    const monthEnd = endOfMonth(calendarMonth);
    const days = eachDayOfInterval({ start: monthStart, end: monthEnd });
    const startDay = getDay(monthStart);
    const offset = startDay === 0 ? 6 : startDay - 1; // Monday start
    return { days, offset };
  }, [calendarMonth]);

  // Recent entries (last 20)
  const recentEntries = useMemo(() => {
    return (allEntries || [])
      .slice()
      .sort((a, b) => b.date.localeCompare(a.date))
      .slice(0, 20);
  }, [allEntries]);

  function handleDelete() {
    if (!window.confirm(`Delete "${habit?.name}"? This cannot be undone.`)) return;
    deleteHabit.mutate(params.id, {
      onSuccess: () => {
        toast.success("Habit deleted");
        router.push(`/${workspace.shortId}/habits`);
      },
      onError: () => toast.error("Failed to delete habit"),
    });
  }

  if (isLoading) {
    return (
      <div className="space-y-4 p-4">
        <div className="h-8 w-48 animate-pulse rounded bg-muted" />
        <div className="h-4 w-32 animate-pulse rounded bg-muted" />
      </div>
    );
  }

  if (!habit) {
    return (
      <div className="py-12 text-center">
        <p className="text-sm text-muted-foreground">Habit not found.</p>
      </div>
    );
  }

  const habitColor = habit.color || "#3b82f6";

  return (
    <div className="space-y-6 p-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <button
            onClick={() => router.push(`/${workspace.shortId}/habits`)}
            className="flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
          >
            <ArrowLeft className="size-4" />
          </button>
          <div
            className="flex h-10 w-10 items-center justify-center rounded-lg text-lg"
            style={{ backgroundColor: habitColor + "20" }}
          >
            {habit.icon || habit.name.charAt(0).toUpperCase()}
          </div>
          <div>
            <h1 className="text-xl font-bold text-foreground">{habit.name}</h1>
            {habit.description && (
              <p className="text-sm text-muted-foreground">{habit.description}</p>
            )}
          </div>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => setEditOpen(true)}
            className="rounded-lg border border-border px-4 py-2 text-sm font-medium text-foreground hover:bg-accent"
          >
            Edit
          </button>
          <button
            onClick={handleDelete}
            className="rounded-lg border border-destructive/30 px-4 py-2 text-sm font-medium text-destructive hover:bg-destructive/10"
          >
            Delete
          </button>
        </div>
      </div>

      {/* Stats row */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <StatCard
          label="Current Streak"
          value={stats.streak}
          icon={
            <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-orange-500">
              <path d="M8.5 14.5A2.5 2.5 0 0 0 11 12c0-1.38-.5-2-1-3-1.072-2.143-.224-4.054 2-6 .5 2.5 2 4.9 4 6.5 2 1.6 3 3.5 3 5.5a7 7 0 1 1-14 0c0-1.153.433-2.294 1-3a2.5 2.5 0 0 0 2.5 2.5z" />
            </svg>
          }
          suffix=" days"
        />
        <StatCard label="Longest Streak" value={stats.longestStreak} suffix=" days" />
        <StatCard label="Total Completions" value={stats.totalCompletions} />
        <StatCard label="Completion Rate" value={stats.completionRate} suffix="%" />
      </div>

      {/* Calendar + Recent Entries — two-column on desktop, stacked on mobile */}
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        {/* Monthly Calendar Heatmap */}
        <div className="rounded-xl border border-border bg-card p-5">
          <div className="flex items-center justify-between">
            <button
              onClick={() => setCalendarMonth(subMonths(calendarMonth, 1))}
              className="rounded-md p-1 text-muted-foreground hover:bg-accent hover:text-foreground"
            >
              <ChevronLeft className="size-4" />
            </button>
            <h3 className="text-sm font-semibold text-foreground">
              {format(calendarMonth, "MMMM yyyy")}
            </h3>
            <button
              onClick={() => setCalendarMonth(addMonths(calendarMonth, 1))}
              className="rounded-md p-1 text-muted-foreground hover:bg-accent hover:text-foreground"
            >
              <ChevronRight className="size-4" />
            </button>
          </div>

          <div className="mt-3 grid grid-cols-7 gap-1.5 text-center">
            {["M", "T", "W", "T", "F", "S", "S"].map((d, i) => (
              <span key={i} className="text-[10px] font-medium text-muted-foreground">
                {d}
              </span>
            ))}
            {/* Offset empty cells */}
            {Array.from({ length: calendarDays.offset }).map((_, i) => (
              <div key={`empty-${i}`} />
            ))}
            {calendarDays.days.map((day) => {
              const dateStr = format(day, "yyyy-MM-dd");
              const value = monthEntryMap.get(dateStr) ?? 0;
              const ratio = habit.targetCount > 0 ? value / habit.targetCount : 0;
              const isComplete = ratio >= 1;
              const isPartial = ratio > 0 && ratio < 1;
              const isToday = dateStr === today;
              const dow = getDay(day);
              const hasSchedule = habit.scheduledDays && habit.scheduledDays.length > 0;
              const isScheduled = !hasSchedule || habit.scheduledDays!.includes(dow);

              return (
                <div
                  key={dateStr}
                  className="flex items-center justify-center"
                >
                  <div
                    className={cn(
                      "flex h-8 w-8 items-center justify-center rounded-full text-[11px]",
                      !isScheduled && "opacity-25",
                      isToday && "ring-2 ring-primary",
                      isComplete && "text-white font-semibold",
                      !isComplete && !isPartial && "text-muted-foreground",
                      isPartial && "font-medium text-foreground",
                    )}
                    style={
                      isComplete
                        ? { backgroundColor: habitColor }
                        : isPartial
                          ? { backgroundColor: habitColor + "25" }
                          : undefined
                    }
                    title={`${dateStr}: ${value}/${habit.targetCount}${!isScheduled ? " (rest day)" : ""}`}
                  >
                    {isComplete ? (
                      <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                        <polyline points="20 6 9 17 4 12" />
                      </svg>
                    ) : (
                      day.getDate()
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Recent Entries */}
        <div className="rounded-xl border border-border bg-card p-5">
          <h3 className="text-sm font-semibold text-foreground">Recent Entries</h3>
          {recentEntries.length === 0 ? (
            <p className="mt-3 text-xs text-muted-foreground">No entries yet.</p>
          ) : (
            <div className="mt-3 space-y-1.5 overflow-y-auto max-h-[320px] pr-1 [&::-webkit-scrollbar]:w-1.5 [&::-webkit-scrollbar-thumb]:rounded-full [&::-webkit-scrollbar-thumb]:bg-muted-foreground/20 [&::-webkit-scrollbar-track]:bg-transparent">
              {recentEntries.map((entry: HabitEntry) => {
                const dateStr = entry.date.split("T")[0]!;
                const isComplete = entry.value >= habit.targetCount;
                return (
                  <div
                    key={entry.id}
                    className="flex items-center justify-between rounded-lg border border-border/50 px-3 py-2"
                  >
                    <div className="flex items-center gap-2">
                      <div
                        className={cn(
                          "h-2 w-2 rounded-full",
                          isComplete ? "bg-green-500" : "bg-orange-400"
                        )}
                      />
                      <span className="text-sm text-foreground">
                        {format(new Date(dateStr), "MMM d, yyyy")}
                      </span>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="text-xs text-muted-foreground">
                        {entry.value}/{habit.targetCount}
                      </span>
                      {entry.notes && (
                        <span className="max-w-[120px] truncate text-xs text-muted-foreground">
                          {entry.notes}
                        </span>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>

      <EditHabitSheet habit={habit} open={editOpen} onOpenChange={setEditOpen} />
    </div>
  );
}

function StatCard({
  label,
  value,
  icon,
  suffix = "",
}: {
  label: string;
  value: number;
  icon?: React.ReactNode;
  suffix?: string;
}) {
  return (
    <div className="rounded-xl border border-border bg-card p-4">
      <p className="text-xs text-muted-foreground">{label}</p>
      <div className="mt-1 flex items-center gap-1.5">
        {icon}
        <span className="text-xl font-bold text-foreground">
          {value}
          {suffix}
        </span>
      </div>
    </div>
  );
}
