import { useState } from "react";
import { useEncryptionStore } from "@/lib/crypto/encryption-store";
import { Button, Checkbox, Dialog, Input, Label } from "@stageholder/ui";
import { toast } from "sonner";
import { Shield, Copy, Check } from "lucide-react";

export function PassphraseSetupDialog({
  open,
  onComplete,
}: {
  open: boolean;
  // Called when the dialog should close — both on successful setup
  // completion AND on user-initiated cancel. The parent (`encryption-gate`)
  // just flips its local `showSetup` state to false either way, so a
  // single "close the dialog" callback is sufficient.
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

  // User-initiated cancel from the "create" step. Resets the form state
  // (so reopening the dialog starts fresh) then closes via onComplete.
  // Not exposed on the "recovery" step — once codes have been generated,
  // the user must complete the flow to avoid losing them.
  function handleCancel() {
    setStep("create");
    setPassphrase("");
    setConfirm("");
    setError("");
    onComplete();
  }

  return (
    <Dialog open={open}>
      <Dialog.Portal>
        <Dialog.Overlay />
        <Dialog.Content
          className="sm:max-w-md"
          onInteractOutside={(e) => e.preventDefault()}
        >
          {step === "create" ? (
            <>
              {/* Restructured header: the Shield icon now lives in its own
                flex row above Dialog.Title, instead of inside Title with
                flex+gap. Tamagui's Dialog.Title renders as an inline-ish
                Text on web — putting Description as its sibling caused
                the two to render on the same line. Splitting the icon
                out makes the wrapping <div>s the block-level boundaries. */}
              <div className="space-y-2">
                <div className="flex items-center gap-2">
                  <Shield className="size-5" />
                  <Dialog.Title>Set Up Journal Encryption</Dialog.Title>
                </div>
                <Dialog.Description>
                  Create an encryption passphrase to protect your journal
                  entries. This is separate from your login password. Even we
                  cannot read your encrypted journals.
                </Dialog.Description>
              </div>
              <div className="space-y-4 pt-2">
                <div className="space-y-2">
                  <Label htmlFor="passphrase">Encryption Passphrase</Label>
                  <Input
                    id="passphrase"
                    width="100%"
                    secureTextEntry
                    value={passphrase}
                    onChangeText={setPassphrase}
                    placeholder="Enter a strong passphrase"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="confirm">Confirm Passphrase</Label>
                  <Input
                    id="confirm"
                    width="100%"
                    secureTextEntry
                    value={confirm}
                    onChangeText={setConfirm}
                    placeholder="Confirm your passphrase"
                    onKeyPress={(e: { nativeEvent: { key: string } }) => {
                      if (e.nativeEvent.key === "Enter") void handleSetup();
                    }}
                  />
                </div>
                {error && <p className="text-sm text-destructive">{error}</p>}
                {/* Dialog-footer convention: right-aligned actions, primary
                  on the far right, dismissive (Cancel) ghost-styled on the
                  left of the pair. Both content-sized.

                  Submit is NOT disabled when fields are empty — letting
                  the user click and see the validation message ("must be
                  at least 8 characters" / "passphrases do not match") is
                  a clearer UX than a silently-disabled button that gives
                  no feedback. We only disable during the in-flight save
                  to prevent double-submit. */}
                <div className="flex justify-end gap-2">
                  <Button intent="ghost" onPress={handleCancel}>
                    Cancel
                  </Button>
                  <Button
                    onPress={handleSetup}
                    disabled={loading}
                    loading={loading}
                    loadingText="Setting up…"
                  >
                    Set Up Encryption
                  </Button>
                </div>
              </div>
            </>
          ) : (
            <>
              <div className="space-y-2">
                <Dialog.Title>Save Your Recovery Codes</Dialog.Title>
                <Dialog.Description>
                  If you forget your passphrase, these codes are the only way to
                  recover access to your journals. Store them somewhere safe.
                </Dialog.Description>
              </div>
              <div className="space-y-4 pt-2">
                <div className="grid grid-cols-2 gap-2 rounded-lg border bg-muted/50 p-4 font-mono text-sm">
                  {recoveryCodes.map((code, i) => (
                    <div key={i} className="text-center">
                      {code}
                    </div>
                  ))}
                </div>
                <Button
                  intent="outline"
                  icon={
                    copied ? (
                      <Check className="size-4" />
                    ) : (
                      <Copy className="size-4" />
                    )
                  }
                  onPress={handleCopy}
                  className="w-full"
                >
                  {copied ? "Copied!" : "Copy to Clipboard"}
                </Button>
                <Label className="flex items-center gap-2 text-sm">
                  <Checkbox
                    checked={saved}
                    onCheckedChange={(v) => setSaved(v === true)}
                  >
                    <Checkbox.Indicator>
                      <Check className="size-3" />
                    </Checkbox.Indicator>
                  </Checkbox>
                  I have saved these recovery codes
                </Label>
                <Button
                  onPress={handleDone}
                  disabled={!saved}
                  className="w-full"
                >
                  Done
                </Button>
              </div>
            </>
          )}
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog>
  );
}
