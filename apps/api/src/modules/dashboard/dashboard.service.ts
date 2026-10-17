import { Injectable } from "@nestjs/common";
import { computeStreak } from "@repo/core/habits/streak";
import type { HabitEntry as CoreHabitEntry } from "@repo/core/types";
import { HabitService } from "../habit/habit.service";
import { HabitEntryService } from "../habit-entry/habit-entry.service";
import { HabitEntry } from "../habit-entry/habit-entry.entity";
import { TodoRepository } from "../todo/todo.repository";
import { JournalRepository } from "../journal/journal.repository";
import { LightService } from "../light/light.service";
import { shiftDays } from "../../common/date";

// How far back to look when reconstructing each habit's current streak.
//
// MUST match `computeStreak`'s own 365-iteration cap: whatever isn't fetched
// reads as "a scheduled day with no entry", which BREAKS the chain. A 90-day
// window (the first cut here) silently capped every streak at ~90 days and
// reported it as authoritative, since the client no longer computes its own.
// One indexed query on { userSub: 1, date: -1 } — see habit-entry.schema.ts —
// and these rows never reach the wire (only `todayEntries` is serialized), so
// the wider window costs a bigger scan, not a bigger payload.
const STREAK_LOOKBACK_DAYS = 365;

@Injectable()
export class DashboardService {
  constructor(
    private readonly habitService: HabitService,
    private readonly habitEntryService: HabitEntryService,
    private readonly todoRepository: TodoRepository,
    private readonly journalRepository: JournalRepository,
    private readonly lightService: LightService,
  ) {}

  async getToday(userSub: string, today: string) {
    const start = shiftDays(today, -STREAK_LOOKBACK_DAYS);

    const [habits, windowEntries, todos, journals, light] = await Promise.all([
      this.habitService.findByUser(userSub),
      this.habitEntryService.listByUserAndDateRange(userSub, start, today),
      this.todoRepository.findByUser(userSub),
      this.journalRepository.findByDateRange(userSub, today, today),
      this.lightService.getUserLight(userSub),
    ]);

    const entriesByHabit = new Map<string, HabitEntry[]>();
    for (const entry of windowEntries) {
      const list = entriesByHabit.get(entry.habitId);
      if (list) list.push(entry);
      else entriesByHabit.set(entry.habitId, [entry]);
    }

    const habitsWithStreak = habits.map((habit) => {
      const entriesForHabit = entriesByHabit.get(habit.id) ?? [];
      return {
        ...habit.toObject(),
        // Anchor the streak on the CLIENT's `today` (not the server's wall
        // clock) so a server in a different timezone doesn't compute the streak
        // for the wrong day near midnight.
        // `.toObject()` emits Date timestamps; core's HabitEntry types them as
        // strings. computeStreak only reads date/type/value, so the shape is
        // compatible for its purposes — cast across the entity↔wire boundary.
        currentStreak: computeStreak(
          entriesForHabit.map((e) =>
            e.toObject(),
          ) as unknown as CoreHabitEntry[],
          habit.scheduledDays,
          today,
        ),
      };
    });

    const todayEntries = windowEntries
      .filter((e) => e.date === today)
      .map((e) => e.toObject());

    return {
      today,
      habits: habitsWithStreak,
      todayEntries,
      todos: todos.map((t) => t.toObject()),
      // journals stay encrypted — the API never decrypts journal content (E2EE).
      journals: journals.map((j) => j.toObject()),
      light: light.toObject(),
    };
  }
}
