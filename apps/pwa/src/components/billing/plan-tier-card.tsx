import { useState } from "react";
import { useNavigate } from "@tanstack/react-router";
import {
  formatPlanPrice,
  useBillingPortal,
  useCanManageBilling,
  useChangePlan,
  useOrg,
  useStageholder,
  useStartCheckout,
  useSubscription,
  type PricingPlan,
  type ProductFeature,
} from "@stageholder/sdk/spa";
import { BillingError } from "@stageholder/sdk/core";
import { openURL } from "@repo/core/platform/linking";
import { billingReturnUrl, openBillingURL } from "@/lib/billing-return";
import { OrbitIllustration } from "./orbit-illustration";
import {
  ArrowUpRight,
  AlertCircle,
  Building2,
  Check,
  ExternalLink,
  Sparkles,
} from "lucide-react";
import {
  Button,
  H3,
  Paragraph,
  Separator,
  Text,
  View,
  XStack,
  YStack,
} from "@stageholder/ui";

/**
 * Single pricing-tier card. Editorial layout: vertical "Plan / 01" gutter
 * mark, large display-serif plan name, mono price, abstract orbital
 * illustration tied to the tier. The featured plan rises out of the
 * baseline grid via {@link className} prop on the parent (CSS-grid placement).
 *
 * Renders without using the SDK's `<PlanCard>` — proves the SDK's headless
 * surface (`usePricing`, `useStartCheckout`, `useCanManageBilling`) is
 * enough to ship a fully custom pricing experience.
 */
export function PlanTierCard({
  plan,
  catalog,
  cycle,
  isCurrent,
}: {
  plan: PricingPlan;
  catalog: ProductFeature[];
  cycle: "monthly" | "yearly";
  isCurrent: boolean;
}) {
  const { mutateAsync, isPending: checkoutPending } = useStartCheckout();
  const billingPortal = useBillingPortal();
  const portalPending = billingPortal.isPending;
  const { canManage } = useCanManageBilling();
  const { org, organizations } = useOrg();
  const { state } = useStageholder();
  const sub = useSubscription();
  // Plan-change mutation. Hoisted next to the other hooks so its
  // `isPending` flag is available in `isPending` below.
  const changePlanMutation = useChangePlan();
  const [errorState, setErrorState] = useState<{
    code: string | null;
    message: string;
  } | null>(null);

  // The org has an active Polar subscription whenever Polar tracks period
  // boundaries on the row. Trial → trialEndsAt set; paid → currentPeriodEnd
  // set. Free-tier rows seeded by Hub at org-creation have neither, so this
  // cleanly separates "first-time purchase" from "plan change for existing
  // subscriber". Plan changes for the second case go through the new
  // `/api/billing/change-plan` endpoint, which calls Polar's
  // `subscriptions.update({product_id})` — checkout would create a duplicate
  // Polar subscription and double-bill the customer.
  const hasPolarSubscription =
    !!sub && (sub.trialEndsAt !== null || sub.currentPeriodEnd !== null);
  const isPending =
    checkoutPending || portalPending || changePlanMutation.isPending;

  // mutate() swallows errors and only console.errors them — we need the
  // structured error to drive inline UI, so we use mutateAsync and handle
  // the redirect ourselves. Falls back to a generic message when the error
  // isn't a typed BillingError (network failures, 5xx HTML responses).
  async function startCheckout() {
    setErrorState(null);
    if (!org) {
      setErrorState({
        code: null,
        message: "No active workspace to bill against.",
      });
      return;
    }
    try {
      const { url } = await mutateAsync({
        orgId: org.id,
        product: "meridian",
        planSlug: plan.slug,
        billingCycle: cycle,
        returnUrl: billingReturnUrl("/settings/billing/success"),
      });
      openBillingURL(url);
    } catch (err) {
      if (err instanceof BillingError) {
        setErrorState({ code: err.code, message: err.message });
      } else {
        setErrorState({
          code: null,
          message:
            err instanceof Error
              ? err.message
              : "Could not start checkout. Please try again.",
        });
      }
    }
  }

  /**
   * Swap an existing Polar subscription onto this plan. POSTs to Hub's
   * `/api/billing/change-plan` (Hub then calls
   * `polar.subscriptions.update({product_id})` server-side). Polar fires
   * `subscription.updated` webhook → Hub refreshes the local row.
   *
   * The SDK's `useChangePlan` returns `unknown` — Hub settles the change
   * server-side and our success page polls/refreshes from there. Navigate
   * to `?changed=1` so the success route runs its refresh + cache-bust
   * sequence.
   */
  async function changePlan() {
    setErrorState(null);
    if (!org) {
      setErrorState({
        code: null,
        message: "No active workspace to bill against.",
      });
      return;
    }
    try {
      await changePlanMutation.mutateAsync({
        orgId: org.id,
        product: "meridian",
        planSlug: plan.slug,
        billingCycle: cycle,
      });
      openURL(`/settings/billing/success?changed=1`);
    } catch (err) {
      if (err instanceof BillingError) {
        setErrorState({ code: err.code, message: err.message });
      } else {
        setErrorState({
          code: null,
          message:
            err instanceof Error
              ? err.message
              : "Could not change plan. Please try again.",
        });
      }
    }
  }

  async function manageSubscription() {
    setErrorState(null);
    if (!org) {
      setErrorState({
        code: null,
        message: "No active workspace to bill against.",
      });
      return;
    }
    try {
      const { url } = await billingPortal.mutateAsync({
        orgId: org.id,
        returnUrl: billingReturnUrl("/settings/billing"),
      });
      openBillingURL(url);
    } catch (err) {
      setErrorState({
        code: null,
        message:
          err instanceof Error ? err.message : "Could not open billing portal.",
      });
    }
  }
  // Show the active-org label only when the user has more than one org —
  // otherwise it's noise. Single-org Meridian users (the majority) see no
  // extra chrome.
  const showActiveOrgLabel =
    state.status === "authenticated" && organizations.length > 1 && !!org;

  const tier: "rest" | "practice" | "conduct" = plan.isFreeTier
    ? "rest"
    : plan.isFeatured
      ? "conduct"
      : "practice";

  const price = cycle === "monthly" ? plan.priceMonthly : plan.priceYearly;
  const bullets = derivePlanBullets(plan, catalog, 4);
  const hasTrial = !!plan.trialDays && plan.trialDays > 0 && !plan.isFreeTier;
  // CTA label depends on whether this is a first-time purchase (checkout)
  // or a plan switch on an existing subscription (change-plan). Same paid
  // plan, different button copy — telling users explicitly that an
  // immediate switch is happening (rather than a fresh trial) reduces
  // surprise when they land on the success page already paying.
  const ctaLabel = hasPolarSubscription
    ? `Switch to ${plan.displayName}`
    : hasTrial
      ? `Start ${plan.trialDays}-day free trial`
      : `Get ${plan.displayName}`;
  const ctaLoadingLabel = hasPolarSubscription
    ? "Switching plan…"
    : "Redirecting to checkout…";

  return (
    <YStack
      render="article"
      group
      position="relative"
      overflow="hidden"
      // Fill the parent wrapper (a carousel slide on mobile, a flex grid cell
      // at md+). Equal-height comes from the row's default stretch; the
      // flex spacer below pins the CTA to the bottom.
      width="100%"
      height="100%"
      rounded={28}
      borderWidth={1}
      // Featured card gets a stronger resting border; both lift to a near-
      // foreground border on hover. The bespoke drop-shadows had no token —
      // dropped, the border emphasis carries the "this rises" intent.
      borderColor={plan.isFeatured ? "$color" : "$borderColor"}
      bg="$card"
      px="$7"
      pt="$8"
      pb="$7"
      transition="medium"
      hoverStyle={{ borderColor: "$color" }}
    >
      {/* Featured badge — clear "this is the recommended pick" */}
      {plan.isFeatured && (
        <XStack
          position="absolute"
          t={28}
          r={28}
          z={1}
          items="center"
          gap="$1.5"
          rounded={9999}
          borderWidth={1}
          borderColor="$color"
          bg="$background"
          px="$2.5"
          py="$1"
        >
          <View width={6} height={6} rounded={9999} bg="$color" />
          <Text fontSize="$1" fontWeight="500" color="$color">
            Most popular
          </Text>
        </XStack>
      )}

      {/* Illustration — a compact brand band across the card top. Bleeds to
          the card edges (negative margins match the px="$7"/pt="$8" padding),
          masked by the card's overflow:hidden + rounding. Slimmer than the old
          176px band so the card reads as a clean pricing card on a phone, a
          touch taller at md+. */}
      <View
        position="relative"
        mx={-39}
        mt={-46}
        mb="$6"
        height={120}
        $md={{ height: 152 }}
        overflow="hidden"
        borderBottomWidth={1}
        borderColor="$borderColor"
        bg="$muted"
        items="center"
        justify="center"
      >
        {/* Fixed-size orbital, centered + sized to sit inside the band so the
            outer ring isn't clipped. Scales up a touch at md+. */}
        <View width={112} height={112} $md={{ width: 144, height: 144 }}>
          <OrbitIllustration tier={tier} />
        </View>
      </View>

      {/* Plan name + description */}
      <YStack gap="$2">
        <H3
          fontSize={32}
          lineHeight={32 * 1.05}
          letterSpacing={-0.6}
          color="$color"
          style={{ fontFamily: "var(--font-display)", fontWeight: 600 }}
        >
          {plan.displayName}
        </H3>
        {plan.description && (
          <Paragraph fontSize="$2" color="$mutedForeground">
            {plan.description}
          </Paragraph>
        )}
      </YStack>

      {/* Price block — tabular mono. Hub stores Polar/Stripe minor units;
          formatPlanPrice handles the /100 conversion for both USD and IDR. */}
      <XStack mt="$7" items="baseline" gap="$2">
        <Text
          fontFamily="$mono"
          fontSize={48}
          fontWeight="500"
          lineHeight={48}
          letterSpacing={-1}
          color="$color"
        >
          {plan.isFreeTier
            ? "Free"
            : price === null
              ? "Custom"
              : formatPlanPrice(price, plan.currency)}
        </Text>
        {!plan.isFreeTier && price !== null && (
          <Text fontSize="$3" color="$mutedForeground">
            per {cycle === "monthly" ? "month" : "year"}
          </Text>
        )}
      </XStack>
      {plan.trialDays && plan.trialDays > 0 && !plan.isFreeTier && (
        <Text mt="$2" fontSize="$1" color="$mutedForeground">
          {plan.trialDays}-day free trial first. No card today.
        </Text>
      )}

      {/* Hairline */}
      <Separator my="$7" />

      {/* Bullets — natural height. */}
      <YStack gap="$3">
        {bullets.map((b) => (
          <XStack key={b} items="flex-start" gap="$3">
            <View
              mt="$0.5"
              width={16}
              height={16}
              shrink={0}
              items="center"
              justify="center"
              rounded={9999}
              bg={plan.isFeatured ? "$color" : "$muted"}
            >
              <Text
                color={plan.isFeatured ? "$background" : "$mutedForeground"}
                lineHeight={0}
              >
                <Check size={10} strokeWidth={3.5} />
              </Text>
            </View>
            <Text flex={1} fontSize="$2" color="$color">
              {b}
            </Text>
          </XStack>
        ))}
      </YStack>

      {/* Spacer pushes the CTA to the bottom of equal-height cards. Empty,
          so flex:1's zero basis can't collapse any content (unlike putting
          flex={1} on the bullet list itself). */}
      <View flex={1} />

      {/* Active-org label — only when the user has multiple orgs, so they
          know which workspace gets billed. Single-org users see nothing. */}
      {showActiveOrgLabel && !isCurrent && !plan.isFreeTier && (
        <XStack
          mt="$6"
          self="flex-start"
          items="center"
          gap="$1.5"
          rounded={9999}
          borderWidth={1}
          borderColor="$borderColor"
          bg="$muted"
          px="$2.5"
          py="$1"
        >
          <Text color="$mutedForeground" lineHeight={0}>
            <Building2 size={12} strokeWidth={2} />
          </Text>
          <Text fontSize="$1" color="$mutedForeground">
            Billing {org!.name}
          </Text>
        </XStack>
      )}

      {/* CTA */}
      <YStack mt="$8" gap="$3">
        {isCurrent ? (
          sub?.status === "trialing" ? (
            // The plan being trialed shouldn't dead-end with "Your current
            // plan" disabled — the user came here from the trial pill
            // wanting to do *something*. Surface the trial state plus a
            // portal link so they can update payment / cancel without
            // leaving the page.
            <TrialingActions
              onManage={() => void manageSubscription()}
              pending={portalPending}
            />
          ) : (
            <CurrentBadge />
          )
        ) : plan.isFreeTier ? (
          <DisabledChip>Free plan</DisabledChip>
        ) : price === null ? (
          <ContactSalesLink />
        ) : !canManage ? (
          <DisabledChip>Ask your admin to upgrade</DisabledChip>
        ) : (
          <Button
            intent={plan.isFeatured ? "primary" : "outline"}
            width="100%"
            loading={isPending}
            loadingText={ctaLoadingLabel}
            onPress={() =>
              void (hasPolarSubscription ? changePlan() : startCheckout())
            }
            iconAfter={<ArrowUpRight size={14} strokeWidth={2} />}
          >
            {ctaLabel}
          </Button>
        )}

        {/* Inline error surface — driven by structured BillingError codes
            from Hub. Reasons get specific, actionable copy; everything else
            falls back to the raw message so the failure isn't silent. */}
        {errorState && <CheckoutErrorBanner error={errorState} />}
      </YStack>
    </YStack>
  );
}

/**
 * Render a structured `BillingError` (or generic checkout failure) inline
 * under the upgrade button. Each `code` gets a tailored message + a follow-up
 * action when the user can fix the problem themselves.
 */
function CheckoutErrorBanner({
  error,
}: {
  error: { code: string | null; message: string };
}) {
  // Per-code overrides for messages whose Hub-side wording is too generic
  // for end-user UI, plus a follow-up `action` for cases the user can fix.
  const copy = explainBillingError(error.code);

  // Danger tint comes from the explicit $destructive tokens below — the kit
  // ships no "destructive" sub-theme (only light/dark/accent), so a theme
  // switch here would silently no-op.
  return (
    <YStack
      role="alert"
      mt="$3"
      rounded={16}
      borderWidth={1}
      borderColor="$destructive"
      bg="$destructiveMuted"
      p="$3"
    >
      <XStack items="flex-start" gap="$2">
        <Text mt="$0.5" color="$destructive" lineHeight={0} shrink={0}>
          <AlertCircle size={14} strokeWidth={2} />
        </Text>
        <YStack gap="$2">
          <Text fontSize="$1" color="$destructive">
            {copy?.message ?? error.message}
          </Text>
          {copy?.action}
        </YStack>
      </XStack>
    </YStack>
  );
}

/**
 * Follow-up action chip for the BILLING_EMAIL_REJECTED error. Internal nav
 * to the billing settings page via TanStack's useNavigate (client-side).
 * Rendered inside the destructive-themed banner, so the outline intent picks
 * up the danger tint from the surrounding theme.
 */
function UpdateBillingEmailButton() {
  const navigate = useNavigate();
  return (
    <XStack self="flex-start">
      <Button
        intent="outline"
        size="sm"
        onPress={() => void navigate({ to: "/settings/billing" })}
      >
        Update billing email
      </Button>
    </XStack>
  );
}

interface ErrorCopy {
  message: string;
  action?: React.ReactNode;
}

function explainBillingError(code: string | null): ErrorCopy | null {
  switch (code) {
    case "BILLING_EMAIL_REJECTED":
      return {
        message:
          "Your billing email's domain doesn't accept mail, so the payment provider can't send you a receipt. Update it before continuing.",
        action: <UpdateBillingEmailButton />,
      };
    case "PERSONAL_ORG_INELIGIBLE_PLAN":
      return {
        message:
          "This plan is only available on team workspaces. Switch to a team org or pick a different plan.",
      };
    case "POLAR_PRODUCT_TEAM_TYPE":
      return {
        message:
          "This plan is misconfigured on the billing provider. We've logged the issue — please contact support so we can fix it for you.",
      };
    case "EXISTING_SUBSCRIPTION_USE_PORTAL":
      // Defensive: the card already routes existing subscribers through
      // change-plan, so this only fires if state is mid-flight (just
      // upgraded / webhook hasn't refreshed the claim yet). Tell the user
      // to retry rather than silently no-op.
      return {
        message:
          "Your subscription was just updated. Refresh the page to see the new plan.",
      };
    case "NO_ACTIVE_SUBSCRIPTION":
      return {
        message:
          "We couldn't find an active subscription to change. Refresh the page and try again.",
      };
    case null:
      return null;
    default:
      // Unknown code — fall through to the raw Hub message rather than
      // hiding it. New error codes ship without an SDK release this way.
      return null;
  }
}

function CurrentBadge() {
  return (
    <XStack
      height={48}
      width="100%"
      items="center"
      justify="center"
      gap="$2"
      rounded={9999}
      borderWidth={1}
      borderStyle="dashed"
      borderColor="$borderColor"
      bg="$muted"
    >
      <View width={6} height={6} rounded={9999} bg="$mutedForeground" />
      <Text fontSize="$3" fontWeight="500" color="$mutedForeground">
        Your current plan
      </Text>
    </XStack>
  );
}

/**
 * Replaces the disabled "Your current plan" badge for the plan that's
 * currently in trial. Trialing users don't need to take action to keep
 * their plan — Polar auto-charges at trial end if a card was captured —
 * but the page came from a "Click to upgrade" trial pill, so the affordance
 * here is "manage your subscription" (cancel, update card) via the Polar
 * portal. Other plan cards on the page stay clickable for tier switches
 * via change-plan.
 */
function TrialingActions({
  onManage,
  pending,
}: {
  onManage: () => void;
  pending: boolean;
}) {
  return (
    <YStack gap="$2">
      <XStack
        height={48}
        width="100%"
        items="center"
        justify="center"
        gap="$2"
        rounded={9999}
        borderWidth={1}
        borderColor="$warning"
        bg="$warningMuted"
      >
        <Text color="$warning" lineHeight={0}>
          <Sparkles size={14} strokeWidth={2} />
        </Text>
        <Text fontSize="$3" fontWeight="500" color="$warning">
          Currently trialing this plan
        </Text>
      </XStack>
      <Button
        intent="ghost"
        size="sm"
        disabled={pending}
        onPress={onManage}
        iconAfter={<ExternalLink size={12} strokeWidth={2} />}
      >
        {pending ? "Opening…" : "Manage subscription"}
      </Button>
    </YStack>
  );
}

function DisabledChip({ children }: { children: React.ReactNode }) {
  return (
    <XStack
      height={48}
      width="100%"
      items="center"
      justify="center"
      rounded={9999}
      borderWidth={1}
      borderColor="$borderColor"
      bg="$muted"
    >
      <Text fontSize="$3" fontWeight="500" color="$mutedForeground">
        {children}
      </Text>
    </XStack>
  );
}

function ContactSalesLink() {
  // External mailto — kit Button with a direct top-level navigation, since
  // the kit Button isn't an anchor and asChild would leak style props.
  return (
    <Button
      intent="outline"
      width="100%"
      onPress={() => {
        openURL("mailto:hello@meridian.app");
      }}
    >
      Contact sales
    </Button>
  );
}

// ─── helpers ──────────────────────────────────────────────────────────────────

/**
 * Derive a short bullet list per plan. Mirrors the SDK's planBullets()
 * algorithm (highlightedFeatures > catalog × per-plan values > nothing) so
 * the custom card renders the same copy the SDK's PlanCard would.
 */
function derivePlanBullets(
  plan: PricingPlan,
  catalog: ProductFeature[],
  max: number,
): string[] {
  if (plan.highlightedFeatures && plan.highlightedFeatures.length > 0) {
    return plan.highlightedFeatures.slice(0, max);
  }
  const bag = plan.features ?? {};
  const out: string[] = [];
  const sorted = [...catalog].sort(
    (a, b) =>
      a.sortOrder - b.sortOrder || a.displayName.localeCompare(b.displayName),
  );
  for (const f of sorted) {
    if (out.length >= max) break;
    if (!(f.slug in bag)) continue;
    const v = bag[f.slug];
    if (f.valueType === "boolean") {
      if (v === true) out.push(f.displayName);
    } else if (f.valueType === "number") {
      if (v === null) out.push(`Unlimited ${f.displayName.toLowerCase()}`);
      else if (typeof v === "number")
        out.push(
          `${v.toLocaleString()}${f.unit ? ` ${f.unit}` : ""} ${f.displayName.toLowerCase()}`,
        );
    } else if (f.valueType === "text") {
      if (typeof v === "string" && v.length > 0)
        out.push(`${v} ${f.displayName.toLowerCase()}`);
    }
  }
  return out;
}
