// apps/mobile/app/(authed)/_layout.tsx
//
// Two responsibilities:
//   1. Auth gate — redirect to /sign-in if not authenticated.
//   2. Tabs frame — expo-router owns navigation state, but the BAR is the
//      kit's floating BottomNav capsule (components/mobile-bottom-nav.tsx),
//      the SAME chrome the PWA shows at mobile widths. The stock RN tab bar
//      is replaced wholesale via the `tabBar` prop — its system styling is
//      what made native look like a different product.
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
import { CalendarPickerProvider, Spinner, View } from "@stageholder/ui";
import { Redirect, Tabs } from "expo-router";

import { MobileBottomNav } from "@/components/mobile-bottom-nav";

export default function AuthedLayout() {
  const { state } = useStageholder();

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

  return (
    <CalendarPickerProvider>
      <Tabs
        // The kit BottomNav capsule replaces the stock bar entirely. It
        // floats OVER the content (no reserved bar space), so every screen
        // pads its scroll content by BOTTOM_NAV_CLEARANCE + safe-area inset
        // (see components/mobile-bottom-nav.tsx) — the same clearance
        // contract the PWA's app-shell uses.
        tabBar={(props) => <MobileBottomNav {...(props as never)} />}
        screenOptions={{ headerShown: false }}
      >
        <Tabs.Screen name="index" options={{ title: "Today" }} />
        <Tabs.Screen name="todos" options={{ title: "Todos" }} />
        <Tabs.Screen name="habits" options={{ title: "Habits" }} />
        <Tabs.Screen name="journal" options={{ title: "Journal" }} />
        <Tabs.Screen name="settings" options={{ title: "Settings" }} />
        {/* Journal entry detail (journal/[id].tsx) lives in the journal tab's
            stack but is not a destination — the custom bar lists its own
            items, and the active-state prefix match keeps Journal lit. */}
        <Tabs.Screen name="journal/[id]" options={{ href: null }} />
      </Tabs>
    </CalendarPickerProvider>
  );
}
