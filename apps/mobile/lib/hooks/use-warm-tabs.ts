// apps/mobile/lib/hooks/use-warm-tabs.ts
//
// Warm sibling tab screens in the BACKGROUND so the FIRST tap on each is an
// instant native visibility flip instead of a synchronous mount-on-the-tap-frame
// (expo-router tabs are lazy: a screen mounts the first time it's focused, which
// is the "slow first click, instant after" behavior). Discord/Telegram/Todoist
// feel instant precisely because the destination is already mounted by the time
// you tap.
//
// react-navigation v7 (which expo-router's <Tabs> wraps) exposes
// `navigation.preload(routeName)` — it mounts a tab screen WITHOUT focusing it.
// We call it from the landing screen (Today) after a short delay, one tab at a
// time, so warming never competes with the current screen's own first paint or
// fires every screen's queries in one burst.
//
// TIMING: a plain staggered setTimeout, NOT InteractionManager — the same call
// as use-staged-mount.ts, whose header documents that runAfterInteractions can
// hang for seconds in this app. Defensive: `preload` is feature-detected and
// wrapped in try/catch, so on any runtime where it's absent or throws this is a
// pure no-op (the tabs just stay lazy, exactly as before).

import { useEffect } from "react";
import { useNavigation } from "expo-router";

type Preloadable = { preload?: (routeName: string) => void };

export function useWarmTabs(
  /** Tab route names to warm (expo-router file basenames, e.g. "todos"). Pass a
   *  STABLE array (module constant) — it's an effect dependency. */
  routeNames: readonly string[],
  startDelayMs = 800,
  stepMs = 500,
): void {
  const navigation = useNavigation();
  useEffect(() => {
    const preload = (navigation as Preloadable).preload;
    if (typeof preload !== "function") return;
    const timers = routeNames.map((name, i) =>
      setTimeout(
        () => {
          try {
            preload.call(navigation, name);
          } catch {
            /* preload is best-effort — a failure just leaves that tab lazy */
          }
        },
        startDelayMs + i * stepMs,
      ),
    );
    return () => timers.forEach(clearTimeout);
  }, [navigation, routeNames, startDelayMs, stepMs]);
}
