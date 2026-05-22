import { useState } from "react";
import { useLightEvents } from "@/lib/api/light";
import { format } from "date-fns";
import { parseDateLocal } from "@/lib/date";
import {
  CheckCircle2,
  Plus,
  Target,
  BookOpen,
  Star,
  Flame,
  CircleDot,
} from "lucide-react";
import { Text, View, XStack, YStack } from "@stageholder/ui";

// Per-action accent colors. These decorative hues (blue/orange/emerald/amber/
// red/purple) have no kit token — they're event-category accents, so the icon
// color rides the style escape hatch (`as const` keeps the literal types).
const ACTION_CONFIG: Record<
  string,
  { label: string; icon: typeof Star; color?: string }
> = {
  todo_complete: {
    label: "Completed todo",
    icon: CheckCircle2,
    color: "#3b82f6",
  },
  todo_create: { label: "Todo created", icon: Plus, color: "#60a5fa" },
  habit_checkin: {
    label: "Habit check-in",
    icon: Target,
    color: "#f97316",
  },
  journal_entry: {
    label: "Journal entry",
    icon: BookOpen,
    color: "#10b981",
  },
  perfect_day: { label: "Perfect Day", icon: Star, color: "#f59e0b" },
  ring_streak_bonus: {
    label: "Streak milestone",
    icon: Flame,
    color: "#ef4444",
  },
  ring_completion_bonus: {
    label: "Ring completed",
    icon: CircleDot,
    color: "#a855f7",
  },
};

const INITIAL_LIMIT = 10;
const LOAD_MORE = 20;

export function JourneyFeed() {
  const [limit, setLimit] = useState(INITIAL_LIMIT);
  const { data: events, isLoading } = useLightEvents(limit, 0);

  if (isLoading) {
    return (
      <Text fontSize="$3" color="$mutedForeground">
        Loading events...
      </Text>
    );
  }

  if (!events || events.length === 0) {
    return (
      <Text fontSize="$3" color="$mutedForeground">
        No Light events yet. Complete tasks, check in habits, or write journal
        entries to earn Light.
      </Text>
    );
  }

  const grouped = events.reduce<Record<string, typeof events>>((acc, event) => {
    const dateKey = format(new Date(event.createdAt), "yyyy-MM-dd");
    if (!acc[dateKey]) acc[dateKey] = [];
    acc[dateKey].push(event);
    return acc;
  }, {});

  const sortedDates = Object.keys(grouped).sort((a, b) =>
    a < b ? 1 : a > b ? -1 : 0,
  );

  const hasMore = events.length >= limit;

  return (
    <YStack gap="$4">
      {sortedDates.map((dateKey) => {
        const dayEvents = grouped[dateKey]!;
        const dayTotal = dayEvents.reduce((sum, e) => sum + e.totalLight, 0);

        return (
          <YStack key={dateKey}>
            <XStack
              items="center"
              justify="space-between"
              borderBottomWidth={1}
              borderColor="$borderColor"
              pb="$1.5"
            >
              <Text fontSize="$3" fontWeight="500" color="$color">
                {format(parseDateLocal(dateKey), "MMM d, yyyy")}
              </Text>
              {/* Amber "+N Light" pill — decorative gold tint with no token. */}
              <View
                rounded={9999}
                px="$2"
                py={2}
                style={{ backgroundColor: "rgba(251, 191, 36, 0.18)" }}
              >
                <Text
                  fontSize="$1"
                  fontWeight="600"
                  style={{
                    color: "#b45309",
                    fontVariantNumeric: "tabular-nums",
                  }}
                >
                  +{dayTotal} Light
                </Text>
              </View>
            </XStack>

            <YStack mt="$2" gap="$1.5">
              {dayEvents.map((event) => {
                const config = ACTION_CONFIG[event.action] ?? {
                  label: event.action,
                  icon: Star,
                  color: undefined,
                };
                const Icon = config.icon;

                return (
                  <XStack
                    key={event.id}
                    items="center"
                    gap="$2.5"
                    rounded="$lg"
                    px="$1"
                    py="$1"
                  >
                    {/* Tinted category icon (style hatch for non-token hues);
                        falls back to the muted-foreground token. */}
                    <Text
                      shrink={0}
                      lineHeight={0}
                      color={config.color ? undefined : "$mutedForeground"}
                      style={config.color ? { color: config.color } : undefined}
                    >
                      <Icon size={14} />
                    </Text>
                    <Text flex={1} fontSize="$3" color="$color">
                      {config.label}
                    </Text>
                    <Text
                      shrink={0}
                      fontSize="$3"
                      color="$mutedForeground"
                      style={{ fontVariantNumeric: "tabular-nums" }}
                    >
                      {event.baseLight} x {event.multiplier} ={" "}
                      <Text fontSize="$3" fontWeight="500" color="$color">
                        {event.totalLight}
                      </Text>
                    </Text>
                  </XStack>
                );
              })}
            </YStack>
          </YStack>
        );
      })}
      {hasMore && (
        <View
          tag="button"
          group
          width="100%"
          rounded="$lg"
          borderWidth={1}
          borderColor="$borderColor"
          py="$2"
          items="center"
          transition="quick"
          hoverStyle={{ bg: "$accent" }}
          onPress={() => setLimit((l) => l + LOAD_MORE)}
        >
          <Text
            fontSize="$3"
            color="$mutedForeground"
            $group-hover={{ color: "$color" }}
          >
            Show more
          </Text>
        </View>
      )}
    </YStack>
  );
}
