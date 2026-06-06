// apps/mobile/app/(authed)/_layout.tsx
//
// Three responsibilities:
//   1. Auth gate — redirect to /sign-in if not authenticated.
//   2. Onboarding gate — first-launch (per-account) users are sent through the
//      onboarding wizard (onboarding.tsx) before the tabs. Completion is a
//      local flag (lib/onboarding, expo-secure-store); see that file + the
//      onboarding screen for why mobile tracks this locally rather than
//      server-side like the PWA.
//   3. Tabs frame — expo-router owns navigation state, but the BAR is the
//      kit's floating BottomNav capsule (components/mobile-bottom-nav.tsx),
//      the SAME chrome the PWA shows at mobile widths. The stock RN tab bar
//      is replaced wholesale via the `tabBar` prop — its system styling is
//      what made native look like a different product.
//
// Both gates run BEFORE Tabs render so we never flash a half-loaded dashboard
// at an unauthenticated or not-yet-onboarded request.
//
// CalendarPickerProvider wraps <Tabs> (not the root layout): its single
// root-level CalendarSheet must mount INSIDE the authed tree — where the
// screens that call useCalendarPicker live — but OUTSIDE any individual
// screen's own Sheet. The authed layout is the closest stable common ancestor
// of every tab screen; mounting at the root _layout didn't survive Expo
// Router's <Stack> boundary + HMR in practice.

import { useStageholder } from "@stageholder/sdk/react-native";
import { CalendarPickerProvider, Spinner, View } from "@stageholder/ui";
import { Redirect, Tabs, useSegments } from "expo-router";
import { useEffect, useState } from "react";

import { MobileBottomNav } from "@/components/mobile-bottom-nav";
import { isOnboarded } from "@/lib/onboarding";

export default function AuthedLayout() {
  const { state } = useStageholder();
  const segments = useSegments();

  // The authenticated user's `sub` keys the per-account onboarding flag. Only
  // present once authenticated (state.data is the me-response); undefined
  // otherwise, which keeps the effect below inert until we have an identity.
  const sub = state.status === "authenticated" ? state.data.sub : undefined;
  const onOnboarding = segments.includes("onboarding");

  // null = still resolving the SecureStore flag (hold the spinner, don't flash
  // tabs); true/false once known. Re-resolves when the identity changes OR
  // when the route leaves/enters onboarding — the latter is what flips this to
  // `true` after the wizard calls markOnboarded() + replace("/"), so we don't
  // redirect-loop back into the flow.
  const [onboarded, setOnboarded] = useState<boolean | null>(null);
  useEffect(() => {
    if (!sub) return;
    let cancelled = false;
    setOnboarded(null);
    isOnboarded(sub).then((v) => {
      if (!cancelled) setOnboarded(v);
    });
    return () => {
      cancelled = true;
    };
  }, [sub, onOnboarding]);

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

  // Authenticated. Hold the spinner until the onboarding flag resolves so the
  // tabs never flash before a not-onboarded user is redirected. (Skip the hold
  // while already on the onboarding screen — it renders inside <Tabs> below.)
  if (onboarded === null && !onOnboarding) {
    return (
      <View flex={1} items="center" justify="center" bg="$background">
        <Spinner size="large" />
      </View>
    );
  }
  // Not onboarded → into the wizard. Guard against a redirect loop when the
  // wizard route is already active (it lives in the authed tree below).
  if (onboarded === false && !onOnboarding) {
    return <Redirect href="/(authed)/onboarding" />;
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
        {/* Journal entry detail (journal/[id].tsx) + the new-entry editor
            (journal/new.tsx) live in the journal tab's stack but are not
            destinations — the custom bar lists its own items, and the
            active-state prefix match keeps Journal lit. */}
        <Tabs.Screen name="journal/[id]" options={{ href: null }} />
        <Tabs.Screen name="journal/new" options={{ href: null }} />
        {/* Onboarding wizard (onboarding.tsx) — gated above, not a tab
            destination; hidden from the custom bar via href:null. */}
        <Tabs.Screen name="onboarding" options={{ href: null }} />
      </Tabs>
    </CalendarPickerProvider>
  );
}
