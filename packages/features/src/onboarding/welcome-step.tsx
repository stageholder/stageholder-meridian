import { Button, H2, Paragraph, YStack } from "@stageholder/ui";

export function WelcomeStep({
  name,
  onContinue,
}: {
  name: string;
  onContinue: () => void;
}) {
  return (
    <YStack items="center" gap="$6">
      <YStack gap="$2" items="center">
        <H2 fontSize="$8" fontWeight="700" color="$color" text="center">
          Welcome to Meridian, {name.split(" ")[0]}!
        </H2>
        <Paragraph fontSize="$3" color="$mutedForeground" text="center">
          Your personal productivity companion for tasks, habits, journaling,
          and more. Let&apos;s get you set up in just a few steps.
        </Paragraph>
      </YStack>
      <Button size="lg" onPress={onContinue}>
        Get Started
      </Button>
    </YStack>
  );
}
