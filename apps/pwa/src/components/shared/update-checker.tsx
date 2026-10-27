import { useCallback, useEffect, useState } from "react";
import { isDesktop } from "@repo/core/platform";
import { useUpdateStore } from "@/lib/update-store";
import {
  AlertDialog,
  Button,
  Text,
  toast,
  XStack,
  YStack,
} from "@stageholder/ui";

interface PendingUpdate {
  version: string;
  /**
   * Release notes — `notes` in the release's latest.json, filled from
   * `apps/desktop/CHANGELOG.md` by the publish script. Undefined when the
   * release has none.
   */
  notes?: string;
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
 *   - **kit Toast** (`toast().show(…)`) — ephemeral status: "Up to
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
            toast.info("You're on the latest version");
          }
          return;
        }
        setPendingUpdate({
          version: update.version,
          notes: releaseNotes(update.body),
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
          toast.error("Couldn't check for updates", { description: msg });
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
      toast.success("Update installed", { description: "Restarting…" });
      const { relaunch } = await import("@tauri-apps/plugin-process");
      await relaunch();
    } catch (e) {
      console.error("[meridian:updater] install failed:", e);
      toast.error("Failed to install update", {
        description: e instanceof Error ? e.message : undefined,
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
      <AlertDialog.Content maxW={460}>
        <YStack gap="$3">
          <AlertDialog.Title>Update available</AlertDialog.Title>
          <AlertDialog.Description>
            Version {pendingUpdate.version} is ready to install. Meridian will
            restart after installing.
          </AlertDialog.Description>
          {pendingUpdate.notes ? (
            <ReleaseNotes notes={pendingUpdate.notes} />
          ) : null}
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
    </AlertDialog>
  );
}

/**
 * The publish script falls back to "Release vX.Y.Z" when the changelog has no
 * entry for a version — that says nothing, so it shows no "What's new" block.
 */
function releaseNotes(body: string | undefined): string | undefined {
  const notes = body?.trim();
  if (!notes || /^Release v\d+\.\d+\.\d+$/.test(notes)) return undefined;
  return notes;
}

/**
 * "What's new" — the version's CHANGELOG section. Renders the small Markdown
 * subset the changelog uses: `### Heading`, `- bullet`, and plain lines;
 * `**bold**` markers are stripped. Scrolls when long so the actions stay put.
 */
function ReleaseNotes({ notes }: { notes: string }) {
  const lines = notes
    .split("\n")
    .map((l) => l.trim())
    .filter(Boolean);
  return (
    <YStack
      gap="$1.5"
      p="$3"
      rounded="$md"
      bg="$muted"
      {...({ style: { maxHeight: 260, overflowY: "auto" } } as object)}
    >
      <Text fontSize="$2" fontWeight="600" color="$mutedForeground">
        What&apos;s new
      </Text>
      {lines.map((line, i) => {
        const text = line.replace(/\*\*(.+?)\*\*/g, "$1");
        if (text.startsWith("#")) {
          return (
            <Text key={i} fontSize="$3" fontWeight="600" mt="$1">
              {text.replace(/^#+\s*/, "")}
            </Text>
          );
        }
        if (/^[-*]\s/.test(text)) {
          return (
            <XStack key={i} gap="$2">
              <Text fontSize="$3" color="$mutedForeground">
                •
              </Text>
              <Text fontSize="$3" flex={1}>
                {text.replace(/^[-*]\s+/, "")}
              </Text>
            </XStack>
          );
        }
        return (
          <Text key={i} fontSize="$3">
            {text}
          </Text>
        );
      })}
    </YStack>
  );
}
