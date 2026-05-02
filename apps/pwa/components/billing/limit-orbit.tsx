"use client";
import { cn } from "@/lib/utils";

/**
 * Diagnostic variant of the {@link OrbitIllustration}. Same three rings
 * (todos / habits / journal) but ONE pillar is highlighted at full
 * saturation while the other two fade to ghost. A pulsing "boundary
 * marker" plots a point on the highlighted ring — answering "which of
 * your three pillars did you hit a limit on?" at a glance.
 *
 * Used in the Meridian paywall modal. Keeps the visual vocabulary
 * identical to the billing/upgrade page (same rings, same accent
 * tokens) so the two surfaces feel like one publication.
 */
export function LimitOrbit({
  highlight,
  className,
}: {
  /** Which pillar to surface. `null` falls back to a neutral, all-ghost diagram. */
  highlight: "todos" | "habits" | "journal" | null;
  className?: string;
}) {
  return (
    <svg
      viewBox="0 0 240 240"
      role="presentation"
      aria-hidden
      className={cn("h-full w-full text-foreground/80", className)}
    >
      {/* Diagonal meridian — the line that gives the product its name. */}
      <line
        x1="20"
        y1="220"
        x2="220"
        y2="20"
        stroke="currentColor"
        strokeWidth="0.5"
        strokeDasharray="2 4"
        opacity="0.3"
      />

      {/* Center mark — "today" */}
      <circle cx="120" cy="120" r="2" fill="currentColor" opacity="0.85" />

      {/* TODO ring — outermost (radius 92) */}
      <Ring
        radius={92}
        color="todo"
        active={highlight === "todos"}
        delay={60}
      />
      {/* HABIT ring — middle (radius 64) */}
      <Ring
        radius={64}
        color="habit"
        active={highlight === "habits"}
        delay={180}
      />
      {/* JOURNAL ring — innermost (radius 38) */}
      <Ring
        radius={38}
        color="journal"
        active={highlight === "journal"}
        delay={300}
      />

      {/* Boundary marker — the "you are here" pulse on the gated ring.
          Angle picked at -45° (upper right) for clean geometry. */}
      {highlight && (
        <BoundaryMarker
          radius={highlight === "todos" ? 92 : highlight === "habits" ? 64 : 38}
          color={
            highlight === "todos"
              ? "todo"
              : highlight === "habits"
                ? "habit"
                : "journal"
          }
          delay={520}
        />
      )}

      {/* Cardinal tick marks — architectural reference */}
      {[0, 90, 180, 270].map((deg) => {
        const rad = (deg * Math.PI) / 180;
        const x1 = 120 + Math.cos(rad) * 110;
        const y1 = 120 + Math.sin(rad) * 110;
        const x2 = 120 + Math.cos(rad) * 116;
        const y2 = 120 + Math.sin(rad) * 116;
        return (
          <line
            key={deg}
            x1={x1}
            y1={y1}
            x2={x2}
            y2={y2}
            stroke="currentColor"
            strokeWidth="0.75"
            opacity="0.35"
          />
        );
      })}
    </svg>
  );
}

function Ring({
  radius,
  color,
  active,
  delay,
}: {
  radius: number;
  color: "todo" | "habit" | "journal";
  active: boolean;
  delay: number;
}) {
  const stroke =
    color === "todo"
      ? "var(--color-ring-todo, var(--ring-todo))"
      : color === "habit"
        ? "var(--color-ring-habit, var(--ring-habit))"
        : "var(--color-ring-journal, var(--ring-journal))";
  // strokeOpacity is independent from `opacity`; the orbit-draw keyframe
  // animates `opacity` to 1 at end, which would clobber an inline
  // `opacity: 0.22` and turn every "ghost" ring solid. Using
  // strokeOpacity sidesteps that — final visible alpha is opacity ×
  // strokeOpacity, so the active ring stays at 1 and the ghosts at 0.22.
  return (
    <circle
      className="orbit-arc"
      cx="120"
      cy="120"
      r={radius}
      fill="none"
      strokeOpacity={active ? 1 : 0.22}
      style={{
        stroke,
        animationDelay: `${delay}ms`,
      }}
      strokeWidth={active ? 1.75 : 1}
      strokeDasharray={active ? "1" : "3 4"}
      pathLength={1}
    />
  );
}

/**
 * "You are here" marker. A solid dot on the ring's circumference plus a
 * larger ring that pulses outward (`paywall-pulse` keyframe in
 * globals.css). Reads as: "this is the boundary you've hit."
 */
function BoundaryMarker({
  radius,
  color,
  delay,
}: {
  radius: number;
  color: "todo" | "habit" | "journal";
  delay: number;
}) {
  const angleDeg = -45;
  const rad = (angleDeg * Math.PI) / 180;
  const cx = 120 + Math.cos(rad) * radius;
  const cy = 120 + Math.sin(rad) * radius;
  const tone =
    color === "todo"
      ? "var(--color-ring-todo, var(--ring-todo))"
      : color === "habit"
        ? "var(--color-ring-habit, var(--ring-habit))"
        : "var(--color-ring-journal, var(--ring-journal))";
  return (
    <g
      className="paywall-boundary"
      style={{
        animationDelay: `${delay}ms`,
        transformOrigin: `${cx}px ${cy}px`,
      }}
    >
      <circle
        cx={cx}
        cy={cy}
        r="10"
        fill="none"
        stroke={tone}
        strokeWidth="1"
        opacity="0.45"
        className="paywall-pulse-ring"
      />
      <circle cx={cx} cy={cy} r="4.5" fill={tone} />
      <circle cx={cx} cy={cy} r="1.5" fill="var(--color-card, var(--card))" />
    </g>
  );
}
