"use client";

import { useRef, useCallback } from "react";
import { motion, useMotionValue, useSpring, useTransform } from "motion/react";

/* ── Orbiting arc lines — each rotates around the shared center ── */
const ARC_ORBITS = [
  // Inner orbit — todo color
  {
    radius: 120,
    arcDeg: 200,
    stroke: 14,
    duration: 20,
    start: 0,
    color: "oklch(0.70 0.28 25 / 40%)",
  },
  {
    radius: 120,
    arcDeg: 90,
    stroke: 10,
    duration: 20,
    start: 240,
    color: "oklch(0.70 0.28 25 / 22%)",
  },
  // Mid-inner orbit — habit color
  {
    radius: 160,
    arcDeg: 220,
    stroke: 15,
    duration: 26,
    start: 80,
    color: "oklch(0.78 0.21 55 / 40%)",
  },
  {
    radius: 160,
    arcDeg: 80,
    stroke: 10,
    duration: 26,
    start: 340,
    color: "oklch(0.78 0.21 55 / 20%)",
  },
  // Mid orbit — journal color
  {
    radius: 205,
    arcDeg: 190,
    stroke: 14,
    duration: 32,
    start: 30,
    color: "oklch(0.85 0.18 85 / 35%)",
  },
  {
    radius: 205,
    arcDeg: 100,
    stroke: 10,
    duration: 32,
    start: 270,
    color: "oklch(0.85 0.18 85 / 18%)",
  },
  // Mid-outer orbit — todo
  {
    radius: 255,
    arcDeg: 210,
    stroke: 13,
    duration: 24,
    start: 140,
    color: "oklch(0.70 0.28 25 / 28%)",
  },
  {
    radius: 255,
    arcDeg: 85,
    stroke: 9,
    duration: 24,
    start: 0,
    color: "oklch(0.70 0.28 25 / 14%)",
  },
  // Outer orbit — habit
  {
    radius: 310,
    arcDeg: 200,
    stroke: 12,
    duration: 30,
    start: 50,
    color: "oklch(0.78 0.21 55 / 22%)",
  },
  {
    radius: 310,
    arcDeg: 90,
    stroke: 8,
    duration: 30,
    start: 300,
    color: "oklch(0.78 0.21 55 / 12%)",
  },
];

const TAGLINES = [
  "Track your daily momentum",
  "Build habits that last",
  "Every day, a new beginning",
];

const SPRING_CONFIG = { damping: 40, stiffness: 150, mass: 1 };

/** SVG arc path from startDeg spanning arcDeg, centered at (cx,cy) */
function arcPath(
  cx: number,
  cy: number,
  r: number,
  startDeg: number,
  arcDeg: number,
): string {
  const toRad = (d: number) => ((d - 90) * Math.PI) / 180;
  const x1 = cx + r * Math.cos(toRad(startDeg));
  const y1 = cy + r * Math.sin(toRad(startDeg));
  const x2 = cx + r * Math.cos(toRad(startDeg + arcDeg));
  const y2 = cy + r * Math.sin(toRad(startDeg + arcDeg));
  return `M ${x1} ${y1} A ${r} ${r} 0 ${arcDeg > 180 ? 1 : 0} 1 ${x2} ${y2}`;
}

export function AuthShowcase() {
  const containerRef = useRef<HTMLDivElement>(null);

  const mouseX = useMotionValue(0.5);
  const mouseY = useMotionValue(0.5);
  const smoothX = useSpring(mouseX, SPRING_CONFIG);
  const smoothY = useSpring(mouseY, SPRING_CONFIG);

  const gridX = useTransform(smoothX, [0, 1], [10, -10]);
  const gridY = useTransform(smoothY, [0, 1], [10, -10]);
  const orbitX = useTransform(smoothX, [0, 1], [18, -18]);
  const orbitY = useTransform(smoothY, [0, 1], [18, -18]);
  const contentX = useTransform(smoothX, [0, 1], [4, -4]);
  const contentY = useTransform(smoothY, [0, 1], [4, -4]);

  const glowX = useMotionValue(0);
  const glowY = useMotionValue(0);
  const glowOpacity = useMotionValue(0);
  const smoothGlowX = useSpring(glowX, { damping: 25, stiffness: 250 });
  const smoothGlowY = useSpring(glowY, { damping: 25, stiffness: 250 });
  const smoothGlowOpacity = useSpring(glowOpacity, {
    damping: 30,
    stiffness: 200,
  });

  const handleMouseMove = useCallback(
    (e: React.MouseEvent<HTMLDivElement>) => {
      const rect = containerRef.current?.getBoundingClientRect();
      if (!rect) return;
      mouseX.set((e.clientX - rect.left) / rect.width);
      mouseY.set((e.clientY - rect.top) / rect.height);
      glowX.set(e.clientX - rect.left);
      glowY.set(e.clientY - rect.top);
      glowOpacity.set(1);
    },
    [mouseX, mouseY, glowX, glowY, glowOpacity],
  );

  const handleMouseLeave = useCallback(() => {
    mouseX.set(0.5);
    mouseY.set(0.5);
    glowOpacity.set(0);
  }, [mouseX, mouseY, glowOpacity]);

  // SVG size for orbiting arcs — large enough for the biggest orbit
  const svgSize = 700;
  const cx = svgSize / 2;

  return (
    <div
      ref={containerRef}
      onMouseMove={handleMouseMove}
      onMouseLeave={handleMouseLeave}
      className="relative hidden lg:flex flex-col items-center justify-center overflow-hidden bg-[oklch(0.11_0.02_30)]"
    >
      {/* Cursor glow */}
      <motion.div
        className="absolute rounded-full pointer-events-none"
        style={{
          width: 400,
          height: 400,
          background:
            "radial-gradient(circle, oklch(0.45 0.12 45 / 14%) 0%, transparent 70%)",
          left: smoothGlowX,
          top: smoothGlowY,
          x: "-50%",
          y: "-50%",
          opacity: smoothGlowOpacity,
          zIndex: 5,
        }}
      />

      {/* Grid background */}
      <motion.div
        className="auth-showcase-grid absolute"
        style={{ x: gridX, y: gridY }}
      />

      {/* Ambient glow orbs */}
      <motion.div
        className="absolute rounded-full pointer-events-none"
        style={{
          top: "28%",
          left: "20%",
          width: 240,
          height: 240,
          filter: "blur(100px)",
          backgroundColor: "oklch(0.38 0.12 30)",
          x: orbitX,
          y: orbitY,
        }}
        animate={{ opacity: [0.08, 0.16, 0.08] }}
        transition={{ duration: 8, repeat: Infinity, ease: "easeInOut" }}
      />
      <motion.div
        className="absolute rounded-full pointer-events-none"
        style={{
          bottom: "22%",
          right: "18%",
          width: 200,
          height: 200,
          filter: "blur(90px)",
          backgroundColor: "oklch(0.35 0.10 55)",
          x: orbitX,
          y: orbitY,
        }}
        animate={{ opacity: [0.06, 0.14, 0.06] }}
        transition={{
          duration: 10,
          repeat: Infinity,
          ease: "easeInOut",
          delay: 3,
        }}
      />

      {/* Orbiting arc lines — CSS animation for reliable rotation */}
      <motion.div
        className="absolute pointer-events-none"
        style={{
          width: svgSize,
          height: svgSize,
          top: "50%",
          left: "50%",
          marginTop: -cx,
          marginLeft: -cx,
          x: orbitX,
          y: orbitY,
        }}
      >
        {ARC_ORBITS.map((arc, i) => {
          const d = arcPath(cx, cx, arc.radius, 0, arc.arcDeg);
          return (
            <svg
              key={i}
              width={svgSize}
              height={svgSize}
              viewBox={`0 0 ${svgSize} ${svgSize}`}
              className="absolute inset-0"
              style={{
                animation: `auth-orbit-spin ${arc.duration}s linear infinite`,
                animationDelay: `${-(arc.start / 360) * arc.duration}s`,
              }}
            >
              <path
                d={d}
                fill="none"
                stroke={arc.color}
                strokeWidth={arc.stroke}
                strokeLinecap="round"
              />
            </svg>
          );
        })}
      </motion.div>

      {/* Center content */}
      <motion.div
        className="relative z-10 flex flex-col items-center gap-5 px-12 text-center"
        style={{ x: contentX, y: contentY }}
      >
        <motion.h1
          className="text-3xl font-[family-name:var(--font-display)] text-white tracking-tight font-semibold"
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.35 }}
        >
          Meridian
        </motion.h1>

        {/* Rotating taglines */}
        <div className="relative h-7 flex items-center justify-center w-full">
          {TAGLINES.map((text, i) => (
            <motion.p
              key={i}
              className="absolute text-base font-[family-name:var(--font-display)] tracking-wide whitespace-nowrap"
              style={{ color: "oklch(0.60 0.04 50)" }}
              initial={{ opacity: 0 }}
              animate={{ opacity: [0, 0, 1, 1, 0, 0] }}
              transition={{
                duration: 9,
                repeat: Infinity,
                ease: "linear",
                times: [
                  i * 0.333,
                  i * 0.333 + 0.02,
                  i * 0.333 + 0.05,
                  (i + 1) * 0.333 - 0.05,
                  (i + 1) * 0.333 - 0.02,
                  (i + 1) * 0.333,
                ],
              }}
            >
              {text}
            </motion.p>
          ))}
        </div>
      </motion.div>
    </div>
  );
}
