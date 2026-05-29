import { useState } from "react";
import { JourneyFeed as JourneyFeedView } from "@repo/features/light";
import { useLightEvents } from "@/lib/api/light";

const INITIAL_LIMIT = 10;
const LOAD_MORE = 20;

/**
 * PWA wrapper: owns the pagination state + `useLightEvents` fetch, then
 * renders the shared cross-platform view. Mobile ships an equivalent
 * wrapper around the same view with its own data source.
 */
export function JourneyFeed() {
  const [limit, setLimit] = useState(INITIAL_LIMIT);
  const { data: events, isLoading } = useLightEvents(limit, 0);
  return (
    <JourneyFeedView
      events={events ?? []}
      isLoading={isLoading}
      canLoadMore={!!events && events.length >= limit}
      onLoadMore={() => setLimit((l) => l + LOAD_MORE)}
    />
  );
}
