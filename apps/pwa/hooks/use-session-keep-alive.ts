"use client";

import { useEffect } from "react";
import apiClient from "@/lib/api-client";

/**
 * Proactively refreshes the access token before it expires,
 * preventing unnecessary 401 cycles. Also refreshes on tab
 * re-focus after being hidden for an extended period.
 *
 * Uses the apiClient's built-in silentRefresh() which respects
 * the isRefreshing guard, preventing race conditions with the
 * reactive 401 interceptor.
 *
 * Access token TTL is 15 min — we refresh at 12 min (80% of TTL).
 */
const REFRESH_INTERVAL_MS = 12 * 60 * 1000; // 12 minutes
const STALE_THRESHOLD_MS = 12 * 60 * 1000; // refresh on focus if hidden this long

// Module-level so re-mounts (e.g. workspace switches) don't redundantly refresh
let lastGlobalRefresh = 0;

export function useSessionKeepAlive() {
  useEffect(() => {
    function doRefresh() {
      lastGlobalRefresh = Date.now();
      apiClient.silentRefresh();
    }

    // Only refresh on mount if truly stale (prevents extra hits on workspace navigation)
    if (Date.now() - lastGlobalRefresh >= STALE_THRESHOLD_MS) {
      doRefresh();
    }

    // Periodic refresh while the tab is active
    const intervalId = setInterval(() => {
      if (document.visibilityState === "visible") {
        doRefresh();
      }
    }, REFRESH_INTERVAL_MS);

    // Refresh immediately when tab becomes visible after being hidden too long
    function handleVisibilityChange() {
      if (document.visibilityState !== "visible") return;

      const elapsed = Date.now() - lastGlobalRefresh;
      if (elapsed >= STALE_THRESHOLD_MS) {
        doRefresh();
      }
    }

    document.addEventListener("visibilitychange", handleVisibilityChange);

    return () => {
      clearInterval(intervalId);
      document.removeEventListener("visibilitychange", handleVisibilityChange);
    };
  }, []);
}
