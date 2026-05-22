import { createFileRoute } from "@tanstack/react-router";
import { BookOpen } from "lucide-react";
import { YStack, Paragraph, View } from "@stageholder/ui";

export const Route = createFileRoute("/_app/journal/")({
  component: JournalPage,
});

function JournalPage() {
  return (
    <YStack height="100%" items="center" justify="center" p="$6">
      <YStack items="center">
        <View opacity={0.3} color="$mutedForeground">
          <BookOpen size={48} />
        </View>
        <Paragraph
          mt="$3.5"
          fontSize="$3"
          color="$mutedForeground"
          text="center"
        >
          Select a journal entry to read, or create a new one.
        </Paragraph>
      </YStack>
    </YStack>
  );
}
