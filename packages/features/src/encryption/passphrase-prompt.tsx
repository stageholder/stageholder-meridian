import { useState } from "react";
import { Button, H2, Input, Text, View, XStack, YStack } from "@stageholder/ui";
// Form isn't re-exported by the kit yet; pull it from the shared tamagui dep.
import { Form } from "tamagui";
import { Lock } from "@tamagui/lucide-icons-2";

export interface PassphrasePromptProps {
  /**
   * Called when the user submits the form. Resolves on success; throws
   * on a wrong passphrase / decryption error. The view catches the throw
   * and surfaces a generic "Wrong passphrase" message — pass `mapError`
   * to provide a richer mapping (e.g. distinguish network failures from
   * bad-passphrase failures when the host knows the difference).
   */
  onUnlock: (passphrase: string) => Promise<void>;
  /** Map a thrown error to a user-visible message. Default: generic. */
  mapError?: (err: unknown) => string;
}

const DEFAULT_ERROR_MESSAGE = "Wrong passphrase. Please try again.";

/**
 * Full-page lock screen — rendered when journal encryption is set up but
 * the passphrase isn't currently in memory. Uses the kit/Tamagui `Form`
 * so Enter-to-submit works cross-platform without manual `onKeyDown`.
 *
 * Presentational only: the host (PWA's `encryption-gate.tsx`, mobile's
 * equivalent) supplies `onUnlock` wired to its `useEncryptionStore`-side
 * `unlock` method.
 */
export function PassphrasePrompt({
  onUnlock,
  mapError,
}: PassphrasePromptProps) {
  const [passphrase, setPassphrase] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  async function handleUnlock() {
    setError("");
    setLoading(true);
    try {
      await onUnlock(passphrase);
    } catch (err) {
      setError(mapError ? mapError(err) : DEFAULT_ERROR_MESSAGE);
      setPassphrase("");
    } finally {
      setLoading(false);
    }
  }

  return (
    <XStack height="100%" items="center" justify="center" p="$8">
      <YStack width="100%" maxW={384} gap="$6">
        <View
          self="center"
          width={64}
          height={64}
          items="center"
          justify="center"
          rounded={9999}
          bg="$muted"
        >
          {/* lucide-icons-2 reads its own `color` prop (no CSS cascade), so
              tint the icon directly instead of wrapping it in a tinted Text. */}
          <Lock size={32} color="$mutedForeground" />
        </View>
        <YStack>
          <H2 fontSize="$6" fontWeight="600" color="$color" text="center">
            Journal Locked
          </H2>
          <Text mt="$1" fontSize="$3" color="$mutedForeground" text="center">
            Enter your encryption passphrase to access your journal entries.
          </Text>
        </YStack>
        <Form onSubmit={() => void handleUnlock()} gap="$3" width="100%">
          <Input
            width="100%"
            secureTextEntry
            type={"password" as never}
            value={passphrase}
            onChangeText={setPassphrase}
            placeholder="Encryption passphrase"
            autoFocus
          />
          {error ? (
            <Text fontSize="$3" color="$destructive" text="center">
              {error}
            </Text>
          ) : null}
          <Form.Trigger asChild>
            <Button
              width="100%"
              disabled={loading || !passphrase}
              loading={loading}
              loadingText="Unlocking…"
            >
              Unlock
            </Button>
          </Form.Trigger>
        </Form>
      </YStack>
    </XStack>
  );
}
