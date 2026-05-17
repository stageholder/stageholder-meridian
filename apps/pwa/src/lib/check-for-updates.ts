import { toast } from "sonner";
import { isDesktop } from "@repo/core/platform";

interface CheckOptions {
  /**
   * When true, show a toast even when no update is available (or the check
   * failed). Use for user-initiated checks (menu item). The auto-poll keeps
   * this false so silent boots stay silent.
   */
  showWhenUpToDate?: boolean;
}

/**
 * Check the Tauri updater endpoint and, if a newer version is published,
 * show a sonner toast with an "Update now" action that downloads and
 * relaunches the app.
 *
 * No-op on web — every Tauri-only import is dynamic so the web bundle
 * doesn't pull in the updater/process plugins.
 */
export async function checkForUpdate(opts: CheckOptions = {}): Promise<void> {
  if (!isDesktop()) return;
  try {
    const { check } = await import("@tauri-apps/plugin-updater");
    const update = await check();
    if (!update) {
      if (opts.showWhenUpToDate) {
        toast("You're on the latest version");
      }
      return;
    }
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
  } catch (e) {
    // Surface the real error so devtools shows what failed. Common causes:
    // - Network / DNS error (endpoint hostname doesn't resolve)
    // - 404 (R2 latest.json not published yet)
    // - Signature verification (artifact signed with a different key than
    //   the pubkey baked into tauri.conf.json)
    console.error("[meridian:updater] check failed:", e);
    if (opts.showWhenUpToDate) {
      const msg = e instanceof Error ? e.message : String(e);
      toast.error("Couldn't check for updates", {
        description: msg,
        duration: 8000,
      });
    }
    // else silent — background poll shouldn't nag on transient network errors
  }
}
