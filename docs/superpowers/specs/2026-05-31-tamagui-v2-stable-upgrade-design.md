# Tamagui v2.0.0 Stable Upgrade — PWA + Responsive Web

- **Date:** 2026-05-31
- **Status:** Approved design → ready for implementation plan
- **Scope owner:** Meridian PWA (`apps/pwa`) + shared (`packages/features`) + monorepo deps
- **Out of scope (deferred to future specs):** the mobile (`apps/mobile`) screen layer; full Tailwind removal + CSS-extraction flip

---

## 1. Context & current state (grounded)

Meridian is a Bun + Turborepo monorepo. The relevant facts established by recon:

- **`apps/pwa` is a Vite + TanStack Router SPA** (not Next.js), with **Tailwind v4 and Tamagui coexisting**. It currently pins Tamagui **`2.0.0-rc.42`** and consumes **`@stageholder/ui@^0.3.0-alpha.5`**. React 19.2.
- **`apps/mobile` is an Expo app with an EMPTY `app/` directory** — the screen/provider layer was removed in commit `d5f3089`. Only pure logic survives in `lib/` (TanStack Query hooks, auth, brand store). It pins Tamagui **`2.0.0-rc.41`**. **Deferred** in this pass except for dependency-graph consistency.
- **The kit `@stageholder/ui@0.3.0-alpha.6`** is built on **Tamagui `2.0.0` stable**. Its consumer contract requires peers: `tamagui ^2.0.0`, every `@tamagui/* ^2.0.0`, **`@tamagui/lucide-icons-2 ^2.0.0`** (used exclusively; the v1 `@tamagui/lucide-icons` is not used by the kit), **`@tamagui/toast ^2.0.0`**, and (native only) `react-native-reanimated >=3.10` + `react-native-gesture-handler >=2`.

What recon proved is **already done** (so it is NOT work in this spec):

- **v1→v2 dead-API sweep: 0 matches.** The consuming code already uses v2 idioms (`gap`, `boxShadow`, `transition`, `aria-*`, `items`/`justify`). No `animation=`, `space=`, `tag=`, `<Stack>`, `onHoverIn`, `accessibility*`, `ellipse`, `selectable`, `Tabs.Trigger`, camelCase media tokens, etc.
- **Local shadcn `ui/` wrappers: already deleted.** `apps/pwa/src/components/ui/` does not exist; all primitives come from `@stageholder/ui` (71 import sites).

The kit re-exports almost everything the app needs (`XStack`/`YStack`/`View`/`Text`/`Theme`/`TamaguiProvider`/`useMedia`/`AnimatePresence`/`Show`/`Hide`/`ResponsiveStack`, etc.). The **only** primitive the app needs that the kit does **not** export is **`Form`** (intentional gap → keep importing from `tamagui`).

## 2. Goals

1. Move the entire workspace from Tamagui `rc.41`/`rc.42` to **`2.0.0` stable**, and `@stageholder/ui` to **`^0.3.0-alpha.6`**, resolving to one coherent dependency graph.
2. Bring the PWA's Tamagui compiler/bundler config into line with the **v2 guide standard** where 2.0.0 stable makes the prior RC workarounds unnecessary — without breaking the React-19 + Tailwind-coexistence setup.
3. Modernize the PWA's **responsive (mobile-web)** behavior onto the kit's responsive primitives (`useMedia` / `Show` / `Hide` / `ResponsiveStack`), removing the hand-rolled `matchMedia` hook.
4. Close the small v5-default and cleanup gaps surfaced by recon.

## 3. Non-goals

- No mobile screens, Expo Router routes, native provider tree, or `@tamagui/native/setup-*` wiring (mobile UI is a separate future spec).
- No Tailwind removal or flipping `disableExtraction` to enable production CSS extraction.
- No git operations, no build/test runs on the assistant side (user verifies manually). No new automated tests.

## 4. Design — phased

### Phase 1 — Dependency upgrade to Tamagui 2.0.0 stable

| File                             | Change                                                                                                                                                                                                                                                                                                                                                                                                                            |
| -------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `package.json` (root)            | `resolutions` + `overrides`: every `@tamagui/*` + `tamagui` `2.0.0-rc.42` → `2.0.0`. Keep `react-native-web` at `0.21.2`. Keep the `@tamagui/react-native-web-lite` override at `2.0.0` for now (re-evaluated in Phase 2).                                                                                                                                                                                                        |
| `apps/pwa/package.json`          | `tamagui`, `@tamagui/config`, `@tamagui/lucide-icons-2`, `@tamagui/vite-plugin` → `2.0.0`. **Add `@tamagui/toast: "2.0.0"`** to dependencies (kit peer; currently only force-pinned via root overrides). `@stageholder/ui` → `^0.3.0-alpha.6`.                                                                                                                                                                                    |
| `packages/features/package.json` | devDependency `@stageholder/ui` → `^0.3.0-alpha.6` (peer stays `*`).                                                                                                                                                                                                                                                                                                                                                              |
| `apps/mobile/package.json`       | **Lockfile-consistency only, no UI work.** tamagui family `^2.0.0-rc.41` → `^2.0.0`; replace `@tamagui/lucide-icons` with `@tamagui/lucide-icons-2`; add `@tamagui/toast`; `@stageholder/ui` → `^0.3.0-alpha.6`. Rationale: prerelease ranges (`^2.0.0-rc.41`) do not auto-resolve to `2.0.0` stable, so leaving mobile on rc while overrides force `core`/`web` to stable would skew the `@tamagui` family in the install graph. |

**Verification gate:** user runs `bun install` and confirms a single, deduped 2.0.0 Tamagui family with no peer-dependency warnings from `@stageholder/ui`.

### Phase 2 — Align PWA compiler/config to the v2 guide (reversible, verification-gated)

The current `vite.config.ts` / `tamagui.build.ts` carry RC-era React-19 workarounds:

- a manual alias `@tamagui/react-native-web-lite → react-native-web` (rc.42's lite build imported `unmountComponentAtNode`, removed in React 19);
- `disableWatchTamaguiConfig: true` (the rc.42 static-worker hard-aliased lite → the broken build);
- `proxy-worm` stubs for native-only packages (`react-native-worklets`, `reanimated`, `gesture-handler`, `screens`).

Changes (each independently reversible):

1. **Try** replacing the manual lite alias with the guide-standard `tamaguiAliases({ rnwLite: true, svg: true })` from `@tamagui/vite-plugin` (per `tamagui-v2-guide/vite.md`). First confirm `tamaguiAliases` is exported at the installed 2.0.0 version.
2. **Try** dropping `disableWatchTamaguiConfig` (revert to default) to restore config HMR.
3. **Keep** `disableExtraction: true` (Tailwind coexistence + guide's dev guidance) and **keep** the `proxy-worm` native stubs (web still bundles native side-effects from Sheet/Toast/Adapt during coexistence).
4. **Optional / cosmetic:** source `TamaguiProvider` + `Theme` in `App.tsx` from `@stageholder/ui` instead of `tamagui` for import consistency. The `next-themes ↔ <Theme name={mode}>` bridge (`TamaguiBridge`) is correct for dynamic theme switching and is kept.

**Verification gate:** user runs `bun run dev:pwa` / `bun run build:pwa`. If the React-19 `unmountComponentAtNode` error (or a static-worker crash) recurs, revert items 1–2 to the manual workaround with comments refreshed to cite the still-present 2.0.0 behavior. This is the one phase where the "right" end state depends on a fact only the build can confirm.

### Phase 3 — Adopt the kit's responsive primitives (responsive-web focus)

Replace the hand-rolled `apps/pwa/src/lib/hooks/use-media-query.ts` (`window.matchMedia` + `useState`, initializes `false` → SSR-style flash) with the kit's `useMedia()` and `Show` / `Hide` / `ResponsiveStack`.

Consumers (all currently call `useMediaQuery("(min-width: 768px)") → isDesktop`, i.e. the `md` breakpoint):

- `apps/pwa/src/routes/_app/journal/route.tsx` — master/detail sidebar vs child → `useMedia().gtMd` or `Show`/`Hide`.
- `apps/pwa/src/routes/_app/todos/route.tsx` — show/hide sidebar/panels → `<Show above="md">` / `<Hide above="md">`.
- `apps/pwa/src/routes/_app/journal/new.tsx` and `journal/$id.tsx` — editor layout switch.
- `apps/pwa/src/routes/_app/settings/index.tsx` — drives Tabs `orientation`/`variant`, `flexDirection`, `gap`, `width`, `justify` off `isDesktop` → prefer Tamagui responsive media props (`$md={{…}}`) and/or `useMedia()`.

Then **delete `use-media-query.ts`**. Reference pattern to converge on: `apps/pwa/src/routes/_app/habits/index.tsx` (`width="100%" $md={{ width: "49%" }} $lg={{ width: "32%" }}` + `flexWrap="wrap"`). Breakpoints are the kit/Tamagui Tailwind-aligned set (`xxs..xxl`, `md=768`).

### Phase 4 — v5-default + cleanups

1. **Celebration overlays under v5 `position: static` default.** Verify the two absolute fill-overlays get a `position: relative` positioning context:
   - `apps/pwa/src/components/habits/radiance-burst.tsx` (mounted via `renderCompletionEffect` in `habits/habit-card.tsx`; parent is the kit `HabitCardView` slot).
   - `apps/pwa/src/components/journal/journal-celebration.tsx` (mounted via `renderCelebration` in `journal/journal-editor.tsx`; parent is the kit `JournalEditorView` slot).
     If the kit slot does not establish `position: relative`, add an explicit `position="relative"` wrapper on our side so overlays anchor correctly. (All other ~38 absolute children already pair with a local relative ancestor; no `flexBasis:auto` reliance anywhere.)
2. **Delete dead code:** `apps/pwa/src/lib/theme-provider.tsx` (exported `ThemeProvider` is imported nowhere; `App.tsx` inlines its own).
3. **`Form` gap:** keep the raw `import { Form } from "tamagui"` in `todos/quick-add-todo.tsx` and `todos/todo-detail-dialog.tsx` (kit does not export `Form`); leave/refresh the existing explanatory comment. The `Input as RawInput` escape hatch in `todo-detail-dialog.tsx` also stays.
4. **Optional polish (may defer to keep churn low):** replace the 16 `animate-pulse` className skeletons (heaviest: `habits/index.tsx`) with the kit `Skeleton` component already used elsewhere.

## 5. Verification approach

- Assistant side: `mcp__ide__getDiagnostics` on every changed `.ts`/`.tsx` + careful reading. No build/test/git runs (standing user preference).
- User side: `bun install` (Phase 1 gate), then `bun run dev:pwa` / `bun run build:pwa` (Phase 2 gate), then a manual visual pass on web + a narrow browser window (responsive) covering journal/todos master-detail, settings tabs, habit-card + journal celebrations, and toasts.

## 6. Risks & open items

- **Phase 2 is the only uncertain phase.** Whether the lite alias + config-watcher workarounds can be removed depends on 2.0.0 stable's `@tamagui/react-native-web-lite`/static-worker behavior, which only the user's build confirms. Mitigation: changes are isolated and reversible; default to keeping the workarounds if the build regresses.
- **Kit `Badge` behavior change (alpha.5→alpha.6):** `Badge` is now a functional wrapper (`styled(Badge, …)` no longer works) and `solid`/`outline` variants now actually apply fill+foreground (previously rendered muted). Audit Badge usages for any reliance on the old appearance or on wrapping it with `styled()`.
- **Mobile dep bump is intentionally minimal.** If the user prefers `apps/mobile` 100% untouched, drop the Phase 1 mobile row and accept a mixed rc/stable graph there (mobile isn't built, so runtime impact is nil; only `bun install` hygiene suffers).

## 7. Out of scope (future specs)

- Mobile screen layer: Expo Router `app/_layout.tsx` + provider stack (`TamaguiProvider`, `GestureHandlerRootView`, `SafeAreaProvider`, `ToastProvider`), auth gate, and product screens (habits/journal/todos/today/light) against existing `lib/api` hooks; the missing `@tamagui/native/setup-expo-linear-gradient` + `setup-burnt` entry imports.
- Tailwind removal + flipping `disableExtraction` to `process.env.NODE_ENV === "development"` for zero-runtime production CSS.
