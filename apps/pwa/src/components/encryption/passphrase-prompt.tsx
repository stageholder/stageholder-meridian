import { useState } from "react";
import { useEncryptionStore } from "@/lib/crypto/encryption-store";
import { Button, Input } from "@stageholder/ui";
import { Lock } from "lucide-react";

export function PassphrasePrompt() {
  const unlock = useEncryptionStore((s) => s.unlock);
  const [passphrase, setPassphrase] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  async function handleUnlock() {
    setError("");
    setLoading(true);
    try {
      await unlock(passphrase);
    } catch {
      setError("Wrong passphrase. Please try again.");
      setPassphrase("");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="flex h-full items-center justify-center p-8">
      <div className="w-full max-w-sm space-y-6 text-center">
        <div className="mx-auto flex size-16 items-center justify-center rounded-full bg-muted">
          <Lock className="size-8 text-muted-foreground" />
        </div>
        <div>
          <h2 className="text-lg font-semibold">Journal Locked</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            Enter your encryption passphrase to access your journal entries.
          </p>
        </div>
        <div className="space-y-3">
          <Input
            width="100%"
            secureTextEntry
            value={passphrase}
            onChangeText={setPassphrase}
            placeholder="Encryption passphrase"
            onKeyPress={(e: { nativeEvent: { key: string } }) => {
              if (e.nativeEvent.key === "Enter") void handleUnlock();
            }}
            autoFocus
          />
          {error && <p className="text-sm text-destructive">{error}</p>}
          <Button
            onPress={handleUnlock}
            disabled={loading || !passphrase}
            loading={loading}
            loadingText="Unlocking…"
            className="w-full"
          >
            Unlock
          </Button>
        </div>
      </div>
    </div>
  );
}
