"use client";

import { useState } from "react";
import { usePendingCount, useFailedMutations } from "@repo/offline/hooks";
import { useNetworkStatus } from "@repo/offline/network";
import {
  dismissMutation,
  dismissAllFailed,
  flush,
} from "@repo/offline/sync/mutation-queue";
import apiClient from "@/lib/api-client";

export function OfflineIndicator() {
  const isOnline = useNetworkStatus();
  const pendingCount = usePendingCount();
  const failedMutations = useFailedMutations();
  const [showPopover, setShowPopover] = useState(false);

  const failedCount = failedMutations.length;

  if (isOnline && pendingCount === 0) {
    return null;
  }

  const handleRetry = async () => {
    try {
      await flush(apiClient);
    } catch {
      // Errors handled by the queue itself
    }
  };

  const handleDismiss = async (id: number) => {
    await dismissMutation(id);
  };

  const handleDismissAll = async () => {
    await dismissAllFailed();
  };

  if (!isOnline) {
    return (
      <div className="relative">
        <button
          type="button"
          onClick={() => failedCount > 0 && setShowPopover(!showPopover)}
          className="flex items-center gap-1.5 rounded-full bg-amber-100 px-2.5 py-1 text-xs font-medium text-amber-800 dark:bg-amber-900/30 dark:text-amber-400"
        >
          <span className="h-2 w-2 rounded-full bg-amber-500" />
          Offline
          {pendingCount > 0 && (
            <span className="ml-1 tabular-nums">({pendingCount})</span>
          )}
        </button>
        {showPopover && failedCount > 0 && (
          <FailedMutationsPopover
            failedMutations={failedMutations}
            onDismiss={handleDismiss}
            onDismissAll={handleDismissAll}
            onRetry={handleRetry}
            onClose={() => setShowPopover(false)}
          />
        )}
      </div>
    );
  }

  // Online but has pending mutations
  return (
    <div className="relative">
      <button
        type="button"
        onClick={() => failedCount > 0 && setShowPopover(!showPopover)}
        className="flex items-center gap-1.5 rounded-full bg-blue-100 px-2.5 py-1 text-xs font-medium text-blue-800 dark:bg-blue-900/30 dark:text-blue-400"
      >
        <span className="h-2 w-2 animate-pulse rounded-full bg-blue-500" />
        {failedCount > 0 ? "Failed" : "Syncing"}
        <span className="tabular-nums">({pendingCount})</span>
      </button>
      {showPopover && failedCount > 0 && (
        <FailedMutationsPopover
          failedMutations={failedMutations}
          onDismiss={handleDismiss}
          onDismissAll={handleDismissAll}
          onRetry={handleRetry}
          onClose={() => setShowPopover(false)}
        />
      )}
    </div>
  );
}

function FailedMutationsPopover({
  failedMutations,
  onDismiss,
  onDismissAll,
  onRetry,
  onClose,
}: {
  failedMutations: { id?: number; entityType: string; operation: string }[];
  onDismiss: (id: number) => void;
  onDismissAll: () => void;
  onRetry: () => void;
  onClose: () => void;
}) {
  return (
    <div className="absolute right-0 top-full z-50 mt-2 w-72 rounded-lg border bg-white p-3 shadow-lg dark:border-neutral-700 dark:bg-neutral-800">
      <div className="mb-2 flex items-center justify-between">
        <span className="text-sm font-medium text-neutral-900 dark:text-neutral-100">
          Failed Mutations ({failedMutations.length})
        </span>
        <button
          type="button"
          onClick={onClose}
          className="text-xs text-neutral-500 hover:text-neutral-700 dark:hover:text-neutral-300"
        >
          Close
        </button>
      </div>
      <ul className="max-h-48 space-y-1 overflow-y-auto">
        {failedMutations.map((m) => (
          <li
            key={m.id}
            className="flex items-center justify-between rounded bg-neutral-50 px-2 py-1 text-xs dark:bg-neutral-700/50"
          >
            <span className="text-neutral-700 dark:text-neutral-300">
              {m.operation} {m.entityType}
            </span>
            <button
              type="button"
              onClick={() => m.id && onDismiss(m.id)}
              className="text-red-500 hover:text-red-700"
            >
              Dismiss
            </button>
          </li>
        ))}
      </ul>
      <div className="mt-2 flex gap-2">
        <button
          type="button"
          onClick={onRetry}
          className="flex-1 rounded bg-blue-500 px-2 py-1 text-xs font-medium text-white hover:bg-blue-600"
        >
          Retry All
        </button>
        <button
          type="button"
          onClick={onDismissAll}
          className="flex-1 rounded bg-neutral-200 px-2 py-1 text-xs font-medium text-neutral-700 hover:bg-neutral-300 dark:bg-neutral-600 dark:text-neutral-200 dark:hover:bg-neutral-500"
        >
          Dismiss All
        </button>
      </div>
    </div>
  );
}
