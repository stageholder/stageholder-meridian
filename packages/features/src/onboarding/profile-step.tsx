import { useEffect, useState } from "react";
import { Button, Input, Label, Paragraph, Text, YStack } from "@stageholder/ui";
import { TimezoneSelect } from "../settings/timezone-select";

export interface ProfileStepProps {
  /** Initial display name from the host's profile fetch (may arrive async). */
  initialName?: string;
  /** Initial timezone (IANA). Falls back to the device tz when not provided. */
  initialTimezone?: string;
  /** True while the host's initial profile fetch is in flight. */
  isLoading?: boolean;
  /** True while the host's save mutation is in flight. */
  isPending?: boolean;
  /** Last save error, surfaced inline below the form. */
  error?: Error | null;
  /**
   * Called with the user-confirmed name + timezone on Continue. The host
   * owns both the save (e.g. `mutateAsync(data)`) AND the wizard advance.
   * Typical impl:
   *
   * ```tsx
   * onSubmit: async (data) => {
   *   await mutateAsync(data);
   *   onContinue();
   * }
   * ```
   *
   * Throwing from `onSubmit` keeps the wizard on this step (the surfaced
   * `error` prop is what tells the user why).
   */
  onSubmit: (data: { displayName: string; timezone: string }) => Promise<void>;
}

/**
 * Onboarding step where the user confirms display name + timezone.
 *
 * Pure presentational. The host fetches the current profile via its own
 * SDK (web: `@stageholder/sdk/spa`'s `useProfile`/`useUpdateProfile`;
 * mobile: the RN equivalent) and feeds the values + a single `onSubmit`
 * callback. The view owns the form state + the hydrate-once effect; the
 * host owns the side effect.
 */
export function ProfileStep({
  initialName,
  initialTimezone,
  isLoading,
  isPending,
  error,
  onSubmit,
}: ProfileStepProps) {
  const [displayName, setDisplayName] = useState<string>(initialName ?? "");
  const [timezone, setTimezone] = useState<string>(
    initialTimezone ?? Intl.DateTimeFormat().resolvedOptions().timeZone,
  );
  const [hydrated, setHydrated] = useState<boolean>(!!initialName);

  // Hydrate once when the host's data lands (may be after first paint).
  // Won't overwrite the user's typing if they started editing mid-load.
  useEffect(() => {
    if (hydrated || !initialName) return;
    setDisplayName(initialName);
    if (initialTimezone) setTimezone(initialTimezone);
    setHydrated(true);
  }, [initialName, initialTimezone, hydrated]);

  const handleContinue = async (): Promise<void> => {
    if (!displayName.trim()) return;
    try {
      await onSubmit({ displayName, timezone });
    } catch {
      // Surfaced via the `error` prop; don't advance.
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

        {error ? (
          <Text fontSize="$1" color="$destructive" role="alert">
            {error.message}
          </Text>
        ) : null}
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
