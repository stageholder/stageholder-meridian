// apps/mobile/app/_layout.tsx
//
// Root layout wires every cross-cutting provider before Expo Router takes
// over. Order matters: gestures → safe-area → Tamagui (themed) → haptics →
// toasts → SDK auth → React Query → router stack.
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
// The SDK still drives auth state and the redirect-on-signOut / 401 callbacks;
// QueryProvider sits INSIDE <StageholderProvider> so its AuthTokenBridge can
// read `useAccessToken()` (see lib/api/Provider.tsx).

import { StageholderProvider } from "@stageholder/sdk/react-native";
import {
  HapticProvider,
  Theme,
  ToastProvider,
  UIProvider,
} from "@stageholder/ui";
import Constants from "expo-constants";
import { SplashScreen, Stack, useRouter } from "expo-router";
import { StatusBar } from "expo-status-bar";
import * as WebBrowser from "expo-web-browser";
import { useEffect, useState } from "react";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import { SafeAreaProvider } from "react-native-safe-area-context";

import { QueryProvider } from "@/lib/api";
import { useAppFonts } from "@/lib/fonts";
import { expoHapticImpl } from "@/lib/haptic-impl";
import { initTheme, useAppTheme } from "@/lib/platform/theme";

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
    // The effect above logged a descriptive error; render nothing rather than
    // mounting StageholderProvider with an invalid config (it would throw
    // ConfigError at mount).
    return null;
  }

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <SafeAreaProvider>
        {/* UIProvider seeds the initial theme; the inner <Theme name> keeps
            the whole tree following live preference changes from the store. */}
        <UIProvider defaultTheme={resolvedTheme}>
          <Theme name={resolvedTheme}>
            <HapticProvider impl={expoHapticImpl}>
              <ToastProvider>
                <StageholderProvider
                  productSlug="meridian"
                  config={{
                    issuerUrl: ISSUER_URL,
                    clientId: CLIENT_ID,
                    scheme: "meridian",
                    audience: "meridian-api",
                    biometric: "off",
                  }}
                  onSignedOut={() => router.replace("/sign-in")}
                >
                  {/* QueryProvider sits INSIDE the SDK provider so its
                      AuthTokenBridge can read useAccessToken(), and its
                      onUnauthorized can drive the route change on a 401. */}
                  <QueryProvider
                    onUnauthorized={() => router.replace("/sign-in")}
                  >
                    <StatusBar
                      style={resolvedTheme === "dark" ? "light" : "dark"}
                    />
                    <Stack screenOptions={{ headerShown: false }}>
                      <Stack.Screen name="sign-in" />
                      <Stack.Screen name="(authed)" />
                    </Stack>
                  </QueryProvider>
                </StageholderProvider>
              </ToastProvider>
            </HapticProvider>
          </Theme>
        </UIProvider>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}
