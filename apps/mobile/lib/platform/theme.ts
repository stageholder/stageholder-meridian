// apps/mobile/lib/platform/theme.ts
//
// React Native counterpart of the PWA's theme store
// (apps/pwa/src/lib/platform/theme.ts). Same EXPORTED CONTRACT:
//   - types ThemePreference / ResolvedTheme / AppThemeState
//   - a `useAppTheme()` hook returning { theme, resolvedTheme, setTheme }
//   - the preference is persisted under the SAME "theme" storage key
//
// The call surface is the contract; the implementation is per-platform.
// Web resolves "system" against `prefers-color-scheme`; here we resolve it
// against react-native's `Appearance.getColorScheme()` and follow OS changes
// via `Appearance.addChangeListener` — but ONLY while the preference is
// "system" (an explicit light/dark pick wins and ignores the OS).
//
// ── The one real difference from web ──────────────────────────────────────
// The web store reads localStorage SYNCHRONOUSLY at module-import time, so the
// correct `.dark` class is on <html> before React's first paint → no flash.
// AsyncStorage on RN is, well, async — there is no synchronous read. So this
// module starts from the OS scheme (a sensible default) and exposes an
// `initTheme()` Promise that hydrates the stored preference exactly once. The
// root layout AWAITS `initTheme()` alongside font loading and keeps the splash
// screen up until both resolve, which is how we avoid a theme flash here:
// nothing is shown until the persisted preference has been applied.

import AsyncStorage from "@react-native-async-storage/async-storage";
import { useSyncExternalStore } from "react";
import { Appearance } from "react-native";

export type ThemePreference = "light" | "dark" | "system";
export type ResolvedTheme = "light" | "dark";

export interface AppThemeState {
  /** The user's stored preference — `"system"` if they haven't picked. */
  theme: ThemePreference;
  /** What's actually rendered now, after resolving `"system"`. */
  resolvedTheme: ResolvedTheme;
  /** Update the user's preference (persists + re-applies immediately). */
  setTheme: (theme: ThemePreference) => void;
}

// Same storage key the web store uses, kept identical on purpose so the two
// platforms share one mental model (and so a future shared sync layer can move
// the value between them without a key translation).
const STORAGE_KEY = "theme";

function systemTheme(): ResolvedTheme {
  // `getColorScheme()` returns null/undefined when the OS hasn't reported a
  // scheme yet (rare, early cold-start) — default to light to match web.
  return Appearance.getColorScheme() === "dark" ? "dark" : "light";
}

function resolvePreference(pref: ThemePreference): ResolvedTheme {
  return pref === "system" ? systemTheme() : pref;
}

// Module-level state. Starts at "system" → OS scheme; `initTheme()` overwrites
// `preference` with the persisted value once AsyncStorage resolves.
let preference: ThemePreference = "system";
let resolved: ResolvedTheme = resolvePreference(preference);

// Snapshot replaced (new ref) only on change, so `useSyncExternalStore` can
// compare by identity without triggering re-render loops.
let snapshot: { theme: ThemePreference; resolvedTheme: ResolvedTheme } = {
  theme: preference,
  resolvedTheme: resolved,
};

const listeners = new Set<() => void>();

function commit(): void {
  snapshot = { theme: preference, resolvedTheme: resolved };
  for (const listener of listeners) listener();
}

// Follow OS appearance changes — but only honor them while the user is on
// "system". The listener is attached once at module load; it stays cheap (a
// guard + early return) when the user has pinned light/dark.
Appearance.addChangeListener(() => {
  if (preference !== "system") return;
  const next = systemTheme();
  if (next === resolved) return;
  resolved = next;
  commit();
});

function persist(pref: ThemePreference): void {
  // Fire-and-forget: a write failure is non-fatal (the in-memory value still
  // drives this session; next launch just falls back to the OS default).
  AsyncStorage.setItem(STORAGE_KEY, pref).catch(() => {});
}

function setTheme(next: ThemePreference): void {
  preference = next;
  persist(next);
  resolved = resolvePreference(next);
  commit();
}

let initPromise: Promise<void> | null = null;

/**
 * Hydrate the persisted preference from AsyncStorage. Idempotent — the
 * underlying read runs at most once; repeat calls return the same Promise.
 *
 * The root layout awaits this (alongside font loading) before hiding the
 * splash screen, so the first painted frame already reflects the stored
 * preference. This is the async stand-in for the web store's synchronous
 * module-load read (see the header comment).
 */
export function initTheme(): Promise<void> {
  if (initPromise) return initPromise;
  initPromise = (async () => {
    try {
      const stored = await AsyncStorage.getItem(STORAGE_KEY);
      if (stored === "light" || stored === "dark" || stored === "system") {
        preference = stored;
        resolved = resolvePreference(stored);
        commit();
      }
    } catch {
      // Keep the OS-derived default already in place.
    }
  })();
  return initPromise;
}

function subscribe(onChange: () => void): () => void {
  listeners.add(onChange);
  return () => {
    listeners.delete(onChange);
  };
}

function getSnapshot() {
  return snapshot;
}

export function useAppTheme(): AppThemeState {
  const state = useSyncExternalStore(subscribe, getSnapshot, getSnapshot);
  return {
    theme: state.theme,
    resolvedTheme: state.resolvedTheme,
    setTheme,
  };
}
