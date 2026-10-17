# Non-Blocking Data Layer — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Eliminate all UI hang/lag during API calls on mobile + PWA by killing per-screen request fan-out (server aggregation), moving heavy work off the render path, and routing every data-driven update through concurrent React.

**Architecture:** Two new aggregation endpoints (`GET /dashboard/today`, `GET /habits?withEntries=`) collapse N habit-entry requests into one. A pure `@repo/core` selector shapes the view-model; both apps consume it through thin React Query hooks that decrypt in `queryFn`, paint from cache (`keepPreviousData`), and commit updates through `useDeferredValue`/`startTransition`. Mobile lists move to FlashList.

**Tech Stack:** NestJS + MongoDB (Mongoose) · React 19.1 / React Native 0.81 (New Architecture) · Expo 54 · TanStack Query 5 · FlashList 2 · Tamagui/kit · `@repo/core` (pure) / `@repo/features` (props-only) / `@repo/crypto` (async).

## Global Constraints

- **NO automated tests.** Manual verification only — every task ends with a **Manual Verification** block the user runs; do not write or run test files. (User preference.)
- **NO build/tsc/lint runs during implementation.** The user builds and verifies at the end. Do not run `bun run build`, `tsc`, `expo`, Metro, or the API server. (User preference.)
- **NO git operations.** The user commits. Do not `git add`/`commit`/`branch`. Phase boundaries are natural commit points **for the user**. (User preference.)
- **Package manager: Bun.** Turborepo monorepo, workspaces `@repo/*`, `@stageholder/ui` from GitHub Packages. Never `bun update @stageholder/ui`.
- **`@repo/core` is pure** — no React, no React Query, no fetching. **`@repo/features` is props-only** — no fetch/decrypt inside components. Keep these boundaries.
- **House style (API):** Zod DTOs validated by `ZodValidationPipe` (`apps/api/src/common/zod-validation.pipe.ts`); auth via `req.user.sub` (`StageholderRequest`); controllers return `.toObject()` / `.map(e => e.toObject())`.
- **Additive first:** new endpoints live alongside the old per-habit routes; dead code is deleted only in Phase 6 after both apps migrate.
- **North star:** zero UI hang or lag during any API call. If any change reintroduces a blocking frame, it is wrong.

---

## File Structure

**New files**

- `packages/core/src/habits/streak.ts` — lifted streak math (from `apps/mobile/lib/streak.ts`).
- `packages/core/src/dashboard/today-selector.ts` — `selectTodayViewModel` + types.
- `apps/api/src/modules/dashboard/dashboard.module.ts`
- `apps/api/src/modules/dashboard/dashboard.controller.ts`
- `apps/api/src/modules/dashboard/dashboard.service.ts`
- `apps/api/src/modules/dashboard/dashboard.dto.ts`
- `apps/mobile/lib/api/hooks/dashboard.ts` — `useDashboardToday`.
- `apps/pwa/src/lib/api/dashboard.ts` — `useDashboardToday`.

**Modified files (key)**

- `packages/core/package.json` — add `"./dashboard/*"` export.
- `apps/api/src/modules/habit/habit.controller.ts` / `habit.service.ts` — `withEntries` param.
- `apps/api/src/modules/habit-entry/habit-entry.service.ts` — expose bulk `findByUserAndDateRange`.
- `apps/api/src/app.module.ts` — register `DashboardModule`.
- `apps/mobile/lib/api/hooks/today.ts` — delete `useQueries` fan-out; re-export from dashboard hook.
- `apps/mobile/lib/api/hooks/habits.ts` — add `useHabitsWithEntries`.
- `apps/mobile/lib/streak.ts` — re-export from `@repo/core/habits/streak`.
- `apps/mobile/app/(authed)/index.tsx` — consume `useDashboardToday` + `useDeferredValue`.
- `apps/mobile/app/(authed)/habits.tsx` — FlashList + entries-as-props.
- `apps/mobile/components/habit-check-in-row.tsx` / `habit-card-row.tsx` — accept `entries` prop instead of self-fetch.
- `apps/mobile/app/(authed)/journal.tsx` + `apps/mobile/lib/api/hooks/journal.ts` + `apps/mobile/lib/journal-crypto.ts` — decrypt in `queryFn`; DEK-keyed cache; FlashList.
- `apps/pwa/src/components/habits/habit-list-item.tsx` — entries as prop; drop per-row `useHabitEntries`.
- `apps/pwa/src/routes/_app/index.tsx` + `apps/pwa/src/lib/hooks/use-dashboard-stats.ts` — consume `useDashboardToday`.
- `apps/pwa/src/lib/api/journals.ts` — DEK-keyed cache.

---

# PHASE 1 — Core lifts (no behavior change)

Move the streak math into `@repo/core` so both apps and the API share one implementation. Pure move + re-export; nothing else changes.

### Task 1.1: Create `@repo/core/habits/streak.ts`

**Files:**

- Create: `packages/core/src/habits/streak.ts`
- Modify: `packages/core/package.json` (exports map)

**Interfaces:**

- Produces: `computeStreak(entries: HabitEntry[] | undefined, scheduledDays?: number[]): number`, `computeStreakCached(habitId: string, entries, scheduledDays?): number`, `localDateKey(d?: Date): string`, `fromDateKey(key: string): Date`, `isCheckedToday(entries): boolean`, `isScheduledToday(scheduledDays?, at?): boolean`.

- [ ] **Step 1: Create the file** with the exact content below (copied verbatim from `apps/mobile/lib/streak.ts`, only the header comment changed).

```ts
// packages/core/src/habits/streak.ts
//
// Pure, cross-platform streak math. Single source of truth for BOTH apps and
// the API (GET /dashboard/today server-computed currentStreak). Lifted from
// apps/mobile/lib/streak.ts (which now re-exports from here) so the streak a
// user sees is byte-identical everywhere.

import type { HabitEntry } from "../types";

/** yyyy-mm-dd in the local timezone. */
export function localDateKey(d: Date = new Date()): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

/** Inverse of localDateKey — local-midnight Date from "yyyy-mm-dd". */
export function fromDateKey(key: string): Date {
  const [y, m, d] = key.split("-").map(Number);
  return new Date(y!, (m ?? 1) - 1, d ?? 1);
}

function prevDay(d: Date): Date {
  const x = new Date(d);
  x.setDate(x.getDate() - 1);
  return x;
}

/**
 * Compute the current streak. Walks backwards from today through scheduled
 * days, counting consecutive completions. Skip preserves the chain; fail (or a
 * past scheduled day with no entry) breaks it; today-not-yet-checked doesn't
 * break it. Caps at 365.
 */
export function computeStreak(
  entries: HabitEntry[] | undefined,
  scheduledDays?: number[],
): number {
  if (!entries || entries.length === 0) return 0;

  const byDate = new Map<string, HabitEntry>();
  for (const e of entries) byDate.set(e.date, e);

  const isScheduled = (dow: number) =>
    !scheduledDays || scheduledDays.length === 0 || scheduledDays.includes(dow);

  const today = new Date();
  const todayKey = localDateKey(today);
  const hasTodayCompletion =
    byDate.get(todayKey)?.type === "completion" ||
    (byDate.get(todayKey)?.value ?? 0) > 0;

  let cursor: Date = hasTodayCompletion ? today : prevDay(today);
  let streak = 0;

  for (let i = 0; i < 365; i++) {
    const dow = cursor.getDay();
    const key = localDateKey(cursor);

    if (!isScheduled(dow)) {
      cursor = prevDay(cursor);
      continue;
    }

    const entry = byDate.get(key);
    if (entry?.type === "skip") {
      cursor = prevDay(cursor);
      continue;
    }
    if (entry?.type === "fail") break;
    if (entry && entry.value > 0) {
      streak += 1;
      cursor = prevDay(cursor);
      continue;
    }
    break;
  }

  return streak;
}

const streakCache = new Map<
  string,
  {
    entries: HabitEntry[] | undefined;
    todayKey: string;
    scheduled: number[] | undefined;
    value: number;
  }
>();

/** `computeStreak` with an identity-keyed per-habit cache — use in render
 *  paths that recompute across many habits. */
export function computeStreakCached(
  habitId: string,
  entries: HabitEntry[] | undefined,
  scheduledDays?: number[],
): number {
  const todayKey = localDateKey();
  const hit = streakCache.get(habitId);
  if (
    hit &&
    hit.entries === entries &&
    hit.todayKey === todayKey &&
    hit.scheduled === scheduledDays
  ) {
    return hit.value;
  }
  const value = computeStreak(entries, scheduledDays);
  streakCache.set(habitId, {
    entries,
    todayKey,
    scheduled: scheduledDays,
    value,
  });
  return value;
}

/** Has the habit been completed today (any positive entry for `localDateKey()`)? */
export function isCheckedToday(entries: HabitEntry[] | undefined): boolean {
  if (!entries) return false;
  const today = localDateKey();
  const e = entries.find((x) => x.date === today);
  return !!e && e.type !== "skip" && e.value > 0;
}

/** Should the habit show today? */
export function isScheduledToday(
  scheduledDays?: number[],
  at: Date = new Date(),
): boolean {
  if (!scheduledDays || scheduledDays.length === 0) return true;
  return scheduledDays.includes(at.getDay());
}
```

- [ ] **Step 2: Add the export subpath.** In `packages/core/package.json`, inside the `"exports"` object, add a `"./habits/streak"` entry matching the sibling `./habits/*` pattern (check the exact shape used for `./habits/entry-resolution` and copy it, swapping the filename). If a wildcard `"./habits/*"` already exists, no change is needed — verify by reading the current `exports` block first.

- [ ] **Manual Verification (user):** `grep -n "habits/streak\|habits/\*" packages/core/package.json` shows the subpath resolvable. No import errors when the user later builds.

### Task 1.2: Re-export streak from core in the mobile app

**Files:**

- Modify: `apps/mobile/lib/streak.ts` (replace body with a re-export)

**Interfaces:**

- Consumes: `@repo/core/habits/streak` (Task 1.1).
- Produces: same symbols as before (`computeStreak`, `computeStreakCached`, `localDateKey`, `fromDateKey`, `isCheckedToday`, `isScheduledToday`) so no call site changes.

- [ ] **Step 1: Replace the entire file** with a re-export so every existing importer (`today.ts`, `index.tsx`, `habits.tsx`, `habit-check-in-row`, etc.) keeps working unchanged:

```ts
// apps/mobile/lib/streak.ts
//
// Streak math moved to @repo/core/habits/streak (shared with the PWA + the API's
// server-computed currentStreak). This file re-exports so existing imports
// ("@/lib/streak") keep resolving; prefer importing from @repo/core in new code.

export {
  computeStreak,
  computeStreakCached,
  localDateKey,
  fromDateKey,
  isCheckedToday,
  isScheduledToday,
} from "@repo/core/habits/streak";
```

- [ ] **Manual Verification (user):** `grep -rn "@/lib/streak" apps/mobile | wc -l` — importers unchanged; app still type-checks at final build.

### Task 1.3: Point the PWA's streak logic at core

**Files:**

- Modify: the PWA streak/entry-resolution module (find it first).

- [ ] **Step 1: Locate it.** Run `grep -rln "computeStreak\|function.*[Ss]treak" apps/pwa/src/lib` to find the PWA's streak implementation (per the map, ~`apps/pwa/src/lib/habits/entry-resolution.ts`). Read it.

- [ ] **Step 2: Replace its streak function(s) with a re-export** from `@repo/core/habits/streak`, keeping any PWA-only helpers in place. If the PWA's function signature differs (e.g. different param order), keep a thin local wrapper that adapts to `computeStreak(entries, scheduledDays)` so call sites don't change. Do **not** alter non-streak exports in that file.

- [ ] **Manual Verification (user):** PWA habit streak badges render the same values as before on a page with known streaks.

> **User commit point:** end of Phase 1.

---

# PHASE 2 — Backend aggregation endpoints (additive)

### Task 2.1: Expose the bulk multi-habit entries method through `HabitEntryService`

**Files:**

- Modify: `apps/api/src/modules/habit-entry/habit-entry.service.ts`

**Interfaces:**

- Consumes: `HabitEntryRepository.findByUserAndDateRange(userSub, startDate, endDate)` (already exists).
- Produces: `HabitEntryService.listByUserAndDateRange(userSub: string, startDate: string, endDate: string): Promise<HabitEntry[]>`.

- [ ] **Step 1: Read** `apps/api/src/modules/habit-entry/habit-entry.service.ts` and `habit-entry.repository.ts` to match the existing method style (how `listByHabit` wraps the repo + maps `.toObject()`).

- [ ] **Step 2: Add the method**, mirroring `listByHabit`'s shape (same return mapping, same decryption of `notes`/`skip_reason` if `listByHabit` does it):

```ts
/** All of a user's entries across ALL habits within a date window — one query.
 *  Powers the aggregation endpoints (dashboard/today, habits?withEntries) so
 *  screens fetch entries once instead of fanning out one request per habit. */
async listByUserAndDateRange(
  userSub: string,
  startDate: string,
  endDate: string,
): Promise<HabitEntry[]> {
  const rows = await this.habitEntryRepository.findByUserAndDateRange(
    userSub,
    startDate,
    endDate,
  );
  return rows.map((e) => /* same .toObject()/decrypt mapping listByHabit uses */ e.toObject());
}
```

Match the exact mapping/decrypt that `listByHabit` uses (copy it verbatim so encrypted `notes`/`skip_reason` are handled identically).

- [ ] **Manual Verification (user):** none yet (consumed in 2.2/2.3).

### Task 2.2: `GET /dashboard/today`

**Files:**

- Create: `apps/api/src/modules/dashboard/dashboard.dto.ts`
- Create: `apps/api/src/modules/dashboard/dashboard.service.ts`
- Create: `apps/api/src/modules/dashboard/dashboard.controller.ts`
- Create: `apps/api/src/modules/dashboard/dashboard.module.ts`
- Modify: `apps/api/src/app.module.ts`

**Interfaces:**

- Consumes: `HabitService.findByUser`, `HabitEntryService.listByUserAndDateRange` (2.1), `TodoRepository.findByUserAndDateRange`, `JournalRepository.findByDateRange`, `LightService.getUserLight`, `@repo/core/habits/streak` `computeStreak`.
- Produces: `GET /dashboard/today?today=YYYY-MM-DD` → `DashboardTodayResponse`.

- [ ] **Step 1: DTO.** Create `dashboard.dto.ts` (Zod, matching `light.dto.ts` style):

```ts
import { z } from "zod";

export const DashboardTodayQuery = z.object({
  today: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/, "today must be yyyy-mm-dd")
    .optional(),
});
export type DashboardTodayQuery = z.infer<typeof DashboardTodayQuery>;
```

- [ ] **Step 2: Service.** Create `dashboard.service.ts` mirroring `calendar.service.ts` (multi-dep inject + `Promise.all`). Read `calendar.service.ts` first for the exact repo method names/return shapes, then:

```ts
import { Injectable } from "@nestjs/common";
import { computeStreak } from "@repo/core/habits/streak";
import { HabitService } from "../habit/habit.service";
import { HabitEntryService } from "../habit-entry/habit-entry.service";
import { TodoRepository } from "../todo/todo.repository";
import { JournalRepository } from "../journal/journal.repository";
import { LightService } from "../light/light.service";

// ~90-day lookback is enough for the streak walk (cap 365, but real streaks
// rarely exceed a quarter; keep the payload lean).
const STREAK_LOOKBACK_DAYS = 90;

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
      this.todoRepository.findByUserAndDateRange(userSub, start, today), // match calendar's call
      this.journalRepository.findByDateRange(userSub, today, today),
      this.lightService.getUserLight(userSub),
    ]);

    // Group entries by habit once; derive today's entries + per-habit streak.
    const byHabit = new Map<string, typeof windowEntries>();
    for (const e of windowEntries) {
      const arr = byHabit.get(e.habitId) ?? [];
      arr.push(e);
      byHabit.set(e.habitId, arr);
    }
    const habitsWithStreak = habits.map((h) => ({
      ...h,
      currentStreak: computeStreak(byHabit.get(h.id) ?? [], h.scheduledDays),
    }));
    const todayEntries = windowEntries.filter((e) => e.date === today);

    return {
      today,
      habits: habitsWithStreak,
      todayEntries,
      todos,
      journals, // still-encrypted; client decrypts
      light,
    };
  }
}

/** yyyy-mm-dd shifted by N days (UTC-safe string math via Date). */
function shiftDays(dateKey: string, delta: number): string {
  const [y, m, d] = dateKey.split("-").map(Number);
  const dt = new Date(Date.UTC(y, (m ?? 1) - 1, d ?? 1));
  dt.setUTCDate(dt.getUTCDate() + delta);
  return dt.toISOString().slice(0, 10);
}
```

**Adjust** the todo/journal/habit method names + entry field names (`habitId` vs `habit_id`, `scheduledDays` vs `scheduled_days`) to the **actual `.toObject()` shapes** those services return — read `calendar.service.ts` to see exactly how it names them, and match. If `HabitService.findByUser` returns entities needing `.toObject()`, map them.

- [ ] **Step 3: Controller.** Create `dashboard.controller.ts`:

```ts
import { Controller, Get, Query, Req, UseGuards } from "@nestjs/common";
import { ZodValidationPipe } from "../../common/zod-validation.pipe";
import { DashboardTodayQuery } from "./dashboard.dto";
import { DashboardService } from "./dashboard.service";
// import the same auth guard + StageholderRequest type calendar.controller uses

@Controller("dashboard")
export class DashboardController {
  constructor(private readonly dashboard: DashboardService) {}

  @Get("today")
  async today(
    @Req() req: StageholderRequest,
    @Query(new ZodValidationPipe(DashboardTodayQuery))
    query: DashboardTodayQuery,
  ) {
    const today = query.today ?? new Date().toISOString().slice(0, 10);
    return this.dashboard.getToday(req.user.sub, today);
  }
}
```

Match the exact auth guard/decorator and `StageholderRequest` import that `calendar.controller.ts` uses (read it first).

- [ ] **Step 4: Module + registration.** Create `dashboard.module.ts` importing the modules that expose the injected providers (`HabitModule`, `HabitEntryModule`, `TodoModule`, `JournalModule`, `LightModule` — whichever export those services/repos), declaring `DashboardController` + `DashboardService`. Then add `DashboardModule` to `apps/api/src/app.module.ts`'s `imports`. Copy `calendar.module.ts`'s import list as the template (it already wires the same repos).

- [ ] **Manual Verification (user):** with the API running, `curl -H "Authorization: Bearer <token>" "http://localhost:4000/dashboard/today?today=$(date +%F)"` returns one JSON payload containing `habits` (each with `currentStreak`), `todayEntries`, `todos`, `journals`, `light`. Spot-check a `currentStreak` against the habit's known streak.

### Task 2.3: `GET /habits?withEntries=<window>`

**Files:**

- Modify: `apps/api/src/modules/habit/habit.dto.ts` (query DTO)
- Modify: `apps/api/src/modules/habit/habit.controller.ts`
- Modify: `apps/api/src/modules/habit/habit.service.ts`

**Interfaces:**

- Consumes: `HabitEntryService.listByUserAndDateRange` (2.1).
- Produces: `GET /habits?withEntries=90d` → `Array<Habit & { entries: HabitEntry[] }>` (when param present; otherwise unchanged).

- [ ] **Step 1: Read** the current `habit.controller.ts` `list` handler + `habit.service.ts` `listByUser`/`findByUser` to see the exact param parsing + return shape.

- [ ] **Step 2: Query DTO / param.** Add an optional `withEntries` param. Simplest robust form — accept a day count like `90d` or `90`:

```ts
// in habit.dto.ts
export const HabitListQuery = z.object({
  withEntries: z
    .string()
    .regex(/^\d{1,3}d?$/, "withEntries must be a day count, e.g. 90 or 90d")
    .optional(),
  // keep existing page/limit/archivedOnly/etc. fields if you convert to a Zod query
});
```

If the controller currently reads raw `@Query("x")` strings, you may just read `@Query("withEntries") withEntries?: string` and parse it — match the file's existing style rather than forcing Zod on the whole query.

- [ ] **Step 3: Service.** Add an overload/path in `HabitService` that, when a window is requested, fetches habits + one bulk entries query and embeds:

```ts
async listByUserWithEntries(
  userSub: string,
  windowDays: number,
): Promise<Array<Habit & { entries: HabitEntry[] }>> {
  const today = new Date().toISOString().slice(0, 10);
  const start = /* shiftDays(today, -windowDays) — reuse the same helper as dashboard.service */;
  const [habits, entries] = await Promise.all([
    this.findByUser(userSub),
    this.habitEntryService.listByUserAndDateRange(userSub, start, today),
  ]);
  const byHabit = new Map<string, HabitEntry[]>();
  for (const e of entries) {
    const arr = byHabit.get(e.habitId) ?? [];
    arr.push(e);
    byHabit.set(e.habitId, arr);
  }
  return habits.map((h) => ({ ...h, entries: byHabit.get(h.id) ?? [] }));
}
```

Inject `HabitEntryService` into `HabitService` (add to constructor + ensure `HabitModule` imports `HabitEntryModule`). Extract `shiftDays` into a shared util (e.g. `apps/api/src/common/date.ts`) so dashboard + habit service share it — do **not** duplicate.

- [ ] **Step 4: Controller** — when `withEntries` is present, call `listByUserWithEntries(sub, parsedDays)`; otherwise the existing branch. Parse `90d`→`90`.

- [ ] **Manual Verification (user):** `curl -H "Authorization: Bearer <token>" "http://localhost:4000/habits?withEntries=90d"` returns habits each with an `entries` array; `curl .../habits` (no param) is byte-identical to before.

> **User commit point:** end of Phase 2 (backend is fully additive and independently testable).

---

# PHASE 3 — Shared selector (`@repo/core`)

### Task 3.1: `selectTodayViewModel`

**Files:**

- Create: `packages/core/src/dashboard/today-selector.ts`
- Modify: `packages/core/package.json` (add `"./dashboard/*"` export)

**Interfaces:**

- Consumes: `@repo/core/habits/entry-resolution` (`scheduledHabitsForDate`, `resolveTargetCount`, `isEntryComplete`), `@repo/core/utils/text` (`countWordsFromContent`), `@repo/core/habits/streak` (`isScheduledToday`, `isCheckedToday`, `computeStreak`), types from `@repo/core/types`.
- Produces: `selectTodayViewModel(input): TodayViewModel` and the `TodayViewModel`/`RingDatum` types.

- [ ] **Step 1: Create the selector.** Rings are returned as raw `value`/`max` per category (each app applies its own colors — the kit `ActivityRings` computes fill from value/max, so no percentage math here):

```ts
// packages/core/src/dashboard/today-selector.ts
//
// Pure view-model for the Today dashboard. Both apps call this with an
// already-fetched + already-DECRYPTED aggregated payload (GET /dashboard/today)
// and render the result. Server supplies currentStreak per habit (lean payload);
// on the Habits screen — which ships the entry window — streaks are recomputed
// client-side instead. This function does NOT fetch, decrypt, or know colors.

import type { Habit, HabitEntry, Todo, Journal, UserLight } from "../types";
import {
  scheduledHabitsForDate,
  resolveTargetCount,
} from "../habits/entry-resolution";
import { isCheckedToday } from "../habits/streak";
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

export interface TodayStatDelta {
  direction: "up" | "down" | "flat";
  label: string;
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
  today: string; // yyyy-mm-dd
  targets: { todoTargetDaily: number; journalTargetDailyWords: number };
}

export function selectTodayViewModel(
  input: TodaySelectorInput,
): TodayViewModel {
  const { habits, todayEntries, todos, journalsToday, today, targets } = input;

  const entryByHabit = new Map<string, HabitEntry>();
  for (const e of todayEntries) entryByHabit.set(e.habitId, e);

  const scheduled = scheduledHabitsForDate(habits, today);
  const scheduledTodayHabits: TodayHabitRow[] = scheduled.map((h) => ({
    ...h,
    todayEntry: entryByHabit.get(h.id),
  }));

  let doneToday = 0;
  let bestStreak = 0;
  for (const h of habits) {
    const entries = entryByHabit.get(h.id) ? [entryByHabit.get(h.id)!] : [];
    if (scheduled.some((s) => s.id === h.id) && isCheckedToday(entries))
      doneToday += 1;
    if (h.currentStreak > bestStreak) bestStreak = h.currentStreak;
  }

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

  const journalWordsToday = journalsToday.reduce(
    (sum, j) => sum + (j.wordCount ?? countWordsFromContent(j.content)),
    0,
  );

  const doneTodos = todos.filter(
    (t) => t.status === "done" && t.updatedAt.slice(0, 10) === today,
  ).length;

  const rings: RingDatum[] = [
    {
      key: "journal",
      value: journalWordsToday,
      max: Math.max(1, targets.journalTargetDailyWords),
    },
    { key: "habit", value: doneToday, max: Math.max(1, scheduled.length) },
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
    habitStats: {
      doneToday,
      totalScheduledToday: scheduled.length,
      bestStreak,
    },
    scheduledTodayHabits,
    todayTodos,
    journalWordsToday,
  };
}
```

Before finalizing, read `packages/core/src/habits/entry-resolution.ts` and `packages/core/src/types/index.ts` to confirm exact names (`scheduledHabitsForDate` signature, `Todo.doDate`/`dueDate`/`updatedAt`, `Journal.wordCount`/`content`, `Habit.scheduledDays`) and adjust field accesses to match.

- [ ] **Step 2: Export subpath.** Add `"./dashboard/*"` to `packages/core/package.json` `exports`, mirroring the existing `"./habits/*"` entry (copy its `import`/`types` shape exactly).

- [ ] **Manual Verification (user):** none standalone; verified through Phase 4/5 screens. (No unit test per constraints.)

> **User commit point:** end of Phase 3.

---

# PHASE 4 — Mobile migration

### Task 4.1: `useDashboardToday` hook

**Files:**

- Create: `apps/mobile/lib/api/hooks/dashboard.ts`
- Modify: `apps/mobile/lib/api/keys.ts` (add a `dashboard` key)

**Interfaces:**

- Consumes: `apiClient` (`apps/mobile/lib/api/client`), `selectTodayViewModel` (3.1), `decryptJournalList` (`apps/mobile/lib/journal-crypto`), `getJournalDek`.
- Produces: `useDashboardToday(): { viewModel: TodayViewModel | undefined; isLoading; error; refetch }` plus the raw `today` query for optimistic writes.

- [ ] **Step 1: Add a query key** in `keys.ts`:

```ts
export const dashboardKeys = {
  today: (day: string) => ["dashboard", "today", day] as const,
};
```

- [ ] **Step 2: Create the hook.** Decrypt journals in the `queryFn` (off render); shape via the selector in `select`; paint from cache:

```ts
// apps/mobile/lib/api/hooks/dashboard.ts
import { useQuery } from "@tanstack/react-query";
import { keepPreviousData } from "@tanstack/react-query";
import { selectTodayViewModel } from "@repo/core/dashboard/today-selector";
import type {
  Habit,
  HabitEntry,
  Todo,
  Journal,
  UserLight,
} from "@repo/core/types";
import { apiClient } from "../client";
import { dashboardKeys } from "../keys";
import { localDateKey } from "@repo/core/habits/streak";
import { decryptJournalList, getJournalDek } from "@/lib/journal-crypto";

interface DashboardTodayResponse {
  today: string;
  habits: Array<Habit & { currentStreak: number }>;
  todayEntries: HabitEntry[];
  todos: Todo[];
  journals: Journal[];
  light: UserLight;
}

export function useDashboardToday() {
  const today = localDateKey();
  const q = useQuery({
    queryKey: dashboardKeys.today(today),
    queryFn: async () => {
      const { data } = await apiClient.get<DashboardTodayResponse>(
        "/dashboard/today",
        { params: { today } },
      );
      // Decrypt journals HERE (async, off the render path) so the selector +
      // render only ever see plaintext.
      const dek = getJournalDek();
      const journals = dek
        ? await decryptJournalList(data.journals, dek)
        : data.journals;
      return { ...data, journals };
    },
    placeholderData: keepPreviousData,
    select: (data) =>
      selectTodayViewModel({
        habits: data.habits,
        todayEntries: data.todayEntries,
        todos: data.todos,
        journalsToday: data.journals,
        light: data.light,
        today: data.today,
        targets: {
          todoTargetDaily: data.light?.todoTargetDaily ?? 5,
          journalTargetDailyWords: data.light?.journalTargetDailyWords ?? 200,
        },
      }),
  });
  return {
    viewModel: q.data,
    isLoading: q.isLoading,
    error: q.error,
    refetch: q.refetch,
  };
}
```

Confirm `UserLight` field names (`todoTargetDaily`, `journalTargetDailyWords`, `perfectDayStreak`) against `@repo/core/types`; adjust.

- [ ] **Manual Verification (user):** temporarily import `useDashboardToday` in the Today screen (next task) — see below.

### Task 4.2: Rewrite the Today screen to consume the aggregate + defer updates

**Files:**

- Modify: `apps/mobile/app/(authed)/index.tsx`
- Modify: `apps/mobile/lib/api/hooks/today.ts` (deprecate the fan-out — keep the export as a thin shim or remove after index.tsx stops using it)

**Interfaces:**

- Consumes: `useDashboardToday` (4.1), `useDeferredValue` (React).

- [ ] **Step 1: Read** the current `index.tsx` (already mapped) to preserve all non-data JSX (header, command palette, charts gated on `chartsReady`, level-up overlay).

- [ ] **Step 2: Replace the data block.** Remove `useTodos`, `useHabits`, `useJournals(today)`, `useTodayHabitProgress`, `useDayActivityCounts`, the `useMemo`s that derive `rings`/`stats`/`scheduledTodayHabits`/`todayTodoList`, and the `todoStats`/`habitStats`/`journalWords` locals. Replace with:

```tsx
import { useDeferredValue } from "react";
import { useDashboardToday } from "@/lib/api/hooks/dashboard";
// ...
const { viewModel, isLoading, error, refetch } = useDashboardToday();
// Deferred so a background refetch's re-render can never block a tap.
const vm = useDeferredValue(viewModel);
const rings = vm?.rings ?? [];
const habitStats = vm?.habitStats ?? {
  doneToday: 0,
  totalScheduledToday: 0,
  bestStreak: 0,
};
const scheduledTodayHabits = vm?.scheduledTodayHabits ?? [];
const todayTodoList = vm?.todayTodos ?? [];
const journalWords = vm?.journalWordsToday ?? 0;
```

Map `rings` (RingDatum[]) to the kit `ActivityRings` prop shape by applying `IGNITION` colors locally:

```tsx
const ringData = rings.map((r) => ({
  value: r.value,
  max: r.max,
  color: IGNITION[r.key].base,
  trackColor: IGNITION[r.key].track,
  label: IGNITION[r.key].label,
}));
```

Keep the trend charts as-is (they use their own `useJournalGrowth`/`useWeeklyActivity`/etc. hooks — leave those; they are below-the-fold and already gated on `chartsReady`). The KPI `stats` array: rebuild it from `vm` fields (light today/streak from `viewModel`/`lightQuery` — keep a small `useUserLight()` if the KPI needs `perfectDayStreak` not in the aggregate, OR add `perfectDayStreak` to the dashboard payload's `light`).

- [ ] **Step 3: `HabitCheckInRow` gets its entry as a prop.** The Today widget's rows now pass `todayEntry` from the view-model (see Task 4.4 for the prop change) instead of self-fetching. Update the `.map`:

```tsx
{
  scheduledTodayHabits
    .slice(0, WIDGET_CAP)
    .map((habit) => (
      <HabitCheckInRow
        key={habit.id}
        habit={habit}
        activeDate={today}
        entries={habit.todayEntry ? [habit.todayEntry] : []}
        onOpenDetail={() => router.push(`/habits/${habit.id}`)}
      />
    ));
}
```

- [ ] **Step 4: `handleRefresh`** → `await refetch()` (plus the chart-source invalidations already present).

- [ ] **Manual Verification (user):** cold-open Today on device: **one** `/dashboard/today` request (not 1 + N entries); rings/habits/todos render; while it loads, other tabs remain tappable; check-in flips instantly.

### Task 4.3: `useHabitsWithEntries` + Habits screen entries-as-props

**Files:**

- Modify: `apps/mobile/lib/api/hooks/habits.ts` (add hook)
- Modify: `apps/mobile/app/(authed)/habits.tsx`
- Modify: `apps/mobile/components/habit-group-section.tsx` (pass entries down)

**Interfaces:**

- Produces: `useHabitsWithEntries(windowDays?: number): { data?: Array<Habit & { entries: HabitEntry[] }>; ... }`.

- [ ] **Step 1: Add the hook** in `habits.ts`:

```ts
export function useHabitsWithEntries(windowDays = 90) {
  return useQuery({
    queryKey: [...habitKeys.list(), "withEntries", windowDays] as const,
    queryFn: async () => {
      const { data } = await apiClient.get<
        Array<Habit & { entries: HabitEntry[] }>
      >("/habits", { params: { withEntries: `${windowDays}d` } });
      return data;
    },
    placeholderData: keepPreviousData,
  });
}
```

- [ ] **Step 2: Habits screen** — replace `useHabits()` with `useHabitsWithEntries()`; build a `Map<habitId, HabitEntry[]>` once and thread each habit's entries down through `HabitGroupSection` → `HabitCardRow` as a prop (see 4.4). Wrap the derived `sections`/`visibleSections` in `useDeferredValue` so filter/refetch re-renders don't block the tap frame.

- [ ] **Step 3: FlashList.** Replace the section `.map` list with a FlashList whose data is the flattened rows (section headers + cards) OR a FlashList per section. Keep the kit `Sortable` drag: prototype `Sortable` inside a FlashList; **if they conflict**, fall back to virtualizing only when NOT dragging (render the plain `Sortable` list for the section being long-pressed, FlashList otherwise). Document whichever path is taken in a comment.

- [ ] **Manual Verification (user):** Habits cold-open on device: one `/habits?withEntries=90d` request (not N); scroll a long list — smooth, only visible cards mount; drag-reorder still works.

### Task 4.4: Make `HabitCheckInRow` / `HabitCardRow` accept `entries` as a prop

**Files:**

- Modify: `apps/mobile/components/habit-check-in-row.tsx`
- Modify: `apps/mobile/components/habit-card-row.tsx`

**Interfaces:**

- Produces: both accept `entries: HabitEntry[]` prop; internal `useSharedHabitEntries` self-fetch removed.

- [ ] **Step 1: `habit-check-in-row.tsx`** — add `entries` to props; delete the `useSharedHabitEntries(habit.id, activeDate)` line; pass the prop into `useHabitDayActions(habit.id, activeDate, entries)`. The mutation hooks still write to the `habitKeys.entries(habitId)` cache — that continues to work because the detail screen and any remaining consumers read it; the list rows now derive from the prop. `loading` becomes `false` (data arrives with the parent).

```tsx
export interface HabitCheckInRowProps {
  habit: Habit;
  activeDate: string;
  entries: HabitEntry[];
  onOpenDetail?: () => void;
}
export function HabitCheckInRow({
  habit,
  activeDate,
  entries,
  onOpenDetail,
}: HabitCheckInRowProps) {
  const actions = useHabitDayActions(habit.id, activeDate, entries);
  // ...rest unchanged, using `entries` instead of entriesQuery.data
}
```

- [ ] **Step 2: `habit-card-row.tsx`** — same change: accept `entries` prop, remove any internal per-habit entries query, pass through to the shared `HabitCard`/day-actions.

- [ ] **Step 3: Optimistic writes still land.** Because check-in mutations `setQueriesData` on `habitKeys.entries(habitId)` **and** the new aggregate caches don't hold per-habit entries under that key, update the mutations' optimistic writers to also patch the aggregate caches: in `apps/mobile/lib/api/hooks/habits.ts`, extend `upsertDayEntry`/`writeServerEntry` to also `setQueriesData` on `dashboardKeys.today(...)` (patch `todayEntries`) and on the `["habits","withEntries",*]` list (patch that habit's `entries`). This keeps the instant flip. Show the exact patch:

```ts
// after the existing upsert on habitKeys.entries(...)
qc.setQueriesData<DashboardTodayResponse>(
  { queryKey: ["dashboard", "today"] },
  (prev) =>
    prev && {
      ...prev,
      todayEntries: upsertEntryArray(prev.todayEntries, habitId, day, make),
    },
);
qc.setQueriesData<Array<Habit & { entries: HabitEntry[] }>>(
  { queryKey: [...habitKeys.list(), "withEntries"] },
  (list) =>
    Array.isArray(list)
      ? list.map((h) =>
          h.id === habitId
            ? { ...h, entries: upsertEntryArray(h.entries, habitId, day, make) }
            : h,
        )
      : list,
);
```

Add a small shared `upsertEntryArray(list, habitId, day, make)` helper (extract the existing day-match logic from `upsertDayEntry`) so the three writers stay DRY.

- [ ] **Manual Verification (user):** check-in from Today AND from the Habits list — control flips on the tap frame in both; ring/count update instantly on Today; streak reconciles within a beat.

### Task 4.5: Journal — decrypt in `queryFn`, FlashList, DEK-keyed cache

**Files:**

- Modify: `apps/mobile/lib/api/hooks/journal.ts`
- Modify: `apps/mobile/app/(authed)/journal.tsx`
- Modify: `apps/mobile/lib/journal-crypto.ts` (expose a DEK-identity token)

**Interfaces:**

- Produces: journal list/detail hooks return **decrypted** journals; query keys include a DEK token.

- [ ] **Step 1: DEK identity token.** In `journal-crypto.ts`, add a monotonically-bumped token that changes on every lock/unlock so the cache can't serve stale plaintext:

```ts
let dekEpoch = 0;
export function journalDekEpoch(): number {
  return dekEpoch;
}
// bump inside unlock/lock/setup/recover paths (everywhere `dek` changes):
dekEpoch += 1;
```

Add `dekEpoch += 1;` in `unlockJournal`, `lockJournal`, `setupJournalPassphrase`, `changeJournalPassphrase`, `recoverJournalWithCodes` (right where `commit({...})` fires).

- [ ] **Step 2: Decrypt in `queryFn`.** In `journal.ts`, change `useJournalsPaginated` + `useJournals` + `useJournal` to decrypt inside the `queryFn` and include the DEK epoch in the key:

```ts
export function useJournalsPaginated(limit = 20) {
  const epoch = journalDekEpoch();
  return useInfiniteQuery<PaginatedJournals>({
    queryKey: [...journalKeys.paginated(), epoch],
    queryFn: async ({ pageParam }) => {
      const { data } = await apiClient.get<PaginatedJournals>("/journals", {
        params: { page: pageParam as number, limit },
      });
      const dek = getJournalDek();
      const decrypted = dek
        ? await decryptJournalList(data.data, dek)
        : data.data;
      return { ...data, data: decrypted };
    },
    // ...initialPageParam/getNextPageParam unchanged
  });
}
```

Apply the same `epoch`-in-key + `queryFn` decrypt to `useJournals` and `useJournal` (detail: decrypt the single entry via `decryptJournalEntry`; keep the `placeholderData` seed but decrypt the seed too, or seed from the already-decrypted list cache).

- [ ] **Step 3: Remove screen-level decrypt.** In `journal.tsx`, delete the `decrypted`/`decrypting` state + the `useEffect` that calls `decryptJournalList`. `rawJournals` becomes the already-decrypted list straight from the query; `sorted` filters/sorts that directly. `listLoading` drops the `decrypting` term.

- [ ] **Step 4: FlashList.** Ensure the `JournalList` (mobile host) renders rows via FlashList. If `JournalList` is a shared `@repo/features` component that maps internally, wrap the mobile usage so the mobile screen supplies a FlashList-rendered list (features stays props-only; the mobile host owns the list container). Read `packages/features/src/journal/journal-list.tsx` first; if it already accepts a render-list injection, use it, else render rows on the mobile side.

- [ ] **Manual Verification (user):** Journal open (encryption ON): list appears with titles decrypted, no frozen frame; open an entry — instant; lock then unlock — no stale plaintext flashes; scroll a long journal — smooth.

> **User commit point:** end of Phase 4 (mobile fully migrated; freeze should be gone on device).

---

# PHASE 5 — PWA migration

### Task 5.1: PWA `useDashboardToday`

**Files:**

- Create: `apps/pwa/src/lib/api/dashboard.ts`

- [ ] **Step 1:** Mirror the mobile hook (4.1), using the PWA's `apiClient` + PWA `decryptJournalList` (`apps/pwa/src/lib/crypto/journal-crypto.ts`) + `useEncryptionStore` DEK. Same `select: selectTodayViewModel`. Read `apps/pwa/src/lib/api/calendar.ts` for the PWA's client + query-key conventions and match them.

- [ ] **Manual Verification (user):** verified via 5.2.

### Task 5.2: PWA dashboard + HabitListItem consume the aggregate

**Files:**

- Modify: `apps/pwa/src/routes/_app/index.tsx`
- Modify: `apps/pwa/src/lib/hooks/use-dashboard-stats.ts` (+ `use-activity-rings.ts` if needed)
- Modify: `apps/pwa/src/components/habits/habit-list-item.tsx`
- Modify: `apps/pwa/src/routes/_app/habits/index.tsx`

- [ ] **Step 1: `HabitListItem`** — add an `entries` prop; delete its internal `useHabitEntries(habit.id, {startDate,endDate})`. Derive day-status + week-strip from the `entries` prop. (Read the file first — per the map, entries are used at lines ~74-77, ~95, ~236-260.)

- [ ] **Step 2: Dashboard** — replace the composed `useCalendarData` + per-row entries with `useDashboardToday()`; feed the view-model to the existing feature components. Keep `useDeferredValue` around the view-model.

- [ ] **Step 3: `/habits` page** — fetch `useHabitsWithEntries(90)` (add a PWA hook mirroring mobile's, in `apps/pwa/src/lib/api/habits.ts`) and pass each habit's `entries` into `HabitListItem`. Remove the redundant per-row fetch. Wrap derived sections in `useDeferredValue`.

- [ ] **Step 4: Optimistic writes** — extend the PWA's `optimistic.ts` writers (or the mutation hooks) to also patch the `dashboard/today` + `habits withEntries` caches, same as mobile Task 4.4 Step 3.

- [ ] **Manual Verification (user):** PWA dashboard + `/habits` each make 1–2 requests (not 1 + N) in the Network tab; check-in flips instantly; no jank on a 30-habit list.

### Task 5.3: PWA journal DEK-keyed cache

**Files:**

- Modify: `apps/pwa/src/lib/api/journals.ts`

- [ ] **Step 1:** Add the DEK-epoch token to the PWA journal query keys (the PWA already decrypts in `queryFn`; this only closes the stale-plaintext gap the map flagged — key currently omits the DEK). Read `apps/pwa/src/lib/crypto/encryption-store.ts` for the DEK/lock source and add an epoch that bumps on lock/unlock, folded into `["journals", ...]` keys.

- [ ] **Manual Verification (user):** PWA lock→unlock shows no stale plaintext; journal list still renders decrypted.

> **User commit point:** end of Phase 5 (both platforms on the aggregate).

---

# PHASE 6 — Cleanup (delete dead fan-out)

### Task 6.1: Remove the fan-out code paths

**Files:**

- Modify/Delete: `apps/mobile/lib/api/hooks/today.ts` (`useTodayHabitProgress` + its `useQueries`), any now-unused `useSharedHabitEntries` list usage.
- Modify: `apps/pwa` — remove the now-dead per-row `useHabitEntries` import paths.

- [ ] **Step 1:** `grep -rn "useTodayHabitProgress\|useQueries" apps/mobile` and `grep -rn "useHabitEntries" apps/pwa/src/components/habits/habit-list-item.tsx` — confirm no live consumers remain, then delete the dead exports/functions. Keep per-habit `useHabitEntries` for the **detail** screens (single habit — no fan-out).

- [ ] **Step 2:** Remove `useWarmTabs`'s query-firing side effect if profiling shows it now front-loads redundant aggregate fetches — OR keep it (it now warms only 3 single-request screens, far cheaper). Decision belongs to the profiling result; leave a comment either way. Do not delete `use-warm-tabs.ts` without the user's sign-off (it also warms nav mount).

- [ ] **Manual Verification (user):** full smoke pass — Today/Habits/Journal/Todos cold-open on device, all responsive during load; `grep` confirms no orphaned fan-out hooks; final `bun run build` (user) is clean across all four workspaces.

> **User commit point:** end of Phase 6.

---

## Self-Review notes (author)

- **Spec coverage:** §4 endpoints → Tasks 2.1–2.3. §5 core selector + lifts → 1.1–1.3, 3.1. §6 per-app hooks → 4.1–4.5, 5.1–5.3. §5.3 optimistic → 4.4 Step 3 / 5.2 Step 4. §7 virtualization → 4.3 Step 3, 4.5 Step 4. Journal decrypt → 4.5. Concurrent React → 4.2/4.3/5.2 (`useDeferredValue`). North-star non-blocking → deferred commits + aggregate + FlashList throughout.
- **Refinement vs spec:** spec §5.1 planned to lift `computeRingPercentages`; the plan drops that (kit `ActivityRings` takes value/max, so the selector needs no percentage math) — less churn, same outcome. Only `streak.ts` is lifted.
- **Constraints:** no tests/builds/git by the implementer; each task ends with a user-run Manual Verification; commit points are the user's.
- **Known open detail (flagged, not a placeholder):** FlashList × kit `Sortable` interplay (4.3 Step 3) is the one integration risk — plan says prototype first with an explicit fallback.
