import { useEffect, useState, type ReactNode } from "react";
import { ControlPress } from "../_internal/control-press";
import { Check } from "@tamagui/lucide-icons-2/icons/Check";
import { Clock } from "@tamagui/lucide-icons-2/icons/Clock";
import { Flag } from "@tamagui/lucide-icons-2/icons/Flag";
import { ListChecks } from "@tamagui/lucide-icons-2/icons/ListChecks";
import { Trash2 } from "@tamagui/lucide-icons-2/icons/Trash2";
import { isWeb } from "tamagui";
import { IconButton, Text, View, XStack, YStack } from "@stageholder/ui";
import type { Todo } from "@repo/core/types";
import { RING_CATEGORY } from "../activity-rings";

/**
 * Compact meta badge — the consistent pill treatment shared by every item in
 * the meta row (priority, list, due/do dates, subtask count): tinted bg +
 * optional leading icon/dot + short label, fully rounded. `bg`/`color` take
 * kit color tokens; `as never` rides the strict color-prop typing (it rejects
 * a plain `string`, but every caller passes a real token).
 */
function MetaBadge({
  icon,
  label,
  bg,
  color,
}: {
  icon?: ReactNode;
  label: string;
  bg: string;
  color: string;
}) {
  return (
    <XStack
      items="center"
      gap="$1"
      rounded={9999}
      px="$2"
      py="$0.5"
      bg={bg as never}
    >
      {icon}
      <Text
        fontSize="$1"
        fontWeight="500"
        lineHeight={16}
        color={color as never}
      >
        {label}
      </Text>
    </XStack>
  );
}

// Priority badge intent tokens. The shadcn version used per-color
// bg-{c}-100/text-{c}-700 pairs; mapped onto the kit's intent palette:
// urgent → destructive, high/medium → warning (amber), low → primary (azure).
// `as const` keeps the values as literal token strings so they satisfy
// Tamagui's strict color-prop typing (arbitrary `string` is rejected).
const PRIORITY_CONFIG = {
  urgent: { label: "Urgent", bg: "$destructiveMuted", color: "$destructive" },
  high: { label: "High", bg: "$warningMuted", color: "$warning" },
  medium: { label: "Medium", bg: "$warningMuted", color: "$warning" },
  low: { label: "Low", bg: "$primaryMuted", color: "$primary" },
  none: { label: "", bg: "$muted", color: "$mutedForeground" },
} as const;

// Warm "ignite & burn" palette. Hex (not oklch / CSS vars) so the colors
// resolve on web AND native. The whole completion effect is built from
// animated Tamagui Views, so it reproduces identically on both platforms.
const EMBER = "#f97316";
const SPARK = "#fb923c";
// Todo IDENTITY colour (red) for the checked checkbox — resolves theme-aware
// `var(--ring-todo)` on web and `#ef4444` on native via RING_CATEGORY, applied
// through the inline `style` prop (which accepts both, unlike the strict
// Tamagui color props). Replaces the generic `$primary` blue.
const TODO_COLOR = RING_CATEGORY.todo.color;
// Kept short so the row vanishes the instant the ignite + sparks finish.
const BURN_MS = 440;

// Row-level enter/exit cosmetics — Tamagui v2 runs these identically on web
// (CSS driver) and native (Reanimated driver), so the row animates the SAME
// on both platforms. Wrap list views in <AnimatePresence> for the exit to play.
const ROW_ANIMATION_PROPS = {
  transition: { default: "quick", exit: "medium" },
  enterStyle: { opacity: 0, y: 6 },
  exitStyle: { opacity: 0, scale: 0.94 },
} as object;

const SPARKS: { left: string; delay: number }[] = [
  { left: "18%", delay: 0 },
  { left: "34%", delay: 45 },
  { left: "50%", delay: 20 },
  { left: "66%", delay: 55 },
  { left: "82%", delay: 30 },
];

/** Parse a `yyyy-MM-dd` or full ISO date string as the LOCAL day. */
function parseDateLocal(input: string): Date {
  const ymd = input.length >= 10 ? input.slice(0, 10) : input;
  return new Date(ymd + "T00:00:00");
}

// Cached formatter — `toLocaleDateString(...)` builds a fresh
// Intl.DateTimeFormat on every call, a known per-row Hermes hotspot (the kit
// hit the same thing in its chat rows). Two date badges × N rows made this
// measurable on list mount.
const BADGE_DATE_FMT = new Intl.DateTimeFormat("en-US", {
  month: "short",
  day: "numeric",
});

/** Local midnight of the current day — the boundary for date-only compares. */
function localTodayStart(): Date {
  const now = new Date();
  return new Date(now.getFullYear(), now.getMonth(), now.getDate());
}

/**
 * Brief warm flash + rising sparks rendered over the row when it's
 * "burning" (about to commit a completion). Pure Tamagui Views animated
 * via enterStyle → the same on web (CSS driver) and native (Reanimated).
 */
function CompletionBurn() {
  return (
    <>
      <View
        position="absolute"
        t={0}
        l={0}
        r={0}
        b={0}
        z={1}
        rounded="$md"
        style={{ backgroundColor: EMBER }}
        opacity={0}
        transition="medium"
        enterStyle={{ opacity: 0.22 }}
        pointerEvents="none"
      />
      {SPARKS.map((s, i) => (
        <View
          key={i}
          position="absolute"
          b={8}
          z={2}
          width={5}
          height={5}
          rounded={9999}
          style={{ backgroundColor: SPARK, left: s.left }}
          y={-22}
          opacity={0}
          transition={["medium", { delay: s.delay }] as never}
          enterStyle={{ y: 0, opacity: 1 }}
          pointerEvents="none"
        />
      ))}
    </>
  );
}

export interface TodoItemProps {
  todo: Todo;
  /**
   * Called when the user toggles the row's checkbox. For an incomplete
   * todo, the view plays the burn animation first and THEN calls
   * `onToggle` (~440ms later); for a completed todo (un-complete), the
   * call is immediate. The host wires this to the appropriate mutation.
   */
  onToggle: () => void;
  /** Called when the user clicks the (group-hover) trash icon. */
  onDelete: () => void;
  /** Called when the user taps the row (anywhere but the checkbox/trash). */
  onOpenDetail: () => void;
  /** Long-press on the row body (native hosts open the todo actions menu —
   *  the touch counterpart of the web right-click). */
  onLongPress?: () => void;
  /**
   * List name — rendered as a badge in the meta row. The host resolves it
   * (the `Todo` only carries `listId`); omit it on single-list views where
   * the list is implicit, pass it on cross-list views (Today / Upcoming).
   */
  listName?: string;
  /** List color (hex) for the list badge's dot. */
  listColor?: string;
  /**
   * Trailing actions slot — replaces the default hover delete IconButton.
   * The PWA renders a "…" actions menu (DropdownMenu) here; hosts that omit
   * it (mobile) keep the plain hover delete button.
   */
  renderActions?: () => ReactNode;
  /**
   * Web-only right-click handler, spread onto the row root. The PWA opens its
   * actions menu from here; native has no context menu and ignores it.
   */
  onContextMenu?: (event: unknown) => void;
  /**
   * Dense variant for the dashboard's Today widget: drops the description and
   * collapses the meta-badge row to just an overdue flag, with tighter
   * vertical padding. Keeps the full checkbox + burn + actions experience.
   */
  compact?: boolean;
  /**
   * Play the row's enter animation on mount (default true). Virtualized hosts
   * (FlashList) pass `false`: cells mount as they scroll in, so every row
   * would replay the fade/slide while the user scrolls — visible jank.
   */
  animateEnter?: boolean;
}

/**
 * Single todo row. Pure presentational + owns its own burn-animation
 * timing (presentation concern). The host (PWA today, mobile later) wires
 * `onToggle` to `useUpdateTodo`, `onDelete` to `useDeleteTodo`, and
 * `onOpenDetail` to its detail-dialog open state.
 *
 * Cross-platform: meta + checkmark icons are `@tamagui/lucide-icons-2`
 * (HTML SVG on web, react-native-svg on native; they read their OWN `color`
 * prop, not the CSS cascade). The burn animation uses Tamagui's
 * `enterStyle`+`transition` which run on both web (CSS driver) and native
 * (Reanimated). `window.setTimeout` replaced with `setTimeout` (available on
 * both runtimes).
 */
export function TodoItem({
  todo,
  onToggle,
  onDelete,
  onOpenDetail,
  onLongPress,
  listName,
  listColor,
  renderActions,
  onContextMenu,
  compact,
  animateEnter = true,
}: TodoItemProps) {
  const [burning, setBurning] = useState(false);

  // If the host's mutation fails, its cache rollback flips this todo back to
  // "todo" — clear the burn so the row is tappable again. (On success the
  // todo becomes "done" and the parent removes/relocates this row.)
  useEffect(() => {
    if (todo.status !== "done") setBurning(false);
  }, [todo.status]);

  const isDone = todo.status === "done";
  const priority =
    PRIORITY_CONFIG[todo.priority as keyof typeof PRIORITY_CONFIG] ??
    PRIORITY_CONFIG.none;

  function handleToggle() {
    if (isDone) {
      // Un-complete: flip back immediately, no burn.
      onToggle();
      return;
    }
    if (burning) return;
    // Play the ignite + burn first, THEN commit — identically on web and
    // native (the animation is pure Tamagui enterStyle/transition).
    setBurning(true);
    setTimeout(() => {
      // Burn finished → commit. The host's OPTIMISTIC patch removes the todo
      // from the list in the same tick, and the list's AnimatePresence plays
      // this row's exitStyle. The row must NOT short-circuit to `null` here
      // (it used to, via a hide flag): an exiting child that renders nothing
      // never reports exit-complete, so Tamagui's AnimatePresence froze on its
      // stale child list and every remaining row kept rendering from stale
      // elements — the NEXT todo's checkbox went dead after the first one was
      // completed (Today widget, 2026-10-21).
      onToggle();
    }, BURN_MS);
  }

  function handleDelete() {
    onDelete();
  }

  const formattedDueDate = todo.dueDate
    ? BADGE_DATE_FMT.format(parseDateLocal(todo.dueDate))
    : null;

  const formattedDoDate = todo.doDate
    ? BADGE_DATE_FMT.format(parseDateLocal(todo.doDate))
    : null;

  // Date-only comparison: a todo due TODAY is not overdue. Comparing against
  // `new Date()` (now) would flag every same-day-due todo as overdue all day,
  // contradicting the Today bucket which correctly includes it.
  const isOverdue =
    todo.dueDate && !isDone && parseDateLocal(todo.dueDate) < localTodayStart();

  return (
    // Layout only. Two SEPARATE press targets sit inside: the checkbox (toggle)
    // and the body (open detail). They never overlap, so no tap needs to be
    // told apart from another — no propagation tricks, no timing guards.
    <XStack
      group
      items="center"
      gap="$3"
      // Compact rows sit inside dashboard/calendar widgets as bordered CARD
      // rows so they read as a balanced pair with the habit list rows (which
      // are bordered `$card` rows). Full rows (the /todos page) stay borderless.
      // COMPACT_ROW_MIN_H (60) is shared with HabitListItem so the two columns
      // line up 1:1 (a todo row's content is a touch shorter than a habit row's).
      rounded={compact ? "$4" : "$md"}
      px={compact ? "$3" : "$2.5"}
      py={compact ? "$2.5" : "$2"}
      minH={compact ? 60 : undefined}
      borderWidth={compact ? 1 : 0}
      borderColor="$borderColor"
      bg={compact ? "$card" : undefined}
      position="relative"
      // Enter + exit (delete / un-complete) via AnimatePresence in the list
      // views — SAME on web and native (Tamagui v2). Completion plays the
      // burn below.
      {...(animateEnter ? ROW_ANIMATION_PROPS : {})}
      hoverStyle={burning ? undefined : { bg: "$accent" }}
      // Web-only right-click → host's actions menu. Passed through to the DOM
      // node (Tamagui forwards unknown props on web); no-op on native.
      {...({ onContextMenu } as object)}
    >
      <View shrink={0} position="relative">
        <ControlPress
          label={isDone ? "Mark as incomplete" : "Mark as complete"}
          checked={isDone || burning}
          onPress={handleToggle}
        >
          <View
            // 20px (was 24): balanced against the compact title (18px line) +
            // date (16px line) block so the circle doesn't out-size the text.
            width={20}
            height={20}
            items="center"
            justify="center"
            rounded={9999}
            borderWidth={2}
            transition="quick"
            // Border color as a single PROP source (not the inline `style`): on
            // native Tamagui expands the `borderColor` prop into per-side
            // longhands that beat a `style` shorthand, so the red border set via
            // `style` lost to the base `$mutedForeground` and the done circle
            // kept a grey ring while its fill went red. `as never` carries the
            // theme-aware var/hex the strict color prop rejects (same cast as
            // `hoverStyle`).
            borderColor={
              (burning
                ? EMBER
                : isDone
                  ? TODO_COLOR
                  : "$mutedForeground") as never
            }
            // The pressable itself stays STATIC (transparent) — the fill is a
            // separate opacity-animated child below. Animating this View's own
            // `bg` from "transparent" broke the feel on native:
            // Reanimated interpolates "transparent" as rgba(0,0,0,0), so the
            // fill faded through muddy grey-black instead of red, and animating
            // the pressable risked swallowing quick taps.
            bg="transparent"
            // Native keeps a pressable focused after a tap (no pointer/keyboard
            // `:focus-visible` gating and no tap-to-blur), so Tamagui's default
            // focus ring — the theme's blue `$outlineColor` — lingers around the
            // circle long after the toggle. Zero it: this control never needs a
            // focus ring. Matches `timezone-select.native.tsx`.
            focusStyle={{ outlineWidth: 0 }}
            focusVisibleStyle={{ outlineWidth: 0 }}
            hoverStyle={
              !isDone && !burning
                ? { borderColor: TODO_COLOR as never }
                : undefined
            }
          >
            {/* Fill layer — the "check registered" feedback. A static-color disc
              whose OPACITY (a first-class animatable prop) fades in: opacity
              interpolation is artifact-free on both drivers, unlike animating
              a background color from "transparent". pointerEvents="none" so
              every tap lands on the pressable parent. Color itself never
              animates (ember vs red just swaps), so it can ride `style`, which
              accepts the theme-aware var/hex. */}
            <View
              position="absolute"
              t={0}
              l={0}
              r={0}
              b={0}
              rounded={9999}
              style={{ backgroundColor: burning ? EMBER : TODO_COLOR }}
              opacity={isDone || burning ? 1 : 0}
              transition="quick"
              pointerEvents="none"
            />
            {isDone || burning ? (
              <View
                transition="bouncy"
                // Explicit base scale/opacity: the native Reanimated driver
                // animates enterStyle → these concrete targets. Without them the
                // enter sticks at `scale: 0` on native and the check never shows
                // during the burn (web's CSS driver tolerates the missing base).
                opacity={1}
                scale={1}
                enterStyle={burning ? { scale: 0, opacity: 0 } : undefined}
                // Taps on the icon must fall through to the pressable circle.
                pointerEvents="none"
              >
                {/* lucide-icons-2 reads its own `color` (no CSS cascade). White
                  check on the red/ember fill. */}
                <Check size={12} strokeWidth={3} color="#ffffff" />
              </View>
            ) : null}
          </View>
        </ControlPress>
        {burning ? (
          // Confirming ring pulse — expands + fades on ignite.
          <View
            position="absolute"
            t={-4}
            l={-4}
            r={-4}
            b={-4}
            rounded={9999}
            borderWidth={2}
            style={{ borderColor: EMBER }}
            scale={2}
            opacity={0}
            transition="medium"
            enterStyle={{ scale: 0.6, opacity: 0.7 }}
            pointerEvents="none"
          />
        ) : null}
      </View>

      {burning ? <CompletionBurn /> : null}

      {/* gap="$1" gives a single tight, uniform title→desc→meta rhythm. The
          title carries an explicit lineHeight (the base `$3` font's default
          leading is ~1.6× and was opening a loose gap above the date); a
          tight 18px line + the small gap is the dense single-row treatment
          used by Todoist / Things. */}
      <YStack
        flex={1}
        minW={0}
        gap="$1"
        // The body IS the open-detail target (title + meta). hitSlop stretches
        // the tap area over the row's vertical padding.
        onPress={() => {
          if (!burning) onOpenDetail();
        }}
        {...(onLongPress ? { onLongPress } : {})}
        cursor="pointer"
        pressStyle={{ opacity: 0.6 }}
        role="button"
        aria-label="Open todo details"
        {...({ hitSlop: { top: 10, bottom: 10 } } as object)}
      >
        <Text
          fontSize="$3"
          fontWeight="500"
          lineHeight={18}
          color={isDone ? "$mutedForeground" : "$color"}
          textDecorationLine={isDone ? "line-through" : "none"}
        >
          {todo.title}
        </Text>
        {!compact && todo.description ? (
          <Text fontSize="$1" color="$mutedForeground" numberOfLines={1}>
            {todo.description}
          </Text>
        ) : null}
        {/* Compact (dashboard Today widget): the essentials — priority + due
            date (overdue-aware). Description / list / do-date / subtasks are
            dropped to keep the row light. */}
        {compact ? (
          priority.label || formattedDueDate ? (
            <XStack flexWrap="wrap" items="center" gap="$1.5">
              {priority.label ? (
                <MetaBadge
                  bg={priority.bg}
                  color={priority.color}
                  label={priority.label}
                />
              ) : null}
              {formattedDueDate ? (
                <MetaBadge
                  bg={isOverdue ? "$destructiveMuted" : "$muted"}
                  color={isOverdue ? "$destructive" : "$mutedForeground"}
                  label={formattedDueDate}
                  icon={
                    <Flag
                      size={11}
                      color={isOverdue ? "$destructive" : "$mutedForeground"}
                    />
                  }
                />
              ) : null}
            </XStack>
          ) : null
        ) : /* Every meta item is a `MetaBadge` pill so the row reads as one
            consistent set of badges (was a mix of one priority pill + bare
            icon+text runs). The list badge surfaces which list the todo is in
            on cross-list views (host passes `listName`). lineHeight on the row
            + each badge text keeps the small ($1) labels from inheriting the
            ~23px body line-height (the old dead-space-above bug). */
        priority.label ||
          listName ||
          formattedDueDate ||
          formattedDoDate ||
          (todo.subtasks && todo.subtasks.length > 0) ? (
          <XStack flexWrap="wrap" items="center" gap="$1.5">
            {priority.label ? (
              <MetaBadge
                bg={priority.bg}
                color={priority.color}
                label={priority.label}
              />
            ) : null}
            {listName ? (
              <MetaBadge
                bg="$muted"
                color="$mutedForeground"
                label={listName}
                icon={
                  <View
                    width={7}
                    height={7}
                    rounded={9999}
                    style={{ backgroundColor: listColor || "#6b7280" }}
                  />
                }
              />
            ) : null}
            {formattedDueDate ? (
              <MetaBadge
                bg={isOverdue ? "$destructiveMuted" : "$muted"}
                color={isOverdue ? "$destructive" : "$mutedForeground"}
                label={formattedDueDate}
                icon={
                  <Flag
                    size={11}
                    color={isOverdue ? "$destructive" : "$mutedForeground"}
                  />
                }
              />
            ) : null}
            {formattedDoDate ? (
              <MetaBadge
                bg="$muted"
                color="$mutedForeground"
                label={formattedDoDate}
                icon={<Clock size={11} color="$mutedForeground" />}
              />
            ) : null}
            {todo.subtasks && todo.subtasks.length > 0 ? (
              <MetaBadge
                bg="$muted"
                color="$mutedForeground"
                label={`${
                  todo.subtasks.filter((s) => s.status === "done").length
                }/${todo.subtasks.length}`}
                icon={<ListChecks size={11} color="$mutedForeground" />}
              />
            ) : null}
          </XStack>
        ) : null}
      </YStack>

      {/* Trailing actions: the host's "…" menu when `renderActions` is given
          (PWA), else the default hover delete button (mobile / other hosts). */}
      {renderActions ? (
        <View shrink={0}>{renderActions()}</View>
      ) : isWeb ? (
        // Hover-reveal delete is a WEB-only affordance: on touch it's
        // permanently invisible ($group-hover never fires) yet still mounted
        // an animated node per row. Native hosts provide their own reachable
        // delete (swipe action / edit sheet).
        <IconButton
          variant="ghost"
          size="sm"
          intent="danger"
          onPress={handleDelete}
          aria-label="Delete todo"
          opacity={0}
          transition="quick"
          $group-hover={{ opacity: 1 }}
        >
          <Trash2 size={14} />
        </IconButton>
      ) : null}
    </XStack>
  );
}
