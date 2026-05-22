import { useEffect, useState } from "react";
import { Button, Text, XStack, YStack } from "@stageholder/ui";
import { useEncryptionStore } from "@/lib/crypto/encryption-store";
import { PassphrasePrompt } from "./passphrase-prompt";
import { PassphraseSetupDialog } from "./passphrase-setup-dialog";

export function EncryptionGate({ children }: { children: React.ReactNode }) {
  const { isSetup, isUnlocked, isLoading, checkStatus } = useEncryptionStore();
  const [showSetup, setShowSetup] = useState(false);
  const [checked, setChecked] = useState(false);

  useEffect(() => {
    if (!checked) {
      checkStatus().then(() => setChecked(true));
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

  // Encryption set up but locked — show passphrase prompt
  if (isSetup && !isUnlocked) {
    return <PassphrasePrompt />;
  }

  // Not set up — show content with a setup banner
  if (!isSetup) {
    return (
      <>
        {children}
        <SetupBanner onSetup={() => setShowSetup(true)} />
        <PassphraseSetupDialog
          open={showSetup}
          onComplete={() => setShowSetup(false)}
        />
      </>
    );
  }

  // Unlocked — show content
  return <>{children}</>;
}

function SetupBanner({ onSetup }: { onSetup: () => void }) {
  const [dismissed, setDismissed] = useState(false);

  if (dismissed) return null;

  return (
    <YStack
      position={"fixed" as never}
      b="$3.5"
      left="50%"
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
