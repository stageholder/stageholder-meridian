"use client";

import { PricingTable } from "@stageholder/sdk/react";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";

/**
 * In-app pricing / plan selection. Renders the SDK's <PricingTable /> for
 * the meridian product. Selecting a paid plan kicks off Polar checkout via
 * the SDK's <UpgradeButton> internals; on success the user lands back here
 * with their new subscription claim active.
 *
 * The hub is the source of truth for which plan slug is the "recommended"
 * paid tier — the seed includes `meridian-unlimited` with `is_featured: true`,
 * so the SDK auto-highlights it. Pass `highlightPlan` to override.
 */
export default function UpgradePage() {
  return (
    <div className="container mx-auto max-w-5xl px-4 py-12">
      <div className="mb-8">
        <Link
          href="/app/settings/billing"
          className="inline-flex items-center gap-1.5 text-sm text-muted-foreground transition-colors hover:text-foreground"
        >
          <ArrowLeft className="size-3.5" />
          Billing
        </Link>
      </div>

      <div className="mb-10 text-center">
        <h1 className="text-3xl font-semibold tracking-tight">Choose a plan</h1>
        <p className="mt-2 text-muted-foreground">
          Upgrade or change your plan anytime. Cancel from the billing page.
        </p>
      </div>

      <PricingTable product="meridian" />
    </div>
  );
}
