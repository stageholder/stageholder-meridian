import { format } from "date-fns";
import { CheckSquare, BookOpen, Target } from "lucide-react";
import { cn } from "@/lib/utils";
import { useActivityRings } from "@/lib/hooks/use-activity-rings";
import { Popover, Text, XStack, YStack } from "@stageholder/ui";

function CircleProgress({
  percent,
  color,
  trackColor,
  size = 28,
  strokeWidth = 2.5,
  children,
  className,
}: {
  percent: number;
  color: string;
  trackColor: string;
  size?: number;
  strokeWidth?: number;
  children: React.ReactNode;
  className?: string;
}) {
  const r = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * r;
  const filled = Math.min(100, Math.max(0, percent));
  const offset = circumference - (filled / 100) * circumference;

  return (
    <div
      className={cn("relative", className)}
      style={{
        display: "inline-flex",
        alignItems: "center",
        justifyContent: "center",
        width: size,
        height: size,
      }}
    >
      <svg
        className="absolute inset-0 -rotate-90"
        width={size}
        height={size}
        viewBox={`0 0 ${size} ${size}`}
      >
        <circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          fill="none"
          stroke={trackColor}
          strokeWidth={strokeWidth}
        />
        {filled > 0 && (
          <circle
            cx={size / 2}
            cy={size / 2}
            r={r}
            fill="none"
            stroke={color}
            strokeWidth={strokeWidth}
            strokeLinecap="round"
            strokeDasharray={circumference}
            strokeDashoffset={offset}
            className="transition-all duration-500"
          />
        )}
      </svg>
      {children}
    </div>
  );
}

export function DailyTargetRings() {
  const today = format(new Date(), "yyyy-MM-dd");
  const { data, details, isLoading } = useActivityRings(today);

  if (isLoading) return null;

  const todoComplete = data.todo >= 100;
  const habitComplete = data.habit >= 100;
  const journalComplete = data.journal >= 100;

  return (
    <Popover placement="bottom-end">
      <Popover.Trigger asChild>
        <XStack
          items="center"
          gap={4}
          rounded="$md"
          px="$1"
          py="$1"
          transition="quick"
          hoverStyle={{ bg: "$accent" }}
          aria-label="View daily targets"
        >
          <CircleProgress
            percent={data.todo}
            color="var(--ring-todo)"
            trackColor="var(--ring-todo-track)"
          >
            <CheckSquare
              className={cn(
                "size-3.5",
                todoComplete
                  ? "text-[var(--ring-todo)]"
                  : "text-muted-foreground/60",
              )}
            />
          </CircleProgress>
          <CircleProgress
            percent={data.habit}
            color="var(--ring-habit)"
            trackColor="var(--ring-habit-track)"
          >
            <Target
              className={cn(
                "size-3.5",
                habitComplete
                  ? "text-[var(--ring-habit)]"
                  : "text-muted-foreground/60",
              )}
            />
          </CircleProgress>
          <CircleProgress
            percent={data.journal}
            color="var(--ring-journal)"
            trackColor="var(--ring-journal-track)"
          >
            <BookOpen
              className={cn(
                "size-3.5",
                journalComplete
                  ? "text-[var(--ring-journal)]"
                  : "text-muted-foreground/60",
              )}
            />
          </CircleProgress>
        </XStack>
      </Popover.Trigger>
      <Popover.Content width={208} p="$3">
        <Text mb="$2" fontSize="$1" fontWeight="600" color="$color">
          Daily Targets
        </Text>
        <YStack gap="$2.5">
          <XStack items="center" gap="$2.5">
            <CircleProgress
              percent={data.todo}
              color="var(--ring-todo)"
              trackColor="var(--ring-todo-track)"
              size={32}
              strokeWidth={3}
            >
              <CheckSquare
                className={cn(
                  "size-4",
                  todoComplete
                    ? "text-[var(--ring-todo)]"
                    : "text-muted-foreground/60",
                )}
              />
            </CircleProgress>
            <YStack flex={1}>
              <Text fontSize="$1" fontWeight="500" color="$color">
                Todos
              </Text>
              {/* allowlist: tabular-nums (figure alignment, no token equivalent) */}
              <Text
                fontSize={11}
                color="$mutedForeground"
                className="tabular-nums"
              >
                {details.todoDone}/{details.todoTarget} completed
              </Text>
            </YStack>
            {/* allowlist: tabular-nums (figure alignment, no token equivalent) */}
            <Text
              fontSize="$1"
              fontWeight="600"
              color="$color"
              className="tabular-nums"
            >
              {Math.round(data.todo)}%
            </Text>
          </XStack>
          <XStack items="center" gap="$2.5">
            <CircleProgress
              percent={data.habit}
              color="var(--ring-habit)"
              trackColor="var(--ring-habit-track)"
              size={32}
              strokeWidth={3}
            >
              <Target
                className={cn(
                  "size-4",
                  habitComplete
                    ? "text-[var(--ring-habit)]"
                    : "text-muted-foreground/60",
                )}
              />
            </CircleProgress>
            <YStack flex={1}>
              <Text fontSize="$1" fontWeight="500" color="$color">
                Habits
              </Text>
              {/* allowlist: tabular-nums (figure alignment, no token equivalent) */}
              <Text
                fontSize={11}
                color="$mutedForeground"
                className="tabular-nums"
              >
                {details.habitDone}/{details.habitTotal} completed
              </Text>
            </YStack>
            {/* allowlist: tabular-nums (figure alignment, no token equivalent) */}
            <Text
              fontSize="$1"
              fontWeight="600"
              color="$color"
              className="tabular-nums"
            >
              {Math.round(data.habit)}%
            </Text>
          </XStack>
          <XStack items="center" gap="$2.5">
            <CircleProgress
              percent={data.journal}
              color="var(--ring-journal)"
              trackColor="var(--ring-journal-track)"
              size={32}
              strokeWidth={3}
            >
              <BookOpen
                className={cn(
                  "size-4",
                  journalComplete
                    ? "text-[var(--ring-journal)]"
                    : "text-muted-foreground/60",
                )}
              />
            </CircleProgress>
            <YStack flex={1}>
              <Text fontSize="$1" fontWeight="500" color="$color">
                Journal
              </Text>
              {/* allowlist: tabular-nums (figure alignment, no token equivalent) */}
              <Text
                fontSize={11}
                color="$mutedForeground"
                className="tabular-nums"
              >
                {details.journalWords}/{details.journalTarget} words
              </Text>
            </YStack>
            {/* allowlist: tabular-nums (figure alignment, no token equivalent) */}
            <Text
              fontSize="$1"
              fontWeight="600"
              color="$color"
              className="tabular-nums"
            >
              {Math.round(data.journal)}%
            </Text>
          </XStack>
        </YStack>
      </Popover.Content>
    </Popover>
  );
}
