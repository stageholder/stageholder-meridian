"use client";

import { useEffect, useState } from "react";
import { useProfile, useUpdateProfile } from "@stageholder/sdk/react";
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
          <label
            htmlFor="onboard-name"
            className="block text-sm font-medium text-foreground"
          >
            Display name
          </label>
          <input
            id="onboard-name"
            type="text"
            value={displayName}
            onChange={(e) => setDisplayName(e.target.value)}
            className="mt-1 block w-full rounded-lg border border-input bg-background px-3 py-2 text-sm text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          />
        </div>

        <div>
          <label
            htmlFor="onboard-tz"
            className="block text-sm font-medium text-foreground"
          >
            Timezone
          </label>
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

      <button
        onClick={() => void handleContinue()}
        disabled={!displayName.trim() || isPending}
        className="w-full rounded-lg bg-primary px-4 py-2.5 text-sm font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-50 transition-colors"
      >
        {isPending ? "Saving…" : "Continue"}
      </button>
    </div>
  );
}
