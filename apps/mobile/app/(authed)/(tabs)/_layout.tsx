// apps/mobile/app/(authed)/(tabs)/_layout.tsx
//
// The platform tab bar: expo-router NativeTabs = a real UITabBarController on
// iOS (Liquid Glass on iOS 26, scroll-to-top + pop-to-root on re-tap, system
// haptics/accessibility) and Material 3 bottom navigation on Android. This
// replaces the kit's floating JS capsule (the old mobile-bottom-nav),
// which looked and behaved like a web page: no re-tap behavior, a "Profile"
// tab that was secretly a button, and hand-computed content clearance on
// every screen.
//
// Only the five top-level destinations live here. Every detail screen
// (habit detail, journal entry/editor, calendar, journey, billing, upgrade)
// is a native-stack screen in ../_layout.tsx, PUSHED over the tabs — slide-in
// animation, iOS edge swipe-back, and Android Back returning to the screen
// the user actually came from.

import { NativeTabs } from "expo-router/unstable-native-tabs";
import { useTheme } from "tamagui";

export default function TabsLayout() {
  const theme = useTheme();
  const tint = theme.color10?.val ?? theme.color?.val;

  return (
    <NativeTabs
      tintColor={tint}
      // Android Material bar: themed surface + indicator; iOS 26 Liquid Glass
      // ignores background props by design.
      backgroundColor={theme.background?.val}
      labelVisibilityMode="labeled"
    >
      <NativeTabs.Trigger name="index" testID="tab-index">
        <NativeTabs.Trigger.Icon
          sf={{ default: "sun.max", selected: "sun.max.fill" }}
          md="today"
        />
        <NativeTabs.Trigger.Label>Today</NativeTabs.Trigger.Label>
      </NativeTabs.Trigger>
      <NativeTabs.Trigger name="todos" testID="tab-todos">
        <NativeTabs.Trigger.Icon
          sf={{
            default: "checkmark.circle",
            selected: "checkmark.circle.fill",
          }}
          md="task_alt"
        />
        <NativeTabs.Trigger.Label>Todos</NativeTabs.Trigger.Label>
      </NativeTabs.Trigger>
      <NativeTabs.Trigger name="habits" testID="tab-habits">
        <NativeTabs.Trigger.Icon sf="target" md="track_changes" />
        <NativeTabs.Trigger.Label>Habits</NativeTabs.Trigger.Label>
      </NativeTabs.Trigger>
      <NativeTabs.Trigger name="journal" testID="tab-journal">
        <NativeTabs.Trigger.Icon
          sf={{ default: "book", selected: "book.fill" }}
          md="menu_book"
        />
        <NativeTabs.Trigger.Label>Journal</NativeTabs.Trigger.Label>
      </NativeTabs.Trigger>
      <NativeTabs.Trigger name="settings" testID="tab-settings">
        <NativeTabs.Trigger.Icon
          sf={{ default: "gearshape", selected: "gearshape.fill" }}
          md="settings"
        />
        <NativeTabs.Trigger.Label>Settings</NativeTabs.Trigger.Label>
      </NativeTabs.Trigger>
    </NativeTabs>
  );
}
