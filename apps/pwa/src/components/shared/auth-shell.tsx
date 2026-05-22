import { Text, View, YStack } from "@stageholder/ui";

/**
 * Branded atmospheric shell for Meridian's auth-adjacent surfaces —
 * sign-in (desktop), sign-in errors, goodbye. Mirrors the full-bleed
 * treatment on the root `/not-found` page so the brand identity carries
 * through every entry/exit point Meridian still renders (the actual
 * login form lives on the Hub; these screens wrap the redirects).
 *
 * Slow-drifting grid + vertical meridian line + primary glow orb, with
 * the content floating above on a transparent layer. Animations use the
 * `auth-animate` + `auth-stagger-*` classes from globals.css, which
 * already honor `prefers-reduced-motion`.
 *
 * Children should be wrapped in individual `<div className="auth-animate
 * auth-stagger-N">` blocks to get the staggered reveal.
 */
export function AuthShell({
  children,
  className,
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <YStack
      position="relative"
      minH={"100vh" as never}
      items="center"
      justify="center"
      overflow="hidden"
      bg="$background"
      px="$6"
      // consumer passthrough (e.g. error/goodbye variants); allowlist-aware
      className={className}
    >
      {/* Atmospheric background */}
      <View position="absolute" t={0} b={0} l={0} r={0} pointerEvents="none">
        {/* allowlist: auth-showcase-grid keyframe (globals.css), dark-variant opacity */}
        <View
          position="absolute"
          className="auth-showcase-grid opacity-40 dark:opacity-20"
          style={{ inset: "-40px" }}
        />
        {/* allowlist: vertical meridian line — CSS gradient, no token equivalent */}
        <View
          position="absolute"
          t={0}
          height="100%"
          width={1}
          l="50%"
          className="-translate-x-1/2 bg-gradient-to-b from-transparent via-primary/20 to-transparent"
        />
        {/* allowlist: primary glow orb — translucency + heavy blur, no token equivalent */}
        <View
          position="absolute"
          t="50%"
          l="50%"
          height={480}
          width={480}
          rounded={9999}
          className="-translate-x-1/2 -translate-y-1/2 bg-primary/[0.04] blur-[100px]"
        />
      </View>

      {/* Content */}
      <YStack position="relative" z={10} maxW={448} items="center">
        {children}
      </YStack>

      {/* Brand watermark */}
      {/* allowlist: auth-animate + auth-stagger-8 keyframes (globals.css) */}
      <Text
        position="absolute"
        b="$6"
        fontSize="$1"
        color="$mutedForeground"
        opacity={0.5}
        className="auth-animate auth-stagger-8"
      >
        Meridian
      </Text>
    </YStack>
  );
}
