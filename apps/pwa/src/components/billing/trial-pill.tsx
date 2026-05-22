import { Link } from "@tanstack/react-router";
import { Sparkles } from "lucide-react";
import { useSubscription } from "@stageholder/sdk/spa";
import { Text, Tooltip, View, XStack, YStack } from "@stageholder/ui";

/**
 * Compact trial countdown for the app header. Replaces the page-width
 * amber banner that used to sit above main content.
 *
 * Renders nothing unless the active subscription is in `trialing` status.
 * Color escalates as the trial runs down — amber while comfortable,
 * rose with a soft pulse in the final stretch — so the pill earns
 * attention without shouting on day 14.
 */
export function TrialPill({
  upgradeHref = "/settings/billing/upgrade",
  urgentBelowDays = 3,
}: {
  upgradeHref?: string;
  urgentBelowDays?: number;
}) {
  const sub = useSubscription();
  if (!sub || sub.status !== "trialing") return null;

  const daysRemaining = sub.trialEndsAt ? daysUntil(sub.trialEndsAt) : null;
  const urgent = daysRemaining !== null && daysRemaining <= urgentBelowDays;
  const endsAt = sub.trialEndsAt ? new Date(sub.trialEndsAt) : null;
  const endsAtLabel = endsAt
    ? endsAt.toLocaleDateString(undefined, {
        month: "short",
        day: "numeric",
        year: "numeric",
      })
    : null;

  const longLabel =
    daysRemaining !== null
      ? `${daysRemaining} ${daysRemaining === 1 ? "day" : "days"} left`
      : "Trial";
  const shortLabel = daysRemaining !== null ? `${daysRemaining}d` : "Trial";

  // Intent palette: urgent escalates to destructive (rose), otherwise the
  // comfortable amber maps onto the kit's warning tokens.
  const tone = urgent
    ? { bg: "$destructiveMuted", border: "$destructive", color: "$destructive" }
    : { bg: "$warningMuted", border: "$warning", color: "$warning" };

  return (
    <Tooltip delay={250} placement="bottom-end">
      <Tooltip.Trigger asChild>
        <Link
          to={upgradeHref}
          aria-label={`${longLabel} in trial — manage subscription`}
          style={{ textDecoration: "none" }}
        >
          <XStack
            group
            height={28}
            items="center"
            gap="$1.5"
            rounded={9999}
            borderWidth={1}
            px="$2.5"
            transition="quick"
            bg={tone.bg}
            borderColor={tone.border}
            hoverStyle={{ opacity: 0.85 }}
          >
            <Text
              color={tone.color}
              shrink={0}
              lineHeight={0}
              transition="quick"
              $group-hover={{ rotate: "12deg" }}
            >
              <Sparkles
                // allowlist: animate-pulse — urgent pulse, no token equivalent
                className={urgent ? "animate-pulse" : undefined}
                size={12}
                strokeWidth={2}
                aria-hidden
              />
            </Text>
            <Text
              fontFamily="$mono"
              fontSize="$1"
              lineHeight={16}
              color={tone.color}
            >
              <Text display="none" $sm={{ display: "inline" }}>
                {longLabel}
              </Text>
              <Text $sm={{ display: "none" }}>{shortLabel}</Text>
            </Text>
            <View
              aria-hidden
              mx="$0.5"
              height={12}
              width={1}
              display="none"
              $sm={{ display: "flex" }}
              opacity={0.3}
              bg={tone.color}
            />
            {/* "Manage" rather than "Upgrade": the trialed plan can already
                be the top tier, so there's nothing to upgrade *to*. The
                destination /upgrade page handles plan switches AND trial
                management uniformly, so this verb covers both cases without
                misleading top-tier trialers. */}
            <Text
              aria-hidden
              display="none"
              $sm={{ display: "inline" }}
              fontSize="$1"
              fontWeight="600"
              letterSpacing={0.9}
              color={tone.color}
              transition="quick"
              $group-hover={{ x: 2 }}
            >
              MANAGE
            </Text>
          </XStack>
        </Link>
      </Tooltip.Trigger>
      <Tooltip.Content maxW={320}>
        <Tooltip.Arrow />
        {endsAtLabel ? (
          <YStack gap="$0.5">
            <Text>
              Free trial of <Text fontWeight="600">{sub.planName}</Text>
            </Text>
            <Text opacity={0.7}>Ends {endsAtLabel} · Click to manage</Text>
          </YStack>
        ) : (
          <Text>Trial in progress — click to manage</Text>
        )}
      </Tooltip.Content>
    </Tooltip>
  );
}

/**
 * Whole days from now until `iso`. Floored, never negative — a trial that's
 * 6 hours from ending shows "1 day left" rather than "0 days left", which
 * reads better in the pill. Mirrors the SDK's TrialBanner logic.
 */
function daysUntil(iso: string): number {
  const ms = new Date(iso).getTime() - Date.now();
  if (Number.isNaN(ms)) return 0;
  if (ms <= 0) return 0;
  return Math.max(1, Math.ceil(ms / 86_400_000));
}
