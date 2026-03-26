"use client";

import { useState } from "react";
import { useEncryptionStore } from "@/lib/crypto/encryption-store";
import { Button } from "@/components/ui/button";
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
          <input
            type="password"
            value={passphrase}
            onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
              setPassphrase(e.target.value)
            }
            placeholder="Encryption passphrase"
            onKeyDown={(e: React.KeyboardEvent<HTMLInputElement>) =>
              e.key === "Enter" && handleUnlock()
            }
            autoFocus
            className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          />
          {error && <p className="text-sm text-destructive">{error}</p>}
          <Button
            onClick={handleUnlock}
            disabled={loading || !passphrase}
            className="w-full"
          >
            {loading ? "Unlocking..." : "Unlock"}
          </Button>
        </div>
      </div>
    </div>
  );
}
