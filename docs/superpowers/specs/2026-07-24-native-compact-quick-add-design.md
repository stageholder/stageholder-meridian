# Native Compact Quick-Add (Todo + Habit) — Design

**Date:** 2026-07-24
**Status:** Approved (design), pending implementation plan
**Scope:** Native mobile (`apps/mobile`) **create** flows only. PWA and all **edit** flows are out of scope and unchanged.

---

## 1. Problem

The native create sheets render the shared `TodoForm` / `HabitForm`, which stack a wall of labeled inputs (`TodoForm`: smart title **plus** a Description TextArea, do-date + deadline pickers, List Select, Priority Select; `HabitForm`: icon, name, frequency toggle, target, unit, weekly days, weekly target, color, description). A tall multi-input form in a bottom sheet is poor mobile UX — it fights the keyboard, forces `scrollable` + snap juggling, and buries the primary action.

To make those tall forms behave, the app piled on scaffolding that the kit already handles or that a better design removes entirely: `Sheet.LazyBody` + a `FormSheetSkeleton`, open-epoch / id remount keys, and `mountChildren` pins.

## 2. Goal

Replace the native **create** flows with a Todoist-style **compact quick-add**: one thing to type, everything else a pill with a sensible default, so a title (todo) or a name (habit) alone can create — keyboard stays up, no scrolling, no dead space. Delete the create-path scaffolding as a consequence.

**Non-goals:** editing (stays a full detail sheet — Todoist model: quick capture vs. full detail), the PWA forms, and any change to the shared `TodoForm` / `HabitForm` (still used by edit + web). No fire-and-repeat mode (Add closes the sheet).

## 3. Approach (chosen)

New **native-only** components in `@repo/features` built on the kit `FormSheet` (for its keyboard-stretch handling — the sheet never lifts, so it can't get stuck raised). Rejected alternatives: raw `Sheet` with custom keyboard handling (reinvents FormSheet); a `compact` variant prop on the shared forms (overloads one component with two divergent layouts).

## 4. Architecture

```
packages/features/src/
  _internal/quick-add-sheet.native.tsx    → <QuickAddSheet>        (shared shell)
  todos/quick-add-todo-sheet.native.tsx    → <QuickAddTodoSheet>
  habits/quick-add-habit-sheet.native.tsx  → <QuickAddHabitSheet>
```

### 4.1 `QuickAddSheet` (shared shell)

Wraps the kit `FormSheet` with `hideFooter` and owns the compact chrome, so both entity sheets share one keyboard/layout implementation:

- **Header:** the title (`FormSheet` `title`), plus a Cancel/close affordance.
- **Body (from the consumer):** the primary field (smart title / icon+name) and any inline-expanded Note field.
- **Action bar (pinned, above the keyboard):** the `FormSheet.HorizontalScroll` pill row on the left + an **accent circular send button** on the right. Accent color is passed in (todo-orange / habit-color).
- `fit` sizing — no `scrollable`, no manual `snapPoints`. The sheet is small by design.

`hideFooter` here is legitimate: the action is a pinned send button in the **fixed** bottom chrome above the keyboard, not buttons in a scrolling body. FormSheet's keyboard spacer keeps the whole action bar above the keys.

**Props (sketch):**

```ts
interface QuickAddSheetProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  accentColor: string;
  onSubmit: () => void; // does NOT auto-close; consumer closes on success
  submitting?: boolean;
  submitDisabled?: boolean;
  field: ReactNode; // the primary field (+ inline Note when expanded)
  pills: ReactNode; // the pill row content (kit <Pill> children)
}
```

### 4.2 Reset / lifecycle

State lives in the entity sheet via plain `useState`, seeded from defaults. On the open `false → true` transition the sheet resets to defaults (a small effect), and after a successful add it resets + closes. **No epoch keys, no remount-via-key, no `mountChildren` juggling, no `Sheet.LazyBody`, no skeleton.** The sheet may stay mounted-warm (kit default) because reset is by state, not by unmount.

## 5. Todo sheet — `QuickAddTodoSheet`

- **Field:** `SmartTodoInput` with `showChips={false}` + `onParse` (the prop contract is explicit: turn chips off when the host renders its own row; `onParse` fires each change so the pills reflect what was typed). `parse` on, `autoFocus` on. `onSubmit(result)` fires the create.
- **Pills** (kit `<Pill>`; show parsed value, tap to set manually):

| Pill          | Field              | Picker                                                                                  |
| ------------- | ------------------ | --------------------------------------------------------------------------------------- |
| `📅 Date`     | `doDate` ("when")  | kit `QuickDatePicker` (proven inside FormSheet today)                                   |
| `🏁 Deadline` | `dueDate`          | kit date picker; pill shows only when set                                               |
| `🚩 Priority` | `priority` (P1–P4) | kit `Select` with `pill` trigger + `inSheet` (the proven pattern already in `TodoForm`) |
| `📁 List`     | `listId`           | kit `Select` with `pill` trigger + `inSheet` (proven in `TodoForm`)                     |
| `📝 Note`     | `description`      | not a picker — expands a one-line inline `TextArea` below the title                     |

`TodoFormValues` = `{ title, description?, priority, doDate?, dueDate?, listId? }`. No labels field → no Labels pill.

## 6. Habit sheet — `QuickAddHabitSheet`

- **Field:** inline `MediaPicker` icon box (reused from `HabitForm`, emoji + lucide) + a plain name `Input`, `autoFocus`.
- **Pills:**

| Pill           | Field(s)                                         | Picker                                                                                                                             |
| -------------- | ------------------------------------------------ | ---------------------------------------------------------------------------------------------------------------------------------- |
| `🔁 Frequency` | `frequency` (+ `scheduledDays` / `weeklyTarget`) | small **custom nested Sheet**: daily / weekly / weekly-target; reveals day chips (weekly) or count (weekly-target) _inside itself_ |
| `🎯 Target`    | `targetCount` (+ `unit?`)                        | small **custom nested Sheet**: count stepper + optional unit input                                                                 |
| `🎨 Color`     | `color`                                          | swatch nested Sheet                                                                                                                |
| `📁 Group`     | `groupId`                                        | kit `DropdownMenu` (rendered only when `groups` is non-empty)                                                                      |
| `📝 Note`      | `description`                                    | inline expanding `TextArea`                                                                                                        |

Defaults (`HABIT_FORM_DEFAULTS`: `daily`, `1×`, `#3b82f6`, `🎯`) let a name alone create.

## 7. Keyboard & nesting behavior (native)

- Kit pickers call `Keyboard.dismiss()` on open. We hold a ref to the title/name input and **refocus it when a picker closes** (the kit `FormSheet` `MixedFieldsDemo` refocus pattern), so the composer stays in one keyboard-up state instead of "returning from raised."
- Menu pills reuse the kit `Select` with a `pill` trigger and `inSheet={true}` on native — the exact pattern the current `TodoForm`/`HabitForm` already use inside a `FormSheet` (kit ancestor-Adapt auto-detection misses inside a Sheet, so `inSheet` forces the driven-sheet listbox). Custom `Select.Trigger` children render the pill face (color dot + label). This is proven; no `DropdownMenu` needed.
- The two custom picker sheets (Frequency, Color) follow kit native sheet rules: `snapPointsMode` `fit`/`constant` (never percent), `transition="medium"` on driven sheets.

## 8. Files changed

**New (native-only):**

- `packages/features/src/_internal/quick-add-sheet.native.tsx`
- `packages/features/src/todos/quick-add-todo-sheet.native.tsx`
- `packages/features/src/habits/quick-add-habit-sheet.native.tsx`
- Barrel exports: `packages/features/src/todos/index.ts`, `packages/features/src/habits/index.ts`

**Modified:**

- `apps/mobile/components/create-todo-dialog.tsx` — render `QuickAddTodoSheet`; delete `Sheet.LazyBody`, `FormSheetSkeleton`, epoch key, `mountChildren="open"` pin.
- `apps/mobile/components/create-habit-dialog.tsx` — render `QuickAddHabitSheet`; same deletions.

**Untouched:** edit dialogs (`edit-todo-dialog`, `edit-habit-dialog`), `todo-list-sheet`, `habit-group-sheet` (their `mountChildren="open"` pins remain valid — they still host the full seed-on-mount forms), PWA, shared `TodoForm` / `HabitForm`, `form-sheet-skeleton.tsx` (edit still uses it).

## 9. DX notes

One shell owns the tricky parts (keyboard-stretch, nested-picker rules, accent send, pinned action bar). Entity sheets are declarative — a primary field + a list of `<Pill>`s. Pills compose existing kit primitives; only **two** genuinely new small picker sheets (Frequency, Color). No new abstraction framework, no create-path scaffolding.

## 10. Verification (manual — per project preference)

No automated tests / no build during implementation (user verifies at end). Manual QA checklist:

1. Todo: type "gym tomorrow 7am p1 #<list>" → Date/Priority/List pills reflect the parse; Add creates correctly; sheet closes; reopen is clean (reset).
2. Todo: create with title only (defaults); tap each pill to set manually; Note pill expands/collapses; keyboard returns after each picker.
3. Habit: create with name only; Frequency picker weekly → day chips appear; weekly-target → count; Target stepper + unit; Color swatch; Group pill hidden when no groups.
4. Keyboard never leaves the sheet stuck raised; action bar stays above the keyboard; no scroll on the compact sheet.
5. Failed create keeps the sheet open with entered values.

## 11. Risks / to verify during implementation

- `QuickDatePicker` custom-trigger support — confirm it accepts a `Pill` trigger (or fall back to `DatePicker` + `asChild`).
- Nested custom picker sheets over a `FormSheet` — confirm z-order / transition per kit alpha.31 rules (pattern proven for kit `Select`/`DatePicker`; the two custom sheets must follow the same driven-sheet setup).
