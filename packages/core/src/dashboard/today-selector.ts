// packages/core/src/dashboard/today-selector.ts
//
// Pure view-model for the Today dashboard. Both apps call this with an
// already-fetched + already-DECRYPTED /dashboard/today payload and render the
// result. Server supplies currentStreak per habit (lean payload). No fetch,
// no decrypt, no colors — the kit ActivityRings computes fill from value/max.
//
// ONE predicate for "scheduled today": `scheduledHabitsForDate` (excludes
// archived, `weekly_target` quota habits, and habits created after `today`)
// feeds BOTH the rendered rows and the habit ring/KPI, so "Habits 2/4" always
// counts exactly the rows shown. Matches the PWA ring rules
// (apps/pwa/src/lib/hooks/use-activity-rings.ts): a skip counts as handled,
// and a check-in only counts once it reaches the habit's target
// (`isEntryComplete`, snapshot-aware) — a 1/3 row no longer fills the ring.
//
// ONE CLOCK: every predicate below is anchored on the `today` field of the
// input — never on the wall clock. `isScheduledToday`/`isCheckedToday` used to
// read `new Date()` internally, which meant `habitStats`/the rings and
// `scheduledTodayHabits` could resolve to DIFFERENT days: the Today screen is a
// permanently-mounted tab root whose query key is pinned at mount, so once the
// app sits across midnight the payload's `today` is yesterday while the wall
// clock says today, and the rings silently disagreed with the rows they label.
// Both helpers now take an explicit day (see ../habits/streak).

import type { Habit, HabitEntry, Journal, Todo, UserLight } from "../types";
import {
  isEntryComplete,
  scheduledHabitsForDate,
} from "../habits/entry-resolution";
import { localDateKey } from "../habits/streak";
import { countWordsFromContent } from "../utils/text";

export interface RingDatum {
  key: "journal" | "habit" | "todo";
  value: number;
  max: number;
}

export interface TodayHabitRow extends Habit {
  currentStreak: number;
  todayEntry?: HabitEntry;
}

export interface TodayViewModel {
  rings: RingDatum[];
  habitStats: {
    doneToday: number;
    totalScheduledToday: number;
    bestStreak: number;
  };
  scheduledTodayHabits: TodayHabitRow[];
  todayTodos: Todo[];
  journalWordsToday: number;
}

export interface TodaySelectorInput {
  habits: Array<Habit & { currentStreak: number }>;
  todayEntries: HabitEntry[];
  todos: Todo[];
  journalsToday: Journal[]; // decrypted
  light: UserLight;
  today: string; // yyyy-mm-dd (localDateKey())
  targets: { todoTargetDaily: number; journalTargetDailyWords: number };
}

export function selectTodayViewModel(
  input: TodaySelectorInput,
): TodayViewModel {
  const { habits, todayEntries, todos, journalsToday, today, targets } = input;

  const entryByHabit = new Map<string, HabitEntry>();
  for (const e of todayEntries) entryByHabit.set(e.habitId, e);

  // Widget row list — the STRICTER schedule predicate. `scheduledHabitsForDate`
  // returns plain `Habit[]` (its declared return type), which would drop the
  // `currentStreak` extra property carried on `habits`, so we recover the id
  // set and re-filter the original (fully-typed) array to preserve it —
  // same relative order, since both filter the same source array.
  const scheduledIds = new Set(
    scheduledHabitsForDate(habits, today).map((h) => h.id),
  );
  const scheduledTodayHabits: TodayHabitRow[] = habits
    .filter((h) => scheduledIds.has(h.id))
    .map((h) => ({ ...h, todayEntry: entryByHabit.get(h.id) }));

  let doneToday = 0;
  let bestStreak = 0;
  const totalScheduledToday = scheduledTodayHabits.length;
  for (const h of scheduledTodayHabits) {
    const e = h.todayEntry;
    if (e && (e.type === "skip" || isEntryComplete(e, h))) doneToday += 1;
  }
  for (const h of habits) {
    if (!h.archivedAt && h.currentStreak > bestStreak) {
      bestStreak = h.currentStreak;
    }
  }

  // Today's open todos (do/due today-or-overdue), earliest-date first —
  // mirrors index.tsx's `todayTodoList` memo exactly.
  const todayTodos = todos
    .filter((t) => {
      if (t.status === "done") return false;
      const due = t.dueDate?.slice(0, 10);
      const doD = t.doDate?.slice(0, 10);
      return (
        (due !== undefined && due <= today) ||
        (doD !== undefined && doD <= today)
      );
    })
    .sort((a, b) => {
      const key = (t: Todo) => {
        const ds = [t.doDate, t.dueDate]
          .filter((d): d is string => !!d)
          .map((d) => d.slice(0, 10));
        return ds.length ? ds.sort()[0]! : today;
      };
      return key(a).localeCompare(key(b));
    });

  // `journalsToday` is expected to already be scoped to `today` by the
  // caller (mobile queries journals with startDate=endDate=today). wordCount
  // is a required field on Journal; the countWordsFromContent fallback is a
  // harmless defensive addition (mobile's current reduce just does `?? 0`).
  const journalWordsToday = journalsToday.reduce(
    (sum, j) => sum + (j.wordCount ?? countWordsFromContent(j.content)),
    0,
  );

  // Done-today todos — completed on the user's LOCAL `today`. `completedAt`
  // (UTC ISO) is converted to a local day key; slicing the UTC string would
  // book a 06:30 completion in UTC+7 onto yesterday. Falls back to
  // `updatedAt` only for legacy rows without `completedAt`.
  const doneTodos = todos.filter((t) => {
    if (t.status !== "done") return false;
    const at = t.completedAt ?? t.updatedAt;
    return !!at && localDateKey(new Date(at)) === today;
  }).length;

  const rings: RingDatum[] = [
    {
      key: "journal",
      value: journalWordsToday,
      max: Math.max(1, targets.journalTargetDailyWords),
    },
    {
      key: "habit",
      value: doneToday,
      max: Math.max(1, totalScheduledToday),
    },
    {
      key: "todo",
      value: doneTodos,
      max: Math.max(
        1,
        Math.max(todayTodos.length + doneTodos, targets.todoTargetDaily),
      ),
    },
  ];

  return {
    rings,
    habitStats: { doneToday, totalScheduledToday, bestStreak },
    scheduledTodayHabits,
    todayTodos,
    journalWordsToday,
  };
}
