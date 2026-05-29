import { useNavigate } from "@tanstack/react-router";
import { JournalList as JournalListView } from "@repo/features/journal";
import type { Journal } from "@repo/core/types";

/**
 * PWA wrapper: wires TanStack `useNavigate` to `onJournalPress` and
 * renders the shared cross-platform view. Same props as before for
 * call-site stability — only the navigation wiring is added.
 */
export function JournalList({
  journals,
  isLoading,
  activeId,
}: {
  journals: Journal[];
  isLoading: boolean;
  activeId?: string;
}) {
  const navigate = useNavigate();
  return (
    <JournalListView
      journals={journals}
      isLoading={isLoading}
      activeId={activeId}
      onJournalPress={(id) =>
        void navigate({ to: "/journal/$id", params: { id } })
      }
    />
  );
}
