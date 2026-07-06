import { useNavigate } from "@tanstack/react-router";
import { RecentJournals as RecentJournalsView } from "@repo/features/dashboard";
import { useJournals } from "@/lib/api/journals";
import { useEncryptionStore } from "@/lib/crypto/encryption-store";

/**
 * PWA data wrapper: hooks `useJournals` + `useEncryptionStore` (skip fetch
 * while locked) and renders the shared CONTENT-ONLY view. Card chrome + "View
 * all" nav are owned by the host route's kit `Dashboard.Widget`; per-entry
 * navigation stays here (a content behavior).
 */
export function RecentJournals() {
  const navigate = useNavigate();
  const { isSetup, isUnlocked } = useEncryptionStore();
  const isLocked = isSetup && !isUnlocked;
  const { data: journals, isLoading } = useJournals(undefined, {
    enabled: !isLocked,
  });

  return (
    <RecentJournalsView
      journals={journals ?? []}
      isLoading={isLoading}
      isLocked={isLocked}
      onJournalPress={(id) =>
        void navigate({ to: "/journal/$id", params: { id } })
      }
    />
  );
}
