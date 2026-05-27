import { useState } from "react";
import { useEncryptionStore } from "@/lib/crypto/encryption-store";
import { Button, H2, Input, Text, View, XStack, YStack } from "@stageholder/ui";
// Form isn't re-exported by the kit yet; pull it from the shared tamagui dep.
import { Form } from "tamagui";
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
          <Text color="$mutedForeground" lineHeight={0}>
            <Lock size={32} />
          </Text>
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
