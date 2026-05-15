// apps/mobile/app/_layout.tsx
//
// Root layout wires every cross-cutting provider before Expo Router takes
// over. Order matters: gestures → safe-area → Tamagui → theme → brand →
// haptics → toasts → SDK auth → router slot.
//
// The SDK still drives auth state and the redirect-on-signOut callback;
// nothing about that changed. We just gain a Tamagui-aware tree below it.

import { StageholderProvider } from "@stageholder/sdk/react-native";
import {
  BrandProvider,
  HapticProvider,
  ToastProvider,
  UIProvider,
} from "@stageholder/ui";
import Constants from "expo-constants";
import { Slot, useRouter } from "expo-router";
import { useEffect } from "react";
import { StatusBar } from "expo-status-bar";
import * as WebBrowser from "expo-web-browser";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import { SafeAreaProvider } from "react-native-safe-area-context";
import { Theme } from "tamagui";

import { QueryProvider } from "@/lib/api";
import { useBrandStore } from "@/lib/brand-store";
import { expoHapticImpl } from "@/lib/haptic-impl";

// Required at app top-level so the system browser handoff completes on web.
// No-op on native, but documented as a best-practice pattern by Expo.
WebBrowser.maybeCompleteAuthSession();

const ISSUER_URL =
  process.env.EXPO_PUBLIC_STAGEHOLDER_ISSUER_URL ??
  (Constants.expoConfig?.extra?.["stageholderIssuerUrl"] as string | undefined);

const CLIENT_ID =
  process.env.EXPO_PUBLIC_STAGEHOLDER_CLIENT_ID ??
  (Constants.expoConfig?.extra?.["stageholderClientId"] as string | undefined);

export default function RootLayout() {
  const router = useRouter();
  const brand = useBrandStore((s) => s.brand);
  const hydrateBrand = useBrandStore((s) => s.hydrate);

  useEffect(() => {
    if (!ISSUER_URL || !CLIENT_ID) {
      console.error(
        "[meridian-mobile] Missing EXPO_PUBLIC_STAGEHOLDER_ISSUER_URL or " +
          "EXPO_PUBLIC_STAGEHOLDER_CLIENT_ID. Copy .env.local.example to " +
          ".env.local and fill in values, then restart the dev server.",
      );
    }
  }, []);

  // Hydrate persisted brand from expo-secure-store on first mount. Initial
  // render uses the "cosmos" default; once hydrate resolves, the brand
  // swaps in place (acceptable single transient if the user picked a
  // non-default brand previously).
  useEffect(() => {
    hydrateBrand();
  }, [hydrateBrand]);

  if (!ISSUER_URL || !CLIENT_ID) {
    return null;
  }

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <SafeAreaProvider>
        <UIProvider defaultTheme="dark">
          <Theme name="dark">
            {/* Brand is driven by useBrandStore so Profile can switch it
                live. Initial render is cosmos until hydrate() resolves. */}
            <BrandProvider brand={brand}>
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
                        onUnauthorized handler can drive SDK sign-out (the
                        SDK already handles the SecureStore cleanup on
                        sign-out; we just kick off the route change). */}
                    <QueryProvider
                      onUnauthorized={() => router.replace("/sign-in")}
                    >
                      <StatusBar style="light" />
                      <Slot />
                    </QueryProvider>
                  </StageholderProvider>
                </ToastProvider>
              </HapticProvider>
            </BrandProvider>
          </Theme>
        </UIProvider>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}
