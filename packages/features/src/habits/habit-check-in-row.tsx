// packages/features/src/habits/habit-check-in-row.tsx
//
// The cross-platform COMPACT habit row — a single scannable line:
//   icon · name (+ subtitle) · [middle slot] · status/Complete · undo/skip/fail · [trailing slot]
//
// Presentational + props-driven (the @repo/features contract): the host wires
// the data + the check-in / skip / fail / undo / clear handlers and supplies the
// resolved accent colors (hex on native, CSS var on web — the row never resolves
// theme tokens for the accent). Platform-specific chrome rides in slots:
//   • middleSlot     — the PWA's current-week dot strip (mobile omits it)
//   • trailingSlot   — the PWA's overflow menu (mobile routes to detail on tap)
//   • controlOverlay — a burst/celebration centered on the status control
//
// This is the single source of truth for the compact-row layout + the check-in
// status state machine (Done / Skipped / Failed pill vs the Complete button, and
// which inline undo/skip/fail controls show). Both the PWA `HabitListItem` and
// the mobile `HabitCheckInRow` are thin wrappers over it.

import { useState, type ReactNode } from "react";
import {
  Button,
  IconButton,
  Text,
  View,
  XStack,
  YStack,
} from "@stageholder/ui";
import { MediaGlyph } from "@stageholder/ui/pickers";
import { Check } from "@tamagui/lucide-icons-2/icons/Check";
import { MoreHorizontal } from "@tamagui/lucide-icons-2/icons/MoreHorizontal";
import { RotateCcw } from "@tamagui/lucide-icons-2/icons/RotateCcw";
import { SkipForward } from "@tamagui/lucide-icons-2/icons/SkipForward";
import { Target } from "@tamagui/lucide-icons-2/icons/Target";
import { X } from "@tamagui/lucide-icons-2/icons/X";
import type { Habit } from "@repo/core/types";

import { accentButtonPressProps } from "../_internal/accent-button-press";
import { HabitStatusPill } from "./habit-status-pill";
import { parseMediaIcon } from "./icon-value";

// Fixed semantic colors for the status icons — lucide-icons-2 reads its own
// `color` (no theme cascade) and must resolve on native, so these are raw hex.
// The pill BACKGROUNDS use kit tokens ($successMuted etc.), which do adapt.
const DESTRUCTIVE = "#ef4444";

export interface HabitCheckInRowProps {
  habit: Habit;
  /** The active date's value + resolved target (host computes both). */
  value: number;
  target: number;
  isSkipped: boolean;
  isFailed: boolean;
  /** Cold-load the status/action slot as a skeleton (no data yet). */
  loading?: boolean;
  /** Guard the controls while a just-created entry is still an unsaved temp. */
  disabled?: boolean;
  /** Habit accent — RAW value (hex on native, `var(--ring-habit)` on web). */
  accentColor: string;
  accentTrackColor: string;
  /** Tap the icon/name → open the habit detail. */
  onOpenDetail?: () => void;
  onCheckIn: () => void | Promise<void>;
  onSkip: () => void | Promise<void>;
  onFail: () => void | Promise<void>;
  onUndo: () => void | Promise<void>;
  onClearStatus: () => void | Promise<void>;
  /**
   * When set, the open-day Skip + Fail icon pair collapses into ONE "More"
   * button that calls this (native hosts open a platform action sheet).
   * A bare X next to Skip read as "dismiss", and one stray tap failed the
   * day. Omit to keep the inline pair (PWA).
   */
  onShowMoreActions?: () => void;
  /** Optional second line under the name (mobile: "2 / 3"; PWA: description). */
  subtitle?: ReactNode;
  /** Between identity and the status control (PWA week-dot strip). */
  middleSlot?: ReactNode;
  /** After the status control (PWA overflow menu). */
  trailingSlot?: ReactNode;
  /** Overlay centered on the control (PWA RadianceBurst / a celebration). */
  controlOverlay?: ReactNode;
  /**
   * Completion celebration render-prop (mobile: an ember `Celebration`) —
   * same contract as `HabitCard.renderCompletionEffect`. The row owns the
   * false→true completion transition and calls this with `active`; the effect
   * plays once when a check-in actually MEETS the target. Rendered centered on
   * the status control.
   */
  renderCompletionEffect?: (active: boolean) => ReactNode;
  minHeight?: number;
  /**
   * Web-only escape hatch: a pointerdown handler for the ACTIONS container.
   * The PWA passes `e => e.stopPropagation()` so control clicks aren't
   * swallowed when the row is a drag item in the kit `Sortable` (its kernel
   * `setPointerCapture`s on pointerdown). No-op on native.
   */
  onActionsPointerDown?: (event: { stopPropagation: () => void }) => void;
}

export function HabitCheckInRow({
  habit,
  value,
  target,
  isSkipped,
  isFailed,
  loading,
  disabled,
  accentColor,
  accentTrackColor,
  onOpenDetail,
  onCheckIn,
  onSkip,
  onFail,
  onUndo,
  onClearStatus,
  onShowMoreActions,
  subtitle,
  middleSlot,
  trailingSlot,
  controlOverlay,
  renderCompletionEffect,
  minHeight = 56,
  onActionsPointerDown,
}: HabitCheckInRowProps) {
  const isComplete = !isSkipped && !isFailed && value >= Math.max(1, target);

  // Press-bounce + completion celebration on the status control (parity with
  // the big HabitCard). The bounce pops the control on every check-in tap; the
  // celebration fires only when THIS tap meets the target (we can predict it
  // from the pre-tap value, so the ember burst plays on the same frame as the
  // optimistic flip — no wait on the mutation round-trip).
  const [bouncing, setBouncing] = useState(false);
  const [completing, setCompleting] = useState(false);
  function handleCheckIn() {
    const willComplete = value + 1 >= Math.max(1, target);
    setBouncing(true);
    setTimeout(() => setBouncing(false), 450);
    if (willComplete) {
      setCompleting(true);
      setTimeout(() => setCompleting(false), 1200);
    }
    void onCheckIn();
  }

  return (
    <XStack
      items="center"
      gap="$3"
      py="$2.5"
      px="$3"
      minH={minHeight}
      rounded="$4"
      borderWidth={1}
      borderColor="$borderColor"
      bg="$card"
      // Web hover border fade only — no `transition` (it added an always-on
      // Reanimated spring hook per row on native, for a hover effect native
      // can't show; the smooth sibling apps animate zero row props).
      hoverStyle={{ borderColor: "$primary" }}
    >
      {/* Identity — icon + name (+ subtitle); tap to open the detail. */}
      <XStack
        flex={1}
        minW={0}
        items="center"
        gap="$3"
        onPress={onOpenDetail}
        pressStyle={onOpenDetail ? { opacity: 0.7 } : undefined}
      >
        <View
          width={34}
          height={34}
          shrink={0}
          rounded="$lg"
          items="center"
          justify="center"
          bg={accentTrackColor as never}
        >
          <MediaGlyph
            value={parseMediaIcon(habit.icon)}
            size={18}
            fallback={
              <Text color={accentColor as never} lineHeight={0}>
                <Target size={15} />
              </Text>
            }
          />
        </View>
        <YStack flex={1} minW={0} gap="$0.5">
          <Text fontSize="$3" fontWeight="600" color="$color" numberOfLines={1}>
            {habit.name}
          </Text>
          {subtitle ? (
            <Text fontSize="$1" color="$mutedForeground" numberOfLines={1}>
              {subtitle}
            </Text>
          ) : null}
        </YStack>
      </XStack>

      {middleSlot}

      {/* Status / actions. */}
      <XStack
        shrink={0}
        items="center"
        gap="$1.5"
        {...(onActionsPointerDown
          ? ({ onPointerDown: onActionsPointerDown } as object)
          : {})}
      >
        {loading ? (
          <View width={84} height={30} rounded="$3" bg="$muted" opacity={0.5} />
        ) : (
          <>
            <View position="relative" items="center" justify="center">
              {controlOverlay}
              {renderCompletionEffect?.(completing)}
              {isComplete ? (
                <HabitStatusPill
                  status="complete"
                  label="Done"
                  bouncing={bouncing}
                />
              ) : isSkipped ? (
                <HabitStatusPill status="skipped" label="Skipped" />
              ) : isFailed ? (
                <HabitStatusPill status="failed" label="Failed" />
              ) : (
                <Button
                  size="sm"
                  borderWidth={0}
                  color={"#ffffff" as never}
                  icon={<Check size={13} color="#ffffff" />}
                  style={{ backgroundColor: accentColor }}
                  {...accentButtonPressProps(accentColor)}
                  // Enter pop (scale only — an explicit opacity would override the
                  // kit's disabled dim) + the press bounce; both need `transition`.
                  enterStyle={{ scale: 0.9 }}
                  transition="quick"
                  scale={bouncing ? 1.1 : 1}
                  disabled={disabled}
                  onPress={handleCheckIn}
                >
                  {target > 1 ? `${value + 1} / ${target}` : "Complete"}
                </Button>
              )}
            </View>

            {/* Inline undo / skip / fail. */}
            {isSkipped || isFailed ? (
              <IconButton
                variant="outline"
                size="sm"
                disabled={disabled}
                aria-label="Clear status"
                hitSlop={6}
                onPress={() => void onClearStatus()}
              >
                <RotateCcw size={14} />
              </IconButton>
            ) : value > 0 ? (
              <IconButton
                variant="outline"
                size="sm"
                disabled={disabled}
                aria-label="Undo last check-in"
                hitSlop={6}
                onPress={() => void onUndo()}
              >
                <RotateCcw size={14} />
              </IconButton>
            ) : onShowMoreActions ? (
              <IconButton
                variant="outline"
                size="sm"
                hitSlop={6}
                disabled={disabled}
                aria-label="More actions: skip or mark failed"
                onPress={onShowMoreActions}
              >
                <MoreHorizontal size={14} />
              </IconButton>
            ) : (
              <>
                <IconButton
                  variant="outline"
                  size="sm"
                  disabled={disabled}
                  aria-label="Skip"
                  onPress={() => void onSkip()}
                >
                  <SkipForward size={14} />
                </IconButton>
                <IconButton
                  variant="outline"
                  size="sm"
                  disabled={disabled}
                  aria-label="Mark failed"
                  onPress={() => void onFail()}
                >
                  <X size={14} color={DESTRUCTIVE} />
                </IconButton>
              </>
            )}
          </>
        )}

        {trailingSlot}
      </XStack>
    </XStack>
  );
}
