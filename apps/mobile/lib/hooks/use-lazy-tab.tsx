// apps/mobile/lib/hooks/use-lazy-tab.tsx
//
// First-focus gate for TAB ROOT screens.
//
// expo-router's NativeTabs (expo-router/unstable-native-tabs, SDK 56) mounts
// EVERY tab's content at launch — there is no `lazy` option: its navigator
// renders a react-native-screens tab Screen per route and calls each route's
// renderer unconditionally (NativeBottomTabsNavigator → NativeTabsView). So
// without this gate, launching the app mounted Today + Todos + Habits + Journal
// + Settings at once: ~14 React Query queries, every tab's sheet hosts and
// their keyboard worklets, and the full Habits card tree — all before the user
// tapped anything, and all re-rendering on every shared-cache write for the
// life of the app. (The old `useWarmTabs` preload was built on the wrong
// assumption that tabs were lazy — it was a no-op on top of eager mounting.)
//
// `withLazyTab` renders a themed blank frame until the tab is focused for the
// first time, then mounts the real screen and KEEPS it mounted (no unmount or
// freeze on blur — unfreezing a heavy tab on the tap frame is the jank the
// 2026-07 perf pass reverted; see project memory). The landing tab (Today) is
// focused on launch, so it mounts immediately — nothing changes for it.

import { useFocusEffect } from "expo-router";
import { useCallback, useState, type ComponentType } from "react";
import { View } from "tamagui";

export function useFirstFocus(): boolean {
  const [focusedOnce, setFocusedOnce] = useState(false);
  useFocusEffect(
    useCallback(() => {
      setFocusedOnce(true);
    }, []),
  );
  return focusedOnce;
}

export function withLazyTab<P extends object>(
  Screen: ComponentType<P>,
): ComponentType<P> {
  function LazyTab(props: P) {
    const ready = useFirstFocus();
    if (!ready) return <View flex={1} bg="$background" />;
    return <Screen {...props} />;
  }
  LazyTab.displayName = `withLazyTab(${Screen.displayName ?? Screen.name ?? "Screen"})`;
  return LazyTab;
}
