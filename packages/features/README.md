# @repo/features

Cross-platform feature components for Meridian (PWA today, RN mobile next).

These are **presentational** components — they take data via props, never
fetch directly. Each app provides the data wiring (TanStack Query for the
PWA's hooks, the `DataStore` adapter for offline reads, OIDC for auth) and
renders these components inside its routes. The pattern mirrors how
[`@stageholder/ui`](../../node_modules/@stageholder/ui) ships UI primitives
and we ship the next layer up — domain feature components built ON those
primitives.

## Why a separate package

The previous architecture had every feature component (`HabitCard`,
`LevelProgress`, `JourneyTierMap`, the dashboard charts, …) living inside
`apps/pwa/src/components/`. To start `apps/mobile`, we'd either duplicate
those components or have mobile import directly from another app's source
tree — both bad. Extracting them here means:

- **One source of truth** per component; web + mobile render the same code.
- **Responsive design carries over** — Tamagui's `$sm`/`$md`/`$lg` media
  props work on both runtimes (CSS queries on web, `Dimensions` on RN),
  so a `<YStack $md={{ flexDirection: "row" }}>` correctly renders as
  phone-column / tablet-row / desktop-row across both apps.
- **API contract integrity** — each component pins its props once; both
  apps must satisfy them.

## Layout

```
src/
  light/    Journey + gamification visuals
            (StarVisual, LevelProgress, LevelUpCelebration,
             JourneyStats, JourneyStreaks, JourneyTierMap)
  …         More domains land incrementally (habits, journal, todos,
            dashboard, activity-rings, encryption flows, settings).
```

## Cross-platform strategy

Per the Tamagui v2 guide's `developing.md` (the `useWebRef`/`useNativeRef`
note), platform divergence inside a single component is handled via the
**platform suffix** convention:

```
src/light/star-visual.tsx        ← web impl (raw <svg>, SVG animations)
src/light/star-visual.native.tsx ← mobile impl (react-native-svg) — added when mobile starts
```

Metro picks `.native.tsx` automatically when bundling for RN; the web
bundler picks `.tsx`. The PWA never loads `.native.tsx`, the mobile app
never loads `.tsx`. **Both apps see the same exported symbol** —
consumers do `import { StarVisual } from "@repo/features/light"` and the
right implementation is picked at bundle time.

### Current escape hatches (need a `.native.tsx` companion before mobile ships)

| File                             | Web-only piece                              | RN approach                             |
| -------------------------------- | ------------------------------------------- | --------------------------------------- |
| `light/star-visual.tsx`          | raw `<svg>` + SVG animations                | `react-native-svg` port                 |
| `light/journey-streaks.tsx`      | inner `StreakRing` raw `<svg>`              | `react-native-svg` port                 |
| `light/journey-tier-map.tsx`     | `HTMLDivElement` refs + programmatic scroll | `FlatList` with `scrollToOffset`        |
| `light/level-up-celebration.tsx` | `position: "fixed"` overlay                 | `Modal` from RN or `Sheet` from the kit |
| `light/level-progress.tsx`       | CSS `linear-gradient` on the progress fill  | `expo-linear-gradient`                  |

Files with NO escape hatch (work on both runtimes today): `journey-stats.tsx`.

## Consumption

```tsx
// In any app's routes
import { StarVisual, LevelProgress } from "@repo/features/light";

export function JourneyHeader({ userLight }) {
  return (
    <>
      <StarVisual tier={userLight.currentTier} size="xl" animate />
      <LevelProgress userLight={userLight} />
    </>
  );
}
```

## What does NOT live here

- **Routes / screens** — per-app (TanStack Router on web, Expo Router on mobile).
- **App shell / navigation** — per-app (web: sidebar + header; mobile: tab bar + stack).
- **Hook-driven smart components** — currently in `apps/pwa/src/components/`
  pending Phase B (refactor to props-driven, then lift).
- **Web-only specifics** with no shared API surface (TipTap journal editor,
  service worker, Tauri updater) — stay in `apps/pwa/`.
