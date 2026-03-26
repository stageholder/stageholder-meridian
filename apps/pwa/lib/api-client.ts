import { createApiClient } from "@repo/core/api/client";
import { LocalStorageAdapter, detectPlatform } from "@repo/core/platform";
import { setLoggedInFlag } from "@/lib/auth-helpers";

const storage = new LocalStorageAdapter();
export const isDesktop = detectPlatform() === "desktop";

const apiClient = createApiClient({
  apiBaseUrl: process.env.NEXT_PUBLIC_API_URL || "http://localhost:4000/api/v1",
  authStrategy: isDesktop ? "bearer" : "cookie",
  storage,
  onLogout: async () => {
    if (typeof window !== "undefined") {
      // Use the same thorough cleanup as explicit logout.
      // Skip the server call — the token is already dead (refresh just failed).
      const { logout } = await import("@/lib/logout");
      await logout({ skipServerCall: true });
      window.location.href = "/login";
    }
  },
  onRefreshSuccess: () => {
    // Renew the logged_in cookie on every successful token refresh
    // so the middleware never kicks the user out while the session is valid
    setLoggedInFlag();
  },
});

/** Read workspace ID from localStorage — used only by offline sync */
export function getWorkspaceId(): string {
  if (typeof window !== "undefined") {
    const stored = localStorage.getItem("workspace-storage");
    if (stored) {
      const parsed = JSON.parse(stored) as {
        state?: { activeWorkspaceId?: string };
      };
      return parsed?.state?.activeWorkspaceId || "";
    }
  }
  return "";
}

export default apiClient;
