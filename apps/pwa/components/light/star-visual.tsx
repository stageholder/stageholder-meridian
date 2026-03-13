"use client";

import { cn } from "@/lib/utils";

interface StarVisualProps {
  tier: number;
  size?: "xs" | "sm" | "md" | "lg" | "xl";
  animate?: boolean;
  className?: string;
}

const SIZES = { xs: 20, sm: 32, md: 48, lg: 64, xl: 96 };

export function StarVisual({
  tier,
  size = "md",
  animate = true,
  className,
}: StarVisualProps) {
  const t = Math.max(1, Math.min(10, tier));
  const px = SIZES[size];
  const id = `s${t}${size}${Math.random().toString(36).slice(2, 6)}`;

  return (
    <svg
      width={px}
      height={px}
      viewBox="0 0 100 100"
      className={cn("shrink-0", className)}
      aria-hidden
    >
      <defs>
        {/* Dark sky backdrop gradient — light mode only */}
        <radialGradient id={`${id}-bg`}>
          <stop offset="0%" stopColor="#070b1e" stopOpacity={0.95} />
          <stop offset="65%" stopColor="#070b1e" stopOpacity={0.92} />
          <stop offset="85%" stopColor="#070b1e" stopOpacity={0.7} />
          <stop offset="95%" stopColor="#070b1e" stopOpacity={0.3} />
          <stop offset="100%" stopColor="#070b1e" stopOpacity={0} />
        </radialGradient>
        <filter id={`${id}-glow`}>
          <feGaussianBlur stdDeviation="3" result="blur" />
          <feMerge>
            <feMergeNode in="blur" />
            <feMergeNode in="SourceGraphic" />
          </feMerge>
        </filter>
        <filter id={`${id}-hglow`}>
          <feGaussianBlur stdDeviation="5" result="blur" />
          <feMerge>
            <feMergeNode in="blur" />
            <feMergeNode in="blur" />
            <feMergeNode in="SourceGraphic" />
          </feMerge>
        </filter>
      </defs>

      {/* ── Light-mode dark sky portal ── */}
      <g className="dark:hidden">
        <circle cx={50} cy={50} r={49} fill={`url(#${id}-bg)`} />
        {/* Distant background stars */}
        <circle cx={18} cy={24} r={0.5} fill="#fff" opacity={0.3} />
        <circle cx={82} cy={30} r={0.4} fill="#fff" opacity={0.25} />
        <circle cx={25} cy={76} r={0.4} fill="#fff" opacity={0.2} />
        <circle cx={78} cy={72} r={0.5} fill="#fff" opacity={0.3} />
        <circle cx={14} cy={52} r={0.3} fill="#fff" opacity={0.2} />
        {/* Subtle edge ring */}
        <circle
          cx={50}
          cy={50}
          r={47}
          fill="none"
          stroke="#334155"
          strokeWidth={0.4}
          opacity={0.25}
        />
      </g>

      {/* ═══════ Tier 1: STARGAZER — a distant twinkling star ═══════ */}
      {t === 1 && (
        <>
          {/* Atmospheric halo */}
          <circle
            cx={50}
            cy={50}
            r={20}
            fill="#94a3b8"
            opacity={0.06}
            filter={`url(#${id}-glow)`}
          />
          {/* Cross twinkle */}
          <line
            x1={50}
            y1={28}
            x2={50}
            y2={72}
            stroke="#94a3b8"
            strokeWidth={1}
            opacity={0.45}
          />
          <line
            x1={28}
            y1={50}
            x2={72}
            y2={50}
            stroke="#94a3b8"
            strokeWidth={1}
            opacity={0.45}
          />
          <line
            x1={36}
            y1={36}
            x2={64}
            y2={64}
            stroke="#94a3b8"
            strokeWidth={0.5}
            opacity={0.25}
          />
          <line
            x1={64}
            y1={36}
            x2={36}
            y2={64}
            stroke="#94a3b8"
            strokeWidth={0.5}
            opacity={0.25}
          />
          {/* Core */}
          <circle cx={50} cy={50} r={5} fill="#cbd5e1" opacity={0.9} />
          <circle cx={50} cy={50} r={2.5} fill="#e2e8f0" />
          <circle cx={50} cy={50} r={1.2} fill="#ffffff" />
          {animate && (
            <>
              {/* Pulsing core glow */}
              <circle cx={50} cy={50} r={5} fill="#e2e8f0" opacity={0}>
                <animate
                  attributeName="opacity"
                  values="0;0.5;0"
                  dur="3s"
                  repeatCount="indefinite"
                />
                <animate
                  attributeName="r"
                  values="5;9;5"
                  dur="3s"
                  repeatCount="indefinite"
                />
              </circle>
              {/* Twinkling cross — vertical */}
              <line
                x1={50}
                y1={28}
                x2={50}
                y2={72}
                stroke="#e2e8f0"
                strokeWidth={1.5}
                opacity={0}
              >
                <animate
                  attributeName="opacity"
                  values="0;0.7;0"
                  dur="4s"
                  repeatCount="indefinite"
                />
              </line>
              {/* Twinkling cross — horizontal */}
              <line
                x1={28}
                y1={50}
                x2={72}
                y2={50}
                stroke="#e2e8f0"
                strokeWidth={1.5}
                opacity={0}
              >
                <animate
                  attributeName="opacity"
                  values="0;0.7;0"
                  dur="4s"
                  begin="2s"
                  repeatCount="indefinite"
                />
              </line>
            </>
          )}
        </>
      )}

      {/* ═══════ Tier 2: SPARK — electric energy with crackling sparks ═══════ */}
      {t === 2 && (
        <>
          {/* Electric field glow */}
          <circle
            cx={50}
            cy={50}
            r={22}
            fill="#ef4444"
            opacity={0.15}
            filter={`url(#${id}-glow)`}
          />
          {/* Main lightning bolt */}
          <path
            d="M 50 22 L 44 46 L 54 44 L 48 78 L 56 48 L 46 50 Z"
            fill="#ef4444"
            filter={`url(#${id}-glow)`}
          />
          <path
            d="M 50 22 L 44 46 L 54 44 L 48 78 L 56 48 L 46 50 Z"
            fill="#fca5a5"
            opacity={0.6}
          />
          {/* Branch sparks */}
          <line
            x1={44}
            y1={46}
            x2={34}
            y2={40}
            stroke="#ef4444"
            strokeWidth={1.2}
            opacity={0.5}
            strokeLinecap="round"
          />
          <line
            x1={56}
            y1={48}
            x2={66}
            y2={44}
            stroke="#ef4444"
            strokeWidth={1}
            opacity={0.4}
            strokeLinecap="round"
          />
          {/* Central hot point */}
          <circle cx={50} cy={47} r={3.5} fill="#ffffff" opacity={0.9} />
          {/* Crackling sparks */}
          {animate && (
            <>
              {[
                { x: 34, y: 32 },
                { x: 66, y: 38 },
                { x: 36, y: 62 },
                { x: 64, y: 58 },
                { x: 28, y: 48 },
                { x: 72, y: 52 },
              ].map((p, i) => (
                <circle
                  key={i}
                  cx={p.x}
                  cy={p.y}
                  r={1.5}
                  fill="#fca5a5"
                  opacity={0}
                >
                  <animate
                    attributeName="opacity"
                    values="0;1;0"
                    dur={`${0.5 + i * 0.25}s`}
                    begin={`${i * 0.3}s`}
                    repeatCount="indefinite"
                  />
                </circle>
              ))}
              {/* Electric pulse ring */}
              <circle
                cx={50}
                cy={50}
                r={18}
                fill="none"
                stroke="#ef4444"
                strokeWidth={1}
                opacity={0}
              >
                <animate
                  attributeName="opacity"
                  values="0;0.4;0"
                  dur="1.8s"
                  repeatCount="indefinite"
                />
                <animate
                  attributeName="r"
                  values="18;28;18"
                  dur="1.8s"
                  repeatCount="indefinite"
                />
              </circle>
            </>
          )}
        </>
      )}

      {/* ═══════ Tier 3: EMBER — a glowing hot coal ═══════ */}
      {t === 3 && (
        <>
          <defs>
            <radialGradient id={`${id}-ember`} cx="45%" cy="45%" r="55%">
              <stop offset="0%" stopColor="#fbbf24" />
              <stop offset="40%" stopColor="#f59e0b" />
              <stop offset="70%" stopColor="#dc2626" />
              <stop offset="100%" stopColor="#7f1d1d" />
            </radialGradient>
          </defs>
          {/* Heat shimmer */}
          <circle
            cx={50}
            cy={50}
            r={30}
            fill="#f59e0b"
            opacity={0.1}
            filter={`url(#${id}-glow)`}
          />
          {/* Ember body */}
          <ellipse cx={50} cy={52} rx={22} ry={18} fill={`url(#${id}-ember)`} />
          {/* Cracks of light */}
          <path
            d="M 38 48 Q 45 44 50 48 Q 55 52 62 48"
            stroke="#fbbf24"
            strokeWidth={1.5}
            fill="none"
            opacity={0.7}
          />
          <path
            d="M 42 56 Q 48 52 55 56"
            stroke="#fde68a"
            strokeWidth={1}
            fill="none"
            opacity={0.5}
          />
          <path
            d="M 36 52 Q 40 50 44 53"
            stroke="#fbbf24"
            strokeWidth={0.8}
            fill="none"
            opacity={0.4}
          />
          {/* Hot center glow */}
          <ellipse cx={48} cy={48} rx={8} ry={6} fill="#fbbf24" opacity={0.5} />
          <ellipse cx={48} cy={48} rx={4} ry={3} fill="#fde68a" opacity={0.7} />
          <ellipse
            cx={48}
            cy={48}
            rx={2}
            ry={1.5}
            fill="#ffffff"
            opacity={0.5}
          />
          {animate && (
            <>
              {/* Breathing glow */}
              <ellipse
                cx={50}
                cy={52}
                rx={22}
                ry={18}
                fill="#f59e0b"
                opacity={0}
              >
                <animate
                  attributeName="opacity"
                  values="0;0.25;0"
                  dur="2.5s"
                  repeatCount="indefinite"
                />
              </ellipse>
              {/* Rising heat particles */}
              {[40, 48, 56].map((x, i) => (
                <circle
                  key={i}
                  cx={x}
                  cy={36}
                  r={1.2}
                  fill="#f59e0b"
                  opacity={0}
                >
                  <animate
                    attributeName="cy"
                    values="36;22;14"
                    dur={`${2 + i * 0.4}s`}
                    repeatCount="indefinite"
                  />
                  <animate
                    attributeName="opacity"
                    values="0.7;0.3;0"
                    dur={`${2 + i * 0.4}s`}
                    repeatCount="indefinite"
                  />
                </circle>
              ))}
            </>
          )}
        </>
      )}

      {/* ═══════ Tier 4: FLAME — a dancing flame with blue-hot base ═══════ */}
      {t === 4 && (
        <>
          <defs>
            <linearGradient id={`${id}-flame`} x1="0" y1="1" x2="0" y2="0">
              <stop offset="0%" stopColor="#1e40af" stopOpacity={0.4} />
              <stop offset="8%" stopColor="#dc2626" />
              <stop offset="40%" stopColor="#f97316" />
              <stop offset="70%" stopColor="#fbbf24" />
              <stop offset="100%" stopColor="#fef3c7" />
            </linearGradient>
          </defs>
          {/* Flame glow */}
          <ellipse
            cx={50}
            cy={50}
            rx={24}
            ry={30}
            fill="#f97316"
            opacity={0.12}
            filter={`url(#${id}-glow)`}
          />
          {/* Outer flame */}
          <path
            d="M 50 16 C 38 30 30 48 34 62 C 36 70 42 76 50 78 C 58 76 64 70 66 62 C 70 48 62 30 50 16 Z"
            fill={`url(#${id}-flame)`}
            opacity={0.85}
          >
            {animate && (
              <animate
                attributeName="d"
                values="M 50 16 C 38 30 30 48 34 62 C 36 70 42 76 50 78 C 58 76 64 70 66 62 C 70 48 62 30 50 16 Z;
                        M 50 18 C 36 32 32 46 35 61 C 37 69 43 75 50 77 C 57 75 63 69 65 61 C 68 46 64 32 50 18 Z;
                        M 50 14 C 39 28 28 50 33 63 C 35 71 41 77 50 79 C 59 77 65 71 67 63 C 72 50 61 28 50 14 Z;
                        M 50 16 C 38 30 30 48 34 62 C 36 70 42 76 50 78 C 58 76 64 70 66 62 C 70 48 62 30 50 16 Z"
                dur="1.8s"
                repeatCount="indefinite"
              />
            )}
          </path>
          {/* Inner flame */}
          <path
            d="M 50 32 C 44 42 40 52 42 60 C 44 66 46 70 50 72 C 54 70 56 66 58 60 C 60 52 56 42 50 32 Z"
            fill="#fde68a"
            opacity={0.8}
          >
            {animate && (
              <animate
                attributeName="d"
                values="M 50 32 C 44 42 40 52 42 60 C 44 66 46 70 50 72 C 54 70 56 66 58 60 C 60 52 56 42 50 32 Z;
                        M 50 34 C 43 44 41 50 43 59 C 45 65 47 69 50 71 C 53 69 55 65 57 59 C 59 50 57 44 50 34 Z;
                        M 50 30 C 45 40 39 53 41 61 C 43 67 45 71 50 73 C 55 71 57 67 59 61 C 61 53 55 40 50 30 Z;
                        M 50 32 C 44 42 40 52 42 60 C 44 66 46 70 50 72 C 54 70 56 66 58 60 C 60 52 56 42 50 32 Z"
                dur="1.5s"
                repeatCount="indefinite"
              />
            )}
          </path>
          {/* Hot core */}
          <ellipse cx={50} cy={62} rx={5} ry={4} fill="#ffffff" opacity={0.7} />
          {/* Blue-hot base hint */}
          <ellipse cx={50} cy={74} rx={6} ry={2} fill="#3b82f6" opacity={0.2} />
          {/* Floating embers */}
          {animate &&
            [
              { x: 40, delay: "0s" },
              { x: 58, delay: "0.8s" },
              { x: 46, delay: "1.6s" },
            ].map((p, i) => (
              <circle key={i} cx={p.x} cy={20} r={1} fill="#fbbf24" opacity={0}>
                <animate
                  attributeName="cy"
                  values="20;8;2"
                  dur="2.5s"
                  begin={p.delay}
                  repeatCount="indefinite"
                />
                <animate
                  attributeName="opacity"
                  values="0.8;0.4;0"
                  dur="2.5s"
                  begin={p.delay}
                  repeatCount="indefinite"
                />
              </circle>
            ))}
        </>
      )}

      {/* ═══════ Tier 5: RADIANT — blazing sun with varied corona ═══════ */}
      {t === 5 && (
        <>
          <defs>
            <radialGradient id={`${id}-sun`} cx="50%" cy="50%" r="50%">
              <stop offset="0%" stopColor="#ffffff" stopOpacity={0.9} />
              <stop offset="30%" stopColor="#fbbf24" />
              <stop offset="60%" stopColor="#f97316" />
              <stop offset="100%" stopColor="#ea580c" stopOpacity={0.6} />
            </radialGradient>
          </defs>
          {/* Outer corona glow */}
          <circle
            cx={50}
            cy={50}
            r={38}
            fill="#f97316"
            opacity={0.08}
            filter={`url(#${id}-glow)`}
          />
          {/* Corona rays — varied lengths */}
          {[
            0, 30, 45, 60, 90, 120, 135, 150, 180, 210, 225, 240, 270, 300, 315,
            330,
          ].map((angle, i) => {
            const rad = (angle * Math.PI) / 180;
            const isPrimary = angle % 90 === 0;
            const isSecondary = angle % 45 === 0 && !isPrimary;
            const len = isPrimary ? 42 : isSecondary ? 34 : 28;
            const w = isPrimary ? 3 : isSecondary ? 2 : 1.2;
            return (
              <line
                key={angle}
                x1={50 + Math.cos(rad) * 20}
                y1={50 + Math.sin(rad) * 20}
                x2={50 + Math.cos(rad) * len}
                y2={50 + Math.sin(rad) * len}
                stroke={isPrimary ? "#fbbf24" : "#f97316"}
                strokeWidth={w}
                strokeLinecap="round"
                opacity={0.55}
              >
                {animate && (
                  <animate
                    attributeName="opacity"
                    values="0.35;0.75;0.35"
                    dur={`${1.5 + i * 0.12}s`}
                    repeatCount="indefinite"
                  />
                )}
              </line>
            );
          })}
          {/* Sun body */}
          <circle cx={50} cy={50} r={18} fill={`url(#${id}-sun)`} />
          {/* Surface detail — sunspots */}
          <circle cx={44} cy={46} r={2.5} fill="#ea580c" opacity={0.2} />
          <circle cx={56} cy={54} r={1.8} fill="#ea580c" opacity={0.15} />
          {/* Inner glow */}
          <circle cx={50} cy={50} r={10} fill="#fde68a" opacity={0.5} />
          <circle cx={50} cy={50} r={5} fill="#ffffff" opacity={0.6} />
        </>
      )}

      {/* ═══════ Tier 6: FLARE — solar flare with dramatic eruptions ═══════ */}
      {t === 6 && (
        <>
          <defs>
            <radialGradient id={`${id}-flare`} cx="50%" cy="50%" r="50%">
              <stop offset="0%" stopColor="#ffffff" />
              <stop offset="30%" stopColor="#fde68a" />
              <stop offset="70%" stopColor="#eab308" />
              <stop offset="100%" stopColor="#a16207" stopOpacity={0} />
            </radialGradient>
          </defs>
          {/* Outer glow */}
          <circle
            cx={50}
            cy={50}
            r={42}
            fill="#eab308"
            opacity={0.06}
            filter={`url(#${id}-hglow)`}
          />
          {/* Flare eruptions — dramatic arcs */}
          {[
            { d: "M 28 36 Q 14 50 28 64", w: 3 },
            { d: "M 72 36 Q 86 50 72 64", w: 3 },
            { d: "M 36 24 Q 50 8 64 24", w: 2.5 },
            { d: "M 34 70 Q 50 86 66 70", w: 2 },
          ].map((arc, i) => (
            <path
              key={i}
              d={arc.d}
              stroke="#fbbf24"
              strokeWidth={arc.w}
              fill="none"
              opacity={0.5}
              filter={`url(#${id}-glow)`}
            >
              {animate && (
                <animate
                  attributeName="opacity"
                  values="0.25;0.7;0.25"
                  dur={`${2 + i * 0.5}s`}
                  repeatCount="indefinite"
                />
              )}
            </path>
          ))}
          {/* Starburst rays */}
          {[0, 30, 60, 90, 120, 150, 180, 210, 240, 270, 300, 330].map(
            (angle, i) => {
              const rad = (angle * Math.PI) / 180;
              const len = i % 3 === 0 ? 40 : i % 3 === 1 ? 32 : 27;
              return (
                <line
                  key={angle}
                  x1={50 + Math.cos(rad) * 16}
                  y1={50 + Math.sin(rad) * 16}
                  x2={50 + Math.cos(rad) * len}
                  y2={50 + Math.sin(rad) * len}
                  stroke="#fbbf24"
                  strokeWidth={i % 3 === 0 ? 2.5 : 1}
                  strokeLinecap="round"
                  opacity={0.45}
                />
              );
            },
          )}
          {/* Core */}
          <circle
            cx={50}
            cy={50}
            r={16}
            fill={`url(#${id}-flare)`}
            filter={`url(#${id}-glow)`}
          />
          <circle cx={50} cy={50} r={6} fill="#ffffff" opacity={0.85} />
          {/* Pulse */}
          {animate && (
            <circle cx={50} cy={50} r={16} fill="#fde68a" opacity={0}>
              <animate
                attributeName="opacity"
                values="0;0.3;0"
                dur="2.2s"
                repeatCount="indefinite"
              />
              <animate
                attributeName="r"
                values="16;24;16"
                dur="2.2s"
                repeatCount="indefinite"
              />
            </circle>
          )}
        </>
      )}

      {/* ═══════ Tier 7: NOVA — blue-white explosion edges ═══════ */}
      {t === 7 && (
        <>
          <defs>
            <radialGradient id={`${id}-nova`} cx="50%" cy="50%" r="50%">
              <stop offset="0%" stopColor="#ffffff" />
              <stop offset="25%" stopColor="#fef9c3" />
              <stop offset="60%" stopColor="#fbbf24" />
              <stop offset="100%" stopColor="#a16207" stopOpacity={0} />
            </radialGradient>
          </defs>
          <circle
            cx={50}
            cy={50}
            r={44}
            fill="#fbbf24"
            opacity={0.06}
            filter={`url(#${id}-hglow)`}
          />
          {/* Shockwave ring — blue-white */}
          <circle
            cx={50}
            cy={50}
            r={36}
            fill="none"
            stroke="#93c5fd"
            strokeWidth={1.5}
            opacity={0.35}
          >
            {animate && (
              <>
                <animate
                  attributeName="r"
                  values="26;42;26"
                  dur="3s"
                  repeatCount="indefinite"
                />
                <animate
                  attributeName="opacity"
                  values="0.45;0.08;0.45"
                  dur="3s"
                  repeatCount="indefinite"
                />
              </>
            )}
          </circle>
          {/* Second shockwave — gold */}
          {animate && (
            <circle
              cx={50}
              cy={50}
              r={30}
              fill="none"
              stroke="#fde68a"
              strokeWidth={1}
              opacity={0}
            >
              <animate
                attributeName="r"
                values="22;38;22"
                dur="3s"
                begin="1.5s"
                repeatCount="indefinite"
              />
              <animate
                attributeName="opacity"
                values="0.3;0;0.3"
                dur="3s"
                begin="1.5s"
                repeatCount="indefinite"
              />
            </circle>
          )}
          {/* Blue-white outer star burst */}
          <path
            d="M 50 6 L 55 40 L 94 50 L 55 60 L 50 94 L 45 60 L 6 50 L 45 40 Z"
            fill="#bfdbfe"
            opacity={0.2}
            filter={`url(#${id}-glow)`}
          />
          {/* Gold inner star burst */}
          <path
            d="M 50 18 L 53 42 L 82 50 L 53 58 L 50 82 L 47 58 L 18 50 L 47 42 Z"
            fill="#fef9c3"
            opacity={0.4}
          />
          {/* Core */}
          <circle
            cx={50}
            cy={50}
            r={14}
            fill={`url(#${id}-nova)`}
            filter={`url(#${id}-glow)`}
          />
          <circle cx={50} cy={50} r={6} fill="#ffffff" opacity={0.9} />
          {animate && (
            <>
              {/* Pulsing core */}
              <circle cx={50} cy={50} r={14} fill="#dbeafe" opacity={0}>
                <animate
                  attributeName="opacity"
                  values="0;0.35;0"
                  dur="2s"
                  repeatCount="indefinite"
                />
                <animate
                  attributeName="r"
                  values="14;22;14"
                  dur="2s"
                  repeatCount="indefinite"
                />
              </circle>
              {/* Orbiting debris — mixed blue & gold */}
              {[0, 72, 144, 216, 288].map((angle, i) => (
                <circle
                  key={i}
                  cx={50}
                  cy={50 - 34}
                  r={1.2}
                  fill={i % 2 === 0 ? "#93c5fd" : "#fde68a"}
                  opacity={0.7}
                >
                  <animateTransform
                    attributeName="transform"
                    type="rotate"
                    from={`${angle} 50 50`}
                    to={`${angle + 360} 50 50`}
                    dur={`${5 + i * 0.8}s`}
                    repeatCount="indefinite"
                  />
                </circle>
              ))}
            </>
          )}
        </>
      )}

      {/* ═══════ Tier 8: PULSAR — cyan beams + gold core ═══════ */}
      {t === 8 && (
        <>
          <defs>
            <radialGradient id={`${id}-pulsar`} cx="50%" cy="50%" r="50%">
              <stop offset="0%" stopColor="#ffffff" />
              <stop offset="30%" stopColor="#fef9c3" />
              <stop offset="60%" stopColor="#fde68a" />
              <stop offset="100%" stopColor="#ca8a04" stopOpacity={0} />
            </radialGradient>
          </defs>
          <circle
            cx={50}
            cy={50}
            r={44}
            fill="#22d3ee"
            opacity={0.04}
            filter={`url(#${id}-hglow)`}
          />
          {/* Primary beam — cyan */}
          <g opacity={0.55}>
            <ellipse
              cx={50}
              cy={50}
              rx={44}
              ry={3.5}
              fill="#22d3ee"
              filter={`url(#${id}-glow)`}
            >
              {animate && (
                <animateTransform
                  attributeName="transform"
                  type="rotate"
                  from="0 50 50"
                  to="360 50 50"
                  dur="4s"
                  repeatCount="indefinite"
                />
              )}
            </ellipse>
          </g>
          {/* Secondary beam — teal, perpendicular */}
          <g opacity={0.3}>
            <ellipse
              cx={50}
              cy={50}
              rx={38}
              ry={2.5}
              fill="#67e8f9"
              filter={`url(#${id}-glow)`}
            >
              {animate && (
                <animateTransform
                  attributeName="transform"
                  type="rotate"
                  from="90 50 50"
                  to="450 50 50"
                  dur="6s"
                  repeatCount="indefinite"
                />
              )}
            </ellipse>
          </g>
          {/* Accretion disk */}
          <ellipse
            cx={50}
            cy={50}
            rx={28}
            ry={8}
            fill="none"
            stroke="#fde68a"
            strokeWidth={1.2}
            opacity={0.2}
          >
            {animate && (
              <animateTransform
                attributeName="transform"
                type="rotate"
                from="30 50 50"
                to="390 50 50"
                dur="20s"
                repeatCount="indefinite"
              />
            )}
          </ellipse>
          {/* Magnetic field rings */}
          {[28, 36].map((r, i) => (
            <circle
              key={i}
              cx={50}
              cy={50}
              r={r}
              fill="none"
              stroke="#67e8f9"
              strokeWidth={0.6}
              opacity={0.15}
            />
          ))}
          {/* Core */}
          <circle
            cx={50}
            cy={50}
            r={12}
            fill={`url(#${id}-pulsar)`}
            filter={`url(#${id}-glow)`}
          />
          <circle cx={50} cy={50} r={5} fill="#ffffff" opacity={0.95} />
          {animate && (
            <circle cx={50} cy={50} r={12} fill="#a5f3fc" opacity={0}>
              <animate
                attributeName="opacity"
                values="0.4;0;0.4"
                dur="1.5s"
                repeatCount="indefinite"
              />
              <animate
                attributeName="r"
                values="12;18;12"
                dur="1.5s"
                repeatCount="indefinite"
              />
            </circle>
          )}
        </>
      )}

      {/* ═══════ Tier 9: SUPERNOVA — gold + violet nebula ═══════ */}
      {t === 9 && (
        <>
          <defs>
            <radialGradient id={`${id}-sn`} cx="50%" cy="50%" r="50%">
              <stop offset="0%" stopColor="#ffffff" />
              <stop offset="20%" stopColor="#fde68a" />
              <stop offset="50%" stopColor="#eab308" />
              <stop offset="100%" stopColor="#854d0e" stopOpacity={0} />
            </radialGradient>
          </defs>
          {/* Violet nebula cloud */}
          <ellipse
            cx={50}
            cy={50}
            rx={40}
            ry={36}
            fill="#a78bfa"
            opacity={0.06}
            filter={`url(#${id}-hglow)`}
          />
          <circle
            cx={50}
            cy={50}
            r={46}
            fill="#eab308"
            opacity={0.04}
            filter={`url(#${id}-hglow)`}
          />
          {/* Expanding shockwave */}
          {animate && (
            <>
              <circle
                cx={50}
                cy={50}
                r={30}
                fill="none"
                stroke="#fbbf24"
                strokeWidth={2}
                opacity={0}
              >
                <animate
                  attributeName="r"
                  values="20;46;20"
                  dur="3.5s"
                  repeatCount="indefinite"
                />
                <animate
                  attributeName="opacity"
                  values="0.5;0;0.5"
                  dur="3.5s"
                  repeatCount="indefinite"
                />
                <animate
                  attributeName="stroke-width"
                  values="3;0.5;3"
                  dur="3.5s"
                  repeatCount="indefinite"
                />
              </circle>
              {/* Secondary violet shockwave */}
              <circle
                cx={50}
                cy={50}
                r={24}
                fill="none"
                stroke="#c4b5fd"
                strokeWidth={1.5}
                opacity={0}
              >
                <animate
                  attributeName="r"
                  values="18;42;18"
                  dur="4s"
                  begin="1s"
                  repeatCount="indefinite"
                />
                <animate
                  attributeName="opacity"
                  values="0.3;0;0.3"
                  dur="4s"
                  begin="1s"
                  repeatCount="indefinite"
                />
              </circle>
            </>
          )}
          {/* Debris rays — explosive pattern with violet accents */}
          {Array.from({ length: 16 }).map((_, i) => {
            const angle = (i * 360) / 16;
            const rad = (angle * Math.PI) / 180;
            const len = i % 4 === 0 ? 44 : i % 2 === 0 ? 36 : 30;
            const w = i % 4 === 0 ? 3 : 1.5;
            const color =
              i % 5 === 0 ? "#c4b5fd" : i % 4 === 0 ? "#fde68a" : "#eab308";
            return (
              <line
                key={i}
                x1={50 + Math.cos(rad) * 14}
                y1={50 + Math.sin(rad) * 14}
                x2={50 + Math.cos(rad) * len}
                y2={50 + Math.sin(rad) * len}
                stroke={color}
                strokeWidth={w}
                strokeLinecap="round"
                opacity={0.5}
              >
                {animate && (
                  <animate
                    attributeName="opacity"
                    values="0.3;0.7;0.3"
                    dur={`${1.2 + i * 0.08}s`}
                    repeatCount="indefinite"
                  />
                )}
              </line>
            );
          })}
          {/* Inner nebula cloud */}
          <circle
            cx={50}
            cy={50}
            r={20}
            fill="#fbbf24"
            opacity={0.2}
            filter={`url(#${id}-hglow)`}
          />
          <ellipse
            cx={46}
            cy={52}
            rx={14}
            ry={10}
            fill="#a78bfa"
            opacity={0.08}
            filter={`url(#${id}-glow)`}
          />
          {/* Core */}
          <circle
            cx={50}
            cy={50}
            r={14}
            fill={`url(#${id}-sn)`}
            filter={`url(#${id}-glow)`}
          />
          <circle cx={50} cy={50} r={6} fill="#ffffff" opacity={0.95} />
          {/* Scattered debris particles — violet & gold mix */}
          {animate &&
            [0, 40, 80, 120, 170, 210, 260, 310].map((startAngle, i) => (
              <circle
                key={i}
                cx={50}
                cy={50 - (30 + (i % 3) * 4)}
                r={i % 3 === 0 ? 1.8 : 1.2}
                fill={i % 3 === 0 ? "#c4b5fd" : "#fde68a"}
                opacity={0.7}
              >
                <animateTransform
                  attributeName="transform"
                  type="rotate"
                  from={`${startAngle} 50 50`}
                  to={`${startAngle + 360} 50 50`}
                  dur={`${4.5 + i * 0.5}s`}
                  repeatCount="indefinite"
                />
              </circle>
            ))}
        </>
      )}

      {/* ═══════ Tier 10: MERIDIAN — prismatic transcendence ═══════ */}
      {t === 10 && (
        <>
          <defs>
            <radialGradient id={`${id}-m-core`} cx="50%" cy="50%" r="50%">
              <stop offset="0%" stopColor="#ffffff" />
              <stop offset="40%" stopColor="#fef3c7" />
              <stop offset="70%" stopColor="#fbbf24" />
              <stop offset="100%" stopColor="#f59e0b" />
            </radialGradient>
            <radialGradient id={`${id}-m-aura`} cx="50%" cy="50%" r="50%">
              <stop offset="0%" stopColor="#fbbf24" stopOpacity={0.3} />
              <stop offset="50%" stopColor="#f59e0b" stopOpacity={0.1} />
              <stop offset="100%" stopColor="#92400e" stopOpacity={0} />
            </radialGradient>
            <linearGradient id={`${id}-m-ring`} x1="0" y1="0" x2="1" y2="1">
              <stop offset="0%" stopColor="#fbbf24" />
              <stop offset="50%" stopColor="#ffffff" />
              <stop offset="100%" stopColor="#f59e0b" />
            </linearGradient>
          </defs>

          {/* Outer aura */}
          <circle cx={50} cy={50} r={48} fill={`url(#${id}-m-aura)`} />

          {/* Double expanding shockwaves */}
          {animate && (
            <>
              <circle
                cx={50}
                cy={50}
                r={30}
                fill="none"
                stroke="#fbbf24"
                strokeWidth={1.5}
                opacity={0}
              >
                <animate
                  attributeName="r"
                  values="20;48;20"
                  dur="5s"
                  repeatCount="indefinite"
                />
                <animate
                  attributeName="opacity"
                  values="0.4;0;0.4"
                  dur="5s"
                  repeatCount="indefinite"
                />
              </circle>
              <circle
                cx={50}
                cy={50}
                r={25}
                fill="none"
                stroke="#fde68a"
                strokeWidth={1}
                opacity={0}
              >
                <animate
                  attributeName="r"
                  values="18;44;18"
                  dur="4s"
                  begin="1.5s"
                  repeatCount="indefinite"
                />
                <animate
                  attributeName="opacity"
                  values="0.3;0;0.3"
                  dur="4s"
                  begin="1.5s"
                  repeatCount="indefinite"
                />
              </circle>
            </>
          )}

          {/* Prismatic orbital ring — color cycling */}
          <ellipse
            cx={50}
            cy={50}
            rx={38}
            ry={12}
            fill="none"
            stroke="#fbbf24"
            strokeWidth={1.5}
            opacity={0.5}
          >
            {animate && (
              <>
                <animateTransform
                  attributeName="transform"
                  type="rotate"
                  from="0 50 50"
                  to="360 50 50"
                  dur="12s"
                  repeatCount="indefinite"
                />
                <animate
                  attributeName="stroke"
                  values="#fbbf24;#f97316;#ef4444;#a855f7;#3b82f6;#06b6d4;#fbbf24"
                  dur="8s"
                  repeatCount="indefinite"
                />
              </>
            )}
          </ellipse>
          {/* Second orbital ring */}
          <ellipse
            cx={50}
            cy={50}
            rx={34}
            ry={10}
            fill="none"
            stroke="#fde68a"
            strokeWidth={1}
            opacity={0.3}
          >
            {animate && (
              <animateTransform
                attributeName="transform"
                type="rotate"
                from="60 50 50"
                to="420 50 50"
                dur="16s"
                repeatCount="indefinite"
              />
            )}
          </ellipse>
          {/* Third orbital ring — tilted */}
          <ellipse
            cx={50}
            cy={50}
            rx={30}
            ry={8}
            fill="none"
            stroke="#ffffff"
            strokeWidth={0.8}
            opacity={0.2}
          >
            {animate && (
              <animateTransform
                attributeName="transform"
                type="rotate"
                from="120 50 50"
                to="480 50 50"
                dur="10s"
                repeatCount="indefinite"
              />
            )}
          </ellipse>

          {/* Radiant rays */}
          {Array.from({ length: 16 }).map((_, i) => {
            const angle = (i * 360) / 16;
            const rad = (angle * Math.PI) / 180;
            const len = i % 4 === 0 ? 46 : i % 2 === 0 ? 38 : 32;
            return (
              <line
                key={i}
                x1={50 + Math.cos(rad) * 18}
                y1={50 + Math.sin(rad) * 18}
                x2={50 + Math.cos(rad) * len}
                y2={50 + Math.sin(rad) * len}
                stroke={i % 4 === 0 ? "#ffffff" : "#fbbf24"}
                strokeWidth={i % 4 === 0 ? 2.5 : 1.2}
                strokeLinecap="round"
                opacity={0.45}
              >
                {animate && (
                  <animate
                    attributeName="opacity"
                    values="0.2;0.65;0.2"
                    dur={`${2 + i * 0.15}s`}
                    repeatCount="indefinite"
                  />
                )}
              </line>
            );
          })}

          {/* Inner nebula glow */}
          <circle
            cx={50}
            cy={50}
            r={22}
            fill="#fbbf24"
            opacity={0.2}
            filter={`url(#${id}-hglow)`}
          />

          {/* Core celestial body */}
          <circle
            cx={50}
            cy={50}
            r={16}
            fill={`url(#${id}-m-core)`}
            filter={`url(#${id}-glow)`}
          />

          {/* Inner white-hot core */}
          <circle cx={50} cy={50} r={8} fill="#ffffff" opacity={0.9} />
          <circle cx={50} cy={50} r={4} fill="#ffffff" />

          {/* Lens flare */}
          {animate && (
            <ellipse
              cx={50}
              cy={50}
              rx={30}
              ry={1.5}
              fill="#ffffff"
              opacity={0.15}
            >
              <animateTransform
                attributeName="transform"
                type="rotate"
                from="0 50 50"
                to="360 50 50"
                dur="25s"
                repeatCount="indefinite"
              />
              <animate
                attributeName="opacity"
                values="0.1;0.25;0.1"
                dur="4s"
                repeatCount="indefinite"
              />
            </ellipse>
          )}

          {/* Breathing pulse */}
          {animate && (
            <circle cx={50} cy={50} r={16} fill="#fde68a" opacity={0}>
              <animate
                attributeName="r"
                values="16;24;16"
                dur="3s"
                repeatCount="indefinite"
              />
              <animate
                attributeName="opacity"
                values="0;0.3;0"
                dur="3s"
                repeatCount="indefinite"
              />
            </circle>
          )}

          {/* Orbiting particles — 3 orbital planes */}
          {animate && (
            <>
              {[0, 120, 240].map((angle, i) => (
                <circle
                  key={`a${i}`}
                  cx={50}
                  cy={50 - 36}
                  r={2}
                  fill="#ffffff"
                  opacity={0.8}
                >
                  <animateTransform
                    attributeName="transform"
                    type="rotate"
                    from={`${angle} 50 50`}
                    to={`${angle + 360} 50 50`}
                    dur={`${8 + i}s`}
                    repeatCount="indefinite"
                  />
                </circle>
              ))}
              {[45, 165, 285].map((angle, i) => (
                <circle
                  key={`b${i}`}
                  cx={50}
                  cy={50 - 30}
                  r={1.5}
                  fill="#fbbf24"
                  opacity={0.6}
                >
                  <animateTransform
                    attributeName="transform"
                    type="rotate"
                    from={`${angle} 50 50`}
                    to={`${angle + 360} 50 50`}
                    dur={`${10 + i}s`}
                    repeatCount="indefinite"
                  />
                </circle>
              ))}
              {[90, 210].map((angle, i) => (
                <circle
                  key={`c${i}`}
                  cx={50}
                  cy={50 - 42}
                  r={1}
                  fill="#a5f3fc"
                  opacity={0.5}
                >
                  <animateTransform
                    attributeName="transform"
                    type="rotate"
                    from={`${angle} 50 50`}
                    to={`${angle + 360} 50 50`}
                    dur={`${12 + i * 2}s`}
                    repeatCount="indefinite"
                  />
                </circle>
              ))}
            </>
          )}
        </>
      )}
    </svg>
  );
}
