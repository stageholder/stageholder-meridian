"use client";

import { BillingSettings } from "@stageholder/sdk/react";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";

/**
 * In-app billing settings — shows current plan summary, seat usage (when
 * applicable), management actions (Change plan, Manage payment), and the
 * invoice history. The "Change plan" link points to /upgrade which renders
 * the SDK's <PricingTable />.
 *
 * Replaces the previous "open the Hub in a new tab" link in the user menu.
 * Customers stay in Meridian for the entire upgrade flow except for the
 * Polar checkout itself.
 */
export default function BillingPage() {
  return (
    <div className="container mx-auto max-w-3xl px-4 py-8">
      <div className="mb-6">
        <Link
          href="/app/settings"
          className="inline-flex items-center gap-1.5 text-sm text-muted-foreground transition-colors hover:text-foreground"
        >
          <ArrowLeft className="size-3.5" />
          Settings
        </Link>
        <h1 className="mt-2 text-2xl font-semibold tracking-tight">Billing</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Your current plan, payment method, and invoice history.
        </p>
      </div>

      <BillingSettings changePlanHref="/app/settings/billing/upgrade" />
    </div>
  );
}
