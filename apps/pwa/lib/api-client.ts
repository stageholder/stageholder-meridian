import { createApiClient } from "@repo/core/api/client";
import { LocalStorageAdapter } from "@repo/core/platform";

const storage = new LocalStorageAdapter();

const apiClient = createApiClient({
  apiBaseUrl: process.env.NEXT_PUBLIC_API_URL || "http://localhost:4000/api/v1",
  authStrategy: "cookie",
  storage,
  onLogout: () => {
    if (typeof window !== "undefined") {
      localStorage.removeItem("auth-storage");
      localStorage.removeItem("workspace-storage");
      document.cookie = "logged_in=; path=/; max-age=0";
      window.location.href = "/login";
    }
  },
});

/** Read workspace ID from localStorage — used only by offline sync */
export function getWorkspaceId(): string {
  if (typeof window !== "undefined") {
    const stored = localStorage.getItem("workspace-storage");
    if (stored) {
      const parsed = JSON.parse(stored) as { state?: { activeWorkspaceId?: string } };
      return parsed?.state?.activeWorkspaceId || "";
    }
  }
  return "";
}

export default apiClient;
