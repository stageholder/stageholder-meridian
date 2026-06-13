// Change-passphrase form — chrome-free (host supplies the Dialog on web /
// FormSheet on mobile and its title). Collects the CURRENT passphrase plus
// a new one + confirmation; `onChangePassphrase` does the real work (unwrap
// DEK with old key → re-wrap with new → PUT /journal-security/passphrase).
// A throw from it is surfaced as "Current passphrase is incorrect" — the
// unwrap's AES-KW integrity failure is the wrong-passphrase signal on both
// platforms.

import { useState } from "react";
import { Button, Input, Label, Text, XStack, YStack } from "@stageholder/ui";
// Form isn't re-exported by the kit yet; pull it from the shared tamagui dep.
import { Form } from "tamagui";

export interface PassphraseChangeFormProps {
  /**
   * Perform the change (host wires its crypto store / module). Resolves on
   * success; throws on a wrong current passphrase or network failure.
   */
  onChangePassphrase: (
    oldPassphrase: string,
    newPassphrase: string,
  ) => Promise<void>;
  /** Fired after a successful change (host closes its chrome + toasts). */
  onComplete: () => void;
  /** Fired on Cancel. */
  onCancel: () => void;
}

export function PassphraseChangeForm({
  onChangePassphrase,
  onComplete,
  onCancel,
}: PassphraseChangeFormProps) {
  const [current, setCurrent] = useState("");
  const [next, setNext] = useState("");
  const [confirm, setConfirm] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  async function handleSubmit() {
    setError("");
    if (!current) {
      setError("Enter your current passphrase");
      return;
    }
    if (next.length < 8) {
      setError("New passphrase must be at least 8 characters");
      return;
    }
    if (next !== confirm) {
      setError("New passphrases do not match");
      return;
    }
    if (next === current) {
      setError("The new passphrase must be different");
      return;
    }

    setLoading(true);
    try {
      await onChangePassphrase(current, next);
      setCurrent("");
      setNext("");
      setConfirm("");
      onComplete();
    } catch {
      // The unwrap throws on a bad old key (AES-KW integrity) — by far the
      // most common failure here; network errors read the same retryable way.
      setError("Current passphrase is incorrect.");
      setCurrent("");
    } finally {
      setLoading(false);
    }
  }

  return (
    <Form onSubmit={() => void handleSubmit()} gap="$4" pt="$2">
      <YStack gap="$2">
        <Label>Current passphrase</Label>
        <Input
          width="100%"
          secureTextEntry
          type={"password" as never}
          value={current}
          onChangeText={setCurrent}
          placeholder="Your current passphrase"
        />
      </YStack>
      <YStack gap="$2">
        <Label>New passphrase</Label>
        <Input
          width="100%"
          secureTextEntry
          type={"password" as never}
          value={next}
          onChangeText={setNext}
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
        <Button intent="ghost" onPress={onCancel} disabled={loading}>
          Cancel
        </Button>
        <Form.Trigger asChild>
          <Button disabled={loading} loading={loading} loadingText="Changing…">
            Change Passphrase
          </Button>
        </Form.Trigger>
      </XStack>
    </Form>
  );
}
