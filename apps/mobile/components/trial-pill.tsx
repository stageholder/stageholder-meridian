// apps/mobile/components/trial-pill.tsx
//
// Compact trial countdown for the Today header — native port of the PWA's
// apps/pwa/src/components/billing/trial-pill.tsx. Renders nothing unless the
// active subscription is in `trialing` status. Color escalates as the trial
// runs down: amber ($warning) while comfortable, rose ($destructive) in the
// final stretch, so the pill earns attention without shouting on day 14.
//
// Differences from the web pill, all touch-driven:
//   - No Tooltip (hover-only affordance) — the tap IS the action, straight
//     to the /upgrade screen, which handles plan switches AND trial
//     management uniformly (same "Manage, not Upgrade" reasoning as the PWA).
//   - No hover micro-animations / urgent CSS pulse (className is web-only).
//   - One compact label ("5d left") — a phone header has no room for the
//     web's expanded "5 days left · MANAGE" form.

import { useSubscription } from "@stageholder/sdk/react-native";
import { Text, XStack } from "@stageholder/ui";
import { Sparkles } from "@tamagui/lucide-icons-2";
import { useRouter } from "expo-router";

export function TrialPill({
  urgentBelowDays = 3,
}: {
  urgentBelowDays?: number;
}) {
  const router = useRouter();
  const sub = useSubscription();
  if (!sub || sub.status !== "trialing") return null;

  const daysRemaining = sub.trialEndsAt ? daysUntil(sub.trialEndsAt) : null;
  const urgent = daysRemaining !== null && daysRemaining <= urgentBelowDays;
  const label = daysRemaining !== null ? `${daysRemaining}d left` : "Trial";

  // Intent palette (PWA parity): urgent escalates to destructive (rose),
  // otherwise the comfortable amber maps onto the kit's warning tokens.
  const tone = urgent
    ? ({
        bg: "$destructiveMuted",
        border: "$destructive",
        color: "$destructive",
      } as const)
    : ({ bg: "$warningMuted", border: "$warning", color: "$warning" } as const);

  return (
    <XStack
      role="button"
      aria-label={`${label} in trial — manage subscription`}
      height={28}
      items="center"
      gap="$1.5"
      rounded={9999}
      borderWidth={1}
      px="$2.5"
      bg={tone.bg}
      borderColor={tone.border}
      pressStyle={{ opacity: 0.7 }}
      onPress={() => router.push("/upgrade")}
    >
      <Sparkles size={12} color={tone.color} strokeWidth={2} />
      <Text fontFamily="$mono" fontSize="$1" lineHeight={16} color={tone.color}>
        {label}
      </Text>
    </XStack>
  );
}

/**
 * Whole days from now until `iso`. Floored, never negative — a trial that's
 * 6 hours from ending shows "1d left" rather than "0d left" (mirrors the
 * PWA pill / SDK TrialBanner logic).
 */
function daysUntil(iso: string): number {
  const ms = new Date(iso).getTime() - Date.now();
  if (Number.isNaN(ms)) return 0;
  if (ms <= 0) return 0;
  return Math.max(1, Math.ceil(ms / 86_400_000));
}
