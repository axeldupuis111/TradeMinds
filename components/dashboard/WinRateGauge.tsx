"use client";

/**
 * WinRateGauge — jauge semi-circulaire pour le win rate.
 *
 * Améliorations direction artistique "Terminal de précision" :
 * - Animation de remplissage ease-out ~1.5s via RAF (one-shot)
 *   utilisant strokeDasharray/strokeDashoffset sur le path arc
 * - Filtre SVG glow appliqué au tracé en dark mode uniquement
 * - Couleur sémantique conservée (profit/warning/loss selon le taux)
 * - Respecte prefers-reduced-motion
 */

import { useEffect, useId, useRef, useState } from "react";
import { useReducedMotion } from "framer-motion";
import { useTheme } from "@/lib/ThemeContext";

interface WinRateGaugeProps {
  wins: number;
  total: number;
}

// ─── SVG constants ────────────────────────────────────────────────────────────

const CX = 40;
const CY = 38;
const R  = 30;
const SW = 7;
const START_X = CX - R; // 10
const START_Y = CY;     // 38
const END_X   = CX + R; // 70
const END_Y   = CY;     // 38

// Full-arc track path and arc length
const TRACK_PATH = `M ${START_X} ${START_Y} A ${R} ${R} 0 0 0 ${END_X} ${END_Y}`;
const ARC_LENGTH  = Math.PI * R; // half-circumference ≈ 94.25

function gaugeColor(wr: number): string {
  if (wr >= 60) return "rgb(var(--profit))";
  if (wr >= 40) return "rgb(var(--warning))";
  return "rgb(var(--loss))";
}

export function WinRateGauge({ wins, total }: WinRateGaugeProps) {
  const winRate = total > 0 ? (wins / total) * 100 : 0;
  const color   = gaugeColor(winRate);

  // Target dashoffset: full offset = empty arc; 0 = full arc
  const targetDashOffset = total > 0 && winRate > 0
    ? ARC_LENGTH * (1 - winRate / 100)
    : ARC_LENGTH;

  const { theme } = useTheme();
  const isDark = theme !== "light";
  const prefersReducedMotion = useReducedMotion();

  const uid      = useId().replace(/:/g, "");
  const filterId = `gauge-glow-${uid}`;

  // Animated dashoffset — starts at ARC_LENGTH (empty), fills to target
  const [currentDashOffset, setCurrentDashOffset] = useState(ARC_LENGTH);
  const rafRef = useRef<number | null>(null);

  useEffect(() => {
    if (rafRef.current) cancelAnimationFrame(rafRef.current);

    if (prefersReducedMotion) {
      setCurrentDashOffset(targetDashOffset);
      return;
    }

    const DURATION = 1500;
    const startTime = performance.now();
    const startOffset = ARC_LENGTH;

    function animate(now: number) {
      const progress = Math.min(1, (now - startTime) / DURATION);
      const eased    = 1 - Math.pow(1 - progress, 3);
      setCurrentDashOffset(startOffset + eased * (targetDashOffset - startOffset));
      if (progress < 1) {
        rafRef.current = requestAnimationFrame(animate);
      }
    }

    rafRef.current = requestAnimationFrame(animate);
    return () => {
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
    };
  }, [targetDashOffset, prefersReducedMotion]);

  return (
    <div className="flex flex-col items-center gap-1 shrink-0">
      <svg width="80" height="44" viewBox="0 0 80 44" aria-hidden="true">
        <defs>
          {isDark && (
            <filter id={filterId} x="-30%" y="-30%" width="160%" height="160%">
              <feGaussianBlur stdDeviation="2" result="blur" />
              <feMerge>
                <feMergeNode in="blur" />
                <feMergeNode in="SourceGraphic" />
              </feMerge>
            </filter>
          )}
        </defs>

        {/* Background track — full semicircle */}
        <path
          d={TRACK_PATH}
          fill="none"
          stroke="rgb(var(--border))"
          strokeWidth={SW}
          strokeLinecap="round"
        />

        {/* Animated fill — same path, clipped via strokeDasharray */}
        {total > 0 && (
          <path
            d={TRACK_PATH}
            fill="none"
            stroke={color}
            strokeWidth={SW}
            strokeLinecap="round"
            strokeDasharray={ARC_LENGTH}
            strokeDashoffset={currentDashOffset}
            filter={isDark ? `url(#${filterId})` : undefined}
          />
        )}
      </svg>

      {/* Percentage label — HTML span (Tailwind token resolves correctly) */}
      <span className="text-xs font-bold tabular-nums text-foreground leading-none">
        {total > 0 ? `${Math.round(winRate)}%` : "—"}
      </span>
    </div>
  );
}
