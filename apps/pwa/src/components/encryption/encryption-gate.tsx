import { useEffect, useState } from "react";
import { Button, Text, useToast, XStack, YStack } from "@stageholder/ui";
import {
  PassphrasePrompt,
  PassphraseSetupDialog,
} from "@repo/features/encryption";
import { useEncryptionStore } from "@/lib/crypto/encryption-store";

/**
 * PWA wrapper around the cross-platform `PassphrasePrompt` +
 * `PassphraseSetupDialog` views from `@repo/features/encryption`.
 *
 * Owns the orchestration (`useEncryptionStore` status checks + view
 * routing) and the floating `<SetupBanner>` — the banner uses
 * `position:"fixed"`, which is web-only, so it stays PWA-local. The
 * future mobile app composes the same lifted dialogs with its own
 * gate + its own kit-`Sheet`-based banner.
 */
export function EncryptionGate({ children }: { children: React.ReactNode }) {
  const {
    isSetup,
    isUnlocked,
    isLoading,
    checkStatus,
    unlock,
    setupPassphrase,
  } = useEncryptionStore();
  const toast = useToast();
  const [showSetup, setShowSetup] = useState(false);
  const [checked, setChecked] = useState(false);

  useEffect(() => {
    if (!checked) {
      void checkStatus().then(() => setChecked(true));
    }
  }, [checked, checkStatus]);

  if (isLoading || !checked) {
    return (
      <XStack height="100%" items="center" justify="center">
        <Text fontSize="$3" color="$mutedForeground">
          Loading...
        </Text>
      </XStack>
    );
  }

  // Encryption set up but locked — show the cross-platform unlock prompt.
  if (isSetup && !isUnlocked) {
    return (
      <PassphrasePrompt
        onUnlock={async (passphrase) => {
          await unlock(passphrase);
        }}
      />
    );
  }

  // Not set up — show content + the floating setup banner.
  if (!isSetup) {
    return (
      <>
        {children}
        <SetupBanner onSetup={() => setShowSetup(true)} />
        <PassphraseSetupDialog
          open={showSetup}
          onComplete={() => setShowSetup(false)}
          onSetup={(passphrase) => setupPassphrase(passphrase)}
          onSetupError={() =>
            toast.show({
              title: "Failed to set up encryption",
              intent: "danger",
            })
          }
        />
      </>
    );
  }

  // Unlocked — show content.
  return <>{children}</>;
}

/**
 * PWA-only floating CTA prompting the user to set up encryption. Stays
 * here (not lifted) because `position:"fixed"` is a web-only CSS value
 * — the mobile app renders the same prompt as a kit `Sheet` (or a
 * persistent toast) instead. The body text + action buttons are the
 * piece that's portable; the positioning isn't.
 */
function SetupBanner({ onSetup }: { onSetup: () => void }) {
  const [dismissed, setDismissed] = useState(false);

  if (dismissed) return null;

  return (
    <YStack
      position={"fixed" as never}
      b="$3.5"
      l="50%"
      x="-50%"
      z={50}
      width="100%"
      maxW={448}
      rounded="$lg"
      borderWidth={1}
      borderColor="$borderColor"
      bg="$background"
      p="$4"
      boxShadow="0 10px 15px rgba(0,0,0,0.1), 0 4px 6px rgba(0,0,0,0.05)"
    >
      <XStack items="flex-start" gap="$3">
        <YStack flex={1}>
          <Text fontSize="$3" fontWeight="500" color="$color">
            Protect your journal
          </Text>
          <Text mt="$0.5" fontSize="$1" color="$mutedForeground">
            Set up end-to-end encryption so only you can read your journal
            entries.
          </Text>
        </YStack>
        <XStack shrink={0} gap="$2">
          <Button intent="ghost" size="sm" onPress={() => setDismissed(true)}>
            Later
          </Button>
          <Button size="sm" onPress={onSetup}>
            Set Up
          </Button>
        </XStack>
      </XStack>
    </YStack>
  );
}
