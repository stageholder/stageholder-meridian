import { useEffect, useState } from "react";
import { Button } from "@stageholder/ui";
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
      <div className="flex h-full items-center justify-center">
        <div className="text-sm text-muted-foreground">Loading...</div>
      </div>
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
    <div className="fixed bottom-4 left-1/2 z-50 w-full max-w-md -translate-x-1/2 rounded-lg border bg-background p-4 shadow-lg">
      <div className="flex items-start gap-3">
        <div className="flex-1">
          <p className="text-sm font-medium">Protect your journal</p>
          <p className="mt-0.5 text-xs text-muted-foreground">
            Set up end-to-end encryption so only you can read your journal
            entries.
          </p>
        </div>
        <div className="flex shrink-0 gap-2">
          <Button intent="ghost" size="sm" onPress={() => setDismissed(true)}>
            Later
          </Button>
          <Button size="sm" onPress={onSetup}>
            Set Up
          </Button>
        </div>
      </div>
    </div>
  );
}
