import {
  useBillingPortal,
  useCanManageBilling,
  useOrg,
  useStageholder,
  useSubscription,
} from "@stageholder/sdk/spa";
import { Link } from "@tanstack/react-router";
import { ArrowUpRight, ExternalLink } from "lucide-react";
import { OrbitIllustration } from "./orbit-illustration";
import {
  Button,
  H1,
  Skeleton,
  Text,
  View,
  XStack,
  YStack,
} from "@stageholder/ui";

/**
 * Editorial hero for the billing dashboard. Reads like the cover page of
 * a quarterly report: large display name of the current plan, mono
 * metadata (status, renewal, member count), and an abstract orbital
 * illustration on the right that mirrors the upgrade page so the two
 * surfaces feel like one publication.
 *
 * Built entirely from SDK hooks (`useSubscription`, `useCanManageBilling`,
 * `useBillingPortal`, `useStageholder`) — no high-level SDK component
 * involved. This is the pattern Meridian uses to fully customize the
 * billing UX while still relying on Hub for the underlying truth.
 */
export function CurrentPlanHero({
  changePlanHref = "/settings/billing/upgrade",
}: {
  changePlanHref?: string;
}) {
  const sub = useSubscription();
  const { state } = useStageholder();
  const { org } = useOrg();
  const { canManage } = useCanManageBilling();
  const billingPortal = useBillingPortal();
  const portalPending = billingPortal.isPending;

  if (state.status !== "authenticated") {
    return <HeroSkeleton />;
  }

  const isFree = !sub;
  const planName = sub?.planName ?? "Free";
  const status = sub?.status ?? "active";
  const seats =
    sub?.pricingModel === "seat_based"
      ? { used: sub.seats ?? 0, total: sub.memberLimit ?? 0 }
      : null;

  const tier: "rest" | "practice" | "conduct" = isFree
    ? "rest"
    : status === "trialing"
      ? "practice"
      : "conduct";

  return (
    <View
      tag="section"
      position="relative"
      rounded={32}
      borderWidth={1}
      borderColor="$borderColor"
      // Was a from-card→card/70 diagonal gradient; flattened to the opaque
      // $card token (no kit gradient token). FLAG: subtle gradient dropped.
      bg="$card"
      p="$7"
      $md={{ p: "$8" }}
      // allowlist: billing-reveal / billing-stagger-1 — staggered section
      // reveal keyframe shared across the billing dashboard (no token equiv).
      className="billing-reveal billing-stagger-1"
    >
      {/* Top-row status strip */}
      <XStack mb="$8" items="center" gap="$3">
        <StatusPill status={status} />
      </XStack>

      <XStack
        flexDirection="column"
        gap="$8"
        $md={{ flexDirection: "row", items: "center" }}
      >
        {/* Left: plan name + meta + actions */}
        <YStack flex={1} gap="$8" $md={{ flexGrow: 1.4 }}>
          <YStack gap="$3">
            <Text
              fontFamily="$mono"
              fontSize="$1"
              textTransform="uppercase"
              letterSpacing={3.4}
              color="$mutedForeground"
            >
              Current plan
            </Text>
            <H1
              fontSize={64}
              lineHeight={64 * 0.92}
              letterSpacing={-1.3}
              color="$color"
              style={{ fontFamily: "var(--font-display)", fontWeight: 600 }}
            >
              {planName}
            </H1>
          </YStack>

          <XStack
            flexWrap="wrap"
            gap="$5"
            borderTopWidth={1}
            borderColor="$borderColor"
            pt="$5"
          >
            <MetaCell
              label="Billing"
              value={
                isFree
                  ? "No charges"
                  : sub?.pricingModel === "seat_based"
                    ? "Per seat"
                    : "Flat rate"
              }
            />
            <MetaCell
              label="Seats"
              value={seats ? `${seats.used} of ${seats.total}` : "1 of 1"}
            />
            <MetaCell
              label="Account"
              value={state.data.email ?? state.data.name ?? "you"}
              ellipsis
            />
          </XStack>

          <XStack flexWrap="wrap" gap="$3" pt="$2">
            {/* Route owned by host; keep <Link> for prefetch + middle-click,
                style + hover live on the inner XStack. */}
            <Link to={changePlanHref} style={{ textDecoration: "none" }}>
              <XStack
                group
                height={44}
                items="center"
                gap="$2"
                rounded={9999}
                bg="$color"
                pl="$5"
                pr="$1.5"
                transition="quick"
                hoverStyle={{ opacity: 0.9 }}
              >
                <Text fontSize="$3" fontWeight="500" color="$background">
                  {isFree ? "Upgrade your plan" : "Change plan"}
                </Text>
                <View
                  width={32}
                  height={32}
                  items="center"
                  justify="center"
                  rounded={9999}
                  bg="$background"
                  opacity={0.15}
                  transition="quick"
                  $group-hover={{ x: 2 }}
                >
                  <Text color="$color" lineHeight={0}>
                    <ArrowUpRight size={14} strokeWidth={2} />
                  </Text>
                </View>
              </XStack>
            </Link>

            {canManage && !isFree && org && (
              <Button
                intent="outline"
                disabled={portalPending}
                iconAfter={<ExternalLink size={14} strokeWidth={2} />}
                onPress={() => {
                  billingPortal
                    .mutateAsync({
                      orgId: org.id,
                      returnUrl: `${window.location.origin}/app/settings/billing`,
                    })
                    .then(({ url }) => {
                      window.location.href = url;
                    })
                    .catch((err) =>
                      // eslint-disable-next-line no-console
                      console.error("[meridian] portal failed:", err),
                    );
                }}
              >
                {portalPending ? "Opening…" : "Manage payment"}
              </Button>
            )}
          </XStack>

          {!canManage && !isFree && (
            <Text
              borderLeftWidth={2}
              borderColor="$borderColor"
              pl="$4"
              fontSize="$1"
              color="$mutedForeground"
            >
              Only owners and admins can change the plan or update payment
              details. Ask an admin in your organization for changes.
            </Text>
          )}
        </YStack>

        {/* Right: orbital illustration framed like a printer's plate */}
        <View
          position="relative"
          display="none"
          $md={{ display: "flex", flexGrow: 1 }}
        >
          <View position="relative" mx="auto" width="100%" maxW={320}>
            {/* aspect-square via padding-bottom trick is hard without a token;
                the inner absolute layers fill an explicit square frame. */}
            <View style={{ aspectRatio: 1 }}>
              <View
                position="absolute"
                t={0}
                r={0}
                b={0}
                l={0}
                rounded={28}
                bg="$background"
                opacity={0.6}
                borderWidth={1}
                borderColor="$borderColor"
              />
              <View position="absolute" t={0} r={0} b={0} l={0} p="$6">
                <OrbitIllustration tier={tier} />
              </View>
              {/* corner ticks */}
              {(["tl", "tr", "bl", "br"] as const).map((c) => (
                <CornerTick key={c} corner={c} />
              ))}
            </View>
          </View>
          <Text mt="$4" fontSize="$1" color="$mutedForeground" text="center">
            Your active features
          </Text>
        </View>
      </XStack>
    </View>
  );
}

function StatusPill({ status }: { status: string }) {
  // emerald/amber/rose intents map onto the kit's success/warning/destructive
  // muted-tint tokens; the dot inherits the same intent color.
  const tone =
    status === "active"
      ? { bg: "$successMuted", color: "$success" }
      : status === "trialing"
        ? { bg: "$warningMuted", color: "$warning" }
        : status === "past_due"
          ? { bg: "$destructiveMuted", color: "$destructive" }
          : { bg: "$muted", color: "$mutedForeground" };
  const label =
    status === "active"
      ? "Active"
      : status === "trialing"
        ? "Free trial"
        : status === "past_due"
          ? "Payment due"
          : status;
  return (
    <XStack
      items="center"
      gap="$1.5"
      rounded={9999}
      px="$3"
      py="$1"
      bg={tone.bg}
    >
      <View width={6} height={6} rounded={9999} bg={tone.color} />
      <Text fontSize="$1" fontWeight="500" color={tone.color}>
        {label}
      </Text>
    </XStack>
  );
}

function MetaCell({
  label,
  value,
  ellipsis,
}: {
  label: string;
  value: string;
  ellipsis?: boolean;
}) {
  return (
    <YStack flex={1} minW={120} gap="$1">
      <Text
        fontFamily="$mono"
        fontSize={10}
        textTransform="uppercase"
        letterSpacing={2.4}
        color="$mutedForeground"
      >
        {label}
      </Text>
      <Text
        fontSize="$3"
        fontWeight="500"
        color="$color"
        numberOfLines={ellipsis ? 1 : undefined}
      >
        {value}
      </Text>
    </YStack>
  );
}

function CornerTick({ corner }: { corner: "tl" | "tr" | "bl" | "br" }) {
  // Small L-shaped registration ticks at each corner. The two visible edges
  // depend on which corner, drawn as faint borders on a tiny square.
  const edges = {
    tl: { borderLeftWidth: 1, borderTopWidth: 1 },
    tr: { borderRightWidth: 1, borderTopWidth: 1 },
    bl: { borderLeftWidth: 1, borderBottomWidth: 1 },
    br: { borderRightWidth: 1, borderBottomWidth: 1 },
  } as const;
  const pos = {
    tl: { t: 7 as const, l: 7 as const },
    tr: { t: 7 as const, r: 7 as const },
    bl: { b: 7 as const, l: 7 as const },
    br: { b: 7 as const, r: 7 as const },
  } as const;
  return (
    <View
      position="absolute"
      width={12}
      height={12}
      borderColor="$borderColor"
      {...pos[corner]}
      {...edges[corner]}
    />
  );
}

function HeroSkeleton() {
  return (
    <View
      tag="section"
      rounded={32}
      borderWidth={1}
      borderColor="$borderColor"
      bg="$card"
      p="$7"
    >
      <Skeleton height={8} width={128} rounded={9999} />
      <Skeleton mt="$6" height={64} width="66%" rounded={16} />
      <XStack mt="$8" gap="$4">
        {Array.from({ length: 3 }).map((_, i) => (
          <Skeleton key={i} flex={1} height={40} rounded={12} />
        ))}
      </XStack>
    </View>
  );
}
