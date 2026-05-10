// apps/mobile/tamagui.config.ts
//
// Re-exports the @stageholder/ui config so Tamagui has a single source of
// truth — same tokens, themes, and fonts as the rest of the design system.
// The `/config` subpath exports the native variant (Reanimated driver, native
// font names) which is what Metro picks for Expo.

import config from "@stageholder/ui/config";

export default config;
export type AppConfig = typeof config;

declare module "tamagui" {
  // eslint-disable-next-line @typescript-eslint/no-empty-object-type
  interface TamaguiCustomConfig extends AppConfig {}
}
