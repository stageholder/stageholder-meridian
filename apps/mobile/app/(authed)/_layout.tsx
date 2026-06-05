// apps/mobile/app/(authed)/_layout.tsx
//
// Two responsibilities:
//   1. Auth gate — redirect to /sign-in if not authenticated.
//   2. Tabs frame — five product tabs whose chrome is styled from the active
//      @stageholder/ui theme tokens via useTheme(), so the tab bar follows
//      light/dark automatically (RN's tab bar wants raw color strings, not
//      Tamagui tokens, so we resolve `<token>.val` and hand the hex in).
//
// The gate runs BEFORE Tabs render so we never flash a half-loaded dashboard
// at an unauthenticated request.
//
// CalendarPickerProvider wraps <Tabs> (not the root layout): its single
// root-level CalendarSheet must mount INSIDE the authed tree — where the
// screens that call useCalendarPicker live — but OUTSIDE any individual
// screen's own Sheet. The authed layout is the closest stable common ancestor
// of every tab screen; mounting at the root _layout didn't survive Expo
// Router's <Stack> boundary + HMR in practice.

import { useStageholder } from "@stageholder/sdk/react-native";
import {
  CalendarPickerProvider,
  Spinner,
  useTheme,
  View,
} from "@stageholder/ui";
import {
  BookOpen,
  CheckSquare,
  Repeat2,
  Settings2,
  Sun,
} from "@tamagui/lucide-icons-2";
import { Redirect, Tabs } from "expo-router";

export default function AuthedLayout() {
  const { state } = useStageholder();
  const theme = useTheme();

  // While the provider hydrates its session from SecureStore, hold render
  // behind a centered spinner — bg from the theme so it matches light/dark.
  if (state.status === "loading") {
    return (
      <View flex={1} items="center" justify="center" bg="$background">
        <Spinner size="large" />
      </View>
    );
  }
  // `error` is treated as unauthenticated for routing purposes — bounce to
  // sign-in, where the SDK error (if any) surfaces.
  if (state.status === "unauthenticated" || state.status === "error") {
    return <Redirect href="/sign-in" />;
  }

  // Resolve token values for the Tabs screenOptions. RN's tab bar accepts raw
  // color strings, not Tamagui tokens, so pull `.val` off the active theme.
  // Active = primary text color, inactive = mutedForeground, with the surface
  // background + border from their named tokens. Fallbacks cover the (rare)
  // window where a token hasn't resolved yet.
  const tabBg = theme.background?.val ?? "#0d1530";
  const tabBorder = theme.borderColor?.val ?? "#1f2d5c";
  const tabActiveTint = theme.color?.val ?? "#0070BA";
  const tabInactiveTint = theme.mutedForeground?.val ?? "#7c89b6";

  return (
    <CalendarPickerProvider>
      <Tabs
        screenOptions={{
          headerShown: false,
          tabBarStyle: {
            backgroundColor: tabBg,
            borderTopColor: tabBorder,
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
          options={{
            title: "Today",
            // @tamagui/lucide-icons-2 icons read their OWN `color` prop — they
            // do NOT inherit the tab bar's tint via CSS cascade. RN's tabBar
            // passes the resolved active/inactive `color` to tabBarIcon, so we
            // forward it straight to the icon's `color` prop.
            tabBarIcon: ({ color, size }) => <Sun color={color} size={size} />,
          }}
        />
        <Tabs.Screen
          name="habits"
          options={{
            title: "Habits",
            tabBarIcon: ({ color, size }) => (
              <Repeat2 color={color} size={size} />
            ),
          }}
        />
        <Tabs.Screen
          name="todos"
          options={{
            title: "Todos",
            tabBarIcon: ({ color, size }) => (
              <CheckSquare color={color} size={size} />
            ),
          }}
        />
        <Tabs.Screen
          name="journal"
          options={{
            title: "Journal",
            tabBarIcon: ({ color, size }) => (
              <BookOpen color={color} size={size} />
            ),
          }}
        />
        <Tabs.Screen
          name="settings"
          options={{
            title: "Settings",
            tabBarIcon: ({ color, size }) => (
              <Settings2 color={color} size={size} />
            ),
          }}
        />
        {/* Journal entry detail (journal/[id].tsx) lives in the journal tab's
            stack but is hidden from the tab bar — `href: null` keeps it
            navigable via router.push without adding a 6th tab. */}
        <Tabs.Screen name="journal/[id]" options={{ href: null }} />
      </Tabs>
    </CalendarPickerProvider>
  );
}
