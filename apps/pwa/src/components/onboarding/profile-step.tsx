import { useProfile, useUpdateProfile } from "@stageholder/sdk/spa";
import { ProfileStep as ProfileStepView } from "@repo/features/onboarding";

/**
 * PWA wrapper: hooks the SDK profile + update mutation, wires the shared
 * cross-platform view. The view owns the form state + the hydrate-once
 * effect; this wrapper owns the side effect (`mutateAsync` + advancing
 * the wizard).
 */
export function ProfileStep({ onContinue }: { onContinue: () => void }) {
  const { data: profile, isLoading } = useProfile();
  const { mutateAsync, isPending, error } = useUpdateProfile();

  return (
    <ProfileStepView
      initialName={profile?.displayName ?? ""}
      initialTimezone={profile?.timezone ?? undefined}
      isLoading={isLoading}
      isPending={isPending}
      error={error ?? null}
      onSubmit={async (data) => {
        await mutateAsync(data);
        onContinue();
      }}
    />
  );
}
