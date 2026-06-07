// apps/mobile/app/(authed)/onboarding.tsx
//
// Native onboarding wizard — the mobile counterpart of the PWA's
// apps/pwa/src/routes/_auth/onboarding.tsx. Same five shared steps from
// @repo/features/onboarding (Welcome → Profile → Goals → Tour → Complete) and
// the same host-owns-the-state-machine contract; the only divergences are the
// host chrome (a native SafeAreaView + ScrollView instead of a centered web
// viewport) and the completion sink:
//
//   - PWA marks completion SERVER-side (POST /me/onboarding/complete) and reads
//     `hasCompletedOnboarding` back off the session.
//   - Mobile marks it LOCALLY via lib/onboarding.markOnboarded(sub)
//     (expo-secure-store, per-account). The (authed) layout's gate reads the
//     same flag with isOnboarded(sub). Reinstall-as-fresh-start is intentional
//     (see lib/onboarding.ts) — a "welcome back" moment, not a server fact.
//
// This screen lives INSIDE the (authed) tree (not the root stack) because it
// needs the authenticated `sub`, and the gate that routes into it lives in the
// (authed) layout. It's registered as a hidden tab (href: null) so the custom
// BottomNav never lists it.

import { useCallback, useState } from "react";
import { useRouter } from "expo-router";
import { useUser, useUpdateProfile } from "@stageholder/sdk/react-native";
import { Button, ScrollView, View, XStack, YStack } from "@stageholder/ui";
import {
  WelcomeStep,
  ProfileStep,
  GoalsStep,
  TourStep,
  CompleteStep,
} from "@repo/features/onboarding";
import {
  SafeAreaView,
  useSafeAreaInsets,
} from "react-native-safe-area-context";

import { markOnboarded } from "@/lib/onboarding";

const TOTAL_STEPS = 5;

export default function OnboardingScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { user } = useUser();
  const updateProfile = useUpdateProfile();

  const [step, setStep] = useState(0);
  const [selectedGoals, setSelectedGoals] = useState<string[]>([]);

  const sub = user?.sub;

  // Persist the local completion flag, then leave the wizard. The (authed)
  // gate re-reads isOnboarded(sub) on the next mount of the dashboard and lets
  // the user through. `replace` (not push) so the back gesture can't re-enter
  // a finished flow.
  const finishOnboarding = useCallback(async () => {
    if (!sub) return;
    await markOnboarded(sub);
    router.replace("/");
  }, [router, sub]);

  // Skip = same completion, just without walking the remaining steps. Silent
  // on failure (CompleteStep is the primary error surface) — the user can
  // still reach the end of the flow normally.
  const handleSkip = useCallback(async () => {
    if (!sub) return;
    try {
      await markOnboarded(sub);
      router.replace("/");
    } catch {
      // Intentionally silent — see above.
    }
  }, [router, sub]);

  // The gate only routes here once authenticated, but guard anyway so the
  // steps never read a null identity (and TS narrows `user` below). Placed
  // AFTER all hooks so hook order stays stable across renders.
  if (!user) return null;

  const stepComponent = (() => {
    switch (step) {
      case 0:
        return (
          <WelcomeStep name={user.name ?? ""} onContinue={() => setStep(1)} />
        );
      case 1:
        return (
          <ProfileStep
            initialName={user.name ?? ""}
            isPending={updateProfile.isPending}
            error={updateProfile.error}
            // Save name + timezone to the Stageholder profile, THEN advance.
            // Throwing keeps the wizard on this step; ProfileStep surfaces the
            // `error` prop inline.
            onSubmit={async ({ displayName, timezone }) => {
              await updateProfile.mutateAsync({ displayName, timezone });
              setStep(2);
            }}
          />
        );
      case 2:
        return (
          <GoalsStep
            selectedGoals={selectedGoals}
            onGoalsChange={setSelectedGoals}
            onContinue={() => setStep(3)}
          />
        );
      case 3:
        return (
          <TourStep
            selectedGoals={selectedGoals}
            onContinue={() => setStep(4)}
          />
        );
      case 4:
        return <CompleteStep onFinish={finishOnboarding} />;
      default:
        return null;
    }
  })();

  const lastStep = TOTAL_STEPS - 1;

  return (
    <YStack flex={1} bg="$background">
      <SafeAreaView style={{ flex: 1 }} edges={["top", "left", "right"]}>
        {/* Fixed header (dots) + fixed footer (Back/Skip) with the step card
            SCROLLING between them — steps like the tour list outgrow a phone
            viewport, so the card cannot live in a fixed centered column (the
            old layout let content run under the footer). flexGrow + centered
            contentContainer keeps short steps vertically centered like
            before; tall steps scroll naturally. */}
        <YStack flex={1}>
          {/* Progress dots — active brand, completed muted-brand, upcoming
              faint. Mirrors the PWA's dot row. */}
          <XStack items="center" justify="center" gap="$2" pt="$4" pb="$2">
            {Array.from({ length: TOTAL_STEPS }).map((_, i) => (
              <View
                key={i}
                height={7}
                width={7}
                rounded={9999}
                transition="quick"
                bg={
                  i === step
                    ? "$primary"
                    : i < step
                      ? "$primaryMuted"
                      : "$muted"
                }
              />
            ))}
          </XStack>

          <ScrollView
            flex={1}
            showsVerticalScrollIndicator={false}
            contentContainerStyle={{
              grow: 1,
              justify: "center",
              px: 20,
              py: 16,
            }}
          >
            {/* Step content card — constrained so the wizard reads as a
                focused card rather than stretching edge-to-edge on tablets. */}
            <YStack
              width="100%"
              maxW={512}
              self="center"
              rounded="$6"
              borderWidth={1}
              borderColor="$borderColor"
              bg="$card"
              p="$6"
            >
              {stepComponent}
            </YStack>
          </ScrollView>

          {/* Navigation — Back (mid-flow) on the left, Skip (before the last
              step) on the right; the last step's CTA lives in CompleteStep.
              Fixed below the scroll area so it never overlaps step content. */}
          <XStack
            items="center"
            justify="space-between"
            width="100%"
            maxW={512}
            self="center"
            px="$5"
            pt="$2"
            style={{ paddingBottom: insets.bottom + 16 }}
          >
            <View>
              {step > 0 && step < lastStep ? (
                <Button
                  intent="ghost"
                  size="sm"
                  onPress={() => setStep(step - 1)}
                >
                  Back
                </Button>
              ) : null}
            </View>
            {step < lastStep ? (
              <Button intent="ghost" size="sm" onPress={handleSkip}>
                Skip setup
              </Button>
            ) : null}
          </XStack>
        </YStack>
      </SafeAreaView>
    </YStack>
  );
}
