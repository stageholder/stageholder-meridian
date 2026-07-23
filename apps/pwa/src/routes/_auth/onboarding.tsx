import { useCallback, useEffect } from "react";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useQueryClient } from "@tanstack/react-query";
import { Button, Text, YStack, toast } from "@stageholder/ui";
import {
  useUser as useSdkUser,
  useProfile,
  useUpdateProfile,
} from "@stageholder/sdk/spa";
import { useUser } from "@/hooks/use-user";
import { apiClient } from "@/lib/api-client";
import type { MeridianUserMeta } from "@/lib/me-query";
import {
  OnboardingWizard,
  ONBOARDING_STEP_IDS,
  type OnboardingProfileValue,
} from "@repo/features/onboarding";
import type { OnboardingValues } from "@stageholder/ui";

export const Route = createFileRoute("/_auth/onboarding")({
  component: OnboardingPage,
});

async function postCompletion(): Promise<void> {
  // Hits the Meridian API directly via the SPA-backed apiClient (Bearer +
  // transparent refresh handled by the SDK). Flips the server
  // `hasCompletedOnboarding` flag.
  await apiClient.post("/me/onboarding/complete", {});
}

function OnboardingPage() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  // Auth + identity come from the SDK SESSION. hasCompletedOnboarding comes from
  // `/me` (use-user) — used ONLY for the "already onboarded" shortcut.
  const sdk = useSdkUser();
  const { user } = useUser();
  const { data: profile, isLoading: profileLoading } = useProfile();
  const updateProfile = useUpdateProfile();

  // Enter the app IMMEDIATELY — the finish action must NEVER block on (or be
  // reverted by) the network, or a slow / failed completion call traps the user
  // on the finish screen ("stuck after finish"). We optimistically write
  // `hasCompletedOnboarding: true` into the meta cache (the `_app` gate's source
  // — see App.tsx) and navigate. Crucially we do NOT invalidate here: an
  // immediate `/me` refetch can read-after-write race and flip the flag back to
  // `false`, bouncing the user back to onboarding. The optimistic value holds;
  // a later natural refetch reconciles once the write has propagated. (Mirrors
  // the native host, which enters via its local flag regardless of the server.)
  const enterApp = useCallback(() => {
    const key = ["meridian-user-meta", sdk.user?.sub] as const;
    queryClient.setQueryData<MeridianUserMeta>(key, (old) => ({
      personalOrgId: old?.personalOrgId ?? "",
      hasCompletedOnboarding: true,
    }));
    navigate({ to: "/" });
  }, [queryClient, navigate, sdk.user?.sub]);

  // Persist completion server-side with a few retries — in the BACKGROUND, so it
  // can't block entry. Returns whether it ultimately succeeded.
  const persistCompletion = useCallback(async (): Promise<boolean> => {
    for (let attempt = 0; attempt < 3; attempt++) {
      try {
        await postCompletion();
        return true;
      } catch {
        await new Promise((r) => setTimeout(r, 500 * (attempt + 1)));
      }
    }
    return false;
  }, []);

  // End of the wizard: enter the app now, then save the profile + persist
  // completion in the background (both best-effort — editable / retried later).
  // Never throws (the kit's finish awaits this).
  const handleComplete = useCallback(
    async (values: OnboardingValues) => {
      enterApp();
      const p = values[ONBOARDING_STEP_IDS.profile] as
        | OnboardingProfileValue
        | undefined;
      if (p?.displayName?.trim()) {
        updateProfile
          .mutateAsync({
            displayName: p.displayName.trim(),
            timezone: p.timezone,
          })
          .catch(() =>
            toast.error("Couldn't save your profile", {
              description: "You can update it later in Settings.",
            }),
          );
      }
      const ok = await persistCompletion();
      if (!ok) {
        toast.error("We couldn't finish syncing your setup", {
          description: "You're in — it'll retry next time you open the app.",
        });
      }
    },
    [enterApp, updateProfile, persistCompletion],
  );

  // Header close (X) = "skip setup": enter now, persist completion in the
  // background (no profile save).
  const handleSkip = useCallback(() => {
    enterApp();
    void persistCompletion();
  }, [enterApp, persistCompletion]);

  // Already onboarded → straight to the app (never back to /auth/login). In an
  // effect (not during render) to avoid a render-phase navigation warning.
  useEffect(() => {
    if (user?.hasCompletedOnboarding) navigate({ to: "/" });
  }, [user?.hasCompletedOnboarding, navigate]);

  // While the SESSION or the PROFILE is still resolving, show a quiet loader —
  // the wizard is seeded from the fetched profile, so it mounts only once ready.
  if (sdk.isLoading || (sdk.user && profileLoading)) {
    return (
      <YStack minH={"100vh" as never} items="center" justify="center" px="$6">
        <Text fontSize="$3" color="$mutedForeground">
          Loading…
        </Text>
      </YStack>
    );
  }

  // No session/identity — show an error and let the user retry. We do NOT
  // redirect back to /auth/login (that's the loop).
  if (!sdk.user) {
    return (
      <YStack
        minH={"100vh" as never}
        items="center"
        justify="center"
        px="$6"
        gap="$4"
      >
        <YStack maxW={420} items="center" gap="$2">
          <Text fontSize="$6" fontWeight="600" text="center">
            We couldn&rsquo;t load your account
          </Text>
          <Text fontSize="$3" color="$mutedForeground" text="center">
            Your session didn&rsquo;t finish loading. Please try again.
          </Text>
        </YStack>
        <Button onPress={() => window.location.reload()}>Try again</Button>
      </YStack>
    );
  }

  const initialProfile: OnboardingProfileValue = {
    displayName: profile?.displayName ?? sdk.user.name ?? "",
    timezone:
      profile?.timezone ?? Intl.DateTimeFormat().resolvedOptions().timeZone,
  };

  return (
    <YStack minH={"100vh" as never} justify="center" py="$8">
      <OnboardingWizard
        firstName={(sdk.user.name ?? "").split(" ")[0] ?? ""}
        initialProfile={initialProfile}
        onComplete={handleComplete}
        onSkip={handleSkip}
      />
    </YStack>
  );
}
