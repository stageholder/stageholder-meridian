import { cn } from "@/lib/utils";

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
    <div
      className={cn(
        "relative flex min-h-screen flex-col items-center justify-center overflow-hidden bg-background px-6",
        className,
      )}
    >
      {/* Atmospheric background */}
      <div className="pointer-events-none absolute inset-0">
        <div
          className="absolute auth-showcase-grid opacity-40 dark:opacity-20"
          style={{ inset: "-40px" }}
        />
        <div className="absolute left-1/2 top-0 h-full w-px -translate-x-1/2 bg-gradient-to-b from-transparent via-primary/20 to-transparent" />
        <div className="absolute left-1/2 top-1/2 h-[480px] w-[480px] -translate-x-1/2 -translate-y-1/2 rounded-full bg-primary/[0.04] blur-[100px]" />
      </div>

      {/* Content */}
      <div className="relative z-10 flex max-w-md flex-col items-center text-center">
        {children}
      </div>

      {/* Brand watermark */}
      <div className="auth-animate auth-stagger-8 absolute bottom-8 text-xs text-muted-foreground/50">
        Meridian
      </div>
    </div>
  );
}
