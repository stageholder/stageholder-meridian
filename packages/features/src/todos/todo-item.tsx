import { useEffect, useRef, useState, type ReactNode } from "react";
import {
  Check,
  Clock,
  Flag,
  ListChecks,
  Trash2,
} from "@tamagui/lucide-icons-2";
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

// Row-level enter/exit cosmetics run ONLY on web. On native (Reanimated
// driver) every `transition`/`enterStyle` prop turns the view into an
// animated node with its own shared values — dozens of rows × several nodes
// each was measurable scroll + mount cost, for animations that either need
// web AnimatePresence (exit) or are imperceptible next to list virtualization
// churn (enter). The burn/checkbox feedback animations below stay on both
// platforms — those are user-triggered, one row at a time.
const ROW_ANIMATION = (
  isWeb
    ? {
        transition: { default: "quick", exit: "medium" },
        enterStyle: { opacity: 0, y: 6 },
        exitStyle: { opacity: 0, scale: 0.94 },
      }
    : {}
) as object;

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
  listName,
  listColor,
  renderActions,
  onContextMenu,
  compact,
}: TodoItemProps) {
  const [burning, setBurning] = useState(false);
  const [gone, setGone] = useState(false);

  // The row hides itself optimistically after the burn (setGone below) so
  // completion feels instant. If the host's mutation fails, its cache rollback
  // flips this todo back to "todo" — reappear rather than stay silently hidden.
  // (On success the todo becomes "done" and the parent unmounts/relocates this
  // row, so this only ever fires on the rollback path.)
  useEffect(() => {
    if (todo.status !== "done") {
      setGone(false);
      setBurning(false);
    }
  }, [todo.status]);

  // Cross-platform "don't open the detail sheet when the checkbox/delete was
  // tapped". Web relies on stopPropagation (onPress → bubbling onClick), but
  // native has no propagation: tapping the checkbox would ALSO fire the row's
  // onPress and open the edit sheet. An inner control records its touch-DOWN
  // time (onPressIn, before ANY onPress fires — order-independent); the row's
  // onPress ignores presses that land within a beat of a control press. A
  // timestamp (not a boolean) so it self-expires — it can never get stuck
  // "true" in the native case where only the control's onPress fires.
  const controlPressAt = useRef(0);
  const pressedControl = () => {
    controlPressAt.current = Date.now();
  };

  const isDone = todo.status === "done";
  const priority =
    PRIORITY_CONFIG[todo.priority as keyof typeof PRIORITY_CONFIG] ??
    PRIORITY_CONFIG.none;

  function handleToggle(e?: { stopPropagation?: () => void }) {
    // Web: stops the row's onPress (open-detail) from also firing — onPress
    // maps to a bubbling onClick. Native: the RN responder system already
    // gives the touch to this innermost view (no bubbling), and the press
    // event carries no stopPropagation — so optional-chain it.
    e?.stopPropagation?.();
    if (isDone) {
      // Un-complete: flip back immediately, no burn.
      onToggle();
      return;
    }
    if (burning) return;
    // Play the ignite + burn first, THEN commit ("animate, then API").
    setBurning(true);
    setTimeout(() => {
      // Burn finished → drop the row immediately (don't wait on the mutation
      // round-trip or a second exit animation), then commit in the background.
      setGone(true);
      onToggle();
    }, BURN_MS);
  }

  function handleDelete(e?: { stopPropagation?: () => void }) {
    // See handleToggle — optional-chained so native (no stopPropagation on
    // the press event) doesn't throw while web still stops row bubbling.
    e?.stopPropagation?.();
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

  // Burn already played → remove the row the instant it ends, so the list
  // closes immediately (no lingering while the mutation/exit settles).
  if (gone) return null;

  return (
    <XStack
      group
      onPress={() => {
        // Skip when an inner control (checkbox / delete) was just the press
        // target — native has no stopPropagation, so without this a checkbox
        // tap would also open the detail sheet. 400ms covers the touch
        // down→up gap of a single tap.
        if (Date.now() - controlPressAt.current < 400) return;
        if (!burning) onOpenDetail();
      }}
      cursor="pointer"
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
      minHeight={compact ? 60 : undefined}
      borderWidth={compact ? 1 : 0}
      borderColor="$borderColor"
      bg={compact ? "$card" : undefined}
      position="relative"
      // Web-only enter + exit (delete / un-complete) via AnimatePresence in
      // the list views; see ROW_ANIMATION. Completion plays the burn below.
      {...ROW_ANIMATION}
      hoverStyle={burning ? undefined : { bg: "$accent" }}
      role="button"
      aria-label="Open todo details"
      // Web-only right-click → host's actions menu. Passed through to the DOM
      // node (Tamagui forwards unknown props on web); no-op on native.
      {...({ onContextMenu } as object)}
    >
      <View shrink={0} position="relative">
        <View
          onPressIn={pressedControl}
          onPress={handleToggle}
          // 20px (was 24): balanced against the compact title (18px line) +
          // date (16px line) block so the circle doesn't out-size the text.
          width={20}
          height={20}
          items="center"
          justify="center"
          rounded={9999}
          borderWidth={2}
          transition="quick"
          borderColor="$mutedForeground"
          bg="transparent"
          // Checked → todo identity RED; burning → warm ember. Both ride the
          // inline `style` prop (it wins over the base `bg`/`borderColor` and
          // takes a CSS var / hex that the strict color props reject).
          style={
            burning
              ? { borderColor: EMBER, backgroundColor: EMBER }
              : isDone
                ? { borderColor: TODO_COLOR, backgroundColor: TODO_COLOR }
                : undefined
          }
          hoverStyle={
            !isDone && !burning
              ? { borderColor: TODO_COLOR as never }
              : undefined
          }
          role="checkbox"
          aria-checked={isDone || burning}
          aria-label={isDone ? "Mark as incomplete" : "Mark as complete"}
        >
          {isDone || burning ? (
            <View
              transition="bouncy"
              enterStyle={burning ? { scale: 0, opacity: 0 } : undefined}
            >
              {/* lucide-icons-2 reads its own `color` (no CSS cascade). White
                  check on the red/ember fill. */}
              <Check size={12} strokeWidth={3} color="#ffffff" />
            </View>
          ) : null}
        </View>
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
      <YStack flex={1} minW={0} gap="$1">
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
            <XStack flexWrap="wrap" items="center" gap="$1.5" lineHeight={16}>
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
          <XStack flexWrap="wrap" items="center" gap="$1.5" lineHeight={16}>
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
          (PWA), else the default hover delete button (mobile / other hosts).
          The wrapping View records the control-press timestamp so a tap on the
          menu/delete doesn't ALSO fire the row's open-detail onPress. */}
      {renderActions ? (
        <View shrink={0} onPressIn={pressedControl}>
          {renderActions()}
        </View>
      ) : isWeb ? (
        // Hover-reveal delete is a WEB-only affordance: on touch it's
        // permanently invisible ($group-hover never fires) yet still mounted
        // an animated node per row. Native hosts provide their own reachable
        // delete (swipe action / edit sheet).
        <IconButton
          variant="ghost"
          size="sm"
          intent="danger"
          onPressIn={pressedControl}
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
