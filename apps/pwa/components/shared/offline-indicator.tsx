"use client";

import { usePendingCount } from "@repo/offline/hooks";
import { useNetworkStatus } from "@repo/offline/network";

export function OfflineIndicator() {
  const isOnline = useNetworkStatus();
  const pendingCount = usePendingCount();

  if (isOnline && pendingCount === 0) {
    return null;
  }

  if (!isOnline) {
    return (
      <div className="flex items-center gap-1.5 rounded-full bg-amber-100 px-2.5 py-1 text-xs font-medium text-amber-800 dark:bg-amber-900/30 dark:text-amber-400">
        <span className="h-2 w-2 rounded-full bg-amber-500" />
        Offline
        {pendingCount > 0 && (
          <span className="ml-1 tabular-nums">({pendingCount})</span>
        )}
      </div>
    );
  }

  // Online but has pending mutations
  return (
    <div className="flex items-center gap-1.5 rounded-full bg-blue-100 px-2.5 py-1 text-xs font-medium text-blue-800 dark:bg-blue-900/30 dark:text-blue-400">
      <span className="h-2 w-2 animate-pulse rounded-full bg-blue-500" />
      Syncing
      <span className="tabular-nums">({pendingCount})</span>
    </div>
  );
}
