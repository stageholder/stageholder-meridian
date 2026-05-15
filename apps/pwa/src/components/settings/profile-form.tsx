import { useEffect, useState } from "react";
import { useProfile, useUpdateProfile } from "@/lib/sdk-compat";
import { TimezoneSelect } from "@/components/ui/timezone-select";

/**
 * SPA-local replacement for the SDK's `<ProfileSettings>` component
 * (which only works under the BFF-flavor `@stageholder/sdk/react`
 * provider — unreachable under SPA mode due to the dual-package hazard).
 *
 * Mirrors the same fields the SDK component surfaced for Meridian: name
 * + timezone. `phoneNumber` was always hidden via `hideFields` in the
 * original — not rendered here for the same reason.
 *
 * Hub is the source of truth; writes go straight to `PATCH
 * /api/users/me` via `useUpdateProfile` (also in sdk-compat).
 */
export function ProfileForm() {
  const { data: profile, isLoading } = useProfile();
  const update = useUpdateProfile();

  const [name, setName] = useState("");
  const [timezone, setTimezone] = useState("");

  // Hydrate local form state once the fetch lands. We don't re-hydrate
  // on subsequent profile changes — that would clobber an in-flight edit.
  useEffect(() => {
    if (profile && !name && !timezone) {
      setName(profile.displayName ?? profile.name ?? "");
      setTimezone(profile.timezone ?? "");
    }
  }, [profile, name, timezone]);

  if (isLoading) {
    return (
      <div className="text-sm text-muted-foreground">Loading profile…</div>
    );
  }

  function save(e: React.FormEvent) {
    e.preventDefault();
    // Send both `displayName` (Hub's canonical field) and `name` (legacy
    // alias some callers still set) so either Hub revision accepts it.
    update.mutate({ displayName: name, name, timezone });
  }

  return (
    <form onSubmit={save} className="space-y-6">
      <div className="space-y-2">
        <label
          htmlFor="profile-name"
          className="text-sm font-medium text-foreground"
        >
          Display name
        </label>
        <input
          id="profile-name"
          type="text"
          value={name}
          onChange={(e) => setName(e.target.value)}
          className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
        />
      </div>

      <div className="space-y-2">
        <label
          htmlFor="profile-timezone"
          className="text-sm font-medium text-foreground"
        >
          Timezone
        </label>
        <TimezoneSelect value={timezone} onValueChange={setTimezone} />
      </div>

      <div className="flex items-center gap-3">
        <button
          type="submit"
          disabled={update.isPending}
          className="inline-flex h-9 items-center rounded-md bg-primary px-4 text-sm font-medium text-primary-foreground transition-opacity hover:opacity-90 disabled:pointer-events-none disabled:opacity-50"
        >
          {update.isPending ? "Saving…" : "Save changes"}
        </button>
        {update.isError && (
          <span className="text-xs text-destructive">
            Save failed. {update.error?.message}
          </span>
        )}
        {update.isSuccess && !update.isPending && (
          <span className="text-xs text-muted-foreground">Saved</span>
        )}
      </div>
    </form>
  );
}
