import { useEffect, useState } from "react";
import { useProfile, useUpdateProfile } from "@stageholder/sdk/spa";
import { Button, Input, Label } from "@stageholder/ui";
import { TimezoneSelect } from "@/components/ui/timezone-select";

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
      <div className="text-sm text-muted-foreground">Loading profile…</div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="space-y-2">
        <h2 className="text-xl font-bold text-foreground">
          Confirm your profile
        </h2>
        <p className="text-sm text-muted-foreground">
          Edit your name and timezone here. They sync with your Stageholder
          account and follow you across products.
        </p>
      </div>

      <div className="space-y-4">
        <div>
          <Label htmlFor="onboard-name">Display name</Label>
          <Input
            id="onboard-name"
            className="mt-1"
            value={displayName}
            onChangeText={setDisplayName}
          />
        </div>

        <div>
          <Label htmlFor="onboard-tz">Timezone</Label>
          <TimezoneSelect
            value={timezone}
            onValueChange={setTimezone}
            className="mt-1"
          />
        </div>

        {error && (
          <p className="text-xs text-destructive" role="alert">
            {error.message}
          </p>
        )}
      </div>

      <Button
        className="w-full"
        onPress={() => void handleContinue()}
        disabled={!displayName.trim() || isPending}
        loading={isPending}
        loadingText="Saving…"
      >
        Continue
      </Button>
    </div>
  );
}
