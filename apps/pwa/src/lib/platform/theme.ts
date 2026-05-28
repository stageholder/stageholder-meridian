import { useTheme as useNextTheme } from "next-themes";

/**
 * Cross-platform theme hook. The PWA backs this with `next-themes`
 * (className-based, persists to localStorage). The future React Native
 * shell will ship the SAME hook signature backed by `useColorScheme()`
 * + a tiny persisted override store, exported from `apps/mobile/src/lib/
 * platform/theme.ts`. Components everywhere import `useAppTheme` from
 * THEIR app's local `@/lib/platform/theme` — the call surface is the
 * contract, the implementation is per-platform.
 *
 * Living in `apps/pwa/src/lib/platform/` rather than `@repo/core/platform/`
 * because the web impl carries a `next-themes` dep that doesn't belong
 * in the shared package; each app owns its own implementation.
 */
export type ThemePreference = "light" | "dark" | "system";
export type ResolvedTheme = "light" | "dark";

export interface AppThemeState {
  /** The user's stored preference — `"system"` if they haven't picked. */
  theme: ThemePreference | undefined;
  /** What's actually rendered now after resolving `"system"`. */
  resolvedTheme: ResolvedTheme | undefined;
  /** Update the user's preference. */
  setTheme: (theme: ThemePreference) => void;
}

export function useAppTheme(): AppThemeState {
  const { theme, resolvedTheme, setTheme } = useNextTheme();
  return {
    theme: theme as ThemePreference | undefined,
    resolvedTheme: resolvedTheme as ResolvedTheme | undefined,
    setTheme,
  };
}
