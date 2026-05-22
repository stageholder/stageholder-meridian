# PWA shadcn/Tailwind → Tamagui Migration Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Convert all app-owned JSX in `apps/pwa/src` from raw HTML + Tailwind to Tamagui primitives (`@stageholder/ui`) + kit tokens, stripping `className` to a small functional allowlist.

**Architecture:** Mechanical, contract-driven conversion. The spec at `docs/superpowers/specs/2026-05-22-pwa-tamagui-migration-design.md` is the single source of truth for every mapping (shorthands, spacing/radius/color/typography tokens, responsive, interaction states, allowlist, exclusions). Each task converts one file or a small group, then the user verifies the affected screen in a running dev server. Work proceeds in 11 batches, shell-first.

**Tech Stack:** Vite, TanStack Router, React 19, Tamagui v2 (rc.42), `@stageholder/ui` (0.3.0-alpha.5), `@tamagui/config/v5`.

---

## Project-Specific Execution Rules (override skill defaults)

These reflect the user's standing preferences and **replace** the skill's default TDD/commit cadence:

- **No automated tests.** Do not write `*.spec.ts` / RTL / E2E. Verification is manual.
- **No builds/typechecks during implementation.** Do not run `vite build`, `tsc`, or `tsr generate` per task. The user runs `tsr generate && tsc --noEmit` once at the very end.
- **No git operations.** Do not `git add`/`commit`/`branch`/`push`. The user owns all git and commits per batch at their discretion.
- **Verification step = manual visual check.** Each task ends with a checkpoint: the user (or reviewer) opens the affected screen in `bun --filter pwa dev` (port 4001) and confirms layout + light/dark parity. The executor pauses for this.
- **Read before you convert.** Every file is read in full before editing. Never write speculative conversions for unread code.

## The Conversion Contract (reference, do not duplicate)

All mappings live in the spec. The executor MUST have the spec open. Quick index:

- Shorthands (verified 33): `bg items justify self content shrink grow rounded p px py pt pb pl pr m mx my mt mb ml mr t b l r z text select maxW minW maxH minH`. No `f`/`w`/`h`/`space`.
- Spacing: nominal `gap-N → $N` (space scale: `$2`=7 `$3`=13 `$4`=18 `$5`=24 `$6`=32).
- Radius: `rounded-sm/md/lg → $sm/$md/$lg`, `rounded-full → {9999}`.
- Color: Tailwind semantic → kit token (`text-muted-foreground → color="$mutedForeground"`, etc.). Intent surfaces → `theme="destructive|success|warning|info"`.
- Typography: font-size scale `text-xs→$1 sm→$3 base→$5 lg→$6`; arbitrary → raw `fontSize={N}`.
- Responsive (1:1): `sm:→$sm md:→$md lg:→$lg`, or `<Show>/<Hide>/<ResponsiveStack>`.
- Interaction: `hover:→hoverStyle`, `active:→pressStyle`, `focus:→focusStyle`, `transition-*→transition="quick"` (prop is `transition`, NOT `animation`); `onClick→onPress`, `onMouseEnter→onHoverIn`; `group`+`group-hover:→group` prop + `$group-hover`.
- Animations: mount/enter → native `enterStyle` + `transition` (stagger via `transition={["medium",{delay:i*100}]}`); exit → `exitStyle`+`AnimatePresence`. Keep className ONLY for spinners/pulse/bespoke keyframes.
- Keep (allowlist): animation classes, `safe-area-*`, `scrollbar-hide`, `backdrop-blur-*`, CSS-var inline styles, SDK markup.
- Exclude (structure-only): `activity-rings/*`, `light/star-visual`, `shared/daily-target-rings`, `dashboard/charts/*`, `light/journey-tier-map`.

---

## Task 1: Worked example — `mobile-bottom-nav.tsx` (the proven pattern)

This task is the reference conversion. It is small, real, and exercises router-`<Link>` handling, conditional styling, responsive hide, an allowlist class, and the frosted-effect edge case. Every later task mirrors these moves.

**Files:**

- Modify: `apps/pwa/src/components/layout/mobile-bottom-nav.tsx`

- [ ] **Step 1: Read the file** in full and confirm the current shape matches the "before" below.

**Before:**

```tsx
import { Link, useRouterState } from "@tanstack/react-router";
import {
  Home,
  CalendarDays,
  CheckSquare,
  Target,
  BookOpen,
} from "lucide-react";
import { cn } from "@/lib/utils";

const bottomNavItems = [
  { href: "/app", label: "Home", icon: Home },
  { href: "/calendar", label: "Calendar", icon: CalendarDays },
  { href: "/todos", label: "Todos", icon: CheckSquare },
  { href: "/habits", label: "Habits", icon: Target },
  { href: "/journal", label: "Journal", icon: BookOpen },
];

export function MobileBottomNav() {
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  return (
    <nav className="fixed bottom-0 left-0 right-0 z-40 border-t border-border bg-background/95 backdrop-blur-sm safe-area-bottom-nav md:hidden">
      <div className="flex h-14 items-center justify-around">
        {bottomNavItems.map((item) => {
          const isActive =
            item.href === "/app"
              ? pathname === "/app"
              : pathname === item.href || pathname.startsWith(item.href + "/");
          const Icon = item.icon;
          return (
            <Link
              key={item.href}
              to={item.href}
              className={cn(
                "flex flex-col items-center gap-0.5 px-3 py-1.5 text-[10px] font-medium transition-colors",
                isActive
                  ? "text-primary"
                  : "text-muted-foreground active:text-foreground",
              )}
            >
              <Icon className="size-5" strokeWidth={isActive ? 2.5 : 2} />
              {item.label}
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
```

- [ ] **Step 2: Apply the conversion.** Replace the whole component body with:

**After:**

```tsx
import { Link, useRouterState } from "@tanstack/react-router";
import {
  Home,
  CalendarDays,
  CheckSquare,
  Target,
  BookOpen,
} from "lucide-react";
import { XStack, YStack, Text } from "@stageholder/ui";

const bottomNavItems = [
  { href: "/app", label: "Home", icon: Home },
  { href: "/calendar", label: "Calendar", icon: CalendarDays },
  { href: "/todos", label: "Todos", icon: CheckSquare },
  { href: "/habits", label: "Habits", icon: Target },
  { href: "/journal", label: "Journal", icon: BookOpen },
];

export function MobileBottomNav() {
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  return (
    <XStack
      tag="nav"
      // Tamagui's position type omits web values; cast as the kit's Header does.
      position={"fixed" as never}
      b={0}
      l={0}
      r={0}
      z={40}
      height={56}
      items="center"
      justify="space-around"
      borderTopWidth={1}
      borderColor="$borderColor"
      bg="$background"
      // allowlist: env safe-area inset + frosted-glass effect (no token equiv)
      className="safe-area-bottom-nav backdrop-blur-sm"
      // responsive: hidden at md+ (Tailwind md = 768 = Tamagui $md)
      $md={{ display: "none" }}
    >
      {bottomNavItems.map((item) => {
        const isActive =
          item.href === "/app"
            ? pathname === "/app"
            : pathname === item.href || pathname.startsWith(item.href + "/");
        const Icon = item.icon;
        return (
          <Link
            key={item.href}
            to={item.href}
            style={{ textDecoration: "none" }}
          >
            <YStack
              items="center"
              justify="center"
              gap="$0.5"
              px="$3"
              py="$1.5"
              transition="quick"
            >
              <Icon size={20} strokeWidth={isActive ? 2.5 : 2} />
              <Text
                fontSize={10}
                fontWeight="500"
                color={isActive ? "$primary" : "$mutedForeground"}
              >
                {item.label}
              </Text>
            </YStack>
          </Link>
        );
      })}
    </XStack>
  );
}
```

**Conversion notes (why each move):**

- `<nav className="fixed …">` → `XStack tag="nav" position={"fixed" as never} b/l/r={0} z={40}`. `fixed` is web-only; Tamagui's TS type omits it so cast `as never` (matches the kit's `Header.tsx`).
- `border-t border-border` → `borderTopWidth={1} borderColor="$borderColor"`.
- `bg-background/95 backdrop-blur-sm` → `bg="$background"` + keep `backdrop-blur-sm` as an allowlist effect class (the frosted bar is load-bearing). The `/95` translucency is dropped; if the user wants it back at verification, switch `bg` to a translucent value.
- `safe-area-bottom-nav` → kept (env-inset allowlist).
- `md:hidden` → `$md={{ display: "none" }}` (1:1 breakpoint).
- inner `<div className="flex …">` → `XStack` props folded into the `<nav>` element (it was the only child wrapping the row) — note the row alignment moved up to the `XStack`.
- `h-14` (56px) → `height={56}` raw (no clean space token at 56).
- `<Link className={cn(...)}>` → `<Link>` kept for routing, styling moved to inner `YStack`; the active/inactive `cn()` ternary becomes a `color` ternary on `<Text>`.
- `gap-0.5/px-3/py-1.5` → `gap="$0.5"/px="$3"/py="$1.5"`. `text-[10px]` → `fontSize={10}`. `font-medium` → `fontWeight="500"`. `transition-colors` → `transition="quick"`. `active:text-foreground` is folded into the color ternary (press feedback is subtle here; if needed, add `pressStyle={{ color: "$color" }}` on the `Text`).
- `lucide-react` `<Icon className="size-5">` → `size={20}` prop (lucide accepts numeric `size`). The icon is decorative; no token needed.
- `cn` import removed (now unused).

- [ ] **Step 3: Manual verification checkpoint.** User opens port 4001 on a narrow viewport (or DevTools mobile emulation), confirms: bar pins to bottom on scroll, 5 tabs evenly spaced, active tab is primary-colored, bar hides at ≥768px, frosted blur still reads, light + dark both correct.

---

## Tasks 2–N: Batch conversions

Each batch below is a task. For every file in a batch, the executor: (1) reads the file fully, (2) applies the contract exactly as demonstrated in Task 1, (3) preserves listed allowlist classes, (4) respects exclusions, then (5) the user verifies the listed screen(s). **Do not** write per-file before/after in this plan — the file contents are read at execution time and the contract is mechanical; pre-writing diffs for unread files would be guessing.

Each batch task carries: the file list, known per-file gotchas (from exploration), the allowlist classes present, and the verification surface.

---

### Task 2: Batch 1 — Layout shell

**Files (modify):**

- `apps/pwa/src/components/layout/app-shell.tsx`
- `apps/pwa/src/components/layout/local-user-button.tsx`
- `apps/pwa/src/components/shared/auth-shell.tsx`

(`mobile-bottom-nav.tsx` already done in Task 1.)

**Known gotchas:**

- `app-shell.tsx` is already half-migrated (top bar uses `XStack/View/Text`). Remaining raw HTML: the `<main className="flex-1 …">` content wrapper → `View tag="main" flex={1} overflow="hidden"` + the safe-area padding stays via `className`; the journey-progress popover (`<button className="group …">` + inline SVG + `group-hover:opacity-40`) → `group` prop + `$group-hover`, but **keep the inline `<svg>` and gradient `style` blocks** (viz, per exclusions); the `SidebarBrand` `<div className={cn("flex …")}>` → `XStack` with conditional `justify`.
- `<kbd>` shortcut chips (rendered in `Sidebar.MenuButton` `trailing`) → `Text` with mono font + `bg="$sidebarAccent"` `borderColor="$sidebarBorder"`. There is no `Kbd`-styling requirement, but the kit exports `Kbd` — prefer `Kbd` from `@stageholder/ui` for these.
- Preserve `safe-area-top` on the outer shell wrapper.

**Verify:** Whole app chrome — sidebar (expanded + collapsed/icon rail), top bar actions, page-title, journey popover hover glow, user menu, in light + dark, web + (if available) the Tauri desktop window (traffic-light spacer).

---

### Task 3: Batch 2 — Route scaffolding

**Files (modify):** every `*.tsx` under

- `apps/pwa/src/routes/_app/` (index, calendar, todos, habits, journal, settings subtree, journey, etc.)
- `apps/pwa/src/routes/_auth/`

**Known gotchas:**

- Route pages are mostly grid/stack wrappers around feature components, e.g. `routes/_app/index.tsx` `<div className="grid grid-cols-1 gap-4 p-4 md:grid-cols-2 lg:grid-cols-12 lg:p-6">`. Convert the responsive grid with the kit `Grid` + media props, or `display="grid"` + `$md/$lg` overrides for `gridTemplateColumns`. Confirm column behavior at sm/md/lg during verify.
- `routes/_app/habits/index.tsx` already imports `DatePicker` from the kit (currently open in the user's editor) — only its surrounding `<div>` layout needs converting; leave the `DatePicker` usage intact.
- Page content max-width wrappers (`mx-auto w-full max-w-5xl px-4`) → `View width="100%" maxW={1024} mx="auto" px="$4"` (or kit `Container`).

**Verify:** Each route renders with correct page padding, max-width centering, and responsive grid reflow at 640/768/1024 breakpoints; light + dark.

---

### Task 4: Batch 3 — Shared components

**Files (modify):** `apps/pwa/src/components/shared/*.tsx` — except already-clean leaves. Includes `offline-indicator`, `command-palette`, `shortcuts-dialog`, `feedback-button`, `meridian-logo`, `update-checker`, `daily-target-rings` (structure-only — see exclusions), `sync-conflict-toast`, `command-palette`.

**Known gotchas:**

- `daily-target-rings.tsx` is a viz exclusion — convert only its outer wrapper, leave the SVG rings + `--ring-*` vars.
- `command-palette` / `shortcuts-dialog` likely wrap kit `Dialog`/`CommandMenu` — convert the internal `<div>` layout to `YStack/XStack`, keep the kit component shells.

**Verify:** Command palette (⌘K), shortcuts dialog (?), offline indicator state, feedback button, update toast; light + dark.

---

### Task 5: Batch 4 — Onboarding

**Files (modify):** `apps/pwa/src/components/onboarding/*.tsx` (all steps).

**Known gotchas:** Card/form layouts with Tailwind. Forms use kit `Input`/`Button`/`Label` already in places — convert the surrounding `<div>` structure and any `auth-animate`/stagger classes stay (allowlist).

**Verify:** Full onboarding flow step-by-step; light + dark.

---

### Task 6: Batch 5 — Todos

**Files (modify):** `apps/pwa/src/components/todos/*.tsx` (highest className density — ~236).

**Known gotchas:**

- `create-todo-dialog.tsx` / `todo-detail-dialog.tsx` already import kit `DatePicker`/`Button`/`Input` — convert remaining `<div>`/`<label>`/`<p>` structure only.
- `todo-item.tsx` priority/status badges: intent colors → `theme="destructive|warning|success"` or `Badge` from the kit; `bg-red-100 dark:bg-red-900/30` patterns → nearest intent `*Muted` token.
- Keep `todo-item-completing`, `todo-check-*`, `ember-particle` animation classes (allowlist).

**Verify:** Todo list, create dialog, detail dialog, complete-with-incinerate animation, overdue styling; light + dark.

---

### Task 7: Batch 6 — Habits

**Files (modify):** `apps/pwa/src/components/habits/*.tsx`.

**Known gotchas:** `habit-card.tsx` completion radiance uses `habit-ray/spark/center-glow/card-completing` classes — keep (allowlist). `create-habit-dialog.tsx` is form layout. Activity-ring visuals inside cards are exclusions (structure-only).

**Verify:** Habits page, habit card states, completion animation, create dialog; light + dark.

---

### Task 8: Batch 7 — Journal

**Files (modify):** `apps/pwa/src/components/journal/*.tsx`.

**Known gotchas:**

- `journal-sidebar.tsx` already imports kit `DatePicker`/`Select`/`Button` — convert remaining `<div>` filters/layout.
- The editor uses the kit `RichTextEditor`; the `.journal-editor-body` CSS hooks in `globals.css` stay. Celebration classes (`journal-*`) are allowlist.

**Verify:** Journal list/sidebar, date filters, editor surface, celebration effects on target hit; light + dark.

---

### Task 9: Batch 8 — Dashboard

**Files (modify):** `apps/pwa/src/components/dashboard/*.tsx` and `dashboard/charts/*.tsx` (charts = structure-only per exclusions).

**Known gotchas:** `bento-card.tsx` uses the `bento-enter` keyframe (`opacity:0; translateY(12px)`) — convert to Tamagui native `enterStyle={{ opacity: 0, y: 12 }}` + `transition="medium"` (with `transition={["medium",{delay}]}` if it staggers), NOT a kept className. Chart wrappers: convert the card/title `<div>` chrome, leave recharts internals; `animate-spin` loading spinners stay as className.

**Verify:** Dashboard bento grid, greeting bar, each chart card renders + animates in; light + dark.

---

### Task 10: Batch 9 — Billing

**Files (modify):** `apps/pwa/src/components/billing/*.tsx` (~194 classNames).

**Known gotchas:** Heavy `billing-reveal`/`billing-stagger-*`/`billing-paper`/`orbit-*`/`paywall-*` animation + texture classes — all allowlist, keep. `comparison-sheet.tsx` is a table → prefer the kit `Table`; convert hero/plan-card layout to stacks/`Grid`.

**Verify:** Plans page, comparison sheet, paywall modal, trial pill, reveal animations; light + dark.

---

### Task 11: Batch 10 — Remainder

**Files (modify):** `*.tsx` under `apps/pwa/src/components/`:

- `calendar/` (except `calendar-cell` if pure leaf — convert wrapper only)
- `settings/`
- `encryption/` (`passphrase-prompt.tsx` — uses kit `Dialog`)
- `light/` (structure-only for `star-visual`, `journey-tier-map`, `journey-feed`)
- `providers/`

**Known gotchas:** `light/*` viz exclusions — wrappers only. `settings/*` are form/section layouts. `encryption/passphrase-prompt` wraps kit `Dialog`.

**Verify:** Calendar view, settings tabs (incl. billing tab), encryption passphrase prompt, journey page/feed; light + dark.

---

### Task 12: Final pass

**Files:** none (verification only).

- [ ] **Step 1:** Grep for stragglers across `apps/pwa/src`:
  - `className=` occurrences → confirm each remaining one is on the allowlist (animations, `safe-area-*`, `scrollbar-hide`, `backdrop-blur-*`, or SDK).
  - raw `<div`/`<span`/`<p`/`<main`/`<section` in converted files → none should remain outside the documented exceptions.
  - leftover `cn(` calls and `from "@/lib/utils"` `cn` imports that are now unused.
  - `onClick`/`onMouseEnter`/`hover:`/`active:`/`group-hover:` literals on converted elements.
- [ ] **Step 2:** User runs `cd apps/pwa && bun run check` (`tsr generate && tsc --noEmit`) and fixes any type errors surfaced (e.g. invalid prop names, wrong token strings).
- [ ] **Step 3:** User does a full visual pass of every screen in light + dark, comparing against pre-migration screenshots if available.

---

## Self-Review

**Spec coverage:** Every spec section maps to a task — contract (referenced in header + Task 1), allowlist (carried per batch), exclusions (called out in Tasks 4/7/8/9/11), batching 0–10 (Tasks 1–11), verification (per-task checkpoints + Task 12). ✔

**Placeholder scan:** No "TBD"/"implement later". The only intentional non-diff content is Tasks 2–11, which is a deliberate, stated choice (files read at execution time; pre-writing diffs for unread files would be guessing — explicitly justified). Task 1 carries full before/after code. ✔

**Type/name consistency:** Token names, shorthands, and breakpoints used in Task 1 match the spec's verified tables. No invented props (`f`/`w`/`h`/`space` explicitly excluded). ✔

**Note on granularity:** This plan deliberately diverges from the skill's "complete code in every step" for Tasks 2–11. Reproducing before/after for ~110 unread files would be speculative (the user's explicit anti-hallucination directive) and is itself the over-engineering the user warned against. The mechanical contract + a fully-worked Task 1 + read-then-convert-per-file is the grounded approach. Each batch is independently verifiable, satisfying "working software per task."
