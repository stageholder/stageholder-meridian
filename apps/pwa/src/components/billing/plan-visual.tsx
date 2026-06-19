import { View, XStack } from "@stageholder/ui";

/**
 * Plan-card header visual. A calm, legible tier indicator: three rounded bars
 * in Meridian's product-pillar colors (todo / habit / journal) over a warm
 * radial wash. Meridian ships TWO plans, so the visual is binary rather than a
 * progressive meter:
 *   - Free      → the three bars present but dimmed, faint wash (product "at rest")
 *   - Unlimited → all three bars at full color WITH a glow, warm wash ("in motion")
 * No bar is ever greyed-off — the difference is energy, not on/off — so the
 * paid card reads as "everything lit up."
 *
 * Web-only (PWA pricing card): CSS gradient + `color-mix` + box-shadow glow,
 * no kit equivalent, so they ride the style escape hatch.
 */
const PILLARS = [
  "var(--ring-todo)",
  "var(--ring-habit)",
  "var(--ring-journal)",
] as const;

export function PlanVisual({
  tier,
}: {
  tier: "rest" | "practice" | "conduct";
}) {
  // Anything that isn't the free "rest" tier reads as the full, lit plan.
  const lit = tier !== "rest";

  const wash = lit
    ? "radial-gradient(120% 150% at 50% 0%, color-mix(in oklch, var(--ring-habit) 40%, transparent), color-mix(in oklch, var(--ring-todo) 22%, transparent) 46%, transparent 76%)"
    : "radial-gradient(120% 150% at 50% 0%, color-mix(in oklch, var(--ring-todo) 12%, transparent), transparent 70%)";

  return (
    <View
      position="absolute"
      t={0}
      r={0}
      b={0}
      l={0}
      items="center"
      justify="center"
      style={{ background: wash } as object}
    >
      <XStack items="center" gap={10}>
        {PILLARS.map((color, i) => (
          <View
            key={i}
            width={lit ? 42 : 36}
            height={12}
            rounded={9999}
            transition="medium"
            style={
              lit
                ? {
                    backgroundColor: color,
                    boxShadow: `0 0 18px color-mix(in oklch, ${color} 60%, transparent)`,
                  }
                : {
                    backgroundColor: `color-mix(in oklch, ${color} 42%, transparent)`,
                  }
            }
          />
        ))}
      </XStack>
    </View>
  );
}
