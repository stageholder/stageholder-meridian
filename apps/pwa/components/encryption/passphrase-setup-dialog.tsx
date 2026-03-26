"use client";

import { useState } from "react";
import { useEncryptionStore } from "@/lib/crypto/encryption-store";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { toast } from "sonner";
import { Shield, Copy, Check } from "lucide-react";

export function PassphraseSetupDialog({
  open,
  onComplete,
}: {
  open: boolean;
  onComplete: () => void;
}) {
  const setupPassphrase = useEncryptionStore((s) => s.setupPassphrase);
  const [step, setStep] = useState<"create" | "recovery">("create");
  const [passphrase, setPassphrase] = useState("");
  const [confirm, setConfirm] = useState("");
  const [recoveryCodes, setRecoveryCodes] = useState<string[]>([]);
  const [saved, setSaved] = useState(false);
  const [loading, setLoading] = useState(false);
  const [copied, setCopied] = useState(false);
  const [error, setError] = useState("");

  async function handleSetup() {
    setError("");
    if (passphrase.length < 8) {
      setError("Passphrase must be at least 8 characters");
      return;
    }
    if (passphrase !== confirm) {
      setError("Passphrases do not match");
      return;
    }

    setLoading(true);
    try {
      const codes = await setupPassphrase(passphrase);
      setRecoveryCodes(codes);
      setStep("recovery");
    } catch {
      toast.error("Failed to set up encryption");
    } finally {
      setLoading(false);
    }
  }

  function handleCopy() {
    const text = recoveryCodes.join("\n");
    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  function handleDone() {
    onComplete();
    setStep("create");
    setPassphrase("");
    setConfirm("");
    setRecoveryCodes([]);
    setSaved(false);
  }

  return (
    <Dialog open={open}>
      <DialogContent
        className="sm:max-w-md"
        onInteractOutside={(e) => e.preventDefault()}
      >
        {step === "create" ? (
          <>
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <Shield className="size-5" />
                Set Up Journal Encryption
              </DialogTitle>
              <DialogDescription>
                Create an encryption passphrase to protect your journal entries.
                This is separate from your login password. Even we cannot read
                your encrypted journals.
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4 pt-2">
              <div className="space-y-2">
                <label htmlFor="passphrase" className="text-sm font-medium">
                  Encryption Passphrase
                </label>
                <input
                  id="passphrase"
                  type="password"
                  value={passphrase}
                  onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
                    setPassphrase(e.target.value)
                  }
                  placeholder="Enter a strong passphrase"
                  className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                />
              </div>
              <div className="space-y-2">
                <label htmlFor="confirm" className="text-sm font-medium">
                  Confirm Passphrase
                </label>
                <input
                  id="confirm"
                  type="password"
                  value={confirm}
                  onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
                    setConfirm(e.target.value)
                  }
                  placeholder="Confirm your passphrase"
                  onKeyDown={(e: React.KeyboardEvent<HTMLInputElement>) =>
                    e.key === "Enter" && handleSetup()
                  }
                  className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                />
              </div>
              {error && <p className="text-sm text-destructive">{error}</p>}
              <Button
                onClick={handleSetup}
                disabled={loading || !passphrase || !confirm}
                className="w-full"
              >
                {loading ? "Setting up..." : "Set Up Encryption"}
              </Button>
            </div>
          </>
        ) : (
          <>
            <DialogHeader>
              <DialogTitle>Save Your Recovery Codes</DialogTitle>
              <DialogDescription>
                If you forget your passphrase, these codes are the only way to
                recover access to your journals. Store them somewhere safe.
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4 pt-2">
              <div className="grid grid-cols-2 gap-2 rounded-lg border bg-muted/50 p-4 font-mono text-sm">
                {recoveryCodes.map((code, i) => (
                  <div key={i} className="text-center">
                    {code}
                  </div>
                ))}
              </div>
              <Button variant="outline" onClick={handleCopy} className="w-full">
                {copied ? (
                  <Check className="mr-2 size-4" />
                ) : (
                  <Copy className="mr-2 size-4" />
                )}
                {copied ? "Copied!" : "Copy to Clipboard"}
              </Button>
              <label className="flex items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  checked={saved}
                  onChange={(e) => setSaved(e.target.checked)}
                  className="rounded"
                />
                I have saved these recovery codes
              </label>
              <Button onClick={handleDone} disabled={!saved} className="w-full">
                Done
              </Button>
            </div>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}
