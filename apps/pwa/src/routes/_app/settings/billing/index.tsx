import { createFileRoute, Link } from "@tanstack/react-router";
import { ArrowLeft } from "lucide-react";
import { H1, Paragraph, Text, View, XStack, YStack } from "@stageholder/ui";
import { CurrentPlanHero } from "@/components/billing/current-plan-hero";
import { InvoiceLedger } from "@/components/billing/invoice-ledger";

/**
 * Meridian's billing dashboard. Composes two custom blocks built on SDK
 * hooks (`useSubscription`, `useInvoices`, `useBillingPortal`,
 * `useCanManageBilling`) — no high-level SDK component is mounted.
 *
 * The visual language is shared with /upgrade so the two surfaces feel
 * like one publication: editorial display type, mono ledger numbers,
 * orbital illustration tinted with Meridian's three product accents.
 */
export const Route = createFileRoute("/_app/settings/billing/")({
  component: BillingPage,
});

function BillingPage() {
  return (
    // allowlist: billing-paper texture (globals.css keyframe/bg, no token equivalent)
    <View
      position="relative"
      minH={"100vh" as never}
      bg="$background"
      className="billing-paper"
    >
      <YStack
        position="relative"
        z={10}
        mx="auto"
        maxW={1024}
        px="$4"
        py="$7"
        $md={{ py: "$9" }}
      >
        {/* Back link */}
        <View mb="$7">
          <Link to="/settings" style={{ textDecoration: "none" }}>
            <XStack
              items="center"
              gap="$1.5"
              transition="quick"
              // Text color cascades to the label + lucide icon (currentColor).
              // `color`/`fontSize` aren't in the View frame's prop type —
              // runtime CSS only — so they ride casts.
              {...({ fontSize: "$3", color: "$mutedForeground" } as object)}
              hoverStyle={{ color: "$color" } as never}
            >
              <ArrowLeft size={16} />
              <Text>Back to settings</Text>
            </XStack>
          </Link>
        </View>

        {/* Page header */}
        <XStack
          render="header"
          mb="$7"
          flexWrap="wrap"
          items="baseline"
          justify="space-between"
          gap="$4"
        >
          <View>
            {/* Editorial mono kicker (was Tailwind font-mono/tracking utils) —
                matches upgrade.tsx. */}
            <Text
              fontFamily="$mono"
              fontSize={11}
              textTransform="uppercase"
              letterSpacing={3.5}
              color="$mutedForeground"
            >
              Billing
            </Text>
            {/* Display heading (was Tailwind text-4xl/md:text-5xl); the display
                serif lives only as a CSS var (no kit font token). */}
            <H1
              mt="$2"
              fontSize={36}
              lineHeight={40}
              letterSpacing={-0.9}
              $md={{ fontSize: 48, lineHeight: 48, letterSpacing: -1.2 }}
              style={{ fontFamily: "var(--font-display)", fontWeight: 600 }}
            >
              Your subscription
            </H1>
          </View>
          <Paragraph maxW={320} fontSize="$3" color="$mutedForeground">
            Manage your plan, payment method, and invoices.
          </Paragraph>
        </XStack>

        <YStack gap="$7">
          <CurrentPlanHero />
          <InvoiceLedger />
        </YStack>

        {/* Footer mark */}
        <XStack
          render="footer"
          mt="$10"
          flexWrap="wrap"
          items="center"
          justify="space-between"
          gap="$2"
          borderTopWidth={1}
          borderColor="$borderColor"
          pt="$5"
        >
          <Text fontSize="$1" color="$mutedForeground">
            Meridian — personal productivity
          </Text>
          <Text fontSize="$1" color="$mutedForeground">
            Powered by Stageholder
          </Text>
        </XStack>
      </YStack>
    </View>
  );
}
