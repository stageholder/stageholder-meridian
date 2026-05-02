"use client";
import type { PricingPlan, ProductFeature } from "@stageholder/sdk/react";
import { cn } from "@/lib/utils";
import { Check, Minus } from "lucide-react";

/**
 * Spec-sheet style comparison table. Reads like a printed datasheet —
 * monospaced category labels, hairline rules, no zebra rows, just type
 * and rules doing the work. Sticky header column lets the values scroll
 * laterally on narrow viewports without losing context.
 */
export function ComparisonSheet({
  plans,
  features,
}: {
  plans: PricingPlan[];
  features: ProductFeature[];
}) {
  if (plans.length === 0 || features.length === 0) return null;

  const grouped = groupByCategory(features);

  return (
    <div className="relative">
      {/* Section heading */}
      <div className="mb-8 flex flex-wrap items-baseline justify-between gap-3 border-b border-border/70 pb-4">
        <div className="space-y-1">
          <h2
            className="text-2xl tracking-tight"
            style={{ fontFamily: "var(--font-display)", fontWeight: 600 }}
          >
            Compare all features
          </h2>
          <p className="text-sm text-muted-foreground">
            Side-by-side breakdown of what&rsquo;s included in each plan.
          </p>
        </div>
      </div>

      <div className="-mx-2 overflow-x-auto pb-4">
        <table className="w-full min-w-[640px] border-separate border-spacing-0">
          <thead>
            <tr>
              <th className="sticky left-0 z-10 w-[34%] bg-background px-3 pb-4 text-left">
                <span className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                  Feature
                </span>
              </th>
              {plans.map((p) => (
                <th
                  key={p.id}
                  className="w-auto px-3 pb-4 text-left align-bottom"
                >
                  <div className="flex flex-col gap-1">
                    <span
                      className="text-base leading-none tracking-tight"
                      style={{
                        fontFamily: "var(--font-display)",
                        fontWeight: 600,
                      }}
                    >
                      {p.displayName}
                    </span>
                    {p.isFeatured && (
                      <span className="text-[10px] font-medium uppercase tracking-wide text-foreground/60">
                        Most popular
                      </span>
                    )}
                  </div>
                </th>
              ))}
            </tr>
          </thead>

          <tbody>
            {grouped.map(([category, group]) => (
              <CategoryRows
                key={category ?? "_uncat"}
                category={category}
                group={group}
                plans={plans}
              />
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function CategoryRows({
  category,
  group,
  plans,
}: {
  category: string | null;
  group: ProductFeature[];
  plans: PricingPlan[];
}) {
  return (
    <>
      <tr>
        <td
          colSpan={1 + plans.length}
          className="border-t-2 border-foreground/40 px-3 pt-7"
        >
          <span className="text-xs font-semibold uppercase tracking-wide text-foreground/70">
            {category ?? "Other"}
          </span>
        </td>
      </tr>
      {group.map((f) => (
        <tr key={f.id} className="group/row">
          <th
            scope="row"
            className={cn(
              "sticky left-0 z-10 bg-background px-3 py-3 text-left align-top text-[13px] font-medium",
              "border-t border-border/60",
            )}
          >
            <div className="flex flex-col gap-0.5">
              <span>{f.displayName}</span>
              {f.description && (
                <span className="text-[11px] font-normal text-muted-foreground">
                  {f.description}
                </span>
              )}
            </div>
          </th>
          {plans.map((p) => (
            <td
              key={p.id}
              className={cn(
                "px-3 py-3 align-top text-[13px] tabular-nums",
                "border-t border-border/60",
                "transition-colors duration-200 group-hover/row:bg-foreground/3",
              )}
            >
              <Cell plan={p} feature={f} />
            </td>
          ))}
        </tr>
      ))}
    </>
  );
}

function Cell({
  plan,
  feature,
}: {
  plan: PricingPlan;
  feature: ProductFeature;
}) {
  const value = (plan.features ?? {})[feature.slug];

  if (feature.valueType === "boolean") {
    if (value === true) {
      return (
        <span className="inline-flex size-4 items-center justify-center rounded-full bg-foreground text-background">
          <Check className="size-2.5" strokeWidth={3} />
        </span>
      );
    }
    return <Minus className="size-3 text-foreground/30" strokeWidth={2} />;
  }
  if (feature.valueType === "number") {
    if (value === null)
      return (
        <span className="text-[13px] font-medium text-foreground/85">
          Unlimited
        </span>
      );
    if (typeof value === "number") {
      return (
        <span className="text-[13px] font-medium tabular-nums text-foreground">
          {value.toLocaleString()}
          {feature.unit && (
            <span className="ml-1 text-xs text-foreground/55">
              {feature.unit}
            </span>
          )}
        </span>
      );
    }
    return <Minus className="size-3 text-foreground/30" strokeWidth={2} />;
  }
  if (
    feature.valueType === "text" &&
    typeof value === "string" &&
    value.length > 0
  ) {
    return <span className="text-foreground">{value}</span>;
  }
  return <Minus className="size-3 text-foreground/30" strokeWidth={2} />;
}

function groupByCategory(
  features: ProductFeature[],
): Array<[string | null, ProductFeature[]]> {
  const map = new Map<string | null, ProductFeature[]>();
  const sorted = [...features].sort(
    (a, b) =>
      a.sortOrder - b.sortOrder || a.displayName.localeCompare(b.displayName),
  );
  for (const f of sorted) {
    const k = f.category ?? null;
    const arr = map.get(k) ?? [];
    arr.push(f);
    map.set(k, arr);
  }
  return Array.from(map.entries());
}
