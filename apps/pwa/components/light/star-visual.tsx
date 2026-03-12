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
        <filter id={`${id}-glow`}>
          <feGaussianBlur stdDeviation="3" result="blur" />
          <feMerge>
            <feMergeNode in="blur" />
            <feMergeNode in="SourceGraphic" />
          </feMerge>
        </filter>
        <filter id={`${id}-heavyglow`}>
          <feGaussianBlur stdDeviation="5" result="blur" />
          <feMerge>
            <feMergeNode in="blur" />
            <feMergeNode in="blur" />
            <feMergeNode in="SourceGraphic" />
          </feMerge>
        </filter>
      </defs>

      {/* ═══════ Tier 1: STARGAZER — a distant twinkling star in the night ═══════ */}
      {t === 1 && (
        <>
          {/* Faint cross twinkle */}
          <line
            x1={50}
            y1={32}
            x2={50}
            y2={68}
            stroke="#94a3b8"
            strokeWidth={1}
            opacity={0.4}
          />
          <line
            x1={32}
            y1={50}
            x2={68}
            y2={50}
            stroke="#94a3b8"
            strokeWidth={1}
            opacity={0.4}
          />
          <line
            x1={38}
            y1={38}
            x2={62}
            y2={62}
            stroke="#94a3b8"
            strokeWidth={0.5}
            opacity={0.25}
          />
          <line
            x1={62}
            y1={38}
            x2={38}
            y2={62}
            stroke="#94a3b8"
            strokeWidth={0.5}
            opacity={0.25}
          />
          {/* Core dot */}
          <circle cx={50} cy={50} r={4} fill="#cbd5e1" />
          <circle cx={50} cy={50} r={2} fill="#ffffff" />
          {animate && (
            <>
              <line
                x1={50}
                y1={32}
                x2={50}
                y2={68}
                stroke="#cbd5e1"
                strokeWidth={1.5}
                opacity={0}
              >
                <animate
                  attributeName="opacity"
                  values="0;0.6;0"
                  dur="4s"
                  repeatCount="indefinite"
                />
              </line>
              <line
                x1={32}
                y1={50}
                x2={68}
                y2={50}
                stroke="#cbd5e1"
                strokeWidth={1.5}
                opacity={0}
              >
                <animate
                  attributeName="opacity"
                  values="0;0.6;0"
                  dur="4s"
                  begin="2s"
                  repeatCount="indefinite"
                />
              </line>
            </>
          )}
        </>
      )}

      {/* ═══════ Tier 2: SPARK — electric spark with crackling energy ═══════ */}
      {t === 2 && (
        <>
          {/* Electric glow */}
          <circle
            cx={50}
            cy={50}
            r={18}
            fill="#ef4444"
            opacity={0.15}
            filter={`url(#${id}-glow)`}
          />
          {/* Lightning bolt shape */}
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
          {/* Central bright point */}
          <circle cx={50} cy={47} r={3} fill="#ffffff" opacity={0.9} />
          {/* Crackling sparks */}
          {animate && (
            <>
              {[
                { x: 36, y: 35 },
                { x: 64, y: 40 },
                { x: 38, y: 60 },
                { x: 62, y: 58 },
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
                    dur={`${0.6 + i * 0.3}s`}
                    begin={`${i * 0.4}s`}
                    repeatCount="indefinite"
                  />
                </circle>
              ))}
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
          {/* Ember body — irregular hot coal shape */}
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
          {/* Hot center glow */}
          <ellipse cx={48} cy={48} rx={8} ry={6} fill="#fbbf24" opacity={0.5} />
          <ellipse cx={48} cy={48} rx={4} ry={3} fill="#fde68a" opacity={0.7} />
          {animate && (
            <>
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
                  values="0;0.2;0"
                  dur="2.5s"
                  repeatCount="indefinite"
                />
              </ellipse>
              {/* Rising heat particles */}
              {[42, 50, 58].map((x, i) => (
                <circle key={i} cx={x} cy={36} r={1} fill="#f59e0b" opacity={0}>
                  <animate
                    attributeName="cy"
                    values="36;24;16"
                    dur={`${2 + i * 0.4}s`}
                    repeatCount="indefinite"
                  />
                  <animate
                    attributeName="opacity"
                    values="0.6;0.3;0"
                    dur={`${2 + i * 0.4}s`}
                    repeatCount="indefinite"
                  />
                </circle>
              ))}
            </>
          )}
        </>
      )}

      {/* ═══════ Tier 4: FLAME — a real dancing flame ═══════ */}
      {t === 4 && (
        <>
          <defs>
            <linearGradient id={`${id}-flame`} x1="0" y1="1" x2="0" y2="0">
              <stop offset="0%" stopColor="#dc2626" />
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
                        M 50 16 C 38 30 30 48 34 62 C 36 70 42 76 50 78 C 58 76 64 70 66 62 C 70 48 62 30 50 16 Z"
                dur="1.5s"
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
                        M 50 32 C 44 42 40 52 42 60 C 44 66 46 70 50 72 C 54 70 56 66 58 60 C 60 52 56 42 50 32 Z"
                dur="1.2s"
                repeatCount="indefinite"
              />
            )}
          </path>
          {/* Hot core */}
          <ellipse cx={50} cy={62} rx={5} ry={4} fill="#ffffff" opacity={0.7} />
        </>
      )}

      {/* ═══════ Tier 5: RADIANT — blazing sun with heat waves ═══════ */}
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
          {/* Heat waves */}
          <circle
            cx={50}
            cy={50}
            r={38}
            fill="#f97316"
            opacity={0.08}
            filter={`url(#${id}-glow)`}
          />
          {/* Wavy rays */}
          {[0, 45, 90, 135, 180, 225, 270, 315].map((angle, i) => {
            const rad = (angle * Math.PI) / 180;
            const x1 = 50 + Math.cos(rad) * 20;
            const y1 = 50 + Math.sin(rad) * 20;
            const x2 = 50 + Math.cos(rad) * 38;
            const y2 = 50 + Math.sin(rad) * 38;
            return (
              <line
                key={angle}
                x1={x1}
                y1={y1}
                x2={x2}
                y2={y2}
                stroke={i % 2 === 0 ? "#fbbf24" : "#f97316"}
                strokeWidth={i % 2 === 0 ? 3.5 : 2}
                strokeLinecap="round"
                opacity={0.6}
              >
                {animate && (
                  <animate
                    attributeName="opacity"
                    values="0.4;0.8;0.4"
                    dur={`${1.5 + i * 0.2}s`}
                    repeatCount="indefinite"
                  />
                )}
              </line>
            );
          })}
          {/* Sun body */}
          <circle cx={50} cy={50} r={18} fill={`url(#${id}-sun)`} />
          <circle cx={50} cy={50} r={10} fill="#fde68a" opacity={0.5} />
          <circle cx={50} cy={50} r={5} fill="#ffffff" opacity={0.6} />
        </>
      )}

      {/* ═══════ Tier 6: FLARE — solar flare eruption ═══════ */}
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
          {/* Flare eruptions — curved arcs shooting out */}
          <circle
            cx={50}
            cy={50}
            r={42}
            fill="#eab308"
            opacity={0.06}
            filter={`url(#${id}-heavyglow)`}
          />
          {[
            "M 30 38 Q 18 50 30 62",
            "M 70 38 Q 82 50 70 62",
            "M 38 28 Q 50 14 62 28",
          ].map((d, i) => (
            <path
              key={i}
              d={d}
              stroke="#fbbf24"
              strokeWidth={2.5}
              fill="none"
              opacity={0.5}
              filter={`url(#${id}-glow)`}
            >
              {animate && (
                <animate
                  attributeName="opacity"
                  values="0.3;0.7;0.3"
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
              const len = i % 3 === 0 ? 38 : i % 3 === 1 ? 30 : 26;
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
        </>
      )}

      {/* ═══════ Tier 7: NOVA — exploding star with shockwave ring ═══════ */}
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
            filter={`url(#${id}-heavyglow)`}
          />
          {/* Shockwave ring */}
          <circle
            cx={50}
            cy={50}
            r={36}
            fill="none"
            stroke="#fde68a"
            strokeWidth={1.5}
            opacity={0.3}
          >
            {animate && (
              <>
                <animate
                  attributeName="r"
                  values="28;40;28"
                  dur="3s"
                  repeatCount="indefinite"
                />
                <animate
                  attributeName="opacity"
                  values="0.4;0.1;0.4"
                  dur="3s"
                  repeatCount="indefinite"
                />
              </>
            )}
          </circle>
          {/* Star rays — 4-pointed star shape */}
          <path
            d="M 50 8 L 54 40 L 92 50 L 54 60 L 50 92 L 46 60 L 8 50 L 46 40 Z"
            fill="#fde68a"
            opacity={0.3}
            filter={`url(#${id}-glow)`}
          />
          <path
            d="M 50 20 L 53 42 L 80 50 L 53 58 L 50 80 L 47 58 L 20 50 L 47 42 Z"
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
            <circle cx={50} cy={50} r={14} fill="#fef9c3" opacity={0}>
              <animate
                attributeName="opacity"
                values="0;0.4;0"
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
          )}
        </>
      )}

      {/* ═══════ Tier 8: PULSAR — rotating beam star ═══════ */}
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
            fill="#fde68a"
            opacity={0.05}
            filter={`url(#${id}-heavyglow)`}
          />
          {/* Rotating beam */}
          <g opacity={0.5}>
            <ellipse
              cx={50}
              cy={50}
              rx={42}
              ry={4}
              fill="#fef9c3"
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
          {/* Second beam perpendicular */}
          <g opacity={0.3}>
            <ellipse
              cx={50}
              cy={50}
              rx={36}
              ry={3}
              fill="#ffffff"
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
          {/* Emission rings */}
          {[28, 36].map((r, i) => (
            <circle
              key={i}
              cx={50}
              cy={50}
              r={r}
              fill="none"
              stroke="#fde68a"
              strokeWidth={0.8}
              opacity={0.2}
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
            <circle cx={50} cy={50} r={12} fill="#fef9c3" opacity={0}>
              <animate
                attributeName="opacity"
                values="0.5;0;0.5"
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

      {/* ═══════ Tier 9: SUPERNOVA — massive explosion with expanding debris ═══════ */}
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
          {/* Expanding outer shockwave */}
          <circle
            cx={50}
            cy={50}
            r={46}
            fill="#eab308"
            opacity={0.05}
            filter={`url(#${id}-heavyglow)`}
          />
          {animate && (
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
          )}
          {/* Debris rays — explosive pattern */}
          {Array.from({ length: 16 }).map((_, i) => {
            const angle = (i * 360) / 16;
            const rad = (angle * Math.PI) / 180;
            const len = i % 4 === 0 ? 44 : i % 2 === 0 ? 36 : 30;
            const w = i % 4 === 0 ? 3 : 1.5;
            return (
              <line
                key={i}
                x1={50 + Math.cos(rad) * 14}
                y1={50 + Math.sin(rad) * 14}
                x2={50 + Math.cos(rad) * len}
                y2={50 + Math.sin(rad) * len}
                stroke={i % 4 === 0 ? "#fde68a" : "#eab308"}
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
          {/* Inner bright nebula cloud */}
          <circle
            cx={50}
            cy={50}
            r={20}
            fill="#fbbf24"
            opacity={0.2}
            filter={`url(#${id}-heavyglow)`}
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
          {/* Scattered debris particles */}
          {animate &&
            [0, 55, 110, 165, 220, 275, 330].map((startAngle, i) => (
              <circle
                key={i}
                cx={50}
                cy={50 - 34}
                r={1.5}
                fill="#fde68a"
                opacity={0.7}
              >
                <animateTransform
                  attributeName="transform"
                  type="rotate"
                  from={`${startAngle} 50 50`}
                  to={`${startAngle + 360} 50 50`}
                  dur={`${5 + i * 0.6}s`}
                  repeatCount="indefinite"
                />
              </circle>
            ))}
        </>
      )}

      {/* ═══════ Tier 10: MERIDIAN — the zenith, a transcendent celestial body ═══════ */}
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

          {/* Outer aura — fills almost the entire viewBox */}
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

          {/* Orbital ring — the meridian line itself */}
          <ellipse
            cx={50}
            cy={50}
            rx={38}
            ry={12}
            fill="none"
            stroke={`url(#${id}-m-ring)`}
            strokeWidth={1.5}
            opacity={0.5}
          >
            {animate && (
              <animateTransform
                attributeName="transform"
                type="rotate"
                from="0 50 50"
                to="360 50 50"
                dur="12s"
                repeatCount="indefinite"
              />
            )}
          </ellipse>
          {/* Second orbital ring — perpendicular */}
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

          {/* Radiant rays — alternating gold and white */}
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
            filter={`url(#${id}-heavyglow)`}
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

          {/* Orbiting celestial particles — 6 in two orbital planes */}
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
              {[60, 180, 300].map((angle, i) => (
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
            </>
          )}
        </>
      )}
    </svg>
  );
}
