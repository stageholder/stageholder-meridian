import { format } from "date-fns";
import { Flame } from "lucide-react";
import { H1, Paragraph, Text, XStack, YStack } from "@stageholder/ui";
import { useUser } from "@/hooks/use-user";
import { useUserLight } from "@/lib/api/light";

function getGreeting(hour: number): string {
  if (hour < 5) return "Good night";
  if (hour < 12) return "Good morning";
  if (hour < 17) return "Good afternoon";
  if (hour < 21) return "Good evening";
  return "Good night";
}

export function GreetingBar() {
  const { user } = useUser();
  const { data: userLight } = useUserLight();
  const now = new Date();
  const greeting = getGreeting(now.getHours());
  const dateStr = format(now, "EEEE, MMMM d");
  const streak = userLight?.perfectDayStreak ?? 0;

  return (
    <YStack
      gap="$1"
      $sm={{ flexDirection: "row", items: "center", justify: "space-between" }}
    >
      <YStack>
        {/* `size="$8"` (not `fontSize`) so fontSize (26) AND lineHeight (38)
            come from one token — H1 otherwise defaults to `size:'$10'` whose
            57px line-height left ~15px of dead leading above the caps.
            `mt={-8}` then trims the remaining ~10px of above-cap leading inside
            the 38px line-box (Tamagui has no leading-trim) so the heading's cap
            sits flush with the page's top padding, matching the left inset.
            Nudge this value if the top still reads off. */}
        <H1
          size="$8"
          fontWeight="700"
          letterSpacing={-0.5}
          color="$color"
          mt={-8}
        >
          {greeting}
          {user?.name ? `, ${user.name.split(" ")[0]}` : ""}
        </H1>
        <Paragraph fontSize="$3" color="$mutedForeground">
          {dateStr}
        </Paragraph>
      </YStack>
      {streak > 0 && (
        // Streak pill: amber/warning surface → kit warning tokens
        // ($warningMuted tint + $warning text), theme-aware in both modes.
        <XStack
          items="center"
          gap="$1.5"
          rounded={9999}
          bg="$warningMuted"
          px="$3"
          py="$1.5"
        >
          <Text color="$warning" lineHeight={0}>
            <Flame size={16} />
          </Text>
          <Text
            fontSize="$3"
            fontWeight="600"
            color="$warning"
            style={{ fontVariant: ["tabular-nums"] }}
          >
            {streak} day streak
          </Text>
        </XStack>
      )}
    </YStack>
  );
}
