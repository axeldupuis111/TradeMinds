"use client";

/**
 * Sparkline — mini courbe SVG animée pour la card P&L.
 *
 * - Ligne de tendance avec animation de tracé (.sparkline-line CSS)
 * - Aire sous la courbe avec dégradé vertical (opaque → transparent)
 * - Couleur sémantique : profit (vert) ou loss (rouge) selon le signe
 * - Respecte prefers-reduced-motion via la classe CSS
 * - Retourne null si données insuffisantes (< 2 points)
 */

import { useId } from "react";

interface SparklineProps {
  /** Série de P&L cumulatifs (ex: [150, 80, 220, 180]) */
  data: number[];
  /** true → couleur profit, false → couleur loss */
  positive?: boolean;
  width?: number;
  height?: number;
  className?: string;
  /** Ajoute un feGaussianBlur glow sur la ligne (activer en dark mode uniquement) */
  glow?: boolean;
}

export function Sparkline({
  data,
  positive = true,
  width = 80,
  height = 36,
  className,
  glow = false,
}: SparklineProps) {
  const uid = useId();
  // Strip colons — SVG id must not contain ':'
  const gradId = `spark-grad-${uid.replace(/:/g, "")}`;
  const glowId = `spark-glow-${uid.replace(/:/g, "")}`;

  if (data.length < 2) return null;

  const pad = 2;
  const minVal = Math.min(0, ...data);
  const maxVal = Math.max(0, ...data);
  const range = maxVal - minVal || 1;

  const toX = (i: number) =>
    pad + (i / (data.length - 1)) * (width - pad * 2);
  const toY = (v: number) =>
    height - pad - ((v - minVal) / range) * (height - pad * 2);

  // SVG line path
  const linePath = data
    .map((v, i) => `${i === 0 ? "M" : "L"}${toX(i).toFixed(1)},${toY(v).toFixed(1)}`)
    .join(" ");

  // SVG area path (closed at bottom)
  const areaPath = [
    `M${toX(0).toFixed(1)},${height}`,
    ...data.map((v, i) => `L${toX(i).toFixed(1)},${toY(v).toFixed(1)}`),
    `L${toX(data.length - 1).toFixed(1)},${height}`,
    "Z",
  ].join(" ");

  // Tokens — inline rgb() with CSS vars
  const color = positive ? "rgb(var(--profit))" : "rgb(var(--loss))";

  return (
    <svg
      width={width}
      height={height}
      viewBox={`0 0 ${width} ${height}`}
      className={className}
      aria-hidden="true"
    >
      <defs>
        {/* Vertical gradient: colour at top → transparent at bottom */}
        <linearGradient id={gradId} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={color} stopOpacity="0.35" />
          <stop offset="100%" stopColor={color} stopOpacity="0" />
        </linearGradient>
        {/* Glow filter — dark mode only, actived via glow prop */}
        {glow && (
          <filter id={glowId} x="-20%" y="-20%" width="140%" height="140%">
            <feGaussianBlur in="SourceGraphic" stdDeviation="2" result="blur" />
            <feMerge>
              <feMergeNode in="blur" />
              <feMergeNode in="SourceGraphic" />
            </feMerge>
          </filter>
        )}
      </defs>

      {/* Area fill — no animation, appears instantly */}
      <path d={areaPath} fill={`url(#${gradId})`} />

      {/* Line — animated draw via .sparkline-line CSS class */}
      <path
        d={linePath}
        fill="none"
        stroke={color}
        strokeWidth={1.5}
        strokeLinecap="round"
        strokeLinejoin="round"
        className="sparkline-line"
        filter={glow ? `url(#${glowId})` : undefined}
      />
    </svg>
  );
}
