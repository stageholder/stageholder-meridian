// apps/mobile/lib/stores/habits.ts
//
// Zustand store for habits + their per-date check-ins. Streak math runs
// against `checkIns` — the longest consecutive run ending today (or
// yesterday if today isn't checked yet — we count the chain alive until
// the day actually ends).

import AsyncStorage from "@react-native-async-storage/async-storage";
import { create } from "zustand";
import { createJSONStorage, persist } from "zustand/middleware";
import { dateKey, type Habit } from "@/lib/types";
import { SEED_HABITS } from "@/lib/seed-data";

type HabitInput = {
  title: string;
  color?: string;
  scheduledDays?: number[];
};

type HabitStore = {
  habits: Habit[];
  add: (input: HabitInput) => Habit;
  remove: (id: string) => void;
  toggleCheckIn: (id: string, key?: string) => void;
  isCheckedIn: (id: string, key?: string) => boolean;
  /** Current streak (consecutive days ending today/yesterday) for one habit. */
  streakFor: (id: string) => number;
  /** Best (longest) streak overall — used in the Today dashboard. */
  bestActiveStreak: () => number;
  /** "Done today" / "Total scheduled today" — drives the activity ring. */
  todayProgress: () => { done: number; total: number };
};

const DEFAULT_COLORS = [
  "#ef4444",
  "#f59e0b",
  "#22c55e",
  "#3b82f6",
  "#a855f7",
  "#ec4899",
];

export const useHabits = create<HabitStore>()(
  persist(
    (set, get) => ({
      habits: SEED_HABITS,

      add: (input) => {
        const usedColors = new Set(get().habits.map((h) => h.color));
        const palette =
          DEFAULT_COLORS.find((c) => !usedColors.has(c)) ?? DEFAULT_COLORS[0]!;
        const habit: Habit = {
          id: makeId(),
          title: input.title.trim(),
          color: input.color ?? palette,
          scheduledDays: input.scheduledDays ?? [],
          checkIns: {},
          createdAt: new Date().toISOString(),
        };
        set({ habits: [habit, ...get().habits] });
        return habit;
      },

      remove: (id) => set({ habits: get().habits.filter((h) => h.id !== id) }),

      toggleCheckIn: (id, key) => {
        const k = key ?? dateKey();
        set({
          habits: get().habits.map((h) => {
            if (h.id !== id) return h;
            const next = { ...h.checkIns };
            if (next[k]) delete next[k];
            else next[k] = true;
            return { ...h, checkIns: next };
          }),
        });
      },

      isCheckedIn: (id, key) => {
        const k = key ?? dateKey();
        const h = get().habits.find((x) => x.id === id);
        return !!h?.checkIns[k];
      },

      streakFor: (id) => {
        const h = get().habits.find((x) => x.id === id);
        if (!h) return 0;
        return computeStreak(h);
      },

      bestActiveStreak: () => {
        return get().habits.reduce(
          (max, h) => Math.max(max, computeStreak(h)),
          0,
        );
      },

      todayProgress: () => {
        const today = new Date();
        const todayDow = today.getDay();
        const k = dateKey(today);
        const scheduledToday = get().habits.filter(
          (h) =>
            h.scheduledDays.length === 0 || h.scheduledDays.includes(todayDow),
        );
        return {
          done: scheduledToday.filter((h) => h.checkIns[k]).length,
          total: scheduledToday.length,
        };
      },
    }),
    {
      name: "meridian.habits.v1",
      storage: createJSONStorage(() => AsyncStorage),
    },
  ),
);

/**
 * Streak = consecutive days with a check-in, ending at today (or yesterday
 * if today's window hasn't been used yet — we keep the chain alive until
 * the day rolls over). Days the habit isn't scheduled for are SKIPPED, not
 * counted as misses, so a Mon/Wed/Fri habit's streak doesn't reset every
 * Saturday.
 */
function computeStreak(h: Habit): number {
  const todayKey = dateKey();
  let streak = 0;
  // Start from today; if today isn't checked, allow yesterday as the
  // anchor (the chain hasn't broken yet — today is just unfinished).
  let cursor = h.checkIns[todayKey]
    ? new Date()
    : (() => {
        const d = new Date();
        d.setDate(d.getDate() - 1);
        return d;
      })();

  // Hard-cap the loop at 365 to avoid pathological scans.
  for (let i = 0; i < 365; i++) {
    const k = dateKey(cursor);
    const dow = cursor.getDay();
    const scheduled =
      h.scheduledDays.length === 0 || h.scheduledDays.includes(dow);

    if (!scheduled) {
      // Off-day — doesn't count for or against the streak.
      cursor = prevDay(cursor);
      continue;
    }
    if (h.checkIns[k]) {
      streak += 1;
      cursor = prevDay(cursor);
      continue;
    }
    // First scheduled day without a check-in — chain broken.
    break;
  }
  return streak;
}

function prevDay(d: Date): Date {
  const x = new Date(d);
  x.setDate(x.getDate() - 1);
  return x;
}

function makeId(): string {
  return `h_${Math.random().toString(36).slice(2, 10)}`;
}

export { computeStreak };
export const HABIT_COLOR_PALETTE = DEFAULT_COLORS;
