"use client";
import { cn } from "@/lib/utils";

/**
 * Abstract "orbital chart" illustration. Renders the three Meridian pillars
 * (todos / habits / journal) as concentric rings tinted with the product
 * accent colors already defined in globals.css (`--ring-todo`,
 * `--ring-habit`, `--ring-journal`). Density grows with tier so the
 * Free card reads as a sparse pencil sketch and the featured card reads
 * as a full system in motion.
 *
 * Pure SVG — no images, no canvas, no runtime dependencies. The dash-draw
 * animation is keyframed in globals.css (`orbit-draw`), which is why each
 * arc carries a `pathLength={1}` and a `style.animationDelay`.
 */
export function OrbitIllustration({
  tier,
  className,
}: {
  tier: "rest" | "practice" | "conduct";
  className?: string;
}) {
  return (
    <svg
      viewBox="0 0 240 240"
      role="presentation"
      aria-hidden
      className={cn("h-full w-full text-foreground/80", className)}
    >
      {/* paper grid — barely there, gives the feeling of a planner page */}
      <defs>
        <pattern
          id="orbit-grid"
          x="0"
          y="0"
          width="12"
          height="12"
          patternUnits="userSpaceOnUse"
        >
          <circle
            cx="0.5"
            cy="0.5"
            r="0.5"
            fill="currentColor"
            opacity="0.18"
          />
        </pattern>
        <radialGradient id="orbit-fade" cx="50%" cy="50%" r="60%">
          <stop offset="40%" stopColor="white" stopOpacity="1" />
          <stop offset="100%" stopColor="white" stopOpacity="0" />
        </radialGradient>
        <mask id="orbit-mask">
          <rect width="240" height="240" fill="url(#orbit-fade)" />
        </mask>
      </defs>

      <rect
        width="240"
        height="240"
        fill="url(#orbit-grid)"
        mask="url(#orbit-mask)"
      />

      {/* meridian — the diagonal line that gives the product its name */}
      <line
        x1="20"
        y1="220"
        x2="220"
        y2="20"
        stroke="currentColor"
        strokeWidth="0.5"
        strokeDasharray="2 4"
        opacity="0.35"
      />

      {/* center point — the "today" marker */}
      <circle cx="120" cy="120" r="2" fill="currentColor" />

      {/* TODO ring — outermost. Stroke pulled from Meridian's product accent
          tokens via inline style so the SVG inherits whatever the host theme
          decides red/orange/gold should be (light vs dark). */}
      <circle
        className="orbit-arc"
        cx="120"
        cy="120"
        r="92"
        fill="none"
        style={{
          stroke: "var(--color-ring-todo, var(--ring-todo))",
          animationDelay: "60ms",
        }}
        strokeWidth="1.25"
        pathLength={1}
        strokeDasharray="1"
      />
      {tier !== "rest" && (
        <>
          {/* HABIT ring */}
          <circle
            className="orbit-arc"
            cx="120"
            cy="120"
            r="64"
            fill="none"
            style={{
              stroke: "var(--color-ring-habit, var(--ring-habit))",
              animationDelay: "180ms",
            }}
            strokeWidth="1.25"
            pathLength={1}
            strokeDasharray="1"
          />
        </>
      )}
      {tier === "conduct" && (
        <>
          {/* JOURNAL ring — innermost */}
          <circle
            className="orbit-arc"
            cx="120"
            cy="120"
            r="38"
            fill="none"
            style={{
              stroke: "var(--color-ring-journal, var(--ring-journal))",
              animationDelay: "300ms",
            }}
            strokeWidth="1.5"
            pathLength={1}
            strokeDasharray="1"
          />
        </>
      )}

      {/* Plotted points — like marking entries on a chart. Density per tier. */}
      <PlottedPoint cx="120" cy="28" color="todo" delay={420} />
      {tier !== "rest" && (
        <>
          <PlottedPoint cx="184" cy="76" color="habit" delay={500} />
          <PlottedPoint cx="64" cy="164" color="todo" delay={580} />
        </>
      )}
      {tier === "conduct" && (
        <>
          <PlottedPoint cx="158" cy="120" color="journal" delay={660} ring />
          <PlottedPoint cx="86" cy="86" color="habit" delay={740} />
          <PlottedPoint cx="148" cy="172" color="todo" delay={820} />
          {/* Constellation lines — only on the top tier, "everything connected" */}
          <line
            className="orbit-thread"
            x1="120"
            y1="28"
            x2="158"
            y2="120"
            stroke="currentColor"
            strokeWidth="0.6"
            strokeDasharray="2 3"
            opacity="0.45"
            pathLength={1}
            style={{ animationDelay: "880ms" }}
          />
          <line
            className="orbit-thread"
            x1="86"
            y1="86"
            x2="148"
            y2="172"
            stroke="currentColor"
            strokeWidth="0.6"
            strokeDasharray="2 3"
            opacity="0.45"
            pathLength={1}
            style={{ animationDelay: "940ms" }}
          />
        </>
      )}

      {/* Cardinal tick marks — an architect's reference */}
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
            opacity="0.4"
          />
        );
      })}
    </svg>
  );
}

function PlottedPoint({
  cx,
  cy,
  color,
  delay,
  ring = false,
}: {
  cx: number;
  cy: number;
  color: "todo" | "habit" | "journal";
  delay: number;
  ring?: boolean;
}) {
  const tone =
    color === "todo"
      ? "var(--color-ring-todo, var(--ring-todo))"
      : color === "habit"
        ? "var(--color-ring-habit, var(--ring-habit))"
        : "var(--color-ring-journal, var(--ring-journal))";
  return (
    <g
      className="orbit-point"
      style={{
        animationDelay: `${delay}ms`,
        transformOrigin: `${cx}px ${cy}px`,
      }}
    >
      {ring && (
        <circle
          cx={cx}
          cy={cy}
          r="6"
          fill="none"
          stroke={tone}
          strokeWidth="0.75"
          opacity="0.5"
        />
      )}
      <circle cx={cx} cy={cy} r="3" fill={tone} />
    </g>
  );
}
