import { useState, useEffect, useCallback } from "react";

export function useNetworkStatus(): boolean {
  const [isOnline, setIsOnline] = useState(
    typeof navigator !== "undefined" ? navigator.onLine : true,
  );

  useEffect(() => {
    const handleOnline = () => setIsOnline(true);
    const handleOffline = () => setIsOnline(false);

    window.addEventListener("online", handleOnline);
    window.addEventListener("offline", handleOffline);

    return () => {
      window.removeEventListener("online", handleOnline);
      window.removeEventListener("offline", handleOffline);
    };
  }, []);

  return isOnline;
}

export function useNetworkStatusWithHeartbeat(
  healthUrl: string,
  intervalMs = 30000,
): boolean {
  const browserOnline = useNetworkStatus();
  const [apiReachable, setApiReachable] = useState(browserOnline);

  const checkHealth = useCallback(async () => {
    if (!browserOnline) {
      setApiReachable(false);
      return;
    }
    try {
      const res = await fetch(healthUrl, { method: "HEAD", cache: "no-store" });
      setApiReachable(res.ok);
    } catch {
      setApiReachable(false);
    }
  }, [browserOnline, healthUrl]);

  useEffect(() => {
    checkHealth();
    const id = setInterval(checkHealth, intervalMs);
    return () => clearInterval(id);
  }, [checkHealth, intervalMs]);

  return apiReachable;
}
