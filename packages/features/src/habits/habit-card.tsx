import { useState, type ReactNode } from "react";
import { format, subDays, startOfWeek, addDays } from "date-fns";
import {
  Check,
  MoreHorizontal,
  SkipForward,
  Undo2,
  X,
} from "@tamagui/lucide-icons-2";
import {
  AlertDialog,
  Button,
  DropdownMenu,
  H3,
  IconButton,
  RippleButton,
  StreakBadge,
  Text,
  View,
  XStack,
  YStack,
} from "@stageholder/ui";
import type { Habit, HabitEntry } from "@repo/core/types";
import {
  resolveTargetCount,
  calculateWeeklyStreak,
  weeklyCompletions,
} from "@repo/core/habits/entry-resolution";

export interface HabitCardProps {
  habit: Habit;
  /**
   * The full window of entries used to render this card (typically the
   * last ~90 days). The host fetches these via its own data layer — the
   * view is pure presentation + derived calculations.
   */
  entries: HabitEntry[] | undefined;
  /** When set, the card shows status for this date instead of today. */
  selectedDate?: string;

  /**
   * Category-identity color for the habit ring + check-in button. On web
   * this is typically a CSS var (`var(--ring-habit)`); on native it's the
   * resolved hex from `RING_CATEGORY.habit.color` so the same view renders
   * identically across platforms.
   */
  accentColor: string;
  /** Faint tint of `accentColor` used for icon badge bg + partial-day dots. */
  accentTrackColor: string;

  /** Disables actions + shows the button spinner while a mutation is in-flight. */
  isPending?: boolean;

  /**
   * Commits a +1 check-in for the active date. Returning a promise lets
   * the view sequence its bouncing + completion animations on success.
   * Rejecting the promise tells the view to skip the success animations
   * (the host already surfaces the error via its own toast).
   */
  onCheckIn: () => Promise<void> | void;
  /** Marks the active date as skipped (preserves streak). */
  onSkip: () => Promise<void> | void;
  /** Marks the active date as failed (breaks the streak). */
  onFail: () => Promise<void> | void;
  /** Decrements the active date's value by 1 (in-progress undo). */
  onUndo: () => Promise<void> | void;
  /** Clears a skip/fail back to an un-acted day (value-0 completion). */
  onClearStatus: () => Promise<void> | void;
  /** Opens the host's edit surface (PWA: sheet, mobile: full-screen form). */
  onEdit: () => void;
  /** Confirmed delete — fires only after the in-card AlertDialog confirms. */
  onDelete: () => void;
  /** Opens the host's habit detail page. */
  onOpenDetail: () => void;

  /** Present → show "Archive" in the menu. Host wires the mutation. */
  onArchive?: () => void;
  /** Present → show "Unarchive" in the menu. Host wires the mutation. */
  onUnarchive?: () => void;
  /** Whether this habit is archived (drives the menu label + restore affordance). */
  isArchived?: boolean;
  /** Present → show "Move to group…" in the menu. Host opens the picker. */
  onMoveToGroup?: () => void;

  /**
   * Optional render-prop for the bespoke web-only celebration effect
   * (`RadianceBurst` on PWA). The view tells the host when to play it via
   * the `active` argument; mobile passes `undefined` here today and will
   * provide a Reanimated equivalent later.
   */
  renderCompletionEffect?: (active: boolean) => ReactNode;

  /** Flex layout hints forwarded to the card root (auto-fit grid host). */
  flex?: number;
  minW?: number;
}

/**
 * Presentational habit card — check-in / skip / fail / undo / edit / delete +
 * 3-state badge + weekly dot strip. The host hooks all data wiring (entries
 * + mutations) and supplies callbacks; the view owns its own animation
 * timing (bouncing on check-in, completing burst on target met).
 *
 * Cross-platform:
 *  - All chrome via the kit (`@stageholder/ui`).
 *  - `@tamagui/lucide-icons-2` icons (cross-platform: HTML SVG on web,
 *    react-native-svg on native; they read their OWN `color` prop, not the
 *    CSS cascade, so tints go directly on the icon).
 *  - The web-only `habit-card-completing` CSS keyframe stays as a
 *    `className`; on native this is a noop and the host can layer a
 *    Reanimated alternative through `renderCompletionEffect`.
 *  - Streak / weekly-progress / week-dots logic uses `date-fns` + the
 *    shared `@repo/core/habits/entry-resolution` helpers — pure data, no
 *    platform dependencies.
 */
export function HabitCard({
  habit,
  entries,
  selectedDate,
  accentColor,
  accentTrackColor,
  isPending,
  onCheckIn,
  onSkip,
  onFail,
  onUndo,
  onClearStatus,
  onEdit,
  onDelete,
  onOpenDetail,
  onArchive,
  onUnarchive,
  isArchived,
  onMoveToGroup,
  renderCompletionEffect,
  flex,
  minW,
}: HabitCardProps) {
  const today = format(new Date(), "yyyy-MM-dd");
  const activeDate = selectedDate || today;

  const [bouncing, setBouncing] = useState(false);
  const [completing, setCompleting] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);

  const isQuota = habit.frequency === "weekly_target";

  const activeDateEntry = entries?.find(
    (e: HabitEntry) => e.date.split("T")[0] === activeDate,
  );
  const activeDateValue = activeDateEntry?.value ?? 0;
  const isSkipped = activeDateEntry?.type === "skip";
  const isFailed = activeDateEntry?.type === "fail";
  const activeTargetCount = activeDateEntry
    ? resolveTargetCount(activeDateEntry, habit)
    : habit.targetCount;
  const isComplete = !isSkipped && activeDateValue >= activeTargetCount;
  const activeDateObj = selectedDate
    ? new Date(selectedDate + "T00:00:00")
    : new Date();
  const activeDow = activeDateObj.getDay();
  // Quota habits are loggable on ANY day, so treat them as always scheduled.
  const isScheduledOnActiveDate =
    isQuota ||
    !habit.scheduledDays ||
    habit.scheduledDays.length === 0 ||
    habit.scheduledDays.includes(activeDow);

  // Aggregate entries per day for the weekly-quota streak / progress.
  const entryMap = new Map<
    string,
    { value: number; type?: string; targetCountSnapshot?: number }
  >();
  for (const e of entries || []) {
    const dateStr = e.date.split("T")[0]!;
    const existing = entryMap.get(dateStr);
    entryMap.set(dateStr, {
      value: (existing?.value ?? 0) + e.value,
      type: e.type || existing?.type || "completion",
      targetCountSnapshot:
        existing?.targetCountSnapshot ?? e.targetCountSnapshot,
    });
  }

  const streak = isQuota
    ? calculateWeeklyStreak(entryMap, habit)
    : calculateStreak(entries || [], habit);
  const weeklyProgress = isQuota
    ? weeklyCompletions(
        entryMap,
        startOfWeek(new Date(), { weekStartsOn: 1 }),
        habit,
      )
    : 0;

  // Week dots data
  const weekStart = startOfWeek(new Date(), { weekStartsOn: 1 });
  const weekDays = Array.from({ length: 7 }, (_, i) => {
    const date = addDays(weekStart, i);
    const dateStr = format(date, "yyyy-MM-dd");
    const entry = entries?.find(
      (e: HabitEntry) => e.date.split("T")[0] === dateStr,
    );
    const dow = date.getDay();
    // Quota habits have no rest days — every day is schedulable/loggable.
    const isScheduled =
      isQuota ||
      !habit.scheduledDays ||
      habit.scheduledDays.length === 0 ||
      habit.scheduledDays.includes(dow);
    // `|| 1` so a habit with a missing/0 targetCount still completes at value
    // 1 — matches the header's `isComplete` (which falls back to 1). Without
    // it, `ratio = value / undefined` left the dot empty even after a
    // successful check-in (the header said "Complete" but the dot didn't fill).
    const effectiveTarget =
      (entry ? resolveTargetCount(entry, habit) : habit.targetCount) || 1;
    return {
      label: format(date, "EEEEE"),
      dateStr,
      value: entry?.value ?? 0,
      type: entry?.type as "completion" | "skip" | "fail" | undefined,
      isToday: dateStr === today,
      isScheduled,
      effectiveTarget,
    };
  });

  async function handleCheckIn() {
    if (isComplete || !isScheduledOnActiveDate || isPending) return;
    // We can predict whether THIS check-in completes the habit because we
    // own the before-value; the post-success animations fire on the same
    // tick as the mutation resolution without waiting for re-fetched data.
    const willComplete = activeDateValue + 1 >= activeTargetCount;
    try {
      await onCheckIn();
    } catch {
      // The host already surfaced the error (toast in its mutation
      // onError). Skip the celebration animations.
      return;
    }
    setBouncing(true);
    setTimeout(() => setBouncing(false), 500);
    if (willComplete) {
      setCompleting(true);
      setTimeout(() => setCompleting(false), 1200);
    }
  }

  function handleSkip() {
    if (isComplete || isSkipped || !isScheduledOnActiveDate || isPending)
      return;
    void onSkip();
  }

  function handleFail() {
    if (isComplete || isFailed || !isScheduledOnActiveDate || isPending) return;
    void onFail();
  }

  function handleUndo() {
    if (activeDateValue <= 0 || isPending) return;
    void onUndo();
  }

  function handleClearStatus() {
    if (!activeDateEntry || isPending) return;
    void onClearStatus();
  }

  function confirmDelete() {
    onDelete();
    setDeleteOpen(false);
  }

  return (
    <>
      <View
        position="relative"
        flex={flex}
        // flex with v5's default flexBasis:0 collapses the card to min-content
        // inside the responsive width-grid wrapper (the rest of the card then
        // overflows below the border). flexBasis:"auto" restores content sizing
        // while still growing to equal height with sibling cards.
        flexBasis="auto"
        minW={minW}
        rounded="$5"
        borderWidth={1}
        borderColor="$borderColor"
        bg="$card"
        p="$3"
        gap="$2.5"
        transition="medium"
        // allowlist: habit-card-completing — bespoke completion keyframe (no token equivalent).
        // Web-only; ignored on native (host can plug in a Reanimated alt via renderCompletionEffect).
        className={completing ? "habit-card-completing" : undefined}
      >
        {renderCompletionEffect?.(completing)}

        {/* Header — icon · name/desc · streak · menu */}
        <XStack items="center" gap="$2.5">
          <XStack
            flex={1}
            minW={0}
            onPress={onOpenDetail}
            cursor="pointer"
            items="center"
            gap="$2.5"
            transition="quick"
            hoverStyle={{ opacity: 0.8 }}
            role="button"
            aria-label={`Open ${habit.name}`}
          >
            {/* Icon badge tinted with the habit identity color (faint orange) */}
            <View
              height={34}
              width={34}
              shrink={0}
              items="center"
              justify="center"
              rounded="$lg"
              style={{ backgroundColor: accentTrackColor }}
            >
              <Text fontSize="$5">
                {habit.icon || habit.name.charAt(0).toUpperCase()}
              </Text>
            </View>
            {/* justify="center" + tight line-heights keep the name/desc block
                vertically centered against the icon, with or without a desc. */}
            <YStack flex={1} minW={0} justify="center">
              <H3
                fontSize="$3"
                fontWeight="600"
                color="$color"
                numberOfLines={1}
                lineHeight={20}
              >
                {habit.name}
              </H3>
              {habit.description ? (
                <Text
                  fontSize="$1"
                  color="$mutedForeground"
                  numberOfLines={1}
                  lineHeight={16}
                >
                  {habit.description}
                </Text>
              ) : null}
            </YStack>
          </XStack>
          {/* Streak fire — the kit StreakBadge already tiers the flame's color
              hotter as the count climbs (cold→warm→hot→blazing at 3/7/30); we
              ALSO grow it so a long streak literally reads bigger: $2 (<7) →
              $3 (7+) → $4 (30+, blazing). */}
          {streak > 0 ? (
            <StreakBadge
              count={streak}
              size={streak >= 30 ? "$4" : streak >= 7 ? "$3" : "$2"}
            />
          ) : null}
          <DropdownMenu>
            <DropdownMenu.Trigger asChild>
              {/* RippleButton (not IconButton): ripple press feedback instead of
                  a press-scale that would shift the menu's anchor as it opens. */}
              <RippleButton
                intent="ghost"
                size="sm"
                iconOnly
                width="$sm"
                aria-label="Habit options"
              >
                <MoreHorizontal size={16} />
              </RippleButton>
            </DropdownMenu.Trigger>
            <DropdownMenu.Content>
              <DropdownMenu.Item onPress={onEdit}>
                <DropdownMenu.Label>Edit</DropdownMenu.Label>
              </DropdownMenu.Item>
              {onMoveToGroup && (
                <DropdownMenu.Item onPress={onMoveToGroup}>
                  <DropdownMenu.Label>Move to group…</DropdownMenu.Label>
                </DropdownMenu.Item>
              )}
              {isArchived && onUnarchive && (
                <DropdownMenu.Item onPress={onUnarchive}>
                  <DropdownMenu.Label>Unarchive</DropdownMenu.Label>
                </DropdownMenu.Item>
              )}
              {!isArchived && onArchive && (
                <DropdownMenu.Item onPress={onArchive}>
                  <DropdownMenu.Label>Archive</DropdownMenu.Label>
                </DropdownMenu.Item>
              )}
              <DropdownMenu.Item
                intent="danger"
                onPress={() => setDeleteOpen(true)}
              >
                <DropdownMenu.Label>Delete</DropdownMenu.Label>
              </DropdownMenu.Item>
            </DropdownMenu.Content>
          </DropdownMenu>
        </XStack>

        {/* Spacer pins the week strip + actions to the bottom, so cards stay
            aligned whether or not they carry a description. */}
        <View flex={1} />

        {/* Week strip — a run of filled days reads as the streak at a glance */}
        <XStack justify="space-between" px="$0.5">
          {weekDays.map((day) => {
            const ratio =
              day.effectiveTarget > 0 ? day.value / day.effectiveTarget : 0;
            const isDaySkipped = day.type === "skip";
            const isDayFailed = day.type === "fail";
            const isPast = day.dateStr < today;
            const complete = !isDaySkipped && !isDayFailed && ratio >= 1;
            // Auto-fail only days with NO entry (truly missed). A cleared day
            // (value-0 completion entry) stays neutral, so "undo fail" works.
            // Quota habits NEVER auto-fail — a missed day just isn't a
            // completion toward the weekly target.
            const failed =
              !isQuota &&
              (isDayFailed ||
                (day.isScheduled && isPast && day.type === undefined));
            const partial = !isDaySkipped && !failed && ratio > 0 && ratio < 1;
            return (
              <YStack key={day.dateStr} items="center" gap="$1.5">
                <Text
                  fontSize={9}
                  fontWeight="500"
                  color="$mutedForeground"
                  opacity={day.isScheduled ? 0.8 : 0.35}
                >
                  {day.label}
                </Text>
                {/* One consistent dot per day — ALWAYS the same View (same
                    hook-affecting props, incl. `transition`) so toggling a
                    day's state never changes the hook order. Filled (habit
                    color) = done, tinted = partial, red ring = fail, primary
                    ring = today. A skipped day drops the border and renders a
                    skip glyph (▷|) CHILD so "deliberately skipped" reads
                    differently from "missed / not yet". A run of filled dots
                    IS the streak. */}
                <View
                  width={11}
                  height={11}
                  rounded={9999}
                  transition="quick"
                  items="center"
                  justify="center"
                  // DOM `title` tooltip attr isn't in the kit View prop type
                  // (web-only, passed through at runtime; no-op on native).
                  {...({
                    title: failed
                      ? "Failed"
                      : isDaySkipped
                        ? "Skipped"
                        : `${day.value}/${day.effectiveTarget}`,
                  } as object)}
                  // No border for a done OR skipped day (skip shows its glyph).
                  borderWidth={complete || isDaySkipped ? 0 : 1}
                  borderStyle={!day.isScheduled ? "dashed" : "solid"}
                  borderColor={failed ? "$destructive" : "$mutedForeground"}
                  opacity={
                    !day.isScheduled
                      ? 0.3
                      : isDaySkipped
                        ? 0.75
                        : complete || partial || failed
                          ? 1
                          : 0.4
                  }
                  outlineWidth={day.isToday ? 2 : 0}
                  outlineColor="$primary"
                  outlineStyle="solid"
                  outlineOffset={1}
                  // Color via the `bg` PROP, not an inline `style`. With the
                  // native Reanimated animation driver (config v5-reanimated),
                  // `transition` + a changing inline `style={{backgroundColor}}`
                  // makes the driver read a shared value's `.value` inside the
                  // inline style → Reanimated's "shared value .value in inline
                  // style" warning, once per dot (7 dots × cards). `bg` is a
                  // first-class animatable Tamagui prop the driver handles via
                  // its own shared value (no inline read) — and it animates the
                  // color smoothly on native too. Raw hex/rgba → `as never`
                  // (the strict color typing rejects a plain `string`).
                  bg={
                    (complete
                      ? accentColor
                      : partial
                        ? accentTrackColor
                        : "transparent") as never
                  }
                >
                  {isDaySkipped ? (
                    <SkipForward size={9} color="$mutedForeground" />
                  ) : null}
                </View>
              </YStack>
            );
          })}
        </XStack>

        {/* Action row — primary (Check In) or status on the left,
            representative icon actions on the right. */}
        {isQuota ? (
          /* Quota footer: log-only. LEFT = "Logged" badge when today is done,
             else the Check In button. RIGHT = "{progress}/{target} this week"
             + an Undo when today is logged. No Skip / Fail for quota. */
          <XStack items="center" justify="space-between" gap="$2">
            {isComplete ? (
              <XStack
                items="center"
                gap="$1.5"
                rounded="$md"
                px="$2.5"
                py="$1.5"
                bg="$successMuted"
                transition="quick"
                scale={bouncing ? 1.1 : 1}
              >
                {/* lucide-icons-2 reads its own `color` (no CSS cascade). */}
                <Check size={14} color="$success" />
                <Text fontSize="$1" fontWeight="600" color="$success">
                  Logged
                </Text>
              </XStack>
            ) : (
              <Button
                size="sm"
                borderWidth={0}
                color={"#ffffff" as never}
                icon={<Check size={14} color="#ffffff" />}
                style={{ backgroundColor: accentColor }}
                hoverStyle={
                  { backgroundColor: accentColor, opacity: 0.9 } as never
                }
                pressStyle={
                  { backgroundColor: accentColor, opacity: 0.82 } as never
                }
                onPress={handleCheckIn}
                disabled={isPending}
                loading={isPending}
                loadingText="Logging…"
                transition="quick"
                scale={bouncing ? 1.1 : 1}
              >
                Check In
              </Button>
            )}

            <XStack items="center" gap="$1.5">
              <Text fontSize="$1" fontWeight="500" color="$mutedForeground">
                {weeklyProgress}/{habit.weeklyTarget} this week
              </Text>
              {isComplete && (
                <IconButton
                  variant="outline"
                  size="sm"
                  onPress={handleUndo}
                  disabled={isPending}
                  title="Undo today's log"
                  aria-label="Undo today's log"
                >
                  <Undo2 size={14} />
                </IconButton>
              )}
            </XStack>
          </XStack>
        ) : (
          <XStack items="center" justify="space-between" gap="$2">
            {isComplete ? (
              <XStack
                items="center"
                gap="$1.5"
                rounded="$md"
                px="$2.5"
                py="$1.5"
                bg="$successMuted"
                transition="quick"
                scale={bouncing ? 1.1 : 1}
              >
                {/* lucide-icons-2 reads its own `color` (no CSS cascade). */}
                <Check size={14} color="$success" />
                <Text fontSize="$1" fontWeight="600" color="$success">
                  Complete
                </Text>
              </XStack>
            ) : isSkipped ? (
              <XStack
                items="center"
                gap="$1.5"
                rounded="$md"
                px="$2.5"
                py="$1.5"
                bg="$muted"
              >
                {/* lucide-icons-2 reads its own `color` (no CSS cascade). */}
                <SkipForward size={12} color="$mutedForeground" />
                <Text fontSize="$1" fontWeight="600" color="$mutedForeground">
                  Skipped
                </Text>
              </XStack>
            ) : isFailed ? (
              <XStack
                items="center"
                gap="$1.5"
                rounded="$md"
                px="$2.5"
                py="$1.5"
                bg="$destructiveMuted"
              >
                {/* lucide-icons-2 reads its own `color` (no CSS cascade). */}
                <X size={12} color="$destructive" />
                <Text fontSize="$1" fontWeight="600" color="$destructive">
                  Failed
                </Text>
              </XStack>
            ) : !isScheduledOnActiveDate ? (
              <Text fontSize="$1" fontWeight="500" color="$mutedForeground">
                Rest day
              </Text>
            ) : (
              <Button
                size="sm"
                borderWidth={0}
                color={"#ffffff" as never}
                icon={<Check size={14} color="#ffffff" />}
                style={{ backgroundColor: accentColor }}
                hoverStyle={
                  { backgroundColor: accentColor, opacity: 0.9 } as never
                }
                pressStyle={
                  { backgroundColor: accentColor, opacity: 0.82 } as never
                }
                onPress={handleCheckIn}
                disabled={isPending}
                loading={isPending}
                loadingText="Checking…"
                transition="quick"
                scale={bouncing ? 1.1 : 1}
              >
                {activeDateValue > 0
                  ? `${activeDateValue}/${activeTargetCount}`
                  : "Check In"}
              </Button>
            )}

            <XStack items="center" gap="$1.5">
              {(isSkipped || isFailed) && (
                <IconButton
                  variant="outline"
                  size="sm"
                  onPress={handleClearStatus}
                  disabled={isPending}
                  title="Undo"
                  aria-label="Undo"
                >
                  <Undo2 size={14} />
                </IconButton>
              )}
              {activeDateValue > 0 && !isSkipped && !isFailed && (
                <IconButton
                  variant="outline"
                  size="sm"
                  onPress={handleUndo}
                  disabled={isPending}
                  title="Undo last check-in"
                  aria-label="Undo last check-in"
                >
                  <Undo2 size={14} />
                </IconButton>
              )}
              {activeDateValue === 0 &&
                !isSkipped &&
                !isFailed &&
                isScheduledOnActiveDate && (
                  <>
                    <IconButton
                      variant="outline"
                      size="sm"
                      onPress={handleSkip}
                      disabled={isPending}
                      title="Skip"
                      aria-label="Skip"
                    >
                      <SkipForward size={14} />
                    </IconButton>
                    <IconButton
                      variant="outline"
                      intent="danger"
                      size="sm"
                      onPress={handleFail}
                      disabled={isPending}
                      title="Mark failed — resets the streak"
                      aria-label="Mark failed"
                    >
                      <X size={14} />
                    </IconButton>
                  </>
                )}
            </XStack>
          </XStack>
        )}
      </View>

      {/* Destructive confirm — kit AlertDialog so it stays in design language
          on both web and native (kit handles overlay + portal per platform).

          Conditionally mounted so CLOSING UNMOUNTS the dialog (overlay removed
          instantly). The kit's exit-presence (<Animate presence> →
          onExitComplete) doesn't fire under this app's runtime-CSS setup
          (Tailwind coexistence forces disableExtraction, so the CSS driver's
          exit transitionend never lands) — closing via state alone left the
          scrim stuck. A full unmount, which the delete-mutation path already
          triggers, clears it reliably. */}
      {deleteOpen && (
        <AlertDialog open onOpenChange={setDeleteOpen} disableRemoveScroll>
          <AlertDialog.Portal>
            <AlertDialog.Overlay />
            <AlertDialog.Content>
              <AlertDialog.Title>
                Delete &ldquo;{habit.name}&rdquo;?
              </AlertDialog.Title>
              <AlertDialog.Description>
                This cannot be undone. All check-ins for this habit will be
                permanently removed.
              </AlertDialog.Description>
              <XStack gap="$2" justify="flex-end" mt="$4">
                <AlertDialog.Cancel asChild>
                  <Button intent="outline">Cancel</Button>
                </AlertDialog.Cancel>
                <AlertDialog.Action asChild>
                  <Button intent="destructive" onPress={confirmDelete}>
                    Delete
                  </Button>
                </AlertDialog.Action>
              </XStack>
            </AlertDialog.Content>
          </AlertDialog.Portal>
        </AlertDialog>
      )}
    </>
  );
}

/**
 * Daily-frequency streak: walk back from today, counting consecutive
 * scheduled days that hit their target. Skips preserve the streak;
 * explicit fails break it. Used for non-quota habits.
 */
function calculateStreak(
  entries: HabitEntry[],
  habit: Pick<Habit, "targetCount" | "scheduledDays">,
): number {
  if (entries.length === 0) return 0;

  const entryMap = new Map<
    string,
    { value: number; type?: string; targetCountSnapshot?: number }
  >();
  for (const e of entries) {
    const dateStr = e.date.split("T")[0]!;
    const existing = entryMap.get(dateStr);
    entryMap.set(dateStr, {
      value: (existing?.value ?? 0) + e.value,
      type: e.type || existing?.type || "completion",
      targetCountSnapshot:
        existing?.targetCountSnapshot ?? e.targetCountSnapshot,
    });
  }

  const hasSchedule = habit.scheduledDays && habit.scheduledDays.length > 0;
  const today = new Date();
  const todayStr = format(today, "yyyy-MM-dd");

  // If today is scheduled and completed, count it
  const todayDow = today.getDay();
  const todayIsScheduled =
    !hasSchedule || habit.scheduledDays!.includes(todayDow);
  const todayEntry = entryMap.get(todayStr);
  const todayIsSkipped = todayEntry?.type === "skip";
  const todayTarget = resolveTargetCount(
    { targetCountSnapshot: todayEntry?.targetCountSnapshot },
    habit,
  );
  const todayCompleted =
    todayIsScheduled &&
    !todayIsSkipped &&
    (todayEntry?.value ?? 0) >= todayTarget;
  // Skipped today: don't break streak but don't count it either
  let streak = todayCompleted ? 1 : 0;

  for (let i = 1; i <= 90; i++) {
    const checkDay = subDays(today, i);
    const dow = checkDay.getDay();

    // Skip non-scheduled days
    if (hasSchedule && !habit.scheduledDays!.includes(dow)) continue;

    const checkDate = format(checkDay, "yyyy-MM-dd");
    const dayEntry = entryMap.get(checkDate);

    // Skipped day: preserve streak but don't increment
    if (dayEntry?.type === "skip") continue;
    // Failed day: user explicitly marked this date as a miss — chain breaks.
    if (dayEntry?.type === "fail") break;

    const dayValue = dayEntry?.value ?? 0;
    const dayTarget = resolveTargetCount(
      { targetCountSnapshot: dayEntry?.targetCountSnapshot },
      habit,
    );
    if (dayValue >= dayTarget) {
      streak++;
    } else {
      // If today wasn't completed and this is the first scheduled day back, don't break yet
      if (i === 1 && !todayCompleted && !todayIsScheduled) continue;
      break;
    }
  }

  return streak;
}
