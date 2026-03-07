'use client';

import { cn } from '@/lib/utils';

interface StarVisualProps {
  tier: number;
  size?: 'xs' | 'sm' | 'md' | 'lg' | 'xl';
  animate?: boolean;
  className?: string;
}

const TIER_COLORS: Record<
  number,
  { core: string; glow: string; outer: string }
> = {
  1: { core: '#94a3b8', glow: '#cbd5e1', outer: '#64748b' },
  2: { core: '#fbbf24', glow: '#fde68a', outer: '#f59e0b' },
  3: { core: '#f59e0b', glow: '#fbbf24', outer: '#d97706' },
  4: { core: '#ef4444', glow: '#f97316', outer: '#dc2626' },
  5: { core: '#f97316', glow: '#fbbf24', outer: '#ea580c' },
  6: { core: '#ec4899', glow: '#f472b6', outer: '#db2777' },
  7: { core: '#8b5cf6', glow: '#a78bfa', outer: '#7c3aed' },
  8: { core: '#3b82f6', glow: '#60a5fa', outer: '#2563eb' },
  9: { core: '#eab308', glow: '#fde68a', outer: '#facc15' },
  10: { core: '#ffffff', glow: '#fde68a', outer: '#f59e0b' },
};

const SIZES = { xs: 20, sm: 32, md: 48, lg: 64, xl: 96 };

export function StarVisual({
  tier,
  size = 'md',
  animate = true,
  className,
}: StarVisualProps) {
  const t = Math.max(1, Math.min(10, tier));
  const colors = TIER_COLORS[t]!;
  const px = SIZES[size];
  const id = `star-${t}-${size}-${Math.random().toString(36).slice(2, 6)}`;

  return (
    <svg
      width={px}
      height={px}
      viewBox="0 0 100 100"
      className={cn('shrink-0', className)}
      aria-hidden
    >
      <defs>
        <radialGradient id={`${id}-bg`} cx="50%" cy="50%" r="50%">
          <stop offset="0%" stopColor={colors.glow} stopOpacity={0.4} />
          <stop offset="60%" stopColor={colors.outer} stopOpacity={0.15} />
          <stop offset="100%" stopColor={colors.outer} stopOpacity={0} />
        </radialGradient>
        <radialGradient id={`${id}-core`} cx="40%" cy="40%" r="60%">
          <stop offset="0%" stopColor="#ffffff" stopOpacity={0.9} />
          <stop offset="50%" stopColor={colors.core} stopOpacity={1} />
          <stop offset="100%" stopColor={colors.outer} stopOpacity={0.8} />
        </radialGradient>
        {t >= 6 && (
          <filter id={`${id}-blur`}>
            <feGaussianBlur stdDeviation="3" />
          </filter>
        )}
      </defs>

      {/* Tier 1: Stargazer — a small twinkling dot */}
      {t === 1 && (
        <>
          <circle cx={50} cy={50} r={12} fill={`url(#${id}-bg)`} />
          <circle cx={50} cy={50} r={5} fill={colors.core} opacity={0.7} />
          {animate && (
            <circle cx={50} cy={50} r={5} fill={colors.core}>
              <animate
                attributeName="opacity"
                values="0.5;1;0.5"
                dur="3s"
                repeatCount="indefinite"
              />
            </circle>
          )}
        </>
      )}

      {/* Tier 2: Spark — warm glowing dot */}
      {t === 2 && (
        <>
          <circle cx={50} cy={50} r={20} fill={`url(#${id}-bg)`} />
          <circle cx={50} cy={50} r={8} fill={`url(#${id}-core)`} />
          {animate && (
            <circle cx={50} cy={50} r={14} fill={colors.glow} opacity={0}>
              <animate
                attributeName="opacity"
                values="0;0.3;0"
                dur="2.5s"
                repeatCount="indefinite"
              />
              <animate
                attributeName="r"
                values="10;18;10"
                dur="2.5s"
                repeatCount="indefinite"
              />
            </circle>
          )}
        </>
      )}

      {/* Tier 3: Ember — pulsing warm orb */}
      {t === 3 && (
        <>
          <circle cx={50} cy={50} r={25} fill={`url(#${id}-bg)`} />
          <circle
            cx={50}
            cy={50}
            r={16}
            fill={colors.glow}
            opacity={0.25}
          />
          <circle cx={50} cy={50} r={10} fill={`url(#${id}-core)`} />
          {animate && (
            <circle cx={50} cy={50} r={16} fill={colors.glow} opacity={0}>
              <animate
                attributeName="opacity"
                values="0.15;0.35;0.15"
                dur="2s"
                repeatCount="indefinite"
              />
            </circle>
          )}
        </>
      )}

      {/* Tier 4: Flame — bright with flickering corona */}
      {t === 4 && (
        <>
          <circle cx={50} cy={50} r={30} fill={`url(#${id}-bg)`} />
          <circle
            cx={50}
            cy={50}
            r={20}
            fill={colors.glow}
            opacity={0.2}
          />
          <circle cx={50} cy={50} r={12} fill={`url(#${id}-core)`} />
          {animate &&
            [0, 90, 180, 270].map((angle) => {
              const rad = (angle * Math.PI) / 180;
              return (
                <circle
                  key={angle}
                  cx={50 + Math.cos(rad) * 18}
                  cy={50 + Math.sin(rad) * 18}
                  r={2}
                  fill={colors.glow}
                  opacity={0}
                >
                  <animate
                    attributeName="opacity"
                    values="0;0.6;0"
                    dur={`${1.5 + (angle / 360) * 0.8}s`}
                    repeatCount="indefinite"
                  />
                </circle>
              );
            })}
        </>
      )}

      {/* Tier 5: Radiant — visible rays of light */}
      {t === 5 && (
        <>
          <circle cx={50} cy={50} r={34} fill={`url(#${id}-bg)`} />
          <circle
            cx={50}
            cy={50}
            r={22}
            fill={colors.glow}
            opacity={0.2}
          />
          {[0, 60, 120, 180, 240, 300].map((angle) => {
            const rad = (angle * Math.PI) / 180;
            return (
              <line
                key={angle}
                x1={50 + Math.cos(rad) * 14}
                y1={50 + Math.sin(rad) * 14}
                x2={50 + Math.cos(rad) * 28}
                y2={50 + Math.sin(rad) * 28}
                stroke={colors.glow}
                strokeWidth={2}
                strokeLinecap="round"
                opacity={0.5}
              />
            );
          })}
          <circle cx={50} cy={50} r={13} fill={`url(#${id}-core)`} />
        </>
      )}

      {/* Tier 6: Flare — dramatic starburst */}
      {t === 6 && (
        <>
          <circle cx={50} cy={50} r={38} fill={`url(#${id}-bg)`} />
          <circle
            cx={50}
            cy={50}
            r={28}
            fill={colors.glow}
            opacity={0.15}
            filter={`url(#${id}-blur)`}
          />
          {[0, 45, 90, 135, 180, 225, 270, 315].map((angle, i) => {
            const rad = (angle * Math.PI) / 180;
            const len = i % 2 === 0 ? 32 : 24;
            return (
              <line
                key={angle}
                x1={50 + Math.cos(rad) * 14}
                y1={50 + Math.sin(rad) * 14}
                x2={50 + Math.cos(rad) * len}
                y2={50 + Math.sin(rad) * len}
                stroke={colors.glow}
                strokeWidth={i % 2 === 0 ? 2.5 : 1.5}
                strokeLinecap="round"
                opacity={0.6}
              >
                {animate && (
                  <animate
                    attributeName="opacity"
                    values="0.4;0.7;0.4"
                    dur={`${2 + i * 0.2}s`}
                    repeatCount="indefinite"
                  />
                )}
              </line>
            );
          })}
          <circle cx={50} cy={50} r={14} fill={`url(#${id}-core)`} />
        </>
      )}

      {/* Tier 7: Nova — glowing star with bright halo */}
      {t === 7 && (
        <>
          <circle
            cx={50}
            cy={50}
            r={40}
            fill={colors.glow}
            opacity={0.08}
            filter={`url(#${id}-blur)`}
          />
          <circle cx={50} cy={50} r={38} fill={`url(#${id}-bg)`} />
          {[0, 45, 90, 135, 180, 225, 270, 315].map((angle, i) => {
            const rad = (angle * Math.PI) / 180;
            const len = i % 2 === 0 ? 36 : 26;
            return (
              <line
                key={angle}
                x1={50 + Math.cos(rad) * 16}
                y1={50 + Math.sin(rad) * 16}
                x2={50 + Math.cos(rad) * len}
                y2={50 + Math.sin(rad) * len}
                stroke={colors.glow}
                strokeWidth={i % 2 === 0 ? 3 : 1.5}
                strokeLinecap="round"
                opacity={0.6}
              >
                {animate && (
                  <animate
                    attributeName="opacity"
                    values="0.3;0.8;0.3"
                    dur={`${1.8 + i * 0.15}s`}
                    repeatCount="indefinite"
                  />
                )}
              </line>
            );
          })}
          <circle
            cx={50}
            cy={50}
            r={20}
            fill={colors.glow}
            opacity={0.2}
            filter={`url(#${id}-blur)`}
          />
          <circle cx={50} cy={50} r={15} fill={`url(#${id}-core)`} />
        </>
      )}

      {/* Tier 8: Pulsar — rhythmic pulsing star with orbiting particles */}
      {t === 8 && (
        <>
          <circle cx={50} cy={50} r={42} fill={`url(#${id}-bg)`} />
          {[0, 45, 90, 135, 180, 225, 270, 315].map((angle, i) => {
            const rad = (angle * Math.PI) / 180;
            const len = i % 2 === 0 ? 38 : 28;
            return (
              <line
                key={angle}
                x1={50 + Math.cos(rad) * 16}
                y1={50 + Math.sin(rad) * 16}
                x2={50 + Math.cos(rad) * len}
                y2={50 + Math.sin(rad) * len}
                stroke={colors.glow}
                strokeWidth={i % 2 === 0 ? 3 : 2}
                strokeLinecap="round"
                opacity={0.5}
              />
            );
          })}
          <circle
            cx={50}
            cy={50}
            r={22}
            fill={colors.glow}
            opacity={0.15}
            filter={`url(#${id}-blur)`}
          />
          <circle cx={50} cy={50} r={16} fill={`url(#${id}-core)`} />
          {animate && (
            <circle cx={50} cy={50} r={22} fill={colors.glow} opacity={0}>
              <animate
                attributeName="r"
                values="18;30;18"
                dur="2s"
                repeatCount="indefinite"
              />
              <animate
                attributeName="opacity"
                values="0.25;0;0.25"
                dur="2s"
                repeatCount="indefinite"
              />
            </circle>
          )}
          {/* Orbiting dots */}
          {[0, 180].map((startAngle, i) => (
            <circle key={i} cx={50} cy={50 - 32} r={2.5} fill={colors.glow}>
              {animate && (
                <animateTransform
                  attributeName="transform"
                  type="rotate"
                  from={`${startAngle} 50 50`}
                  to={`${startAngle + 360} 50 50`}
                  dur="5s"
                  repeatCount="indefinite"
                />
              )}
            </circle>
          ))}
        </>
      )}

      {/* Tier 9: Supernova — explosive brilliance with particle ring */}
      {t === 9 && (
        <>
          <circle cx={50} cy={50} r={45} fill={`url(#${id}-bg)`} />
          {animate && (
            <circle cx={50} cy={50} r={35} fill={colors.glow} opacity={0}>
              <animate
                attributeName="r"
                values="20;42;20"
                dur="3s"
                repeatCount="indefinite"
              />
              <animate
                attributeName="opacity"
                values="0.2;0;0.2"
                dur="3s"
                repeatCount="indefinite"
              />
            </circle>
          )}
          {[0, 30, 60, 90, 120, 150, 180, 210, 240, 270, 300, 330].map(
            (angle, i) => {
              const rad = (angle * Math.PI) / 180;
              const len = i % 3 === 0 ? 40 : i % 3 === 1 ? 34 : 28;
              return (
                <line
                  key={angle}
                  x1={50 + Math.cos(rad) * 16}
                  y1={50 + Math.sin(rad) * 16}
                  x2={50 + Math.cos(rad) * len}
                  y2={50 + Math.sin(rad) * len}
                  stroke={colors.glow}
                  strokeWidth={i % 3 === 0 ? 3 : 1.5}
                  strokeLinecap="round"
                  opacity={0.55}
                >
                  {animate && (
                    <animate
                      attributeName="opacity"
                      values="0.3;0.7;0.3"
                      dur={`${1.5 + i * 0.1}s`}
                      repeatCount="indefinite"
                    />
                  )}
                </line>
              );
            },
          )}
          <circle
            cx={50}
            cy={50}
            r={24}
            fill={colors.glow}
            opacity={0.2}
            filter={`url(#${id}-blur)`}
          />
          <circle cx={50} cy={50} r={16} fill={`url(#${id}-core)`} />
          {/* Orbiting particle ring */}
          {[0, 90, 180, 270].map((startAngle, i) => (
            <circle
              key={i}
              cx={50}
              cy={50 - 34}
              r={2}
              fill={colors.glow}
              opacity={0.8}
            >
              {animate && (
                <animateTransform
                  attributeName="transform"
                  type="rotate"
                  from={`${startAngle} 50 50`}
                  to={`${startAngle + 360} 50 50`}
                  dur={`${4 + i * 0.5}s`}
                  repeatCount="indefinite"
                />
              )}
            </circle>
          ))}
        </>
      )}

      {/* Tier 10: Meridian — the peak, radiant white-gold celestial body */}
      {t === 10 && (
        <>
          <circle cx={50} cy={50} r={48} fill={`url(#${id}-bg)`} />
          {animate && (
            <>
              <circle cx={50} cy={50} r={40} fill={colors.glow} opacity={0}>
                <animate
                  attributeName="r"
                  values="25;46;25"
                  dur="4s"
                  repeatCount="indefinite"
                />
                <animate
                  attributeName="opacity"
                  values="0.15;0;0.15"
                  dur="4s"
                  repeatCount="indefinite"
                />
              </circle>
              <circle cx={50} cy={50} r={30} fill={colors.glow} opacity={0}>
                <animate
                  attributeName="r"
                  values="20;35;20"
                  dur="2.5s"
                  repeatCount="indefinite"
                />
                <animate
                  attributeName="opacity"
                  values="0.1;0.25;0.1"
                  dur="2.5s"
                  repeatCount="indefinite"
                />
              </circle>
            </>
          )}
          {[0, 30, 60, 90, 120, 150, 180, 210, 240, 270, 300, 330].map(
            (angle, i) => {
              const rad = (angle * Math.PI) / 180;
              const len = i % 2 === 0 ? 44 : 36;
              return (
                <line
                  key={angle}
                  x1={50 + Math.cos(rad) * 18}
                  y1={50 + Math.sin(rad) * 18}
                  x2={50 + Math.cos(rad) * len}
                  y2={50 + Math.sin(rad) * len}
                  stroke={i % 2 === 0 ? '#ffffff' : colors.glow}
                  strokeWidth={i % 2 === 0 ? 3 : 2}
                  strokeLinecap="round"
                  opacity={0.6}
                >
                  {animate && (
                    <animate
                      attributeName="opacity"
                      values="0.3;0.8;0.3"
                      dur={`${1.5 + i * 0.12}s`}
                      repeatCount="indefinite"
                    />
                  )}
                </line>
              );
            },
          )}
          <circle
            cx={50}
            cy={50}
            r={26}
            fill={colors.glow}
            opacity={0.25}
            filter={`url(#${id}-blur)`}
          />
          <circle cx={50} cy={50} r={18} fill={`url(#${id}-core)`} />
          {/* Inner bright core */}
          <circle cx={50} cy={50} r={8} fill="#ffffff" opacity={0.9} />
          {/* Orbiting particles */}
          {[0, 72, 144, 216, 288].map((startAngle, i) => (
            <circle
              key={i}
              cx={50}
              cy={50 - 36}
              r={2}
              fill="#ffffff"
              opacity={0.7}
            >
              {animate && (
                <animateTransform
                  attributeName="transform"
                  type="rotate"
                  from={`${startAngle} 50 50`}
                  to={`${startAngle + 360} 50 50`}
                  dur={`${6 + i * 0.4}s`}
                  repeatCount="indefinite"
                />
              )}
            </circle>
          ))}
        </>
      )}
    </svg>
  );
}
