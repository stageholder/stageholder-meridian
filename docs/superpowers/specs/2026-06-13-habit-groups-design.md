# Habit Groups, Archiving & Sidebar — Design Spec

**Date:** 2026-06-13
**Status:** Approved design, pre-implementation
**Surfaces:** Backend (NestJS/MongoDB), `@repo/core`, `@repo/features`, PWA, Mobile

## Summary

Habits are currently a flat, `created_at`-ordered list with no grouping, ordering, or
archive concept. This adds:

1. **Customizable habit groups** — a new `HabitGroup` entity mirroring the proven
   `TodoList` ↔ `Todo` pattern, with **time-of-day defaults** (Morning / Afternoon /
   Evening / Anytime) seeded on first use.
2. **Optional membership** — a habit may belong to one group or none ("Ungrouped").
3. **Archiving** — hide a habit from the list and daily check-in while preserving all
   entry history, distinct from soft-delete.
4. **Drag-reorder** — of groups and of habits (within/between groups).
5. **Sidebar parity** — PWA habits sidebar + mobile chips rail, mirroring todos.

## Decisions (locked)

| Decision         | Choice                                                                | Rationale                                                                             |
| ---------------- | --------------------------------------------------------------------- | ------------------------------------------------------------------------------------- |
| Grouping axis    | Single axis: custom groups, seeded with time-of-day                   | One model, not two; reuses TodoList pattern; "customizable + sensible default" in one |
| Membership       | **Optional** (`groupId` nullable), "Ungrouped" catch-all              | Habit grouping is a soft lens, not a mandatory home                                   |
| Group delete     | **Orphan** member habits (`groupId → null`); NOT cascade              | Deleting a group must never destroy habits or streak history                          |
| Defaults         | Seed **4** time-of-day groups, once (guard counts soft-deleted)       | Habit-native default; deleting all four does not re-spawn them                        |
| Archive          | New `archivedAt`, separate from `deletedAt`                           | Archive ≠ done ≠ delete; history preserved                                            |
| Reorder          | Drag both groups and habits, **both platforms, v1**                   | Kit ships `Sortable` (web + native) — no phasing needed                               |
| Cross-group move | Card "Move to group" menu action (+ drag-to-group on PWA wide)        | Avoids a bespoke cross-list drag kernel; kit `Sortable` handles within-group          |
| Archive UX       | Card kebab Archive/Unarchive + dedicated Archived view                | Full parity with todo "Completed" view                                                |
| UI primitives    | Kit `Sidebar`, `Sortable`, `FormSheet`, `List` from `@stageholder/ui` | Do not hand-roll; all exist as of `0.3.0-alpha.43`                                    |

## Non-Goals (YAGNI)

- Tags / many-to-many habit labeling.
- A separate fixed time-of-day enum **in addition** to custom groups (single axis only).
- Sharing groups between users (`isShared` exists in core todo types but is unused).
- Nested / hierarchical groups.

---

## 1. Data Model

### 1.1 New entity: `HabitGroup`

Mirrors `TodoList` (`apps/api/src/modules/todo-list/`), **plus an `order` field**
(TodoList has none; habit groups need explicit ordering for the time-of-day sequence
and drag-reorder).

```ts
interface HabitGroupProps {
  name: string; // required, 1–100, encrypted at rest
  color?: string; // hex, e.g. "#3b82f6"
  icon?: string; // emoji
  order: number; // 0-based, ascending; drives sidebar + section order
  userSub: string; // owner
  // id, createdAt, updatedAt via Entity base
}
```

- **No `isDefault`** — unlike TodoList's mandatory "Inbox," no group is a required home
  (membership is optional). The four seeds are ordinary, fully-editable groups.
- MongoDB collection `habit_groups`; `name` encrypted via `EncryptionService` (same as
  todo lists). Soft-delete via `deleted_at`.
- Indexes: `{ userSub: 1, order: 1 }` (sidebar/section order),
  `{ userSub: 1 }`.

### 1.2 `Habit` additions

`apps/api/src/modules/habit/habit.entity.ts` + `habit.schema.ts` +
`packages/core/src/types/habit.ts`:

| Field (TS)   | Mongo         | Type             | Default | Notes                                           |
| ------------ | ------------- | ---------------- | ------- | ----------------------------------------------- |
| `groupId`    | `group_id`    | `string \| null` | `null`  | Nullable FK → `HabitGroup._id`; indexed         |
| `order`      | `order`       | `number`         | `0`     | Position within its group (or within Ungrouped) |
| `archivedAt` | `archived_at` | `Date \| null`   | `null`  | Archive timestamp; not the same as `deleted_at` |

- Add index `{ userSub: 1, group_id: 1, order: 1 }` for grouped, ordered fetch.
- **No data migration required.** Existing documents lack these fields and read as
  `groupId=null`, `order=0` (or `undefined → 0` at the consumer), `archivedAt=null`.
  Existing habits appear in "Ungrouped," not archived.

### 1.3 `HabitEntry`: unchanged

History keys off `habitId`, so archiving/grouping/deleting groups never touches entries.

---

## 2. Backend API

### 2.1 New module: `habit-group`

Copy `apps/api/src/modules/todo-list/` structure (entity, schema, repository, service,
controller, dto, module).

| Route                        | Purpose                                                                                                                                                 |
| ---------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `POST /habit-groups`         | Create (name required; color/icon optional). Sets `order` = end.                                                                                        |
| `GET /habit-groups`          | List user's groups, ordered by `order ASC`. **Lazy-seeds** the 4 time-of-day groups on first access (see 2.3). Supports `updatedSince` for sync parity. |
| `GET /habit-groups/:id`      | Single group                                                                                                                                            |
| `PATCH /habit-groups/:id`    | Update name/color/icon                                                                                                                                  |
| `DELETE /habit-groups/:id`   | Soft-delete group **and set `group_id = null`** on all member habits (orphan, NOT cascade).                                                             |
| `POST /habit-groups/reorder` | Batch `{ items: [{ id, order }] }` — drag-reorder groups                                                                                                |

- **Entitlement cap:** enforce `max_habit_groups` parallel to todo-list's
  `max_todo_lists`. (Assumption: entitlement infra is reusable; confirm the key name
  during implementation.)

### 2.2 Habit controller additions

`apps/api/src/modules/habit/habit.controller.ts` + `.service.ts` + `.dto.ts`:

| Change                              | Detail                                                                                                                                                                 |
| ----------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `GET /habits?groupId=<id>`          | Filter to one group. `groupId=null`/`unassigned` → Ungrouped.                                                                                                          |
| `GET /habits?archivedOnly=true`     | Archived view. **Default: archived excluded** from the normal list.                                                                                                    |
| `POST /habits/reorder`              | Batch `{ items: [{ id, order, groupId? }] }`. Including `groupId` makes drag-**between**-groups atomic (move + reposition in one call). Mirrors `POST /todos/reorder`. |
| `POST /habits/:id/archive`          | Server stamps `archivedAt = now`.                                                                                                                                      |
| `POST /habits/:id/unarchive`        | Server clears `archivedAt = null`.                                                                                                                                     |
| `CreateHabitDto` / `UpdateHabitDto` | Add nullable `groupId`. `order` set server-side on create (end of target group).                                                                                       |

> Archive uses dedicated endpoints (not `PATCH { archivedAt }`) so the server controls
> the timestamp and the intent is explicit, matching how state transitions with side
> effects are modeled.

### 2.3 Time-of-day seeding

On the first `GET /habit-groups` for a user, seed four groups **iff the user has never
had any group** — i.e. the count of `habit_groups` for `userSub` **including
soft-deleted** is zero. This guards against re-seeding after a user deletes all four.

| name      | color (suggested) | icon | order |
| --------- | ----------------- | ---- | ----- |
| Morning   | amber             | 🌅   | 0     |
| Afternoon | sky               | ☀️   | 1     |
| Evening   | indigo            | 🌙   | 2     |
| Anytime   | slate             | ✨   | 3     |

(Exact colors/icons finalized in implementation; must be valid kit theme hex tokens.)

---

## 3. Shared `@repo/core`

- `types/habit.ts`: add `HabitGroup` interface; add `groupId?: string | null`,
  `order: number`, `archivedAt?: string | null` to `Habit`.
- `api/habits.ts`: extend `createHabitsApi()` (or equivalent factory) with group
  CRUD + `reorderGroups`, habit `reorder`, `archive`/`unarchive`, and `groupId` in
  create/update — mirroring `api/todos.ts`.

### 3.1 Correctness-critical: rings & streaks must ignore archived

`packages/core/src/habits/entry-resolution.ts`:

- `countScheduledHabitsForDate(...)` and any activity-ring / "scheduled today" math
  **must exclude habits with `archivedAt != null`**, so archiving a habit does not drag
  down completion rings.
- The default `useHabits()` fetch excludes archived (server default), so most consumers
  receive clean data automatically; the resolution helpers still guard explicitly as a
  belt-and-suspenders measure.
- **Streaks freeze on archive:** entries remain, so unarchiving resumes streak
  computation from existing history. No streak data is mutated by archive/unarchive.

---

## 4. `@repo/features` (cross-platform)

- **New `HabitGroupForm`** (`packages/features/src/habits/habit-group-form.tsx`) —
  mirror `TodoListForm`: name (required, max 100) + color swatches built on kit
  `Input` + color buttons; host owns the create/update mutation; `key`-prop remount
  for reset.
- **`HabitCard`** (`packages/features/src/habits/habit-card.tsx`): kebab menu gains
  **Archive / Unarchive** and **Move to group…**; the card stays presentation-only and
  is rendered as the `renderItem` of the kit `Sortable` at the host (drag chrome — ghost,
  drop indicator, a11y announce — is owned by `Sortable`, not the card). Hosts wire
  mutations.

---

## 5. PWA

Use the kit `Sidebar` compound component (`@stageholder/ui`) — do **not** hand-roll a
sidebar. Mirror the todos _information architecture_ but with kit `Sidebar.*`.

- **`habits-sidebar.tsx`** (new): `Sidebar.Provider` → `Sidebar.Menu` with
  `Sidebar.MenuButton` rows — "All habits" · group rows (`glyph`/color dot, name,
  `badge={count}`, kebab edit/delete) · "+ Create group" · **"Archived"**. Groups render
  by `order`. (Group reorder uses kit `Sortable` over the group rows.)
- **Index route** (`routes/_app/habits/index.tsx`): section habits under group headers
  in `order` (Morning → Afternoon → Evening → Anytime → custom → **Ungrouped** last).
  Each section is a kit **`Sortable`** of `HabitCard`s; within-group drag →
  `POST /habits/reorder`. Cross-group via the card's "Move to group…" action. Keep
  card/list view toggle.
- **`routes/_app/habits/$groupId.tsx`** (new, mirror `$listId`): single-group view
  (one `Sortable`).
- **`routes/_app/habits/archived.tsx`** (new, mirror `completed`): archived habits via
  kit `List`, each with a **Restore** action (no drag).
- **Group create/edit dialog** wrapping the shared `HabitGroupForm` (mirror
  `create-list-dialog.tsx`).
- **`habit-form.tsx`** host: add a group picker (kit `Select`; mirror `TodoForm`'s list
  selector — hidden when there are 0 groups).

---

## 6. Mobile

Mirror `apps/mobile/app/(authed)/todos.tsx` for the chips rail; use kit `Sortable.native`
for drag (gesture-handler + reanimated — long-press to activate, so it coexists with the
ScrollView).

- **Chips rail** in `habits.tsx`: "All" · group chips (color dot + name) · edit pencil
  (when a group is active) · "+ group" · **Archived** chip. Sets `activeGroupId`.
- **Sectioned list** by group header (mirror todos' bucket sections), Ungrouped last;
  each section is a kit **`Sortable`** of `HabitCard`s. Cross-group via the card's "Move
  to group…" action (driven `Sheet` picker), not cross-section drag.
- **`HabitGroupSheet`** (mirror `todo-list-sheet.tsx`) hosting `HabitGroupForm`, or kit
  `FormSheet` directly.
- **Archive:** card kebab Archive/Unarchive; Archived chip → archived list with Restore.
- Follow established native conventions from memory: driven `Sheet` (no `Adapt`),
  `Banner.Body` wrappers, kit `Button` triggers, `usePressScale` for rows, persisted
  React-Query cache `buster` bump (the cached habit shape changes — adds
  `groupId`/`order`/`archivedAt`).

---

## 7. Risks & Open Items

1. **Kit version bump required.** Meridian is pinned to `@stageholder/ui` `^alpha.38`;
   `Sidebar`, `Sortable`(+`.native`), and `Kanban` land at `0.3.0-alpha.43`. **Prereq:**
   bump the pin to `^0.3.0-alpha.43` across `apps/pwa`, `apps/mobile`, `packages/features`,
   `bun install`, clear `apps/pwa/.vite`, check for stale nested copies (per memory). If
   these components are not yet in the published dist, that must be resolved first (kit is
   the user's own repo at `~/Project/stageholder-ui`). Verify the exports exist before
   building UI.
2. **Cross-group drag is via menu action, not cross-section drag.** Kit `Sortable`
   reorders _within_ one list; moving a habit to another group uses a "Move to group…"
   action (Select on PWA, driven Sheet on mobile). A full cross-section drag (kit
   `Kanban` kernel) is a possible later enhancement, out of scope for v1.
3. **Entitlement key** `max_habit_groups` — confirm the entitlement system accepts a new
   key and pick the default limit.
4. **Seed colors/icons** must be valid kit theme hex tokens (no `var()`/`oklch`; see the
   somewhat-strict-web color rules).
5. **`updatedSince` sync parity** — `habit-group` should support the same incremental
   sync query shape as other modules for consistency.

## 8. Verification (manual)

Per project convention, no automated tests — manual verification only. Key paths to
exercise after build:

- First habits-area load seeds exactly four groups, once; deleting all four and
  reloading does **not** re-seed.
- Create/rename/recolor/reorder groups (PWA drag; mobile per chosen phasing).
- Assign habit to a group via form; drag a habit between groups (PWA).
- Delete a group → member habits move to Ungrouped, habits + streaks intact.
- Archive a habit → disappears from list & daily check-in, **rings/streak unaffected**;
  appears in Archived; Restore returns it with history intact.
- Existing (pre-feature) habits appear in Ungrouped, not archived, no errors.
