import { createFileRoute } from "@tanstack/react-router";
import { Sparkles } from "lucide-react";
import { H1, Paragraph, Text, View, XStack, YStack } from "@stageholder/ui";

/**
 * Public, auth-free billing-completion landing page.
 *
 * This is the `returnUrl` Polar redirects the SYSTEM BROWSER to after a
 * desktop user finishes checkout / portal management (see
 * `lib/billing-return.ts`). It must NOT require a session — the desktop user's
 * browser generally isn't logged into the web app, so an auth-gated page would
 * bounce them to login right after paying.
 *
 * It does no work beyond confirming success: the canonical subscription update
 * happens server-side via Polar's webhook → Hub, and the desktop app picks up
 * the new plan on its own when it regains focus (`useBillingReturnRefresh`).
 * So this page is deliberately static — "you're done, head back to the app."
 *
 * On web, checkout returns to the in-app `/settings/billing/success` route
 * instead (same tab, full rotate/bust), so this page is desktop-only in
 * practice — but it's a normal public route and harmless if hit directly.
 */
export const Route = createFileRoute("/_auth/billing/complete")({
  component: BillingCompletePage,
});

function BillingCompletePage() {
  return (
    <YStack minH={"100vh" as never} items="center" justify="center" px="$6">
      <YStack maxW={460} items="center">
        {/* Success accent — fixed hexes (no kit green token; same idiom as
            the billing success page's Sparkles glyph). Translucent fill reads
            in both light and dark. */}
        <XStack
          width={56}
          height={56}
          rounded={9999}
          items="center"
          justify="center"
          style={{ backgroundColor: "rgba(5, 150, 105, 0.12)" }}
        >
          <Text lineHeight={0} style={{ color: "#059669" }}>
            <Sparkles size={26} />
          </Text>
        </XStack>

        <H1
          mt="$5"
          fontSize="$8"
          fontWeight="600"
          letterSpacing={-0.5}
          text="center"
        >
          Payment complete
        </H1>

        <Paragraph mt="$3" fontSize="$4" color="$mutedForeground" text="center">
          Thanks &mdash; your purchase is confirmed. Head back to the Meridian
          app to see your new plan. It updates automatically the moment you
          return; you can close this tab.
        </Paragraph>

        <Text mt="$6" fontSize="$2" color="$mutedForeground" text="center">
          Nothing else to do here.
        </Text>
      </YStack>
    </YStack>
  );
}
