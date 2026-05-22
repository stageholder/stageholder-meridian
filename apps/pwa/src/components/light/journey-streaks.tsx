import { Flame, CheckCircle2, Repeat2, BookOpen } from "lucide-react";
import { Text, View, XStack, YStack } from "@stageholder/ui";
import type { UserLight } from "@repo/core/types/light";

interface JourneyStreaksProps {
  userLight: UserLight;
}

// `color` here is the decorative accent for the overlaid lucide icon (no kit
// token — style escape hatch). `ringColor`/`trackColor` are Tailwind stroke
// classes consumed by the StreakRing SVG (viz coloring, left untouched).
const streakCards = [
  {
    label: "Perfect Day",
    icon: Flame,
    color: "#f59e0b",
    ringColor: "stroke-amber-500",
    trackColor: "stroke-amber-500/15",
    currentKey: "perfectDayStreak" as const,
    bestKey: "longestPerfectStreak" as const,
    maxDays: 30,
  },
  {
    label: "Todos",
    icon: CheckCircle2,
    color: "#3b82f6",
    ringColor: "stroke-blue-500",
    trackColor: "stroke-blue-500/15",
    currentKey: "todoRingStreak" as const,
    bestKey: null,
    maxDays: 14,
  },
  {
    label: "Habits",
    icon: Repeat2,
    color: "#f97316",
    ringColor: "stroke-orange-500",
    trackColor: "stroke-orange-500/15",
    currentKey: "habitRingStreak" as const,
    bestKey: null,
    maxDays: 14,
  },
  {
    label: "Journal",
    icon: BookOpen,
    color: "#10b981",
    ringColor: "stroke-emerald-500",
    trackColor: "stroke-emerald-500/15",
    currentKey: "journalRingStreak" as const,
    bestKey: null,
    maxDays: 14,
  },
] as const;

// VIZ leaf — SVG geometry + Tailwind stroke color classes left as-is.
function StreakRing({
  current,
  max,
  ringColor,
  trackColor,
}: {
  current: number;
  max: number;
  ringColor: string;
  trackColor: string;
}) {
  const pct = Math.min(100, (current / max) * 100);
  const r = 20;
  const circumference = 2 * Math.PI * r;
  const dashOffset = circumference - (circumference * pct) / 100;

  return (
    <svg width="52" height="52" viewBox="0 0 52 52" className="shrink-0">
      <circle
        cx="26"
        cy="26"
        r={r}
        fill="none"
        strokeWidth="4"
        className={trackColor}
      />
      <circle
        cx="26"
        cy="26"
        r={r}
        fill="none"
        strokeWidth="4"
        strokeLinecap="round"
        className={ringColor}
        strokeDasharray={circumference}
        strokeDashoffset={dashOffset}
        transform="rotate(-90 26 26)"
        style={{ transition: "stroke-dashoffset 1s ease-out" }}
      />
    </svg>
  );
}

export function JourneyStreaks({ userLight }: JourneyStreaksProps) {
  return (
    // Responsive grid: 2 columns, 4 at lg. `Grid`'s `columns` isn't a media-
    // aware style prop, so the CSS-grid template lives directly on a View with
    // an `$lg` override (gap maps gap-3 → $3).
    <View
      display="grid"
      gap="$3"
      style={{ gridTemplateColumns: "repeat(2, minmax(0, 1fr))" }}
      $lg={{
        style: { gridTemplateColumns: "repeat(4, minmax(0, 1fr))" },
      }}
    >
      {streakCards.map((card) => {
        const Icon = card.icon;
        const current = userLight[card.currentKey];
        const best = card.bestKey ? userLight[card.bestKey] : null;

        return (
          <XStack
            key={card.label}
            items="center"
            gap="$3"
            rounded="$lg"
            borderWidth={1}
            borderColor="$borderColor"
            bg="$card"
            p="$3"
          >
            <View position="relative" items="center" justify="center">
              <StreakRing
                current={current}
                max={card.maxDays}
                ringColor={card.ringColor}
                trackColor={card.trackColor}
              />
              {/* Centered accent icon — decorative hue via style hatch. */}
              <Text
                position="absolute"
                lineHeight={0}
                style={{ color: card.color }}
              >
                <Icon size={16} />
              </Text>
            </View>
            <YStack minW={0}>
              <Text
                fontSize="$6"
                fontWeight="700"
                lineHeight={20}
                color="$color"
                style={{ fontVariantNumeric: "tabular-nums" }}
              >
                {current}d
              </Text>
              <Text fontSize="$1" color="$mutedForeground">
                {card.label}
              </Text>
              {best !== null && (
                <Text fontSize={10} color="$mutedForeground">
                  Best: {best}d
                </Text>
              )}
            </YStack>
          </XStack>
        );
      })}
    </View>
  );
}
