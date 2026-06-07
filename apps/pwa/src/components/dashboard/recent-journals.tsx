import { useNavigate } from "@tanstack/react-router";
import { RecentJournals as RecentJournalsView } from "@repo/features/dashboard";
import { useJournals } from "@/lib/api/journals";
import { useEncryptionStore } from "@/lib/crypto/encryption-store";

/**
 * PWA wrapper: hooks `useJournals` + `useEncryptionStore` (skip fetch
 * while locked), wires TanStack `useNavigate` to `onViewAll` and
 * `onJournalPress`, and renders the shared cross-platform view.
 */
export function RecentJournals({ index = 0 }: { index?: number }) {
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
      onViewAll={() => void navigate({ to: "/journal" })}
      onJournalPress={(id) =>
        void navigate({ to: "/journal/$id", params: { id } })
      }
      index={index}
    />
  );
}
