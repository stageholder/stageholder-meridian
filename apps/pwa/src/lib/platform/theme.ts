import { useSyncExternalStore } from "react";

/**
 * Cross-platform theme hook — Tamagui-v2-native, no `next-themes`.
 *
 * Tamagui v2 switches themes with `<Theme name={mode}>` driven by your own
 * state (see the v2 guide's theme.md / use-theme.md). This module IS that
 * state: a tiny module-level store that owns the user's light/dark/system
 * preference, resolves `"system"` against `prefers-color-scheme`, persists to
 * localStorage, and mirrors the resolved mode onto `<html>` for the remaining
 * Tailwind `.dark` variant + `globals.css` `.dark {}` block.
 *
 * Why module-level with synchronous init: it reads localStorage and sets the
 * `.dark` class at IMPORT time — before React's first paint — so there's no
 * light→dark flash on load (the job `next-themes` did with an injected script).
 * `useAppTheme` subscribes to changes via `useSyncExternalStore`.
 *
 * The future React Native shell ships the SAME `useAppTheme` signature backed
 * by `useColorScheme()` + a persisted override store — the call surface is the
 * contract, the implementation is per-platform.
 */
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

// Same storage key next-themes used, so an existing preference carries over.
const STORAGE_KEY = "theme";

const canUseDOM =
  typeof window !== "undefined" && typeof document !== "undefined";

function systemTheme(): ResolvedTheme {
  if (!canUseDOM || !window.matchMedia) return "light";
  return window.matchMedia("(prefers-color-scheme: dark)").matches
    ? "dark"
    : "light";
}

function readPreference(): ThemePreference {
  if (!canUseDOM) return "system";
  const stored = window.localStorage.getItem(STORAGE_KEY);
  return stored === "light" || stored === "dark" || stored === "system"
    ? stored
    : "system";
}

function resolvePreference(pref: ThemePreference): ResolvedTheme {
  return pref === "system" ? systemTheme() : pref;
}

/** Mirror the resolved mode onto <html> for Tailwind's `.dark` selector. */
function applyDocumentTheme(resolved: ResolvedTheme): void {
  if (!canUseDOM) return;
  const root = document.documentElement;
  root.classList.toggle("dark", resolved === "dark");
  root.classList.toggle("light", resolved === "light");
  root.style.colorScheme = resolved;
}

let preference = readPreference();
let resolved = resolvePreference(preference);

// Snapshot replaced (new ref) only on change, so `useSyncExternalStore` can
// compare by identity without triggering re-render loops.
let snapshot: { theme: ThemePreference; resolvedTheme: ResolvedTheme } = {
  theme: preference,
  resolvedTheme: resolved,
};

// Synchronous, at module load → the correct class is on <html> before paint.
applyDocumentTheme(resolved);

const listeners = new Set<() => void>();

function commit(): void {
  snapshot = { theme: preference, resolvedTheme: resolved };
  applyDocumentTheme(resolved);
  for (const listener of listeners) listener();
}

// Follow OS changes only while the user is on "system".
if (canUseDOM && window.matchMedia) {
  window
    .matchMedia("(prefers-color-scheme: dark)")
    .addEventListener("change", () => {
      if (preference !== "system") return;
      resolved = systemTheme();
      commit();
    });
}

function setTheme(next: ThemePreference): void {
  preference = next;
  if (canUseDOM) window.localStorage.setItem(STORAGE_KEY, next);
  resolved = resolvePreference(next);
  commit();
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
