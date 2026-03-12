"use client";

import { useEffect, useCallback } from "react";
import { toast } from "sonner";
import { isDesktop } from "@repo/core/platform";

export function UpdateChecker() {
  const checkForUpdate = useCallback(async () => {
    if (!isDesktop()) return;
    try {
      const { check } = await import("@tauri-apps/plugin-updater");
      const update = await check();
      if (!update) return;
      toast(`Version ${update.version} is available`, {
        duration: Infinity,
        action: {
          label: "Update now",
          onClick: async () => {
            try {
              toast.loading("Downloading update...", { id: "update" });
              await update.downloadAndInstall();
              toast.success("Update installed! Restarting...", {
                id: "update",
              });
              const { relaunch } = await import("@tauri-apps/plugin-process");
              await relaunch();
            } catch {
              toast.error("Failed to install update.", { id: "update" });
            }
          },
        },
      });
    } catch {
      // silent
    }
  }, []);

  useEffect(() => {
    if (!isDesktop()) return;
    checkForUpdate();
    const interval = setInterval(checkForUpdate, 30 * 60 * 1000);
    return () => clearInterval(interval);
  }, [checkForUpdate]);

  return null;
}
