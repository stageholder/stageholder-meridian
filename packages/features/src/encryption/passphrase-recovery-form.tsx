// Recovery flow — for a FORGOTTEN passphrase, redeeming the recovery codes
// saved at setup. Chrome-free two-step wizard (host supplies Dialog /
// FormSheet + per-step titles via PASSPHRASE_RECOVERY_COPY + onStepChange,
// mirroring the setup form's contract):
//
//   step "redeem"   — paste/type the recovery codes + choose a new
//                     passphrase. `onRecover` unwraps the DEK with the
//                     recovery key, re-wraps under the new passphrase AND a
//                     fresh code set, finalizes server-side, and resolves
//                     with the NEW codes.
//   step "newCodes" — the fresh codes in the shared RecoveryCodesPanel
//                     (old codes are now burned — these are the only ones).
//
// Codes input is forgiving: split on whitespace/commas/newlines, empties
// dropped — pasting the copied block from setup "just works".

import { useState } from "react";
import {
  Button,
  Input,
  Label,
  Text,
  TextArea,
  XStack,
  YStack,
} from "@stageholder/ui";
// Form isn't re-exported by the kit yet; pull it from the shared tamagui dep.
import { Form } from "tamagui";

import { RecoveryCodesPanel } from "./recovery-codes-panel";

export type PassphraseRecoveryStep = "redeem" | "newCodes";

/** Per-step heading copy for hosts (Dialog.Title / FormSheet title). */
export const PASSPHRASE_RECOVERY_COPY = {
  redeem: {
    title: "Recover Your Journal",
    description:
      "Enter the recovery codes you saved when you set up encryption, and " +
      "choose a new passphrase. Your entries will be re-protected with it.",
  },
  newCodes: {
    title: "Save Your New Recovery Codes",
    description:
      "Your old codes no longer work. These new codes are now the only way " +
      "to recover access if you forget your passphrase.",
  },
} as const;

export interface PassphraseRecoveryFormProps {
  /**
   * Redeem the codes + set the new passphrase (host wires its crypto
   * store / module). Resolves with the NEW recovery codes; throws on
   * invalid codes or network failure.
   */
  onRecover: (codes: string[], newPassphrase: string) => Promise<string[]>;
  /** Fired when the flow ends — after Done on the new codes, or Cancel. */
  onComplete: () => void;
  /** Step change — hosts swap their title/description (and block
   *  dismissal on "newCodes", where the fresh codes must be saved). */
  onStepChange?: (step: PassphraseRecoveryStep) => void;
}

/** Forgiving code-block parser — whitespace/comma/newline separated. ORDER
 *  IS PRESERVED: the server verifies codes positionally against the saved
 *  set, so they must be entered in their original order (pasting the
 *  copied block from setup satisfies this naturally). */
function parseCodes(raw: string): string[] {
  return raw
    .split(/[\s,]+/)
    .map((c) => c.trim())
    .filter(Boolean);
}

/** The server requires exactly this many codes (journal-security DTOs). */
const RECOVERY_CODE_COUNT = 8;

/** Map the server's distinct failure modes to honest messages — the
 *  endpoint is rate-limited (5/hour → 429) and code-mismatch is a 401;
 *  blaming the codes on a 429 would gaslight the user. */
function recoveryErrorMessage(err: unknown): string {
  const response = (
    err as { response?: { status?: number; data?: { message?: string } } }
  )?.response;
  if (response?.status === 429) {
    return "Too many recovery attempts. Wait an hour and try again.";
  }
  if (response?.status === 401) {
    // Same status, two very different meanings — the server's "Recovery
    // exhausted" (uses counter at zero) is TERMINAL, not a typo.
    if (/exhausted/i.test(response.data?.message ?? "")) {
      return "Recovery has been used too many times for this account. Contact support.";
    }
    return "Those codes don't match. Enter all 8 exactly as saved, in their original order.";
  }
  return "Recovery failed — check your connection and try again.";
}

export function PassphraseRecoveryForm({
  onRecover,
  onComplete,
  onStepChange,
}: PassphraseRecoveryFormProps) {
  const [step, setStepState] = useState<PassphraseRecoveryStep>("redeem");
  const [codesRaw, setCodesRaw] = useState("");
  const [passphrase, setPassphrase] = useState("");
  const [confirm, setConfirm] = useState("");
  const [newCodes, setNewCodes] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  function setStep(next: PassphraseRecoveryStep) {
    setStepState(next);
    onStepChange?.(next);
  }

  async function handleRecover() {
    setError("");
    const codes = parseCodes(codesRaw);
    // The server validates length(8) and verifies positionally — catch the
    // count mismatch client-side with a precise message instead of a 400.
    if (codes.length !== RECOVERY_CODE_COUNT) {
      setError(
        codes.length === 0
          ? "Enter your recovery codes"
          : `Enter all ${RECOVERY_CODE_COUNT} codes — found ${codes.length}.`,
      );
      return;
    }
    if (passphrase.length < 8) {
      setError("New passphrase must be at least 8 characters");
      return;
    }
    if (passphrase !== confirm) {
      setError("Passphrases do not match");
      return;
    }

    setLoading(true);
    try {
      const fresh = await onRecover(codes, passphrase);
      setNewCodes(fresh);
      setStep("newCodes");
    } catch (err) {
      setError(recoveryErrorMessage(err));
    } finally {
      setLoading(false);
    }
  }

  function handleDone() {
    onComplete();
    setStep("redeem");
    setCodesRaw("");
    setPassphrase("");
    setConfirm("");
    setNewCodes([]);
  }

  if (step === "redeem") {
    return (
      <Form onSubmit={() => void handleRecover()} gap="$4" pt="$2">
        <YStack gap="$2">
          <Label>Recovery codes</Label>
          <TextArea
            width="100%"
            value={codesRaw}
            onChangeText={setCodesRaw}
            placeholder={
              "Paste all 8 codes — one per line,\nor separated by spaces"
            }
            rows={4}
            autoCapitalize="none"
            autoCorrect={false}
            // rows × lineHeight ignores padding under border-box → permanent
            // scrollbar; height auto lets native `rows` size it (kit gotcha).
            height={"auto" as never}
          />
          <Text fontSize="$1" color="$mutedForeground">
            Codes are case-sensitive and must be in their original order —
            pasting the block you copied at setup works as-is.
          </Text>
        </YStack>
        <YStack gap="$2">
          <Label>New passphrase</Label>
          <Input
            width="100%"
            secureTextEntry
            type={"password" as never}
            value={passphrase}
            onChangeText={setPassphrase}
            placeholder="At least 8 characters"
          />
        </YStack>
        <YStack gap="$2">
          <Label>Confirm new passphrase</Label>
          <Input
            width="100%"
            secureTextEntry
            type={"password" as never}
            value={confirm}
            onChangeText={setConfirm}
            placeholder="Repeat the new passphrase"
          />
        </YStack>
        {error ? (
          <Text fontSize="$3" color="$destructive">
            {error}
          </Text>
        ) : null}
        <XStack justify="flex-end" gap="$2">
          <Button intent="ghost" onPress={onComplete} disabled={loading}>
            Cancel
          </Button>
          <Form.Trigger asChild>
            <Button
              disabled={loading}
              loading={loading}
              loadingText="Recovering…"
            >
              Recover Journal
            </Button>
          </Form.Trigger>
        </XStack>
      </Form>
    );
  }

  return (
    <YStack gap="$4" pt="$2">
      <RecoveryCodesPanel codes={newCodes} onDone={handleDone} />
    </YStack>
  );
}
