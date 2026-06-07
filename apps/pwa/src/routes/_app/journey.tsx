import { createFileRoute } from "@tanstack/react-router";
import { format } from "date-fns";
import { useUserLight } from "@/lib/api/light";
import { ActivityRings } from "@/components/activity-rings";
import {
  StarVisual,
  LevelProgress,
  LevelUpCelebration,
  JourneyStreaks,
  JourneyTierMap,
  JourneyStats,
} from "@repo/features/light";
import { useLevelUp } from "@/lib/hooks/use-level-up";
import { LIGHT_TIERS } from "@repo/core/types/light";
import { JourneyFeed } from "@/components/light/journey-feed";
import { JourneyLightChart } from "@/components/light/journey-light-chart";
import { Card, H1, H2, Paragraph, View, XStack, YStack } from "@stageholder/ui";

export const Route = createFileRoute("/_app/journey")({
  component: JourneyPage,
});

function JourneyPage() {
  const { data: userLight, isLoading } = useUserLight();
  const { levelUpTier, dismiss } = useLevelUp(userLight);
  const today = format(new Date(), "yyyy-MM-dd");

  if (isLoading || !userLight) {
    return (
      <XStack minH={"50vh" as never} items="center" justify="center">
        {/* allowlist: animate-spin keyframe (sanctioned spinner class). The
            amber ring tints are plain CSS colors on the style hatch. */}
        <View
          height={32}
          width={32}
          rounded={9999}
          borderWidth={2}
          className="animate-spin"
          style={
            {
              borderColor:
                "color-mix(in srgb, var(--muted-foreground) 20%, transparent)",
              borderTopColor: "#f59e0b",
            } as object
          }
        />
      </XStack>
    );
  }

  return (
    <YStack mx="auto" maxW={768} gap="$6" p="$4" $lg={{ p: "$5" }}>
      {/* Hero + Today's Progress — two-column on md+ */}
      {/* Flexbox auto-fit: columns flex to fill, wrapping below minWidth so the
          layout reads single-column on mobile and two-up once wide enough. */}
      <XStack flexWrap="wrap" gap="$4">
        {/* Left: Hero — Star + Title + Progress */}
        {/* Amber gradient surface + border tint — web-only CSS (no token
            equivalent) on the style hatch (was Tailwind amber utilities). */}
        <YStack
          flex={1}
          minW={280}
          position="relative"
          items="center"
          justify="center"
          overflow="hidden"
          rounded="$6"
          borderWidth={1}
          px="$5"
          pb="$5"
          pt="$6"
          style={
            {
              borderColor: "rgba(245, 158, 11, 0.2)",
              background:
                "linear-gradient(to bottom, rgba(245, 158, 11, 0.05), transparent)",
            } as object
          }
        >
          {/* Amber ambient glow — translucency + heavy blur (web-only CSS)
              on the style hatch. */}
          <View
            position="absolute"
            t={0}
            l="50%"
            height={128}
            width={256}
            rounded={9999}
            pointerEvents="none"
            style={
              {
                transform: "translateX(-50%)",
                backgroundColor: "rgba(245, 158, 11, 0.1)",
                filter: "blur(64px)",
              } as object
            }
          />

          <StarVisual tier={userLight.currentTier} size="xl" />
          <H1
            mt="$3"
            fontSize="$8"
            fontWeight="700"
            letterSpacing={-0.5}
            color="$color"
          >
            {userLight.currentTitle}
          </H1>
          <Paragraph mt="$0.5" fontSize="$3" color="$mutedForeground">
            {userLight.totalLight.toLocaleString()} Light earned
          </Paragraph>
          {/* mt-5 / w-full → Tamagui margin + width on a wrapping View. */}
          <View mt="$5" width="100%">
            <LevelProgress userLight={userLight} />
          </View>
        </YStack>

        {/* Right: Today's Progress + Quick Stats */}
        <YStack flex={1} minW={280} gap="$4">
          <View>
            <H2
              mb="$3"
              fontSize="$3"
              fontWeight="600"
              color="$mutedForeground"
              textTransform="uppercase"
              letterSpacing={0.5}
            >
              Today&apos;s Progress
            </H2>
            <ActivityRings date={today} size="lg" showLabels />
          </View>
          <JourneyStats userLight={userLight} />
        </YStack>
      </XStack>

      {/* Tier description — full width below hero */}
      <Paragraph
        fontSize="$3"
        color="$mutedForeground"
        text="center"
        maxW={512}
        mx="auto"
      >
        {LIGHT_TIERS[userLight.currentTier - 1]?.description}
      </Paragraph>

      {/* Streaks */}
      <View render="section">
        <H2
          mb="$3"
          fontSize="$3"
          fontWeight="600"
          color="$mutedForeground"
          textTransform="uppercase"
          letterSpacing={0.5}
        >
          Streaks
        </H2>
        <JourneyStreaks userLight={userLight} />
      </View>

      {/* Light Earned Chart */}
      <Card>
        <Card.Header>
          <Card.Title fontSize="$3">Light Earned</Card.Title>
        </Card.Header>
        <Card.Body>
          <JourneyLightChart />
        </Card.Body>
      </Card>

      {/* Tier Map */}
      <View render="section">
        <H2
          mb="$3"
          fontSize="$3"
          fontWeight="600"
          color="$mutedForeground"
          textTransform="uppercase"
          letterSpacing={0.5}
        >
          Tier Map
        </H2>
        <JourneyTierMap currentTier={userLight.currentTier} />
      </View>

      {/* Recent Light Feed */}
      <Card>
        <Card.Header>
          <Card.Title fontSize="$3">Recent Light</Card.Title>
        </Card.Header>
        <Card.Body>
          <JourneyFeed />
        </Card.Body>
      </Card>

      {levelUpTier && (
        <LevelUpCelebration tier={levelUpTier} onDismiss={dismiss} />
      )}
    </YStack>
  );
}
