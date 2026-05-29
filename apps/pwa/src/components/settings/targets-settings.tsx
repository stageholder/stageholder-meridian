import { TargetsSettings as TargetsSettingsView } from "@repo/features/settings";
import { useUserLight, useUpdateTargets } from "@/lib/api/light";

/**
 * PWA wrapper: hooks `useUserLight` + `useUpdateTargets` from the local
 * lib/api and renders the shared cross-platform `TargetsSettings` view.
 * The view owns form state, hydration, and toast feedback; this wrapper
 * just supplies the data + the async save function.
 */
export function TargetsSettings() {
  const { data: userLight, isLoading } = useUserLight();
  const updateTargets = useUpdateTargets();

  return (
    <TargetsSettingsView
      initialTodoTarget={userLight?.todoTargetDaily}
      initialJournalTarget={userLight?.journalTargetDailyWords}
      isLoading={isLoading}
      onSubmit={async (data) => {
        await updateTargets.mutateAsync(data);
      }}
    />
  );
}
