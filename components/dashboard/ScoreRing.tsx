"use client";

/**
 * ScoreRing — anneau SVG de progression pour le score de discipline.
 *
 * Améliorations direction artistique "Terminal de précision" :
 * - Animation de remplissage ease-out ~1.5s via RAF (one-shot)
 * - Dégradé sur le tracé (profit → accent-glow) pour score ≥ 75 en dark
 * - Filtre SVG glow appliqué au tracé en dark mode uniquement
 * - Couleur sémantique du score conservée (vert/amber/rouge selon seuils)
 * - Respecte prefers-reduced-motion
 */

import { useEffect, useId, useRef, useState } from "react";
import { useReducedMotion } from "framer-motion";
import { useTheme } from "@/lib/ThemeContext";

interface ScoreRingProps {
  score: number;
  size?: "sm" | "md" | "lg" | "xl";
}

/** Gradient stops selon le niveau de score */
function gradientColors(score: number): [string, string] {
  if (score >= 75) return ["rgb(var(--profit))", "rgb(var(--accent-glow))"];
  if (score >= 50) return ["rgb(var(--warning))", "rgb(var(--accent-glow))"];
  return ["rgb(var(--loss))", "rgb(var(--warning))"];
}

const sizeMeta = {
  sm: { px: 36, cx: 18, cy: 18, r: 14, sw: 3 },
  md: { px: 48, cx: 24, cy: 24, r: 20, sw: 3.5 },
  lg: { px: 64, cx: 32, cy: 32, r: 28, sw: 4 },
  xl: { px: 96, cx: 48, cy: 48, r: 40, sw: 5 },
} as const;

function ringColor(score: number): string {
  if (score >= 75) return "rgb(var(--profit))";
  if (score >= 40) return "rgb(var(--warning))";
  return "rgb(var(--loss))";
}

export function ScoreRing({ score, size = "sm" }: ScoreRingProps) {
  const { px, cx, cy, r, sw } = sizeMeta[size];
  const circumference = 2 * Math.PI * r;
  const targetOffset = circumference - (Math.min(100, Math.max(0, score)) / 100) * circumference;
  const solidColor = ringColor(score);

  const { theme } = useTheme();
  const isDark = theme !== "light";
  const prefersReducedMotion = useReducedMotion();

  // Unique IDs for SVG defs (React 18 useId)
  const uid = useId().replace(/:/g, "");
  const filterId = `ring-glow-${uid}`;
  const gradId   = `ring-grad-${uid}`;

  // Animated dashoffset — starts full (empty ring), fills to target
  const [currentOffset, setCurrentOffset] = useState(circumference);
  const rafRef = useRef<number | null>(null);

  useEffect(() => {
    // Cancel any running animation
    if (rafRef.current) cancelAnimationFrame(rafRef.current);

    if (prefersReducedMotion) {
      setCurrentOffset(targetOffset);
      return;
    }

    const DURATION = 1500; // ms
    const startTime = performance.now();
    const startOffset = circumference;

    function animate(now: number) {
      const progress = Math.min(1, (now - startTime) / DURATION);
      // ease-out cubic
      const eased = 1 - Math.pow(1 - progress, 3);
      setCurrentOffset(startOffset + eased * (targetOffset - startOffset));
      if (progress < 1) {
        rafRef.current = requestAnimationFrame(animate);
      }
    }

    rafRef.current = requestAnimationFrame(animate);
    return () => {
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
    };
  }, [targetOffset, circumference, prefersReducedMotion]);

  // Gradient actif en dark mode pour tous les scores (couleurs adaptées au niveau)
  const useGradient = isDark;
  const [gradFrom, gradTo] = gradientColors(score);
  const strokeColor = useGradient ? `url(#${gradId})` : solidColor;

  return (
    <svg
      width={px}
      height={px}
      viewBox={`0 0 ${px} ${px}`}
      className="shrink-0"
      aria-hidden="true"
    >
      <defs>
        {/* Gradient stroke adapté au niveau de score */}
        {useGradient && (
          <linearGradient
            id={gradId}
            x1={cx - r} y1="0"
            x2={cx + r} y2="0"
            gradientUnits="userSpaceOnUse"
          >
            <stop offset="0%"   stopColor={gradFrom} />
            <stop offset="100%" stopColor={gradTo} />
          </linearGradient>
        )}

        {/* Glow filter — dark mode only */}
        {isDark && (
          <filter id={filterId} x="-30%" y="-30%" width="160%" height="160%">
            <feGaussianBlur stdDeviation="3" result="blur" />
            <feMerge>
              <feMergeNode in="blur" />
              <feMergeNode in="SourceGraphic" />
            </feMerge>
          </filter>
        )}
      </defs>

      {/* Track */}
      <circle
        cx={cx} cy={cy} r={r}
        fill="none"
        stroke="rgb(var(--border))"
        strokeWidth={sw}
      />

      {/* Animated fill */}
      <circle
        cx={cx} cy={cy} r={r}
        fill="none"
        stroke={strokeColor}
        strokeWidth={sw}
        strokeLinecap="round"
        strokeDasharray={circumference}
        strokeDashoffset={currentOffset}
        transform={`rotate(-90 ${cx} ${cy})`}
        filter={isDark ? `url(#${filterId})` : undefined}
      />
    </svg>
  );
}
