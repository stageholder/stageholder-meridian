import { useCallback, useEffect, useState } from "react";
import { isDesktop } from "@repo/core/platform";
import { useUpdateStore } from "@/lib/update-store";
import { AlertDialog, Button, useToast, XStack, YStack } from "@stageholder/ui";

interface PendingUpdate {
  version: string;
  /**
   * Opaque install handle from the Tauri updater plugin. Kept behind a
   * function so this file doesn't pull the Tauri types into the web bundle.
   */
  install: () => Promise<void>;
}

/**
 * Desktop-only update orchestrator. Owns three Tamagui v2 surfaces and
 * splits them by UX role — the old sonner version conflated all of this
 * into one `toast(…, { action })` with `{ id: "update" }` updates-in-place,
 * which doesn't map to the kit's hook-based toast (and isn't great UX).
 *
 *   - **kit Toast** (`useToast().show(…)`) — ephemeral status: "Up to
 *     date" / "Couldn't check" / "Update installed" / install errors.
 *   - **kit AlertDialog** — the actionable "Version X is available, install
 *     now?" decision. AlertDialog is the proper Tamagui surface for a
 *     user choice; toasts don't carry actions in the kit (and shouldn't —
 *     they're meant to be dismissable + non-blocking).
 *   - **Auto-poll** — silent check on mount + every 30 min while mounted.
 *
 * Cross-component triggering: the "Check for updates" menu item in the
 * app shell calls `useUpdateStore.getState().requestCheck(…)`. This
 * component subscribes to that request and runs the check, then clears
 * it. The store keeps menu wiring as a plain function reference.
 *
 * Web is a no-op (isDesktop() === false) — every Tauri import is dynamic
 * so the web bundle doesn't pull in @tauri-apps/plugin-updater or
 * plugin-process.
 */
export function UpdateChecker() {
  const toast = useToast();
  const checkRequest = useUpdateStore((s) => s.checkRequest);
  const consumeRequest = useUpdateStore((s) => s.consumeRequest);
  const [pendingUpdate, setPendingUpdate] = useState<PendingUpdate | null>(
    null,
  );
  const [isDownloading, setIsDownloading] = useState(false);

  const performCheck = useCallback(
    async (showWhenUpToDate: boolean) => {
      if (!isDesktop()) return;
      try {
        const { check } = await import("@tauri-apps/plugin-updater");
        const update = await check();
        if (!update) {
          if (showWhenUpToDate) {
            toast.show({
              title: "You're on the latest version",
              intent: "info",
            });
          }
          return;
        }
        setPendingUpdate({
          version: update.version,
          install: () => update.downloadAndInstall(),
        });
      } catch (e) {
        // Surface the real error so devtools shows what failed. Common causes:
        //   - Network / DNS error (endpoint hostname doesn't resolve)
        //   - 404 (R2 latest.json not published yet)
        //   - Signature verification (artifact signed with a different key
        //     than the pubkey baked into tauri.conf.json)
        console.error("[meridian:updater] check failed:", e);
        if (showWhenUpToDate) {
          const msg = e instanceof Error ? e.message : String(e);
          toast.show({
            title: "Couldn't check for updates",
            message: msg,
            intent: "danger",
            duration: 8000,
          });
        }
        // else silent — background poll shouldn't nag on transient errors
      }
    },
    [toast],
  );

  // Silent auto-poll: launch + every 30 min while mounted.
  useEffect(() => {
    if (!isDesktop()) return;
    void performCheck(false);
    const interval = setInterval(
      () => void performCheck(false),
      30 * 60 * 1000,
    );
    return () => clearInterval(interval);
  }, [performCheck]);

  // React to user-initiated checks dispatched from the app-shell menu.
  useEffect(() => {
    if (!checkRequest) return;
    void performCheck(checkRequest.showWhenUpToDate);
    consumeRequest();
  }, [checkRequest, consumeRequest, performCheck]);

  async function handleInstall() {
    if (!pendingUpdate) return;
    setIsDownloading(true);
    try {
      await pendingUpdate.install();
      toast.show({
        title: "Update installed",
        message: "Restarting…",
        intent: "success",
      });
      const { relaunch } = await import("@tauri-apps/plugin-process");
      await relaunch();
    } catch (e) {
      console.error("[meridian:updater] install failed:", e);
      toast.show({
        title: "Failed to install update",
        message: e instanceof Error ? e.message : undefined,
        intent: "danger",
      });
      setIsDownloading(false);
      setPendingUpdate(null);
    }
  }

  if (!pendingUpdate) return null;

  return (
    <AlertDialog
      open
      onOpenChange={(open) => {
        // Guard against dismissal while the install is in flight — we don't
        // want the user to lose the dialog mid-download.
        if (!open && !isDownloading) setPendingUpdate(null);
      }}
    >
      <AlertDialog.Portal>
        <AlertDialog.Overlay />
        <AlertDialog.Content maxW={420}>
          <YStack gap="$3">
            <AlertDialog.Title>Update available</AlertDialog.Title>
            <AlertDialog.Description>
              Version {pendingUpdate.version} is ready to install. Meridian will
              restart after installing.
            </AlertDialog.Description>
            <XStack justify="flex-end" gap="$2" mt="$2">
              <Button
                intent="ghost"
                disabled={isDownloading}
                onPress={() => setPendingUpdate(null)}
              >
                Later
              </Button>
              <Button
                onPress={() => void handleInstall()}
                loading={isDownloading}
                loadingText="Installing…"
              >
                Install now
              </Button>
            </XStack>
          </YStack>
        </AlertDialog.Content>
      </AlertDialog.Portal>
    </AlertDialog>
  );
}
