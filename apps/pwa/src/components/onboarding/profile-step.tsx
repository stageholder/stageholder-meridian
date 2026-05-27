import { useEffect, useState } from "react";
import { useProfile, useUpdateProfile } from "@stageholder/sdk/spa";
import { Button, Input, Label, Paragraph, Text, YStack } from "@stageholder/ui";
import { TimezoneSelect } from "@/components/settings/timezone-select";

/**
 * Onboarding step where the user confirms display name and picks a
 * timezone. Both fields commit to Hub (single source of truth) on
 * Continue. Skipping or backing out leaves whatever was last persisted.
 *
 * The displayName field is editable here so the user can correct anything
 * imported from their OIDC provider (e.g. an awkward Google account name)
 * before the onboarding flow finishes.
 */
export function ProfileStep({ onContinue }: { onContinue: () => void }) {
  const { data: profile, isLoading } = useProfile();
  const { mutateAsync, isPending, error } = useUpdateProfile();

  const [displayName, setDisplayName] = useState<string>("");
  const [timezone, setTimezone] = useState<string>(
    () => Intl.DateTimeFormat().resolvedOptions().timeZone,
  );
  const [hydrated, setHydrated] = useState(false);

  // Hydrate once from the profile fetch. Profile may load after first paint;
  // we only seed the form when it lands and only once, so user typing during
  // load doesn't get overwritten.
  useEffect(() => {
    if (!profile || hydrated) return;
    setDisplayName(profile.displayName ?? "");
    if (profile.timezone) setTimezone(profile.timezone);
    setHydrated(true);
  }, [profile, hydrated]);

  const handleContinue = async (): Promise<void> => {
    if (!displayName.trim()) return;
    try {
      await mutateAsync({ displayName, timezone });
      onContinue();
    } catch {
      // Error is surfaced inline via the `error` state below; don't advance.
    }
  };

  if (isLoading) {
    return (
      <Text fontSize="$3" color="$mutedForeground">
        Loading profile…
      </Text>
    );
  }

  return (
    <YStack gap="$6">
      <YStack gap="$2">
        <Text fontSize="$7" fontWeight="700" color="$color">
          Confirm your profile
        </Text>
        <Paragraph fontSize="$3" color="$mutedForeground">
          Edit your name and timezone here. They sync with your Stageholder
          account and follow you across products.
        </Paragraph>
      </YStack>

      <YStack gap="$4">
        <YStack gap="$1.5">
          <Label htmlFor="onboard-name">Display name</Label>
          <Input
            id="onboard-name"
            value={displayName}
            onChangeText={setDisplayName}
          />
        </YStack>

        <YStack gap="$1.5">
          <Label htmlFor="onboard-tz">Timezone</Label>
          <TimezoneSelect value={timezone} onValueChange={setTimezone} />
        </YStack>

        {error && (
          <Text fontSize="$1" color="$destructive" role="alert">
            {error.message}
          </Text>
        )}
      </YStack>

      <Button
        width="100%"
        onPress={() => void handleContinue()}
        disabled={!displayName.trim() || isPending}
        loading={isPending}
        loadingText="Saving…"
      >
        Continue
      </Button>
    </YStack>
  );
}
