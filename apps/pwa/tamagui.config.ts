/**
 * Web-only Tamagui config for the meridian PWA.
 *
 * Consumes the @stageholder/ui package's tokens / fonts / themes via
 * its public `/config` entrypoint, so the PWA renders with the same
 * brand palette + sizing scales as the mobile app and the kit's
 * own docs site. The kit is the canonical source of truth for these
 * values — do not duplicate them here.
 *
 * Pattern mirrored verbatim from
 * `~/Project/stageholder-ui/apps/docs/tamagui.config.ts` (the kit's
 * own web docs setup). Any future addition (e.g. a meridian-specific
 * sub-theme) should be done by extending `themes` here, not by
 * forking tokens from the kit.
 */
import { defaultConfig } from "@tamagui/config/v5";
import { animations } from "@tamagui/config/v5-css";
import { defaultProps, fonts, themes, tokens } from "@stageholder/ui/config";
import { createTamagui } from "tamagui";

export const config = createTamagui({
  ...defaultConfig,
  tokens,
  fonts,
  themes,
  animations,
  // `defaultProps` carries primitive theming (cursor / hover / transition
  // defaults) that doesn't ride tokens or themes — has to be spread
  // explicitly. Same as the kit's docs site.
  defaultProps,
  settings: {
    ...defaultConfig.settings,
    // We drive light/dark via <Theme name={mode}> from next-themes (see
    // App.tsx). Letting Tamagui also bind to OS prefers-color-scheme
    // creates a second source of truth and the toggle stops being
    // authoritative.
    shouldAddPrefersColorThemes: false,
  },
});

export type AppConfig = typeof config;

declare module "tamagui" {
  interface TamaguiCustomConfig extends AppConfig {}
}

export default config;
