// apps/mobile/app/(authed)/_layout.tsx
//
// Three responsibilities:
//   1. Auth gate — redirect to /sign-in if not authenticated.
//   2. Onboarding gate — first-launch (per-account) users are sent through the
//      onboarding wizard (onboarding.tsx) before the tabs. Completion is a
//      local flag (lib/onboarding, expo-secure-store); see that file + the
//      onboarding screen for why mobile tracks this locally rather than
//      server-side like the PWA.
//   3. Navigation frame — a native Stack whose root is the (tabs) group
//      (platform tab bar, see (tabs)/_layout.tsx). Every detail screen is a
//      Stack screen PUSHED over the tabs: real slide-in transition, iOS edge
//      swipe-back, native header with back button, and Android Back popping
//      to wherever the user came from. (These used to be hidden Tabs.Screen
//      entries — no animation, no gesture, and Back always jumped to Today.)
//
// Both gates run BEFORE the navigator renders so we never flash a half-loaded dashboard
// at an unauthenticated or not-yet-onboarded request.
//
// CalendarPickerProvider wraps <Stack> (not the root layout): its single
// root-level CalendarSheet must mount INSIDE the authed tree — where the
// screens that call useCalendarPicker live — but OUTSIDE any individual
// screen's own Sheet. The authed layout is the closest stable common ancestor
// of every tab screen; mounting at the root _layout didn't survive Expo
// Router's <Stack> boundary + HMR in practice.

import { useStageholder } from "@stageholder/sdk/react-native";
import {
  Button,
  CalendarPickerProvider,
  Spinner,
  Text,
  View,
  YStack,
} from "@stageholder/ui";
import { Redirect, Stack, useRouter, useSegments } from "expo-router";
import { useCallback, useEffect, useState } from "react";
import { useTheme } from "tamagui";

import { useMeridianMe } from "@/lib/api";
import { useJournalAutoLock } from "@/lib/hooks/use-journal-auto-lock";
import { isOnboarded } from "@/lib/onboarding";
import { configurePurchases } from "@/lib/purchases";

export default function AuthedLayout() {
  const { state, refreshSession } = useStageholder();
  const segments = useSegments();
  const router = useRouter();
  const theme = useTheme();
  // Theme tokens for the native stack chrome (scene bg so no white flash on
  // push; header surface + tint so headers match light/dark).
  const sceneBg = theme.background?.val ?? "transparent";
  const headerTint = theme.color?.val;
  // Re-lock the journal after 5 min in the background (hooks above the early
  // returns — they must run unconditionally).
  useJournalAutoLock();

  // The authenticated user's `sub` keys the per-account onboarding flag. Only
  // present once authenticated (state.data is the me-response); undefined
  // otherwise, which keeps the effect below inert until we have an identity.
  const sub = state.status === "authenticated" ? state.data.sub : undefined;
  // expo-router types `segments` as a route-tuple union — widen for the
  // membership test.
  const onOnboarding = (segments as string[]).includes("onboarding");

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

  // SERVER source of truth for onboarding — so a user who onboarded on the PWA
  // (or another device) isn't shown the wizard here. Merged with the local
  // flag: EITHER being true means done. The local flag is the instant/offline
  // path; the server flag catches cross-device completion.
  const meQuery = useMeridianMe(!!sub);
  const localDone = onboarded === true;
  const serverDone = meQuery.data?.hasCompletedOnboarding === true;
  const anyDone = localDone || serverDone;
  const localResolved = onboarded !== null;
  // Success OR error both count as "resolved" — on a /me error we fall back to
  // the local flag rather than hang (offline = same behavior as before).
  const serverResolved = !meQuery.isLoading;

  // Configure RevenueCat as soon as we have an identity — at the authed root,
  // not just on the paywall mount — so restore/purchase work from anywhere and
  // store events are keyed to this user the moment they sign in.
  // `configurePurchases` is idempotent (caches per-sub, no-ops when IAP is off);
  // a different sub (account switch) re-configures.
  useEffect(() => {
    if (!sub) return;
    void configurePurchases(sub);
  }, [sub]);

  // The onboarding redirect must be IMPERATIVE (effect + router.replace), not
  // a render-time <Redirect> that replaces <Stack>: the wizard route lives
  // INSIDE the Stack navigator below, so returning <Redirect> instead of it
  // unmounts the very navigator the navigation targets — the action can never
  // complete, segments never change, the gate redirects again on every render,
  // and React throws "Maximum update depth exceeded". the Stack stays mounted; a
  // full-screen overlay (bottom of the render) masks the dashboard while the
  // flag resolves / the replace lands, so nothing half-loaded ever flashes.
  // (Hook lives ABOVE the early returns — hooks must run unconditionally.)
  // Route to onboarding only once we're SURE it's needed: neither flag says
  // done, the local flag has resolved, AND the server flag has resolved (so a
  // PWA-onboarded user is masked by the splash during the /me fetch instead of
  // flashing the wizard). If the local flag already says done, short-circuit.
  const needsOnboarding =
    !onOnboarding && !anyDone && localResolved && serverResolved;
  // Hold the masking splash while EITHER flag is still resolving (and neither
  // has already confirmed done).
  const resolvingFlag =
    !onOnboarding && !anyDone && (!localResolved || !serverResolved);
  useEffect(() => {
    if (needsOnboarding) router.replace("/(authed)/onboarding");
  }, [needsOnboarding, router]);

  // Retry handler for the recoverable `error` state below (network/server blip
  // at startup with a still-valid refresh token). `refreshSession()` re-runs
  // the failed refresh; success transitions state → authenticated and the tabs
  // render. Kept above the early returns so hook order stays stable.
  const [retrying, setRetrying] = useState(false);
  const retrySession = useCallback(() => {
    setRetrying(true);
    void refreshSession().finally(() => setRetrying(false));
  }, [refreshSession]);

  // While the provider hydrates its session from SecureStore, hold render
  // behind a centered spinner — bg from the theme so it matches light/dark.
  if (state.status === "loading") {
    return (
      <View flex={1} items="center" justify="center" bg="$background">
        <Spinner size="large" />
      </View>
    );
  }
  // `unauthenticated` = no/invalid refresh token → genuinely signed out; bounce
  // to sign-in. NOTE this is DISTINCT from `error`: the SDK only reaches
  // `unauthenticated` when there's no refresh token or it was revoked
  // (invalid_grant → clearAll), so the redirect is safe here.
  if (state.status === "unauthenticated") {
    return <Redirect href="/sign-in" />;
  }
  // `error` is NOT a dead session: the SDK enters it only when a startup
  // refresh fails for a NON-auth reason (network/server) AND there's no stale
  // token to fall back on — the refresh token is still valid. Bouncing to
  // sign-in would strand an offline user on a screen they can't complete while
  // silently holding a recoverable session. Show a retry surface instead.
  if (state.status === "error") {
    return (
      <View flex={1} items="center" justify="center" bg="$background" p="$6">
        <YStack gap="$3" maxW={340} items="center">
          <Text fontSize="$6" fontWeight="600" text="center">
            Couldn&apos;t connect
          </Text>
          <Text fontSize="$3" color="$mutedForeground" text="center">
            We couldn&apos;t reach your account. Check your connection and try
            again — you&apos;re still signed in.
          </Text>
          <Button intent="primary" onPress={retrySession} disabled={retrying}>
            {retrying ? "Retrying…" : "Try again"}
          </Button>
        </YStack>
      </View>
    );
  }

  // Authenticated — render the navigation frame (plus the masking overlay while the
  // onboarding state is still settling; see the gate comment above).
  return (
    <CalendarPickerProvider>
      <View flex={1}>
        <Stack
          screenOptions={{
            contentStyle: { backgroundColor: sceneBg },
            headerStyle: { backgroundColor: sceneBg },
            headerTintColor: headerTint,
            headerTitleStyle: { color: headerTint },
            headerShadowVisible: false,
            // iOS: chevron-only back button (the previous screen's title
            // crowds narrow headers).
            headerBackButtonDisplayMode: "minimal",
          }}
        >
          <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
          <Stack.Screen name="habits/[id]" options={{ title: "Habit" }} />
          <Stack.Screen name="calendar" options={{ title: "Calendar" }} />
          <Stack.Screen name="journey" options={{ title: "Journey" }} />
          <Stack.Screen name="billing" options={{ title: "Plans & billing" }} />
          <Stack.Screen name="journal/[id]" options={{ title: "Entry" }} />
          <Stack.Screen name="journal/new" options={{ title: "New entry" }} />
          {/* Paywall — a modal sheet (swipe down to dismiss), the platform
              convention for a purchase flow. */}
          <Stack.Screen
            name="upgrade"
            options={{ title: "Upgrade", presentation: "modal" }}
          />
          {/* Onboarding — full-screen gated flow: no header, no swipe-back
              escape hatch out of it. */}
          <Stack.Screen
            name="onboarding"
            options={{
              headerShown: false,
              gestureEnabled: false,
              animation: "fade",
            }}
          />
        </Stack>
        {/* Masks the dashboard while the SecureStore flag resolves and while
            the onboarding replace() is in flight — keeps the Stack mounted (the
            redirect needs the navigator alive, see comment above) without
            ever flashing a screen the user shouldn't see yet. */}
        {resolvingFlag || needsOnboarding ? (
          <View
            position="absolute"
            t={0}
            l={0}
            r={0}
            b={0}
            items="center"
            justify="center"
            bg="$background"
            z={100}
          >
            <Spinner size="large" />
          </View>
        ) : null}
      </View>
    </CalendarPickerProvider>
  );
}
