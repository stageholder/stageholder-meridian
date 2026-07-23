// apps/mobile/app/_layout.tsx
//
// Root layout wires every cross-cutting provider before Expo Router takes
// over. Order matters: gestures → keyboard → safe-area → Tamagui (themed) →
// haptics → toasts → SDK auth → React Query → router stack.
//
// KeyboardProvider (react-native-keyboard-controller) sits OUTSIDE
// SafeAreaProvider — same outside→inside order as the kit's reference app
// (stageholder-ui/apps/docs-expo/app/_layout.tsx). It's the native bridge the
// kit's RichTextEditor.native (10tap) keyboard-avoidance + KeyboardStickyView
// toolbar need; without it the journal editor's toolbar won't track the
// keyboard. A no-op until something mounts a keyboard-aware view.
//
// Two things changed from the pre-d5f3089 shell:
//   1. BrandProvider is gone. The current kit (@stageholder/ui 0.3.0-alpha.20)
//      no longer exports a BrandProvider, so the brand-store wiring it fed is
//      dropped here. Theme selection is now light/dark only, driven by the
//      cross-platform theme store in lib/platform/theme.ts.
//   2. Theme is no longer hard-pinned to "dark". `useAppTheme()` resolves the
//      user's persisted light/dark/system preference; UIProvider's
//      `defaultTheme` + a `<Theme name>` wrapper both follow it so the whole
//      tree (and the OS status bar) re-themes live.
//
// The SDK drives auth state and the teardown callbacks — redirect-on-signOut
// (explicit) and onAuthError (terminal session death, e.g. a dead refresh
// token). QueryProvider sits INSIDE <StageholderProvider> so its
// AuthTokenBridge can read `useAccessToken()` (see lib/api/Provider.tsx).

import { StageholderProvider } from "@stageholder/sdk/react-native";
import {
  CelebrationProvider,
  HapticProvider,
  Theme,
  Toaster,
} from "@stageholder/ui";
import { TamaguiProvider } from "tamagui";
import Constants from "expo-constants";
import { SplashScreen, Stack, useRouter } from "expo-router";
import { StatusBar } from "expo-status-bar";
import * as WebBrowser from "expo-web-browser";
import { useEffect, useState } from "react";
import { Text, View } from "react-native";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import { KeyboardProvider } from "react-native-keyboard-controller";
import { SafeAreaProvider } from "react-native-safe-area-context";

import { QueryProvider, queryClient } from "@/lib/api";
import { PaywallHost } from "@/components/paywall-sheet";
import { useAppFonts } from "@/lib/fonts";
import { expoHapticImpl } from "@/lib/haptic-impl";
import { lockJournal } from "@/lib/journal-crypto";
import { initTheme, useAppTheme } from "@/lib/platform/theme";
import { config as tamaguiConfig } from "../tamagui.config";

// Required at app top-level so the system-browser auth handoff completes on
// web. No-op on native, but documented by Expo as a best-practice pattern.
WebBrowser.maybeCompleteAuthSession();

// Keep the splash screen up until fonts AND the persisted theme have loaded —
// hiding early would flash the system font + the wrong color scheme for a
// frame. Called at module scope so it runs before the first render. The
// rejection is swallowed: it only fails if the splash was already hidden,
// which is harmless.
SplashScreen.preventAutoHideAsync().catch(() => {});

// SDK config is read from EXPO_PUBLIC_* env (bundled at build time) with an
// app.json `extra` fallback. These are the same var names lib/api/client.ts
// and the SDK provider expect — keep them in sync with .env.example.
const ISSUER_URL =
  process.env.EXPO_PUBLIC_STAGEHOLDER_ISSUER_URL ??
  (Constants.expoConfig?.extra?.["stageholderIssuerUrl"] as string | undefined);

const CLIENT_ID =
  process.env.EXPO_PUBLIC_STAGEHOLDER_CLIENT_ID ??
  (Constants.expoConfig?.extra?.["stageholderClientId"] as string | undefined);

/**
 * SECURITY (cross-account DEK bleed): on a confirmed end-of-session — an
 * explicit sign-out (`onSignedOut`) or terminal session death (`onAuthError`,
 * the SDK's refresh got `invalid_grant`) — scrub the journal key material
 * (in-memory DEK + wrapped-DEK + salt) and purge the in-memory React Query
 * cache, so the next account signing in on this device inherits neither the
 * previous user's DEK nor any of their decrypted/cached journal data. (The
 * on-disk cache purge is gone with cache persistence itself — nothing is
 * written to disk anymore; see lib/api/query-client.ts.) Idempotent — safe
 * to run from more than one path (profile-sheet also calls this pre-signOut,
 * and onSignedOut/onAuthError may both fire around a teardown).
 */
function purgeSessionState(): void {
  lockJournal();
  queryClient.clear();
}

export default function RootLayout() {
  const router = useRouter();
  const { resolvedTheme } = useAppTheme();

  const [fontsLoaded, fontError] = useAppFonts();

  // True once initTheme() has resolved (persisted preference applied). The
  // theme store commits + notifies subscribers when it resolves, so
  // `resolvedTheme` is already correct by the time this flips true.
  const [themeReady, setThemeReady] = useState(false);
  useEffect(() => {
    let cancelled = false;
    initTheme().finally(() => {
      if (!cancelled) setThemeReady(true);
    });
    return () => {
      cancelled = true;
    };
  }, []);

  // Hide the splash only once BOTH fonts and theme are ready — hiding earlier
  // would flash the system font or the wrong color scheme. A font load error
  // still counts as "ready": the system font is an acceptable fallback, far
  // better than a stuck splash. hideAsync is idempotent.
  const fontsSettled = fontsLoaded || !!fontError;
  useEffect(() => {
    if (fontsSettled && themeReady) {
      SplashScreen.hideAsync().catch(() => {});
    }
  }, [fontsSettled, themeReady]);

  useEffect(() => {
    if (!ISSUER_URL || !CLIENT_ID) {
      console.error(
        "[meridian-mobile] Missing EXPO_PUBLIC_STAGEHOLDER_ISSUER_URL or " +
          "EXPO_PUBLIC_STAGEHOLDER_CLIENT_ID. Copy .env.example to " +
          ".env.local and fill in values, then restart the dev server.",
      );
    }
  }, []);

  // Hold the tree until fonts settle AND the theme has hydrated. The splash
  // screen is still up here, so returning null shows the splash — not a blank
  // frame — and the first real frame is already correctly themed/fonted.
  if (!fontsSettled || !themeReady) {
    return null;
  }

  if (!ISSUER_URL || !CLIENT_ID) {
    // The effect above logged a descriptive error. Mounting StageholderProvider
    // with an invalid config throws ConfigError, so we can't render the app —
    // but returning null once the splash is hidden leaves a silent blank screen
    // that reads as a crash. Render a plain RN fallback (no provider tree is up
    // yet, so no Tamagui/theme dependency) telling the operator exactly what to
    // fix. Only reachable on a misconfigured build, never in normal use.
    return (
      <View
        style={{
          flex: 1,
          alignItems: "center",
          justifyContent: "center",
          padding: 32,
          backgroundColor: "#0b0b0f",
        }}
      >
        <Text
          style={{
            color: "#fafafa",
            fontSize: 18,
            fontWeight: "600",
            marginBottom: 12,
            textAlign: "center",
          }}
        >
          Configuration required
        </Text>
        <Text
          style={{
            color: "#a1a1aa",
            fontSize: 14,
            lineHeight: 20,
            textAlign: "center",
          }}
        >
          EXPO_PUBLIC_STAGEHOLDER_ISSUER_URL and
          EXPO_PUBLIC_STAGEHOLDER_CLIENT_ID are not set. Copy .env.example to
          .env.local, fill in the values, then restart the dev server.
        </Text>
      </View>
    );
  }

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      {/* KeyboardProvider wraps everything below the gesture root (outside
          SafeAreaProvider) — the kit RichTextEditor.native's keyboard-aware
          toolbar reads from it. Order matches the kit reference app. */}
      <KeyboardProvider>
        <SafeAreaProvider>
          {/* The app's OWN config (tamagui.config.ts) instead of the kit's
              UIProvider — same building blocks, but with `disableSSR: true`
              (Expo Router has no SSR; see the config file header). Mirrors
              the kit reference app's provider setup. defaultTheme seeds the
              initial theme; the inner <Theme name> keeps the whole tree
              following live preference changes from the store. */}
          {/* HEADLESS providers (SDK auth + react-query) sit OUTSIDE
              TamaguiProvider ON PURPOSE: Tamagui's root portal host renders
              at the TamaguiProvider level, and MODAL SHEETS PORTAL their
              children there. Any context provided BELOW that host is
              invisible to sheet content — react-query hooks inside a
              FormSheet threw "No QueryClient set" until these moved up.
              Both providers render no UI, so Tamagui doesn't need to wrap
              them. Query stays INSIDE the SDK provider so its
              AuthTokenBridge can read useAccessToken(). */}
          <StageholderProvider
            productSlug="meridian"
            config={{
              issuerUrl: ISSUER_URL,
              clientId: CLIENT_ID,
              scheme: "meridian",
              audience: "meridian-api",
              biometric: "off",
            }}
            onSignedOut={() => {
              purgeSessionState();
              router.replace("/sign-in");
            }}
            onAuthError={() => {
              // Terminal session death: the SDK's token refresh got
              // `invalid_grant` (a dead / rotated-away refresh token — e.g.
              // the "logged out after a while" case). This is DISTINCT from a
              // transient network/5xx refresh failure, which the SDK keeps the
              // session alive through (stale claims) and never surfaces here.
              // Same teardown as an explicit sign-out.
              //
              // This is the AUTHORITATIVE terminal signal as of
              // @stageholder/sdk alpha.60: `getAccessToken()` now returns null
              // for BOTH "temporarily unavailable, retry" and terminal death,
              // so teardown must NOT be inferred from a 401 / a null token
              // anymore (doing so forced a spurious re-login on any network
              // blip). The API 401 interceptor is now non-destructive — it lets
              // React Query retry, and death arrives here instead.
              purgeSessionState();
              router.replace("/sign-in");
            }}
          >
            <QueryProvider>
              <TamaguiProvider
                config={tamaguiConfig}
                defaultTheme={resolvedTheme}
              >
                <Theme name={resolvedTheme}>
                  <HapticProvider impl={expoHapticImpl}>
                    {/* Full-screen celebration overlay + useCelebrate().
                        Inside HapticProvider (burst haptics) and Theme.
                        Drives the habit completion burst — see habits.tsx
                        renderCompletionEffect. */}
                    <CelebrationProvider>
                      <StatusBar
                        style={resolvedTheme === "dark" ? "light" : "dark"}
                      />
                      <Stack screenOptions={{ headerShown: false }}>
                        <Stack.Screen name="sign-in" />
                        <Stack.Screen name="(authed)" />
                      </Stack>
                      {/* Server-driven paywall — listens for the API's 402
                          limit_reached event and slides up the upgrade sheet
                          over whatever screen the user is on. */}
                      <PaywallHost />
                      {/* Kit toast renderer — the v2 API is provider-less; this
                          single host near the root receives every `toast.*`
                          call. Sits inside Theme/Tamagui so toasts are themed. */}
                      <Toaster />
                    </CelebrationProvider>
                  </HapticProvider>
                </Theme>
              </TamaguiProvider>
            </QueryProvider>
          </StageholderProvider>
        </SafeAreaProvider>
      </KeyboardProvider>
    </GestureHandlerRootView>
  );
}
