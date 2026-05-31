import type { TamaguiBuildOptions } from "tamagui";

// Single source of truth for Tamagui compiler / bundler-plugin options.
// `@tamagui/vite-plugin`, `@tamagui/cli`, and any future Tamagui tool all
// read this file automatically — see
// `tamagui-v2-guide/compiler-install.md` (§ "Configuration with
// tamagui.build.ts"). Keeping options here means we don't have to mirror
// them across vite.config.ts, CLI scripts, or CI commands.
export default {
  config: "./tamagui.config.ts",
  // Required when extending Tamagui with our own design system: the
  // compiler needs to know which packages contain `styled()` components
  // to recognize and optimize. Without this, kit components fall back to
  // runtime rendering only. See `tamagui-v2-guide/design-systems.md` § 4.
  components: ["@stageholder/ui", "tamagui"],
  // Extraction stays off in both dev and prod for the Tailwind+Tamagui
  // migration window:
  //   1. Tailwind v4 and Tamagui coexist in this app today — extracted
  //      Tamagui CSS can shift the cascade in ways that surprise
  //      Tailwind utility ordering.
  //   2. HMR is faster without extraction; the runtime CSS-in-JS cost is
  //      acceptable for an alpha-stage rollout.
  // Flip to `process.env.NODE_ENV === 'development'` once Tailwind is
  // removed, so production builds get zero-runtime CSS.
  disableExtraction: true,
  // Disable the static-worker config watcher.
  //
  // The watcher spawns `@tamagui/static-worker`, a child Node process
  // that pre-bundles `tamagui.config.ts` for HMR. Its esbuild config
  // hardcodes an alias of `react-native` → `@tamagui/react-native-web-lite`
  // (see node_modules/@tamagui/static-worker/.../bundleConfig.cjs:438),
  // and the lite package STILL imports `unmountComponentAtNode` from
  // `react-dom` — an API React 19 removed. Verified still present in
  // tamagui@2.0.0 stable:
  // node_modules/@tamagui/react-native-web-lite/src/AppRegistry/index.tsx.
  // There is no plugin option to make the worker use the full
  // `react-native-web` instead.
  //
  // Tradeoff: editing `tamagui.config.ts` (tokens, themes, fonts)
  // requires a `dev:pwa` restart. Component code still hot-reloads
  // normally. Re-enable once Tamagui's lite package drops the
  // `unmountComponentAtNode` import (still broken as of tamagui@2.0.0).
  disableWatchTamaguiConfig: true,
} satisfies TamaguiBuildOptions;
