// apps/mobile/lib/hooks/use-sign-out.ts
//
// Sign-out flow (moved out of the retired Profile sheet into Settings).
// `confirmSignOut()` asks first — signing out also locks the journal, so the
// passphrase has to be re-entered afterwards — then tears down in the order
// that matters for shared devices.

import { useStageholder, useUser } from "@stageholder/sdk/react-native";
import { toast } from "@stageholder/ui";
import { useCallback, useState } from "react";
import { Alert, Platform } from "react-native";

import { queryClient } from "@/lib/api";
import { lockJournal } from "@/lib/journal-crypto";
import { configurePurchases, logOutPurchases } from "@/lib/purchases";

export function useSignOut() {
  const { user } = useUser();
  const { signOut } = useStageholder();
  const [signingOut, setSigningOut] = useState(false);

  const run = useCallback(async () => {
    setSigningOut(true);
    try {
      // Reset RevenueCat identity FIRST so a shared device doesn't attribute
      // the next signed-in user's purchases/restores to this user.
      await logOutPurchases();
      // SECURITY (cross-account DEK bleed): drop the in-memory DEK + all
      // journal key material and every cached/decrypted entry BEFORE the
      // signOut round-trip (the root layout's onSignedOut repeats this).
      lockJournal();
      queryClient.clear();
      // ANDROID ONLY — `endSession`: Custom Tabs share Chrome's cookie jar,
      // so without RP-initiated logout the Hub SSO cookie survives and the
      // next sign-in silently re-authenticates as the same user. iOS uses an
      // ephemeral ASWebAuthenticationSession, so the hop is skipped there.
      // The root layout's onSignedOut redirects to /sign-in.
      await signOut(
        Platform.OS === "android" ? { endSession: true } : undefined,
      );
    } catch (err) {
      // Still signed in — re-bind RevenueCat to this user.
      if (user?.sub) await configurePurchases(user.sub).catch(() => {});
      setSigningOut(false);
      toast.error("Couldn't sign out", {
        description: (err as Error).message ?? "Try again.",
      });
    }
  }, [signOut, user?.sub]);

  const confirmSignOut = useCallback(() => {
    Alert.alert(
      "Sign out?",
      "Your journal will lock — you'll need your passphrase to open it again.",
      [
        { text: "Cancel", style: "cancel" },
        { text: "Sign out", style: "destructive", onPress: () => void run() },
      ],
    );
  }, [run]);

  return { confirmSignOut, signingOut };
}
