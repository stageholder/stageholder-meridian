import { useProfile, useUpdateProfile } from "@stageholder/sdk/spa";
import { ProfileForm as ProfileFormView } from "@repo/features/settings";

/**
 * PWA wrapper: hooks `useProfile` + `useUpdateProfile` from the SPA SDK
 * and renders the shared cross-platform `ProfileForm` view. The view owns
 * the form state + the hydrate-once effect + inline save-status text;
 * this wrapper just supplies the data + the async save function.
 *
 * Mobile ships an equivalent wrapper around the same view with its own
 * SDK entry (e.g. `@stageholder/sdk/native`).
 */
export function ProfileForm() {
  const { data: profile, isLoading } = useProfile();
  const update = useUpdateProfile();

  return (
    <ProfileFormView
      initialName={profile?.displayName ?? ""}
      initialTimezone={profile?.timezone ?? ""}
      isLoading={isLoading}
      onSubmit={async (data) => {
        await update.mutateAsync(data);
      }}
    />
  );
}
