import { useState } from "react";
import { Check } from "lucide-react";
import { Button, Paragraph, Text, XStack, YStack } from "@stageholder/ui";

export function CompleteStep({ onFinish }: { onFinish: () => Promise<void> }) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleFinish() {
    setError(null);
    setLoading(true);
    try {
      await onFinish();
    } catch {
      setError("We couldn't save that. Try again.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <YStack items="center" gap="$6">
      {/* Check badge: 64px circle, $primaryMuted bg (= bg-primary/10) */}
      <XStack
        width={64}
        height={64}
        items="center"
        justify="center"
        rounded={9999}
        bg="$primaryMuted"
      >
        <Text color="$primary">
          <Check size={32} />
        </Text>
      </XStack>

      <YStack gap="$2" items="center">
        <Text fontSize="$8" fontWeight="700" color="$color" text="center">
          You&apos;re all set!
        </Text>
        <Paragraph fontSize="$3" color="$mutedForeground" text="center">
          You&apos;re ready to go. Start building habits, tracking tasks, and
          journaling your journey.
        </Paragraph>
      </YStack>

      {error && (
        <Text fontSize="$3" color="$destructive" role="alert">
          {error}
        </Text>
      )}

      <Button
        size="lg"
        onPress={handleFinish}
        disabled={loading}
        loading={loading}
        loadingText="Saving…"
      >
        Go to Dashboard
      </Button>
    </YStack>
  );
}
