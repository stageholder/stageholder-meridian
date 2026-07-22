// apps/mobile/app/(authed)/onboarding.tsx
//
// Native onboarding host — renders the shared, kit-based `OnboardingWizard`
// (@repo/features/onboarding) inside the native chrome (SafeAreaView + a
// ScrollView so tall steps fit small screens). All wizard structure/UX lives in
// the kit `Onboarding`; this host owns only the data + side effects:
//   • firstName + initialProfile — from the SDK session (name) + device tz.
//   • onComplete — save the profile (best-effort) + mark completion.
//   • onSkip     — mark completion, no profile save.
//
// Completion writes BOTH the local expo-secure-store flag (instant/offline) AND
// the server (POST /me/onboarding/complete via useCompleteOnboarding), so
// onboarding syncs across devices/platforms; the (authed) gate treats EITHER as
// done. `replace` (not push) so the back gesture can't re-enter a finished flow.
//
// Lives INSIDE the (authed) tree (needs the authenticated `sub`); registered as
// a hidden tab (href: null) so the BottomNav never lists it.

import { useCallback } from "react";
import { useRouter } from "expo-router";
import { useUser, useUpdateProfile } from "@stageholder/sdk/react-native";
import { ScrollView, View, YStack } from "@stageholder/ui";
import {
  OnboardingWizard,
  ONBOARDING_STEP_IDS,
  type OnboardingProfileValue,
} from "@repo/features/onboarding";
import type { OnboardingValues } from "@stageholder/ui";
import { SafeAreaView } from "react-native-safe-area-context";

import { useCompleteOnboarding } from "@/lib/api";
import { markOnboarded } from "@/lib/onboarding";

export default function OnboardingScreen() {
  const router = useRouter();
  const { user } = useUser();
  const updateProfile = useUpdateProfile();
  const completeOnboarding = useCompleteOnboarding();

  const sub = user?.sub;

  // Mark completion (local flag first so the gate releases instantly + offline,
  // then the server write best-effort) and leave the wizard.
  const completeAndLeave = useCallback(async () => {
    if (!sub) return;
    await markOnboarded(sub);
    completeOnboarding.mutate(undefined, { onError: () => {} });
    router.replace("/");
  }, [sub, router, completeOnboarding]);

  // End of the wizard: save the profile (best-effort — editable in Settings, so
  // a blip must NOT trap the user), then mark completion. Never throws.
  const handleComplete = useCallback(
    async (values: OnboardingValues) => {
      const p = values[ONBOARDING_STEP_IDS.profile] as
        | OnboardingProfileValue
        | undefined;
      if (p?.displayName?.trim()) {
        try {
          await updateProfile.mutateAsync({
            displayName: p.displayName.trim(),
            timezone: p.timezone,
          });
        } catch {
          // Non-blocking — the name/timezone can be set later in Settings.
        }
      }
      await completeAndLeave();
    },
    [updateProfile, completeAndLeave],
  );

  const handleSkip = useCallback(() => {
    void completeAndLeave();
  }, [completeAndLeave]);

  // The gate only routes here once authenticated, but guard so the wizard never
  // reads a null identity (and the seed below is stable).
  if (!user) return null;

  const initialProfile: OnboardingProfileValue = {
    displayName: user.name ?? "",
    timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
  };

  return (
    <YStack flex={1} bg="$background">
      <SafeAreaView
        style={{ flex: 1 }}
        edges={["top", "left", "right", "bottom"]}
      >
        {/* Tall steps (the tour list) can outgrow a phone viewport, so the whole
            wizard scrolls; short steps stay vertically centered via grow+center. */}
        <ScrollView
          flex={1}
          showsVerticalScrollIndicator={false}
          contentContainerStyle={{ grow: 1, justify: "center" }}
        >
          <View width="100%">
            <OnboardingWizard
              firstName={(user.name ?? "").split(" ")[0]}
              initialProfile={initialProfile}
              onComplete={handleComplete}
              onSkip={handleSkip}
            />
          </View>
        </ScrollView>
      </SafeAreaView>
    </YStack>
  );
}
