// packages/features/src/habits/habit-status-pill.tsx
//
// The day-status control a habit shows once it is acted on — "Complete" /
// "Logged" / "Done", "Skipped", "Failed" — plus the "Rest day" placeholder.
//
// It is sized EXACTLY like the kit `Button size="sm"` it replaces (height
// $sm = 32, px $sm = 12, radius $sm = 6, gap $2, label $sm = 12px) so the
// check-in → status swap happens IN PLACE: same box, same corner radius, same
// label metrics, only the fill and the label change. Before this the status
// was an ad-hoc `px $2.5 / py $1.5 / rounded $md / fontSize $1` chip that was
// 4 px shorter, tighter and rounder than the button, so every check-in made
// the control visibly shrink and the action row re-flow (the "jump" between
// the Check In button and the Complete badge, 2026-10-20).
//
// Mount animation: a quick scale/opacity pop-in (transform + opacity only, so
// it is equally cheap on the PWA's CSS driver and native's Reanimated driver —
// the RadianceBurst rule). `opacity={1}` and `scale` are explicit bases so the
// enter animation can't stick at `enterStyle` (see memory
// reference_native_focus_ring_and_enter_base). `bouncing` is the press bounce
// the host fires on the check-in tap (parity with HabitCard).
//
// Shared by the big `HabitCard` and the compact `HabitCheckInRow`, so the PWA
// and the native app render the identical control.
import type { ReactNode } from "react";
import { Check } from "@tamagui/lucide-icons-2/icons/Check";
import { SkipForward } from "@tamagui/lucide-icons-2/icons/SkipForward";
import { X } from "@tamagui/lucide-icons-2/icons/X";
import { Text, XStack } from "@stageholder/ui";

export type HabitDayStatus = "complete" | "skipped" | "failed" | "rest";

// Fixed semantic colors for the status icons — lucide-icons-2 reads its own
// `color` (no theme cascade) and must resolve on native, so these are raw hex.
// The pill BACKGROUNDS use kit tokens ($successMuted etc.), which do adapt.
const SUCCESS = "#16a34a";
const DESTRUCTIVE = "#ef4444";
const MUTED = "#71717a";

const STATUS_STYLE: Record<
  HabitDayStatus,
  { bg: string; color: string; icon: ReactNode }
> = {
  complete: {
    bg: "$successMuted",
    color: "$success",
    icon: <Check size={14} color={SUCCESS} />,
  },
  skipped: {
    bg: "$muted",
    color: "$mutedForeground",
    icon: <SkipForward size={13} color={MUTED} />,
  },
  failed: {
    bg: "$destructiveMuted",
    color: "$destructive",
    icon: <X size={13} color={DESTRUCTIVE} />,
  },
  // Not scheduled today — same box so the action row keeps its height, but no
  // fill and no icon: it is information, not a state the user produced.
  rest: { bg: "transparent", color: "$mutedForeground", icon: null },
};

export interface HabitStatusPillProps {
  status: HabitDayStatus;
  label: string;
  /** Press-bounce (scale 1 → 1.1 → 1) the host fires on the check-in tap. */
  bouncing?: boolean;
}

export function HabitStatusPill({
  status,
  label,
  bouncing = false,
}: HabitStatusPillProps) {
  const s = STATUS_STYLE[status];
  return (
    <XStack
      items="center"
      justify="center"
      gap="$2"
      height="$sm"
      px="$sm"
      rounded="$sm"
      bg={s.bg as never}
      transition="quick"
      enterStyle={{ opacity: 0, scale: 0.9 }}
      opacity={1}
      scale={bouncing ? 1.1 : 1}
    >
      {s.icon}
      <Text fontSize="$sm" fontWeight="600" color={s.color as never}>
        {label}
      </Text>
    </XStack>
  );
}
