// apps/mobile/tamagui.config.ts
//
// The app's OWN `createTamagui` call, composed from the kit's building
// blocks — mirroring the kit reference app (stageholder-ui/apps/docs-expo/
// tamagui.config.ts) exactly. Two things to know:
//
//   1. `@stageholder/ui/config` exports BUILDING BLOCKS ONLY (tokens,
//      fonts, themes, defaultProps, animations) — there is NO default
//      export and NO pre-built config. A previous version of this file did
//      `import config from "@stageholder/ui/config"`, which silently
//      evaluated to `undefined`; the app only worked because _layout used
//      the kit's UIProvider (which builds its own config internally).
//   2. We build our own config instead of UIProvider because the kit's
//      internal config does NOT set `disableSSR` — per
//      tamagui-v2-guide/configuration.md §Settings, Expo Router has no SSR,
//      and without the flag Tamagui renders twice on mount to match a
//      server pass that never happens.
//
// The animation driver is Reanimated (NOT v5-css) — imported explicitly so
// there's no resolution subtlety, same as the reference app.

import { defaultConfig } from "@tamagui/config/v5";
import { animations } from "@tamagui/config/v5-reanimated";
import { defaultProps, fonts, themes, tokens } from "@stageholder/ui/config";
import { createTamagui } from "tamagui";

export const config = createTamagui({
  ...defaultConfig,
  tokens,
  animations,
  fonts,
  themes,
  // Per tamagui-v2-guide/how-to-upgrade.md §"Component themes are off by
  // default in v5 — use defaultProps instead".
  defaultProps,
  settings: {
    ...defaultConfig.settings,
    // Manual <Theme name={mode}> in _layout.tsx (fed by lib/platform/theme)
    // is the source of truth — don't bind to OS prefers-color-scheme.
    shouldAddPrefersColorThemes: false,
    // v5 defaults this to true, which on iOS turns theme colors into
    // DynamicColorIOS OBJECTS bound to the OS scheme. Two reasons it must
    // be off here: (1) our theme is app-driven, so OS-bound colors would
    // paint dark while the app says light; (2) Reanimated 4's color
    // processor rejects the object form — the kit Tabs' sliding indicator
    // (theme.primary.get() → Animated.View backgroundColor) crashed with
    // "[Reanimated] Invalid color value: [object Object]".
    fastSchemeChange: false,
    // Expo Router has no SSR — skip the hydration double-render.
    disableSSR: true,
  },
});

export type AppConfig = typeof config;

declare module "tamagui" {
  // eslint-disable-next-line @typescript-eslint/no-empty-object-type
  interface TamaguiCustomConfig extends AppConfig {}
}

export default config;
