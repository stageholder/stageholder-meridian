import { StageholderProvider } from "@stageholder/sdk/react-native";
import Constants from "expo-constants";
import { Slot, useRouter } from "expo-router";
import { useEffect } from "react";
import * as WebBrowser from "expo-web-browser";

// Required at app top-level so the system browser handoff completes on web.
// No-op on native, but documented as a best-practice pattern by Expo.
WebBrowser.maybeCompleteAuthSession();

const ISSUER_URL =
  process.env.EXPO_PUBLIC_STAGEHOLDER_ISSUER_URL ??
  // Fallback for fresh checkouts: read from app.json's `extra` block if set.
  (Constants.expoConfig?.extra?.["stageholderIssuerUrl"] as string | undefined);

const CLIENT_ID =
  process.env.EXPO_PUBLIC_STAGEHOLDER_CLIENT_ID ??
  (Constants.expoConfig?.extra?.["stageholderClientId"] as string | undefined);

export default function RootLayout() {
  const router = useRouter();

  useEffect(() => {
    if (!ISSUER_URL || !CLIENT_ID) {
      console.error(
        "[meridian-mobile] Missing EXPO_PUBLIC_STAGEHOLDER_ISSUER_URL or " +
          "EXPO_PUBLIC_STAGEHOLDER_CLIENT_ID. Copy .env.local.example to " +
          ".env.local and fill in values, then restart the dev server.",
      );
    }
  }, []);

  if (!ISSUER_URL || !CLIENT_ID) {
    return null;
  }

  return (
    <StageholderProvider
      productSlug="meridian"
      config={{
        issuerUrl: ISSUER_URL,
        clientId: CLIENT_ID,
        scheme: "meridian",
        // Per-product audience — Hub stamps this on access tokens issued
        // for this client. Match the value set on the oidc_clients row's
        // `audience` column.
        audience: "meridian-api",
        // Biometric off by default. Flip to "on-launch" to require Face ID /
        // Touch ID on cold start once you've decided that's the UX you want.
        biometric: "off",
      }}
      onSignedOut={() => router.replace("/sign-in")}
    >
      <Slot />
    </StageholderProvider>
  );
}
