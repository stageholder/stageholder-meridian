// Two-step encryption setup wizard CONTENT — step 1 collects + confirms a
// passphrase, step 2 shows the recovery codes the user must save before
// they can finish. Chrome-free: the host supplies the surface (PWA wraps it
// in a kit `Dialog` via `PassphraseSetupDialog`, mobile hosts it in a kit
// `FormSheet`) and renders the per-step title/description itself —
// `PASSPHRASE_SETUP_COPY` + `onStepChange` exist for exactly that.
//
// Presentational only: the host supplies `onSetup` wired to its encryption
// store's `setupPassphrase` method and (optionally) an `onSetupError` toast.
//
// `writeToClipboard` is the cross-platform adapter from
// `@repo/core/platform/clipboard` — web clipboard API on web,
// `expo-clipboard` on native.

import { useState } from "react";
import { Button, Input, Label, Text, XStack, YStack } from "@stageholder/ui";
// Form isn't re-exported by the kit yet; pull it from the shared tamagui dep.
import { Form } from "tamagui";

import { RecoveryCodesPanel } from "./recovery-codes-panel";

export type PassphraseSetupStep = "create" | "recovery";

/**
 * Per-step heading copy. Hosts render this in their own chrome (Dialog.Title
 * on the PWA, FormSheet's `title`/`description` on mobile) so the two
 * surfaces stay word-for-word identical.
 */
export const PASSPHRASE_SETUP_COPY = {
  create: {
    title: "Set Up Journal Encryption",
    description:
      "Create an encryption passphrase to protect your journal entries. " +
      "This is separate from your login password. Even we cannot read " +
      "your encrypted journals.",
  },
  recovery: {
    title: "Save Your Recovery Codes",
    description:
      "If you forget your passphrase, these codes are the only way to " +
      "recover access to your journals. Store them somewhere safe.",
  },
} as const;

export interface PassphraseSetupFormProps {
  /**
   * Called when the flow should end — both on successful finish (Done) AND
   * on user-initiated cancel from the "create" step. The host typically
   * closes its dialog/sheet either way.
   */
  onComplete: () => void;
  /**
   * Generate the user's encryption key + return the recovery codes they
   * must save (typically 8-12 short strings). The view advances to the
   * "show recovery codes" step on resolve. Throwing surfaces via
   * `onSetupError` (the host typically shows a toast).
   */
  onSetup: (passphrase: string) => Promise<string[]>;
  /** Called when `onSetup` throws. Host usually surfaces a toast. */
  onSetupError?: (err: unknown) => void;
  /**
   * Fired when the wizard advances to the recovery step (and back to
   * "create" on finish/cancel) so the host can swap its title/description.
   * Hosts that must not dismiss mid-recovery (sheet overlay taps) also key
   * off this.
   */
  onStepChange?: (step: PassphraseSetupStep) => void;
}

export function PassphraseSetupForm({
  onComplete,
  onSetup,
  onSetupError,
  onStepChange,
}: PassphraseSetupFormProps) {
  const [step, setStepState] = useState<PassphraseSetupStep>("create");
  const [passphrase, setPassphrase] = useState("");
  const [confirm, setConfirm] = useState("");
  const [recoveryCodes, setRecoveryCodes] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  function setStep(next: PassphraseSetupStep) {
    setStepState(next);
    onStepChange?.(next);
  }

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
      const codes = await onSetup(passphrase);
      setRecoveryCodes(codes);
      setStep("recovery");
    } catch (err) {
      onSetupError?.(err);
    } finally {
      setLoading(false);
    }
  }

  function handleDone() {
    onComplete();
    setStep("create");
    setPassphrase("");
    setConfirm("");
    setRecoveryCodes([]);
  }

  // User-initiated cancel from the "create" step. Resets the form state so
  // reopening starts fresh, then closes via `onComplete`. Not exposed on the
  // "recovery" step — once codes have been generated, the user must complete
  // the flow to avoid losing them.
  function handleCancel() {
    setStep("create");
    setPassphrase("");
    setConfirm("");
    setError("");
    onComplete();
  }

  if (step === "create") {
    return (
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
        {/* Footer convention: right-aligned actions, primary on the far
            right, dismissive (Cancel) ghost-styled on the left. Submit isn't
            disabled when fields are empty — letting the user click and see
            the validation message is clearer UX than a silently-disabled
            button. Only disabled during the in-flight save to prevent
            double-submit. */}
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
    );
  }

  return (
    <YStack gap="$4" pt="$2">
      <RecoveryCodesPanel codes={recoveryCodes} onDone={handleDone} />
    </YStack>
  );
}
