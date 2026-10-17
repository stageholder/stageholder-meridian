# Non-Blocking Data Layer — Design Spec

**Date:** 2026-07-29
**Status:** Approved (pending spec review)
**Scope:** `apps/api`, `apps/mobile`, `apps/pwa`, `@repo/core`, `@repo/features`

---

## 1. Problem

On production (APK + TestFlight, real devices) the app **freezes while data loads**: navigating to Habits/Journal/Today the first time hangs — you can't tap other tabs or buttons — until the response arrives, then it's smooth. Repeats per screen on first visit; Journal is worst ("hangs on everything").

### Root cause (why it freezes)

Network I/O is asynchronous in React Native and **cannot** block the JS thread. The freeze is **synchronous JS work bookending each fetch**:

1. **Per-item request fan-out → a re-render storm.** Every data screen fires **one habit-entries request per habit**:
   - Mobile: `useTodayHabitProgress` (`apps/mobile/lib/api/hooks/today.ts`) uses `useQueries` — N queries; each `HabitCheckInRow`/`HabitCard` also subscribes to its habit's entries.
   - PWA: same shape, hidden inside `HabitListItem` (`apps/pwa/src/components/habits/habit-list-item.tsx`) which calls `useHabitEntries(id, 90d)` per rendered row — **uncapped** on the `/habits` page.

   The N responses land staggered over the network window. Each landing bumps a change-stamp → the aggregate `useMemo` recomputes (walking every habit + a streak walk) → the **whole screen re-renders**. With N habits that's up to N full synchronous reconciliations in a burst — the JS thread is saturated for the duration of the load. That is the freeze, and it lifts when the last response settles.

2. **Non-virtualized lists.** Mobile Habits (kit `Sortable`) and Journal (`JournalList`) render **every row at once**; only Todos uses FlashList. Render cost scales with data size, not screen size.

3. **Journal decrypt on the render path (mobile only).** `apps/mobile/app/(authed)/journal.tsx` decrypts the whole list in a screen-level `useEffect` (per-entry crypto over JSI + `JSON.parse` per entry), re-running on every page load/refetch. The PWA already avoids this by decrypting in the `queryFn`.

4. **No non-blocking rendering.** Neither app uses concurrent React (`useDeferredValue`/`startTransition`), so a data-driven re-render competes with — and beats — user input on the single JS thread.

### Confirmed non-causes

- **Auth is not the cause.** The SDK's `getAccessToken()` (`~/Project/stageholder-identity/.../StageholderProvider.tsx`) returns the in-memory token synchronously and only awaits the network within 60s of expiry, collapsing concurrent calls into one refresh.
- **The HTTP client is not the cause.** axios vs `expo/fetch` is irrelevant; both do async I/O and a synchronous `JSON.parse`. `expo/fetch`'s only real edge (streaming) doesn't apply to these REST payloads.

---

## 2. Goals & Non-Goals

### North Star

> **Zero UI hang or lag during any API call — ever.** No screen, no tap, no gesture may block while a request is in flight or its response is being processed. Loading shows responsive skeletons/spinners, never a frozen thread. Every design decision below is subordinate to this outcome; if a choice reintroduces a blocking frame, it is wrong.

### Goals

- **The UI thread is never gated on a network response.** Tapping a tab/button stays instant regardless of in-flight fetches.
- Eliminate the per-screen habit-entries **fan-out** on both platforms.
- Data-driven re-renders and background refetches **never block user input**.
- Journal decryption never runs on the render path.
- Every list is virtualized.
- **One shared data architecture** across mobile + PWA (pure logic in `@repo/core`, per-app thin hooks, props-driven `@repo/features`).

### Non-Goals (explicitly out of scope)

- **HTTP client rewrite.** Keep the existing axios setup. No `expo/fetch`, no new client abstraction.
- **Navigation restructure.** Moving the ~13 `href:null` detail screens out of the single mobile Tabs navigator into Stacks is deferred to a separate follow-up spec. Sections below fully remove the freeze without it.
- **Offline/persistence.** No re-adding the removed cache persister (mobile) or Dexie (PWA).
- **New crypto.** `@repo/crypto` primitives are unchanged; only _where_ decrypt runs changes.

### Success criteria (manual verification on a real device)

- Cold-open Habits/Today/Journal: tabs and buttons remain tappable throughout the load; no frozen frames.
- A Hermes/React DevTools profile of a Habits cold-open shows **one** commit for the aggregated data, not a burst of N.
- Journal list open + entry open: no main-thread crypto during render.
- Optimistic check-in flips the control on the tap frame; aggregate numbers reconcile within a beat.

---

## 3. Architecture Overview

```
                         ┌──────────────────────────────────────────┐
   apps/api (NestJS)     │  GET /dashboard/today?today=YYYY-MM-DD    │  one payload
                         │  GET /habits?withEntries=<window>         │  one payload
                         └──────────────────────────────────────────┘
                                          │ (1 request per screen)
                                          ▼
   apps/mobile/lib/api/hooks  &  apps/pwa/src/lib/api   (thin RQ hooks)
      - queryFn decrypts journals (async, off render)
      - select → shared selector → stable view-model
      - placeholderData: keepPreviousData  (instant paint)
      - useDeferredValue / startTransition (non-blocking updates)
                                          │  props (already shaped + decrypted)
                                          ▼
   @repo/core (pure)                    @repo/features (props-only views)
      - dashboard/today-selector.ts       - FlashList-virtualized lists (mobile)
      - habits/streak.ts (lifted)         - HabitCard / HabitCheckInRow / JournalList
      - activity-rings compute (lifted)   - charts, dashboard widgets
```

**Principle:** the server ships aggregated _data_ in one call; the shared selector shapes the _view-model_; components are pure and virtualized; updates flow through concurrent-React transitions so they can't block input.

---

## 4. Backend — Aggregation Endpoints (`apps/api`)

Mirror the existing `calendar` module (`apps/api/src/modules/calendar/`), which already fans-in todos + journals + habit-entries + habits over a date window via multi-repo `Promise.all`. The enabling query already exists: `HabitEntryRepository.findByUserAndDateRange(userSub, startDate, endDate)` (index `{userSub:1, date:-1}`), currently used only by `CalendarService`.

### 4.1 `GET /dashboard/today?today=YYYY-MM-DD`

New `dashboard` module (`dashboard.controller.ts` + `dashboard.service.ts` + `dashboard.dto.ts`). Service injects `HabitRepository`, `HabitEntryRepository`, `TodoRepository`, `JournalRepository`, `LightService`. Single `Promise.all`:

- `habitRepo.findByUser(sub)` — active habits
- `habitEntryRepo.findByUserAndDateRange(sub, today, today)` — **today's** entries, all habits, one query
- `todoRepo.findByUserAndDateRange(sub, todayWindow)` — today/overdue todos
- `journalRepo.findByDateRange(sub, today, today)` — today's journals (still ciphertext; client decrypts)
- `lightService.getUserLight(sub)` — light snapshot

**Server also computes `currentStreak` per habit** (decision: lean payload — the dashboard never ships a 90-day window). The service fetches a bounded lookback window (`findByUserAndDateRange`, ~90 days) once for all habits, groups by `habit_id`, and computes each streak. **Parity:** prefer importing the lifted `@repo/core/habits/streak` `computeStreak` directly (monorepo package — one function, server and client cannot diverge). If `apps/api` cannot consume `@repo/core`, port the identical rule and add a parity check to the plan. Returned inline per habit as `currentStreak`.

**Response shape (`DashboardTodayResponse`):**

```ts
{
  today: string;                          // echo yyyy-mm-dd
  habits: Array<Habit & { currentStreak: number }>;
  todayEntries: HabitEntry[];             // all habits, today only
  todos: Todo[];                          // today + overdue
  journals: Journal[];                    // today, still-encrypted
  light: UserLight;
}
```

Zod DTO for the query (`today` optional, defaults server-side to UTC-safe today), validated with `ZodValidationPipe`. Auth `req.user.sub`. Return `.toObject()` shapes.

### 4.2 `GET /habits?withEntries=<window>`

Extend `HabitController.list` + `HabitService.listByUser` with a Zod-validated optional `withEntries` param (e.g. `withEntries=90d` or explicit `entriesFrom`/`entriesTo`). When present:

- `habitRepo.findByUser(sub)` + `habitEntryRepo.findByUserAndDateRange(sub, windowStart, today)` — **one** entries query across all habits.
- Group entries by `habit_id` in memory; embed as `entries` on each habit.

**Response shape when `withEntries`:** `Array<Habit & { entries: HabitEntry[] }>`. Wrap the bulk method through `HabitEntryService` (currently unwrapped) so the controller doesn't reach into the repo directly.

> The Habits screen ships the window (so streaks/week-strips compute client-side and update optimistically); the Today dashboard does not (uses server `currentStreak`). This asymmetry is intentional — see §5.3.

---

## 5. Shared Logic — `@repo/core`

The core/features boundary is clean: `@repo/core` = pure, React-free logic; `@repo/features` = props-only views; each app owns its RQ hooks. The shared additions are **pure selectors**, not hooks.

### 5.1 Lift duplicated/misplaced pure code into core (prerequisite)

- **`computeStreak` / `computeStreakCached`** — today in `apps/mobile/lib/streak.ts` and duplicated in the PWA. Move to **`@repo/core/src/habits/streak.ts`**; both apps import it. (Also `isCheckedToday`, `isScheduledToday`, `localDateKey` helpers.)
- **`computeRingPercentages`** — today in `@repo/features/src/activity-rings/compute.ts`. Move to **`@repo/core/src/habits/rings.ts`** (features→core import is forbidden, so the selector can't consume it where it lives). `@repo/features` re-imports it from core for its own presentational use.
- Add `"./habits/*"` (already present) and a new `"./dashboard/*"` subpath to `packages/core/package.json` exports.

### 5.2 New selector: `@repo/core/src/dashboard/today-selector.ts`

```ts
export interface TodayViewModel {
  rings: RingDatum[]; // journal / habit / todo, resolved values+max
  habitStats: {
    doneToday: number;
    totalScheduledToday: number;
    bestStreak: number;
  };
  scheduledTodayHabits: Array<
    Habit & { todayEntry?: HabitEntry; currentStreak: number }
  >;
  todayTodos: Todo[]; // sorted
  journalWordsToday: number;
  kpis: DashboardStatItem[];
}

export function selectTodayViewModel(input: {
  habits: Array<Habit & { currentStreak: number }>;
  todayEntries: HabitEntry[];
  todos: Todo[];
  journalsToday: Journal[]; // already decrypted
  light: UserLight;
  today: string;
}): TodayViewModel;
```

Pure; reuses `scheduledHabitsForDate`, `resolveTargetCount`, `isEntryComplete`, `countWordsFromContent`, tier/multiplier helpers, and the lifted `computeRingPercentages`. Uses server `currentStreak` (no entry-window walk).

### 5.3 Optimistic behavior with server-computed streak

- **Rings + doneToday** derive from `todayEntries` → an optimistic check-in writes today's entry to cache → the selector recomputes them **instantly** (through `useDeferredValue`).
- **Streak badge** shows the server `currentStreak` and **reconciles on the settle refetch** (a beat later). This is the accepted Todoist-style trade-off for the lean dashboard payload.
- On the **Habits screen** (which _has_ the 90-day window) streaks recompute client-side via `computeStreak`, so they update optimistically there.

---

## 6. Per-App Hook Changes

### 6.1 Mobile (`apps/mobile/lib/api/hooks`)

- **Replace** `today.ts` `useQueries` fan-out with a single `useDashboardToday()` → `GET /dashboard/today`, feeding `selectTodayViewModel` via RQ `select`.
- **Replace** the Habits screen's per-card `useSharedHabitEntries`/`HabitCheckInRow` self-fetch with `useHabitsWithEntries(window)` → `GET /habits?withEntries=`; distribute each habit's embedded `entries` to its card as props (no per-row query).
- **Journal:** move decrypt from the screen `useEffect` into the `queryFn` (mirror PWA), decrypting per-entry with `Promise.allSettled`; cache decrypted. Add a DEK-identity token to the journal query keys so lock/unlock can't serve stale plaintext.
- Keep the existing per-habit `useHabitEntries` only for the **habit detail screen** (single habit — no fan-out).

### 6.2 PWA (`apps/pwa/src/lib/api` + `components`)

- **`HabitListItem`** stops calling `useHabitEntries` per row. On the Habits page it reads entries from `useHabitsWithEntries(window)`; on the dashboard the habit rows read from `useDashboardToday()`. Entries arrive as props (matches the `@repo/features` contract).
- Dashboard composition (`use-dashboard-stats`, `use-activity-rings`) consumes `useDashboardToday()` instead of composing `useCalendarData` + N `useHabitEntries`.
- Journal decrypt already in `queryFn` — only add the DEK-identity key token.

### 6.3 Both — concurrent React + SWR

- Wrap selector output / list data in **`useDeferredValue`**; route imperative list/state updates through **`startTransition`** so refetch-driven renders can't block taps.
- Add **`placeholderData: keepPreviousData`** to the aggregate + list queries on mobile (PWA already uses it on several) → instant cache paint.
- Use RQ **`select`** so components get referentially-stable, pre-shaped view-models (cheap re-renders).

---

## 7. Virtualization (mobile)

- **Habits:** render sections/cards through **FlashList** (v2, already installed). The kit `Sortable` long-press drag must be preserved — use a FlashList-compatible ordering (drag can stay per-section; if `Sortable` can't wrap FlashList rows cleanly, keep `Sortable` only while a section is actively being dragged and virtualize otherwise). _(Implementation detail for the plan; flagged as the one integration risk.)_
- **Journal:** `JournalList` (mobile host) renders rows through **FlashList**.
- Todos already virtualized — no change.

---

## 8. Data Flow (Today, cold open)

```
tap Today
  → useDashboardToday(): cache MISS → skeleton painted, UI fully interactive
  → 1 request: GET /dashboard/today
  → response: 1 JSON.parse, journals decrypted in queryFn (off render)
  → select → selectTodayViewModel (pure) → view-model
  → useDeferredValue commits view-model at low priority (a tap here preempts it)
  → rings/habits/todos render once
revisit within staleTime
  → cache HIT → keepPreviousData paints instantly, background revalidate is non-blocking
check in a habit
  → optimistic write to todayEntries cache → selector recomputes rings/doneToday instantly
  → settle refetch reconciles currentStreak
```

No point in this flow runs unbounded synchronous work on the JS thread while input is pending.

---

## 9. Risks & Mitigations

- **`/dashboard/today` payload size** — bounded (today's entries only + server streak); far smaller than N× 90-day windows. Low risk.
- **Server streak vs client streak divergence** — eliminated when `apps/api` imports the lifted `@repo/core/habits/streak` (one function). If it must port instead, the plan adds a parity check against the shared implementation.
- **FlashList + kit `Sortable` interplay** (mobile Habits) — the one real integration risk; plan must prototype this first and fall back to a virtualized non-drag list per section if needed.
- **Optimistic streak lag on dashboard** — accepted, documented (§5.3).
- **Cross-platform blast radius** — changes touch both apps + shared core; sequence so shared lifts land first, then each app migrates behind the same endpoints.

---

## 10. Sequencing (for the implementation plan)

1. **Core lifts** — move `computeStreak`/rings into `@repo/core`; add exports. (No behavior change; both apps import new location.)
2. **Backend** — `GET /dashboard/today` + `GET /habits?withEntries=`; server streak. (Additive — old per-habit routes stay.)
3. **Shared selector** — `today-selector.ts`.
4. **Mobile migration** — dashboard hook, habits-with-entries hook, journal decrypt→queryFn, concurrent-React + FlashList.
5. **PWA migration** — same endpoints/selector; remove `HabitListItem` fan-out.
6. **Cleanup** — delete now-dead fan-out hooks once both apps are off them.

Each step is independently shippable; old endpoints remain until step 6.

---

## 11. Verification (manual — no automated tests/builds per project prefs)

- Real-device cold-open of Today/Habits/Journal: confirm tabs/buttons stay responsive during load.
- Hermes sampling / React DevTools Profiler: one commit per aggregated load, not N.
- Check-in: instant control flip; ring updates instantly; streak reconciles within a beat.
- Journal: open list + entry with encryption on — no main-thread crypto during render; no stale plaintext after lock/unlock.
- PWA parity: dashboard + /habits make 1–2 requests, not 1 + N.
