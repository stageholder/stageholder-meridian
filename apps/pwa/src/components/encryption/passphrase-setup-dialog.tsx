import { useState } from "react";
import { useEncryptionStore } from "@/lib/crypto/encryption-store";
import {
  Button,
  Checkbox,
  Dialog,
  Grid,
  Input,
  Label,
  Text,
  XStack,
  YStack,
} from "@stageholder/ui";
// Form isn't re-exported by the kit yet; pull it from the shared tamagui dep.
import { Form } from "tamagui";
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
          maxW={448}
          onInteractOutside={(e) => e.preventDefault()}
        >
          {step === "create" ? (
            <>
              {/* Restructured header: the Shield icon now lives in its own
                flex row above Dialog.Title, instead of inside Title with
                flex+gap. Tamagui's Dialog.Title renders as an inline-ish
                Text on web — putting Description as its sibling caused
                the two to render on the same line. Splitting the icon
                out makes the wrapping stacks the block-level boundaries. */}
              <YStack gap="$2">
                <XStack items="center" gap="$2">
                  <Text color="$cardForeground" lineHeight={0}>
                    <Shield size={20} />
                  </Text>
                  <Dialog.Title>Set Up Journal Encryption</Dialog.Title>
                </XStack>
                <Dialog.Description>
                  Create an encryption passphrase to protect your journal
                  entries. This is separate from your login password. Even we
                  cannot read your encrypted journals.
                </Dialog.Description>
              </YStack>
              <Form onSubmit={() => void handleSetup()} gap="$4" pt="$2">
                <YStack gap="$2">
                  <Label htmlFor="passphrase">Encryption Passphrase</Label>
                  <Input
                    id="passphrase"
                    width="100%"
                    secureTextEntry
                    type={"password" as never}
                    value={passphrase}
                    onChangeText={setPassphrase}
                    placeholder="Enter a strong passphrase"
                  />
                </YStack>
                <YStack gap="$2">
                  <Label htmlFor="confirm">Confirm Passphrase</Label>
                  <Input
                    id="confirm"
                    width="100%"
                    secureTextEntry
                    type={"password" as never}
                    value={confirm}
                    onChangeText={setConfirm}
                    placeholder="Confirm your passphrase"
                  />
                </YStack>
                {error ? (
                  <Text fontSize="$3" color="$destructive">
                    {error}
                  </Text>
                ) : null}
                {/* Dialog-footer convention: right-aligned actions, primary
                  on the far right, dismissive (Cancel) ghost-styled on the
                  left of the pair. Both content-sized.

                  Submit is NOT disabled when fields are empty — letting
                  the user click and see the validation message ("must be
                  at least 8 characters" / "passphrases do not match") is
                  a clearer UX than a silently-disabled button that gives
                  no feedback. We only disable during the in-flight save
                  to prevent double-submit. */}
                <XStack justify="flex-end" gap="$2">
                  <Button intent="ghost" onPress={handleCancel}>
                    Cancel
                  </Button>
                  <Form.Trigger asChild>
                    <Button
                      disabled={loading}
                      loading={loading}
                      loadingText="Setting up…"
                    >
                      Set Up Encryption
                    </Button>
                  </Form.Trigger>
                </XStack>
              </Form>
            </>
          ) : (
            <>
              <YStack gap="$2">
                <Dialog.Title>Save Your Recovery Codes</Dialog.Title>
                <Dialog.Description>
                  If you forget your passphrase, these codes are the only way to
                  recover access to your journals. Store them somewhere safe.
                </Dialog.Description>
              </YStack>
              <YStack gap="$4" pt="$2">
                <Grid
                  columns={2}
                  gap="$2"
                  rounded="$lg"
                  borderWidth={1}
                  borderColor="$borderColor"
                  bg="$muted"
                  p="$4"
                >
                  {recoveryCodes.map((code, i) => (
                    <Text
                      key={i}
                      fontFamily="$mono"
                      fontSize="$3"
                      color="$color"
                      text="center"
                    >
                      {code}
                    </Text>
                  ))}
                </Grid>
                <Button
                  intent="outline"
                  width="100%"
                  icon={copied ? <Check size={16} /> : <Copy size={16} />}
                  onPress={handleCopy}
                >
                  {copied ? "Copied!" : "Copy to Clipboard"}
                </Button>
                <Label flexDirection="row" items="center" gap="$2" size="$3">
                  <Checkbox
                    checked={saved}
                    onCheckedChange={(v) => setSaved(v === true)}
                  >
                    <Checkbox.Indicator>
                      <Check size={12} />
                    </Checkbox.Indicator>
                  </Checkbox>
                  <Text>I have saved these recovery codes</Text>
                </Label>
                <Button onPress={handleDone} disabled={!saved} width="100%">
                  Done
                </Button>
              </YStack>
            </>
          )}
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog>
  );
}
