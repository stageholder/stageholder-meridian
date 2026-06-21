import { useRef, useState, type ReactNode } from "react";
import {
  Calendar,
  Check,
  Clock,
  ListChecks,
  Trash2,
} from "@tamagui/lucide-icons-2";
import { IconButton, Text, View, XStack, YStack } from "@stageholder/ui";
import type { Todo } from "@repo/core/types";

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
// Kept short so the row vanishes the instant the ignite + sparks finish.
const BURN_MS = 440;

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
}: TodoItemProps) {
  const [burning, setBurning] = useState(false);
  const [gone, setGone] = useState(false);

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
    ? parseDateLocal(todo.dueDate).toLocaleDateString("en-US", {
        month: "short",
        day: "numeric",
      })
    : null;

  const formattedDoDate = todo.doDate
    ? parseDateLocal(todo.doDate).toLocaleDateString("en-US", {
        month: "short",
        day: "numeric",
      })
    : null;

  const isOverdue =
    todo.dueDate && !isDone && parseDateLocal(todo.dueDate) < new Date();

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
      rounded="$md"
      px="$2.5"
      py="$2"
      position="relative"
      // Cross-platform enter + exit (delete / un-complete) via AnimatePresence
      // in the list views. Completion plays the burn below, then commits.
      transition={{ default: "quick", exit: "medium" }}
      enterStyle={{ opacity: 0, y: 6 }}
      exitStyle={{ opacity: 0, scale: 0.94 }}
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
          borderColor={isDone ? "$primary" : "$mutedForeground"}
          bg={isDone ? "$primary" : "transparent"}
          // Burning ignites the box warm (hex → resolves on web + native).
          style={
            burning ? { borderColor: EMBER, backgroundColor: EMBER } : undefined
          }
          hoverStyle={
            !isDone && !burning ? { borderColor: "$primary" } : undefined
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
              {/* lucide-icons-2 reads its own `color` (no CSS cascade). */}
              <Check size={12} strokeWidth={3} color="$primaryForeground" />
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
        {todo.description ? (
          <Text fontSize="$1" color="$mutedForeground" numberOfLines={1}>
            {todo.description}
          </Text>
        ) : null}
        {/* Every meta item is a `MetaBadge` pill so the row reads as one
            consistent set of badges (was a mix of one priority pill + bare
            icon+text runs). The list badge surfaces which list the todo is in
            on cross-list views (host passes `listName`). lineHeight on the row
            + each badge text keeps the small ($1) labels from inheriting the
            ~23px body line-height (the old dead-space-above bug). */}
        {priority.label ||
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
                  <Calendar
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
      ) : (
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
      )}
    </XStack>
  );
}
