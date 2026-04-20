"use client";

import { useState, useEffect } from "react";
import { useUser } from "@/hooks/use-user";
import { TimezoneSelect } from "@/components/ui/timezone-select";

export function ProfileStep({ onContinue }: { onContinue: () => void }) {
  const { data: user } = useUser();
  const [name, setName] = useState(user?.name || "");
  const [timezone, setTimezone] = useState(
    Intl.DateTimeFormat().resolvedOptions().timeZone,
  );

  // TODO(group-?): user profile (name, timezone) is now owned by the Hub.
  // Previously this step PATCHed `/auth/me` and updated the local auth store;
  // both are gone. We keep the form visible so the onboarding flow still
  // reads naturally, but "Continue" just advances — to edit the profile the
  // user is directed to the Hub. Wire a real local-profile PATCH when the
  // API exposes one (e.g. journal_security, timezone override).
  const HUB_URL = process.env.NEXT_PUBLIC_HUB_URL;

  useEffect(() => {
    if (user?.name) setName(user.name);
  }, [user]);

  function handleContinue() {
    onContinue();
  }

  function openHubProfile() {
    if (!HUB_URL) return;
    window.open(`${HUB_URL}/account/profile`, "_blank", "noopener,noreferrer");
  }

  return (
    <div className="space-y-6">
      <div className="space-y-2">
        <h2 className="text-xl font-bold text-foreground">
          Confirm your profile
        </h2>
        <p className="text-sm text-muted-foreground">
          Your name and email live in your Stageholder account. Edit them in the
          Hub at any time.
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
            value={name}
            onChange={(e) => setName(e.target.value)}
            disabled
            className="mt-1 block w-full rounded-lg border border-input bg-muted/40 px-3 py-2 text-sm text-muted-foreground"
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

        {HUB_URL && (
          <button
            type="button"
            onClick={openHubProfile}
            className="text-xs text-muted-foreground hover:text-foreground underline"
          >
            Edit profile in Hub →
          </button>
        )}
      </div>

      <button
        onClick={handleContinue}
        disabled={!name.trim()}
        className="w-full rounded-lg bg-primary px-4 py-2.5 text-sm font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-50 transition-colors"
      >
        Continue
      </button>
    </div>
  );
}
