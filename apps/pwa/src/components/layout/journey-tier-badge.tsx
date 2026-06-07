import { useNavigate } from "@tanstack/react-router";
import {
  Button,
  Popover,
  Progress,
  ProgressRing,
  Text,
  XStack,
  YStack,
} from "@stageholder/ui";
import { StarVisual } from "@repo/features/light";
import {
  getTierProgress,
  getNextTier,
  LIGHT_TIERS,
} from "@repo/core/types/light";
import type { UserLight } from "@repo/core/types";

// Per-tier COLOR VALUES. `ring` is the brightest mid-stop — applied as a SOLID
// color via Tamagui's color/fillColor props (no gradient text clip). `track` is
// the unfilled ring. Single source for both the desktop and mobile badges.
const tierColors: Record<
  number,
  { ring: `#${string}`; track: `rgba(${string})` }
> = {
  1: { ring: "#cbd5e1", track: "rgba(148,163,184,0.15)" },
  2: { ring: "#ef4444", track: "rgba(239,68,68,0.15)" },
  3: { ring: "#f59e0b", track: "rgba(245,158,11,0.15)" },
  4: { ring: "#f97316", track: "rgba(249,115,22,0.15)" },
  5: { ring: "#f97316", track: "rgba(249,115,22,0.15)" },
  6: { ring: "#eab308", track: "rgba(234,179,8,0.15)" },
  7: { ring: "#fbbf24", track: "rgba(251,191,36,0.15)" },
  8: { ring: "#fde68a", track: "rgba(253,230,138,0.15)" },
  9: { ring: "#eab308", track: "rgba(234,179,8,0.15)" },
  10: { ring: "#fbbf24", track: "rgba(251,191,36,0.15)" },
};

/**
 * The user's gamification tier ("Light" level) shown in the header.
 *
 * Two forms, switched purely by static media props (no JS `useMedia` branch, so
 * both extract to CSS and neither flashes):
 *
 *  - **Desktop (≥md)** — the full trigger: tier title + 28px progress ring, with
 *    a tap-to-open Popover detailing progress to the next tier, streak stats,
 *    and a link to the Journey page.
 *  - **Mobile (<md)** — a compact 26px ring + star with no title (to save header
 *    width) that navigates straight to `/journey` on tap (a larger, simpler
 *    touch target than a popover).
 *
 * Render it once, guarded by the caller for a loaded `userLight`.
 */
export function JourneyTierBadge({ userLight }: { userLight: UserLight }) {
  const navigate = useNavigate();

  const progress = getTierProgress(userLight.totalLight, userLight.currentTier);
  const nextTier = getNextTier(userLight.currentTier);
  const colors = tierColors[userLight.currentTier] ?? tierColors[1]!;

  return (
    <>
      {/* Mobile: compact ring, taps straight to the Journey page. */}
      <Button
        intent="ghost"
        size="sm"
        shrink={0}
        px="$1.5"
        py="$1"
        height="auto"
        aria-label={`Journey — ${userLight.currentTitle}`}
        onPress={() => void navigate({ to: "/journey" })}
        $md={{ display: "none" }}
      >
        <ProgressRing
          value={progress}
          size={26}
          thickness={2.5}
          fillColor={colors.ring}
          trackColor={colors.track}
          shrink={0}
        >
          <StarVisual tier={userLight.currentTier} size="xs" />
        </ProgressRing>
      </Button>

      {/* Desktop: title + ring with the full progress popover. */}
      <XStack
        items="center"
        shrink={0}
        display="none"
        $md={{ display: "flex" }}
      >
        <Popover placement="bottom-end">
          <Popover.Trigger asChild>
            <Button
              intent="ghost"
              size="sm"
              shrink={0}
              gap={6}
              py="$1"
              px="$2"
              height="auto"
              aria-label="Journey progress"
            >
              <Text
                fontSize={11}
                fontWeight="600"
                letterSpacing={0.5}
                color={colors.ring}
              >
                {userLight.currentTitle}
              </Text>
              <ProgressRing
                value={progress}
                size={28}
                thickness={2.5}
                fillColor={colors.ring}
                trackColor={colors.track}
                shrink={0}
              >
                <StarVisual tier={userLight.currentTier} size="xs" />
              </ProgressRing>
            </Button>
          </Popover.Trigger>
          <Popover.Content width={256} maxW="calc(100vw - 2rem)" p={0}>
            <YStack items="center" gap="$2" px="$4" pt="$4" pb="$3">
              <ProgressRing
                value={progress}
                size={72}
                thickness={4}
                fillColor={colors.ring}
                trackColor={colors.track}
                animate
              >
                <StarVisual tier={userLight.currentTier} size="md" animate />
              </ProgressRing>
              <Text fontSize="$3" fontWeight="700">
                {userLight.currentTitle}
              </Text>
              <Text
                fontSize={11}
                color="$mutedForeground"
                text="center"
                lineHeight={15}
                px="$1"
              >
                {LIGHT_TIERS[userLight.currentTier - 1]?.shortDescription}
              </Text>
              {nextTier ? (
                <YStack width="100%" gap="$0.5">
                  <Progress
                    value={progress}
                    height={6}
                    width="100%"
                    bg="$muted"
                    rounded={9999}
                  >
                    <Progress.Indicator bg="$warning" transition="quick" />
                  </Progress>
                  <Text text="center" fontSize={11} color="$mutedForeground">
                    <Text fontWeight="500" color="$color">
                      {userLight.totalLight}
                    </Text>
                    {" / "}
                    {nextTier.lightRequired} Light
                  </Text>
                </YStack>
              ) : (
                <Text fontSize={11} color="$mutedForeground">
                  {userLight.totalLight.toLocaleString()} Light — Max tier
                  reached
                </Text>
              )}
            </YStack>
            <XStack
              width="100%"
              py="$2.5"
              borderTopWidth={1}
              borderColor="$borderColor"
            >
              <YStack flex={1} items="center" gap="$0.5">
                <Text fontSize="$1" fontWeight="700">
                  {userLight.perfectDayStreak}d
                </Text>
                <Text fontSize={10} color="$mutedForeground">
                  Streak
                </Text>
              </YStack>
              <YStack flex={1} items="center" gap="$0.5">
                <Text fontSize="$1" fontWeight="700">
                  {userLight.perfectDaysTotal}
                </Text>
                <Text fontSize={10} color="$mutedForeground">
                  Perfect
                </Text>
              </YStack>
              <YStack flex={1} items="center" gap="$0.5">
                <Text fontSize="$1" fontWeight="700">
                  {userLight.longestPerfectStreak}d
                </Text>
                <Text fontSize={10} color="$mutedForeground">
                  Best
                </Text>
              </YStack>
            </XStack>
            {/* Popover.Close dismisses on click; the Button's onPress still
                navigates (handlers compose). */}
            <Popover.Close asChild>
              <Button
                intent="ghost"
                size="sm"
                width="100%"
                height="auto"
                py="$2.5"
                rounded={0}
                borderTopWidth={1}
                borderColor="$borderColor"
                color="$mutedForeground"
                hoverStyle={
                  // `color` isn't in the View frame's pseudo type; it works at
                  // runtime via CSS cascade onto the label, so it rides a cast.
                  { bg: "$accent", color: "$color" } as never
                }
                onPress={() => void navigate({ to: "/journey" })}
              >
                My Journey →
              </Button>
            </Popover.Close>
          </Popover.Content>
        </Popover>
      </XStack>
    </>
  );
}
