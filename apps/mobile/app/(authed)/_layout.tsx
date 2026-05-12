// apps/mobile/app/(authed)/_layout.tsx
//
// Two responsibilities:
//   1. Auth gate — redirect to /sign-in if not authenticated
//   2. Tabs frame — five product tabs, dark navy chrome, tab bar styled
//      from @stageholder/ui tokens via the active theme
//
// The auth check runs BEFORE Tabs renders so we never flash an empty tab
// frame at unauthenticated users.

import { useStageholder } from "@stageholder/sdk/react-native";
import { CalendarPickerProvider } from "@stageholder/ui";
import { Redirect, Tabs } from "expo-router";
import { ActivityIndicator, Text as RNText } from "react-native";
import { useTheme, View } from "tamagui";

export default function AuthedLayout() {
  const { state } = useStageholder();
  const theme = useTheme();
  const themeT = theme as unknown as Record<string, { val?: string }>;

  if (state.status === "loading") {
    return (
      <View flex={1} items="center" justify="center" bg="$background">
        <ActivityIndicator color={themeT.color9?.val ?? "#0074D9"} />
      </View>
    );
  }
  if (state.status === "unauthenticated" || state.status === "error") {
    return <Redirect href="/sign-in" />;
  }

  // Resolve token values for the Tabs screenOptions — RN's tab bar accepts
  // raw color strings, not Tamagui tokens, so we pull from the theme proxy.
  const tabBarBg = themeT.color2?.val ?? "#0d1530";
  const tabBarBorder = themeT.color6?.val ?? "#1f2d5c";
  const tabActiveTint = themeT.color9?.val ?? "#0074D9";
  const tabInactiveTint = themeT.color11?.val ?? "#7c89b6";

  return (
    // CalendarPickerProvider must wrap <Tabs> so its single root-level
    // CalendarSheet is mounted INSIDE the authed tree (where the
    // screens that call useCalendarPicker live), but OUTSIDE any
    // individual screen's Sheet. Mounting at the root _layout.tsx
    // didn't work — Expo Router's <Slot> boundary plus HMR breaks the
    // context propagation in practice. The authed layout is the
    // closest stable ancestor of every tab screen.
    <CalendarPickerProvider>
      <Tabs
        screenOptions={{
          headerShown: false,
          tabBarStyle: {
            backgroundColor: tabBarBg,
            borderTopColor: tabBarBorder,
            borderTopWidth: 1,
          },
          tabBarActiveTintColor: tabActiveTint,
          tabBarInactiveTintColor: tabInactiveTint,
          tabBarLabelStyle: {
            fontSize: 10,
            fontWeight: "600",
            letterSpacing: 0.5,
            textTransform: "uppercase",
          },
        }}
      >
        <Tabs.Screen
          name="index"
          options={{ title: "Today", tabBarIcon: TabGlyph("◐") }}
        />
        <Tabs.Screen
          name="todos"
          options={{ title: "Todos", tabBarIcon: TabGlyph("✓") }}
        />
        <Tabs.Screen
          name="journal"
          options={{ title: "Journal", tabBarIcon: TabGlyph("✎") }}
        />
        <Tabs.Screen
          name="habits"
          options={{ title: "Habits", tabBarIcon: TabGlyph("◎") }}
        />
        <Tabs.Screen
          name="profile"
          options={{ title: "Profile", tabBarIcon: TabGlyph("◇") }}
        />
        {/* Hide detail routes from the tab bar. Without `href: null`,
            Expo Router auto-generates a tab entry for every sibling
            file/folder under (authed) — including dynamic routes like
            /habits/[id], which would render as "HABITS/..." beside the
            real Habits tab. */}
        <Tabs.Screen name="habits/[id]" options={{ href: null }} />
      </Tabs>
    </CalendarPickerProvider>
  );
}

/**
 * Returns a tabBarIcon renderer for a single unicode glyph. We use
 * geometric symbols (◐ ✓ ✎ ◎ ◇) instead of Lucide / Material icons —
 * matches the observatory aesthetic and skips a dep install.
 */
function TabGlyph(glyph: string) {
  return function TabIcon({
    color,
    focused,
  }: {
    color: string;
    focused: boolean;
  }) {
    return (
      <View
        width={28}
        height={28}
        items="center"
        justify="center"
        style={{ opacity: focused ? 1 : 0.85 }}
      >
        <RNText style={{ color, fontSize: 18, fontWeight: "500" }}>
          {glyph}
        </RNText>
      </View>
    );
  };
}
