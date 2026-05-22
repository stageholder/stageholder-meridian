# PWA shadcn/Tailwind → Tamagui Migration Design

**Date:** 2026-05-22
**Status:** Draft, pending user review
**Scope:** `apps/pwa` only (the Vite + TanStack Router PWA). No changes to `@stageholder/ui`, the API, mobile, or desktop wrappers.

## Context

`apps/pwa` is mid-migration from shadcn/ui + Tailwind to Tamagui v2 via the
published `@stageholder/ui` kit. The infrastructure is already in place:

- `TamaguiProvider` + a `next-themes`→Tamagui `<Theme>` bridge in `src/App.tsx`.
- `tamagui.config.ts` consumes tokens/fonts/themes from `@stageholder/ui/config`
  (the kit is the canonical source of truth for the palette and scales).
- `@tamagui/vite-plugin` configured in `vite.config.ts` (with `disableExtraction: true`).
- Primitives (Button, Input, Select, DatePicker, Sidebar, Header, etc.) are
  largely migrated.

What remains is the **structural layer**: ~1,306 `className=` occurrences across
~113 files still author layout and color with Tailwind on raw HTML
(`<div className="flex …">`, `<main>`, `<span>`, `<p>`, grids). Even partially
migrated files (e.g. `app-shell.tsx`) mix Tamagui primitives with raw HTML +
Tailwind. A code comment in `app-shell.tsx:275` documents the concrete failure
mode this causes: _plain HTML inside an RN-Web `View` doesn't reliably pick up
Tailwind flex utilities_, which produced layout bugs. Converting structure to
Tamagui primitives removes that whole class of bug.

## Goals

- Convert all **app-owned JSX** in `apps/pwa/src` from raw HTML + Tailwind to
  Tamagui primitives from `@stageholder/ui` + kit tokens.
- Move layout, spacing, radius, color, and typography from Tailwind classes to
  Tamagui style props/tokens.
- Strip `className` down to a small, documented **functional allowlist**
  (animation hooks, env safe-areas, scrollbar) — everything else becomes props.
- Stay grounded in the kit's own authoring patterns (e.g. `EmptyState.tsx`) and
  the `tamagui-v2-guide`. No invented props, no speculative abstractions.

## Non-Goals

- **Pixel-identical parity.** Approved trade-offs (see Decisions): colors retune
  onto the kit's azure palette; spacing drifts sub-2px under nominal mapping.
- Converting bespoke CSS keyframe animations to Tamagui animations. They stay as
  `className` hooks against `globals.css` (separate, larger effort).
- Removing Tailwind from the build. It stays installed because
  `@stageholder/sdk/styles.css` ships prebuilt components that depend on it.
- Touching `@stageholder/ui`, mobile, desktop, or API code.
- Automated tests or build/typecheck runs during implementation — verification is
  manual per project norms; the user runs `tsr generate && tsc --noEmit` at the end.
- Refactoring component logic, data flow, or behavior. This is a presentation-layer
  conversion only.

## Decisions (locked with user)

1. **Depth:** Structure **+** theme tokens (not structure-only).
2. **Breadth:** All ~113 files (full sweep), sequenced in verifiable batches.
3. **className policy:** Strip fully, except the functional allowlist (§4).
4. **Color fidelity:** Adopt the kit palette as-is (accept the hue 210→240 shift).
   The kit is the source of truth; future kit color updates flow through.
5. **Spacing fidelity:** Nominal mapping `gap-N → $N` (matches the already-migrated
   `app-shell.tsx`), accepting sub-2px drift.

## The Conversion Contract

Every file follows this identically. All values below are **verified** against
`@tamagui/config/v5` (rc.42) and `@stageholder/ui` source, not assumed.

### Shorthand vocabulary (verified — the only 33 that exist)

```
bg→backgroundColor  items→alignItems  justify→justifyContent  content→alignContent
self→alignSelf  shrink→flexShrink  grow→flexGrow  rounded→borderRadius
p→padding px py pt pb pl pr   m→margin mx my mt mb ml mr
t→top b→bottom l→left r→right  z→zIndex  text→textAlign  select→userSelect
maxW→maxWidth minW→minWidth maxH→maxHeight minH→minHeight
```

Use real prop names where no shorthand exists: `flex`, `flexDirection`,
`flexWrap`, `gap`, `width`, `height`, `position`, `overflow`, `display`,
`borderWidth`, `borderColor`, `fontSize`, `fontWeight`, `color`, `lineHeight`,
`letterSpacing`.

> **Do not use** `f` (no flex shorthand), `w`/`h` (no width/height shorthand),
> or `space` (deprecated — use `gap`). These are common hallucinations.

### Structure → primitive

| Raw HTML / Tailwind                           | Tamagui                                                                                                                                                                                                |
| --------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `<div className="flex …">`                    | `<XStack>`                                                                                                                                                                                             |
| `<div className="flex flex-col …">`           | `<YStack>`                                                                                                                                                                                             |
| plain block `<div>`                           | `<View>` (or `<YStack>` if it stacks children)                                                                                                                                                         |
| `<main>/<section>/<header>/<nav>/<aside>`     | primitive + `tag="main"` etc.                                                                                                                                                                          |
| `<span>` (inline text)                        | `<Text>`                                                                                                                                                                                               |
| `<p>`                                         | `<Paragraph>` (or `<Text>`)                                                                                                                                                                            |
| `<h1>`–`<h6>`                                 | `<H1>`–`<H6>`                                                                                                                                                                                          |
| `<div className="grid grid-cols-N gap-…">`    | `<Grid columns={N} gap="$…">`                                                                                                                                                                          |
| divider `<div className="border-t">` / `<hr>` | `<Separator>`                                                                                                                                                                                          |
| absolute-positioned overlay stack             | `<ZStack>` or `position="absolute"`                                                                                                                                                                    |
| TanStack `<Link>` with `className`            | keep `<Link>` for routing; move styling to an inner Tamagui primitive (wrap), or use a primitive with `asChild`. Do **not** replace `<Link>` with `onPress`-only — that loses middle-click + prefetch. |

`position: fixed`/`sticky` are web-only and **Tamagui's TS type omits them** —
cast as the kit's own `Header.tsx` does: `position={"fixed" as never}`. They pass
through to CSS on web; verify the element still pins on scroll during the check.

Press/hover handlers go directly on the primitive (`onPress`, `hoverStyle`,
`pressStyle`) — no `Pressable`/`<button>` wrapper needed (per `props.md`).

### Spacing — nominal `$N`, space scale (verified px)

`$0=0 · $0.5=1 · $1=2 · $1.5=4 · $2=7 · $2.5=10 · $3=13 · $3.5=16 · $4=18 ·
$4.5=21 · $5=24 · $6=32 · $7=39 · $8=46 · $9=53 · $10=60`

Mapping: Tailwind `gap-3`→`gap="$3"`, `p-4`→`p="$4"`, `gap-1.5`→`gap="$1.5"`,
`px-2`→`px="$2"`. Arbitrary values not on the scale (`gap-[6px]`) → raw number
(`gap={6}`).

> **Nominal mapping only holds for small spacing** (drift stays sub-2px through
> ~`$5`). The scale is non-linear and diverges fast above that: Tailwind `-8`
> (32px) is `$6` (32px), **not** `$8` (46px); `-10` (40px) is `$10` (60px) under
> nominal — wrong by 20px. For any value ≥ `gap-6`/`p-6`, or for positional
> offsets (`top-/bottom-/left-/right-`), pick the token **closest in px** (or a
> raw number), not the same-numbered token. Quick refs: 32px→`$6`, 40px→`$10` is
> wrong (use `{40}`), 24px→`$5`, 16px→`$3.5` (or `$4`=18).

### Radius (verified px)

`$0=0 · $1=3 · $2=5 · $3=7 · $4=9 · $true=9 · $5=10 · $6=16` and named
`$sm=6 · $md=8 · $lg=10 · $icon=8`.

Mapping: `rounded-sm`→`rounded="$sm"`, `rounded-md`→`rounded="$md"`,
`rounded-lg`→`rounded="$lg"`, `rounded-full`→`rounded={9999}`,
`rounded-[Npx]`→`rounded={N}`.

### Color — Tailwind semantic class → kit theme token

| Tailwind                                                                                 | Token                                                                       |
| ---------------------------------------------------------------------------------------- | --------------------------------------------------------------------------- |
| `text-foreground`                                                                        | `color="$color"`                                                            |
| `text-muted-foreground`                                                                  | `color="$mutedForeground"`                                                  |
| `bg-background`                                                                          | `bg="$background"`                                                          |
| `bg-card` / `text-card-foreground`                                                       | `bg="$card"` / `color="$cardForeground"`                                    |
| `bg-popover` / `text-popover-foreground`                                                 | `$popover` / `$popoverForeground`                                           |
| `bg-muted`                                                                               | `bg="$muted"`                                                               |
| `bg-accent` / `text-accent-foreground`                                                   | `bg="$accent"` / `color="$accentForeground"`                                |
| `bg-secondary` / `text-secondary-foreground`                                             | `$secondary` / `$secondaryForeground`                                       |
| `bg-primary` / `text-primary` / `text-primary-foreground`                                | `$primary` / `$primaryForeground`                                           |
| `border-border` / default border                                                         | `borderColor="$borderColor"`                                                |
| divider weight (`border-…` on `<hr>`-likes)                                              | `$separator` (via `Separator`)                                              |
| `text-destructive` / `bg-destructive`                                                    | `$destructive` / `$destructiveForeground`, or wrap in `theme="destructive"` |
| success / warning / info surfaces                                                        | `theme="success" \| "warning" \| "info"` sub-themes                         |
| `bg-sidebar` / `text-sidebar-foreground` / `border-sidebar-border` / `bg-sidebar-accent` | `$sidebar` / `$sidebarForeground` / `$sidebarBorder` / `$sidebarAccent`     |
| chart series colors                                                                      | `$chart1`–`$chart5`                                                         |
| input fill / focus ring / placeholder                                                    | `$inputBackground` / `$outlineColor` / `$placeholderColor`                  |
| hover/press/focus ladders                                                                | `$backgroundHover` / `$backgroundPress` / `$colorHover` etc.                |

For intent-colored surfaces (danger/success rows, badges), prefer the kit's
sub-theme pattern (`<View theme="destructive">`) over hardcoding each key — this
mirrors how the kit authors `themes.ts`. Opacity tints (`bg-destructive/10`) map
to the `$destructiveMuted` / `$successMuted` / `$warningMuted` / `$infoMuted`
tokens.

### Typography — **font size scale (distinct from spacing)**

Body `fontSize` token px (verified): `$1=12 · $2=13 · $3=14 · $4=15 · $5=16 ·
$6=18 · $7=22 · $8=26 · $9=30`.

| Tailwind                    | Tamagui                                  |
| --------------------------- | ---------------------------------------- |
| `text-xs` (12)              | `fontSize="$1"`                          |
| `text-sm` (14)              | `fontSize="$3"`                          |
| `text-base` (16)            | `fontSize="$5"`                          |
| `text-lg` (18)              | `fontSize="$6"`                          |
| `text-xl` (20)              | `fontSize="$7"` (22; or `fontSize={20}`) |
| `text-[Npx]`                | `fontSize={N}`                           |
| `font-medium/semibold/bold` | `fontWeight="500"/"600"/"700"`           |
| `leading-*` / `tracking-*`  | `lineHeight` / `letterSpacing`           |
| `text-center/right`         | `text="center"/"right"`                  |

> The token **number differs by category**: `fontSize="$3"`=14px but
> `gap="$3"`=13px. Always pick the value from the right scale.

### Responsive — Tailwind breakpoints map 1:1 (verified)

Active media (from `defaultConfig` v5, Tailwind-aligned): `sm`=640, `md`=768,
`lg`=1024, `xl`=1280, plus `xs`=460, `xxs`=340 and `max-*` variants.

- `sm:flex` / `md:block` → media prop: `$sm={{ display: 'flex' }}`,
  `$md={{ display: 'block' }}`.
- `hidden md:flex` → `display="none" $md={{ display: 'flex' }}`.
- Or use the kit helpers: `<Show above="md">…</Show>`, `<Hide below="md">…</Hide>`,
  `<ResponsiveStack rowAt="sm">` for column→row stacks.
- Responsive grid (`grid-cols-1 md:grid-cols-2 lg:grid-cols-12`): use
  `<Grid>` with `minColumnWidth` (auto-fit) where the intent is "fit as many as
  fit," or media props on `columns` where exact counts matter.

### Interaction states, events & groups (grounded in `props.md`)

Tamagui Views are Pressable by default and carry interaction _style props_ — these
replace Tailwind's pseudo-class variants and DOM event handlers. Verified against
`props.md` and the kit's `defaultProps`.

**Pseudo-class variants → style props:**

| Tailwind                               | Tamagui                                                                                                                                                                                                                                                                                                |
| -------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `hover:bg-accent`                      | `hoverStyle={{ bg: '$accent' }}`                                                                                                                                                                                                                                                                       |
| `active:opacity-80`                    | `pressStyle={{ opacity: 0.8 }}`                                                                                                                                                                                                                                                                        |
| `focus:…` / `focus-visible:…`          | `focusStyle={{ … }}` / `focusVisibleStyle={{ … }}`                                                                                                                                                                                                                                                     |
| `disabled:…`                           | `disabledStyle={{ … }}` (+ the `disabled` prop)                                                                                                                                                                                                                                                        |
| `transition-colors` / `transition-all` | `transition="quick"` — **the prop is `transition`, NOT `animation`** (v1→v2 rename; `animation=` is a type error / wrong API). Verified keys: `quick`, `quicker`, `bouncy`, `lazy`, `medium`, `slow`, or duration keys `0ms`–`500ms`. Exact ms off-scale snap to nearest; `duration-700` has no token. |

**Events (prefer cross-platform — the kit ships a mobile app):**

| DOM (web-only)                       | Tamagui (cross-platform)                             |
| ------------------------------------ | ---------------------------------------------------- |
| `<button onClick>` / `<div onClick>` | primitive + `onPress` (no `<button>` wrapper needed) |
| `onMouseEnter` / `onMouseLeave`      | `onHoverIn` / `onHoverOut`                           |
| `onFocus` / `onBlur`                 | `onFocus` / `onBlur` (same)                          |

Web-only handlers (`onKeyDown`, `onWheel`, `onScroll`, clipboard, drag) remain
valid and pass through unchanged when genuinely web-specific.

**`group` (Tailwind `group` / `group-hover:`):** mark the parent with `group`
(or a named `group="card"`), then style descendants by parent state:
`$group-hover={{ … }}` (unnamed) or `$group-card-hover={{ … }}` (named). This is
the direct replacement for the journey-progress popover in `app-shell.tsx`
(`className="group …"` + `group-hover:opacity-40`).

**Prop caveats from `props.md`:**

- `className` is a documented, compiler-friendly escape hatch (it concatenates
  with generated classes) — this is _why_ the allowlist (§4) is safe.
- `tag="main"` works because this app uses the **CSS animation driver**
  (`@tamagui/config/v5-css`); for pure semantics/a11y, `role` is the portable
  alternative.
- `asChild` merges event handlers into the single child. Preserve existing
  `asChild` triggers (Popover/DropdownMenu) and do **not** add a manual `onPress`
  to the slotted child — the parent trigger owns the handler.

**Two systematic gotchas (verified against `tsc`):**

- **`text`/`textAlign` is Text-only.** It is a valid prop on `Text`/`Paragraph`/
  `H1`–`H6`, but a **type error on `View`/`XStack`/`YStack`** ("Type 'string' is
  not assignable to type 'undefined'"). To center a block's text, put `text=` on
  the text elements themselves, not the container. (`items="center"` centers the
  block on the cross axis; it does not align text.)
- **Kit `Button` is NOT a polymorphic anchor** — it has no `tag`/`href` prop
  (those error). For an internal route, wrap: `<Link to="…" style={{
textDecoration: "none" }}><Button>…</Button></Link>`. For an external/`_blank`
  URL, wrap with a native `<a href target rel style={{textDecoration:"none"}}>`.
  Note: the bare primitives `Text`/`View` **do** accept `tag="a"` + `href` and
  render a real anchor — that's the right tool for a plain text link.
- **Strict color typing — only `$tokens`, not arbitrary color strings.** A raw
  CSS color (`"oklch(…)"`, `"#fff"`, `"rgb(…)"`) or a value typed as plain
  `string` is **rejected** by `color`/`bg`/`borderColor` props. Options: (a) use a
  `$token`; (b) for a value with no token (brand-adjacent one-offs, animation
  flashes), use the `style={{ color: … }}` / `style={{ backgroundColor: … }}`
  escape hatch; (c) for a lookup map, declare it `as const` with valid `$token`
  literals (a `Record<string, {bg: string}>` widens to `string` and errors —
  drop the annotation, use `as const`). To color a lucide/SVG icon by theme, wrap
  it in `<Text color="$token">` (SVG inherits via `currentColor`); icons cannot
  read `$tokens` directly.
- **Prefer style shorthands over longhands.** Longhands that have a shorthand
  (`minWidth`/`maxWidth`/`minHeight`/`maxHeight`/`flexShrink`/`flexGrow`,
  `backgroundColor`, `alignItems`, …) can fail type resolution on nested Tamagui
  primitives ("Property 'minWidth' does not exist"). Always use the shorthand on
  primitives: `minW`/`maxW`/`minH`/`maxH`/`shrink`/`grow`/`bg`/`items`. **Caveat:**
  this is for Tamagui PRIMITIVES only — kit components can define custom props that
  happen to share a longhand name (e.g. `RichTextEditor` takes `minHeight`); don't
  blanket-rename props on kit components.
- **Type errors cascade up the JSX tree.** An invalid child prop (e.g. `color` on
  a stack) makes TS blame an _innocent_ prop on the parent (e.g. `minWidth`/`flex`).
  Fix the real (usually leaf) error first, then re-check — the parent errors often
  vanish.

### Animations — use Tamagui v2 native (grounded in `animations.md`)

We are on Tamagui v2 with the CSS driver (`@tamagui/config/v5-css`). **Do not keep
Tailwind mount/enter animations as classes** — express them natively. The prop is
`transition` (NOT `animation` — that's the v1 name and errors).

| Tailwind / shadcn                                 | Tamagui v2 native                                                                                                                      |
| ------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------- |
| `animate-in fade-in` (mount fade)                 | `enterStyle={{ opacity: 0 }}` + `transition="medium"`                                                                                  |
| `animate-in slide-in-from-bottom`                 | `enterStyle={{ opacity: 0, y: 20 }}` + `transition="medium"`                                                                           |
| `zoom-in-95` (mount scale)                        | `enterStyle={{ opacity: 0, scale: 0.95 }}` + `transition="quick"`                                                                      |
| staggered list (inline `animationDelay: i*100`)   | `transition={["medium", { delay: i * 100 }]}` + `enterStyle`                                                                           |
| `data-[state=closed]:animate-out fade-out` (exit) | `exitStyle={{ opacity: 0 }}` inside `<AnimatePresence>` (or rely on the kit Dialog/Sheet's built-in enter/exit, which already animate) |
| hover/press transitions                           | `hoverStyle`/`pressStyle` + (optional) `transition` (see Interaction states)                                                           |

Rules from `animations.md`: if you set `transition`, **always keep the prop**
present (pass `null`/`false` to disable, never conditionally spread it). Per-prop
control via `transition={{ x: 'bouncy' }}`; default + overrides via
`transition={['bouncy', { y: 'slow' }]}`.

**Keep as `className` only** the continuous/bespoke keyframes listed in the
allowlist (spinners, skeleton pulse, particle/celebration sequences). For a custom
modal that used Radix `data-[state]:animate-*` overlay classes, prefer the kit
`Dialog`/`Sheet` (their overlays/content already animate via `transition`) over
re-implementing the data-state classes.

### `cn()` / clsx

After conversion an element has no `className` (or only an allowlist class), so
`cn(...)` calls collapse to either nothing or a single static string. Remove the
`cn` import where it becomes unused. Conditional styling moves to conditional
props (`color={isActive ? '$color' : '$mutedForeground'}`) or `theme=`.

## className Allowlist — what stays (and why)

These hook CSS that Tamagui tokens cannot express. They remain as `className`
(or inline `style` for CSS-var-driven values), even under "strip fully":

- **Animation hooks** (keyframes in `globals.css`): `auth-animate`,
  `auth-stagger-1..8`, `auth-error`, `auth-showcase-grid`, `todo-item-completing`,
  `todo-check-draw/pop/ring`, `ember-particle`, `journal-*` (spark/ember/fire-edge/
  celebration-flash/shimmer/banner/target-glow), `habit-ray/spark/center-glow/
card-completing`, `billing-reveal`, `billing-stagger-1..6`, `billing-paper`,
  `orbit-arc/point/thread`, `paywall-boundary/pulse-ring`, confetti classes.
- **Continuous / bespoke keyframes only** (`globals.css` + `tw-animate-css`):
  `animate-spin` (loading spinners), `animate-pulse` (skeletons), and the bespoke
  particle/celebration keyframes (`ember-*`, `*-spark`, `todo-incinerate`,
  `journal-*` celebration, `habit-*`, `orbit-*`, `paywall-*`, `billing-paper`,
  shimmer text-clip). These have no practical Tamagui-config equivalent — KEEP
  them as `className`. **But mount/enter/exit animations do NOT belong here** —
  see the Animations section: convert those to native `enterStyle`/`transition`.
- **Env / viewport CSS**: `safe-area-top`, `safe-area-bottom`,
  `safe-area-bottom-nav`, `scrollbar-hide`.
- **CSS-var-driven particles**: inline `style={{ '--ember-dx': … }}` etc. stay
  inline (dynamic per-instance values, not tokens).
- **SDK-rendered markup**: anything emitted by `@stageholder/sdk` components is
  out of our control and untouched.
- **CSS-only visual effects with no token equivalent**: `backdrop-blur-*`
  (frosted glass) and `bg-{color}/{opacity}` translucency (e.g.
  `bg-background/95`). Two options per instance, decided at the batch's
  verification: (a) keep the effect class as an allowlist exception and set the
  base `bg` via token, or (b) drop the frost and use the opaque token. Default to
  (a) where the frosted look is load-bearing (e.g. the mobile nav bar), (b)
  otherwise. Flag each occurrence to the user rather than guessing.

The implementation plan will carry this as a literal allowlist so each batch
knows exactly which classes are intentional.

## Exclusions — leaf/visualization components

Convert only the **structural wrappers** of these; leave SVG/canvas internals and
viz-specific color vars (`--ring-todo/habit/journal` + `-track`) alone:

- `components/activity-rings/*`, `components/light/star-visual.tsx`,
  `components/shared/daily-target-rings.tsx`
- `components/dashboard/charts/*` (recharts)
- `components/light/journey-tier-map.tsx`

Rationale: these are SVG stroke/geometry, not layout. The `--ring-*` colors have
no kit-token equivalent and are correct as CSS vars on SVG strokes. No
`tamagui.config.ts` token additions are needed for this migration.

## Batching & Sequencing

~113 files is too large to verify in one pass, so work proceeds in
independently-verifiable batches, each ending at a screen the user can eyeball:

| #   | Batch        | Key files                                                                         |
| --- | ------------ | --------------------------------------------------------------------------------- |
| 0   | Infra        | This spec → implementation plan; no code yet                                      |
| 1   | Layout shell | `layout/app-shell`, `mobile-bottom-nav`, `local-user-button`, `shared/auth-shell` |
| 2   | Routes       | `routes/_app/*`, `routes/_auth/*` page scaffolding                                |
| 3   | Shared       | `components/shared/*`                                                             |
| 4   | Onboarding   | `components/onboarding/*`                                                         |
| 5   | Todos        | `components/todos/*`                                                              |
| 6   | Habits       | `components/habits/*`                                                             |
| 7   | Journal      | `components/journal/*`                                                            |
| 8   | Dashboard    | `components/dashboard/*` (wrappers; charts excluded per §5)                       |
| 9   | Billing      | `components/billing/*`                                                            |
| 10  | Remainder    | `calendar/`, `settings/`, `encryption/`, `light/`, `providers/`                   |

Each batch is internally consistent and references the §"Conversion Contract".
Order is chosen so the shared chrome (1–3) lands first, giving a stable frame to
verify feature batches against.

## Verification

- No builds/tests during implementation (project norm). After each batch the user
  visually verifies the affected screen(s) in `bun --filter pwa dev` (port 4001),
  in **both light and dark** (the palette retune is most visible here).
- After the final batch the user runs `tsr generate && tsc --noEmit` and a full
  visual pass.
- Per-batch self-check before handoff: (a) no remaining `className` outside the
  allowlist, (b) no `cn` import left unused, (c) no raw `<div>/<span>/<p>` left in
  converted files, (d) shorthands limited to the verified 33, (e) interaction
  styling moved to `hoverStyle`/`pressStyle`/`focusStyle` and events to
  `onPress`/`onHoverIn` (no leftover `onClick`/`onMouseEnter`/`hover:`/`active:`
  where a primitive now renders), (f) `group-hover:` converted to the `group`
  prop + `$group-hover`.

## Risks & Mitigations

- **Palette retune is global and visible.** Mitigation: verify each batch in light
  and dark; the shift is intended and uniform (kit tokens), not per-file drift.
- **`fontSize` vs `gap` scale confusion.** Mitigation: the contract calls it out
  explicitly; reviewers check the category.
- **Over-eager className stripping breaks animations.** Mitigation: the allowlist
  is explicit and carried into the plan; converted files keep allowlisted classes.
- **RN-Web flex quirks** when a raw HTML child remains inside a `View`.
  Mitigation: convert children fully within a file (no half-converted subtrees).
- **Volume → reviewer fatigue.** Mitigation: small batches, screen-by-screen
  verification, consistent mechanical rules so diffs are predictable.
