import apiClient from "@/lib/api-client";
import { clearLoggedInFlag } from "@/lib/auth-helpers";
import { getQueryClient } from "@/lib/query-provider";
import { clearAllUserData } from "@repo/offline/db";
import { useEncryptionStore } from "@/lib/crypto/encryption-store";

/**
 * Centralized logout that clears ALL user data to prevent leakage
 * between accounts. Must be used everywhere instead of ad-hoc cleanup.
 */
export async function logout(): Promise<void> {
  // 1. Server-side logout (invalidate session/token)
  try {
    await apiClient.post("/auth/logout");
  } catch (err) {
    console.warn(
      "Server-side logout failed, proceeding with local cleanup:",
      err,
    );
  }

  // 2. Clear IndexedDB (Dexie) — all offline-cached workspace data
  try {
    await clearAllUserData();
  } catch (err) {
    console.warn("Failed to clear IndexedDB:", err);
  }

  // 3. Clear React Query cache — prevents stale data from previous user
  try {
    const queryClient = getQueryClient();
    if (queryClient) {
      queryClient.clear();
    }
  } catch (err) {
    console.warn("Failed to clear query cache:", err);
  }

  // 4. Clear all localStorage — auth, workspace, bearer tokens
  localStorage.removeItem("auth-storage");
  localStorage.removeItem("workspace-storage");
  localStorage.removeItem("access_token");
  localStorage.removeItem("refresh_token");

  // 5. Clear encryption key from memory
  useEncryptionStore.getState().lock();

  // 6. Clear cookies
  clearLoggedInFlag();
}
