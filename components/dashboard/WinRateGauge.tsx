/**
 * WinRateGauge — jauge semi-circulaire style Focuspips pour le win rate.
 * Partie gagnante en profit/warning/loss selon le taux.
 * Le % est affiché en HTML sous la jauge (Tailwind token, pas SVG fill attribute).
 */

interface WinRateGaugeProps {
  wins: number;
  total: number;
}

// ─── SVG constants ────────────────────────────────────────────────────────────

const CX = 40;
const CY = 38;
const R = 30;
const SW = 7;
const START_X = CX - R; // 10
const START_Y = CY;     // 38
const END_X = CX + R;  // 70
const END_Y = CY;       // 38
// viewBox height = 44 : arc bottom ≈ CY + SW/2 = 41.5, padding 2.5px
// Track: M 10 38 A 30 30 0 0 0 70 38  (sweep=0 → counterclockwise = upward)

function gaugeColor(winRate: number): string {
  if (winRate >= 60) return "rgb(var(--profit))";
  if (winRate >= 40) return "rgb(var(--warning))";
  return "rgb(var(--loss))";
}

function buildFillPath(winRate: number): string {
  const clamped = Math.min(99.9, Math.max(0.1, winRate));
  const angleDeg = 180 - (clamped / 100) * 180;
  const angleRad = (angleDeg * Math.PI) / 180;
  const ex = (CX + R * Math.cos(angleRad)).toFixed(3);
  const ey = (CY - R * Math.sin(angleRad)).toFixed(3);
  return `M ${START_X} ${START_Y} A ${R} ${R} 0 0 0 ${ex} ${ey}`;
}

export function WinRateGauge({ wins, total }: WinRateGaugeProps) {
  const winRate = total > 0 ? (wins / total) * 100 : 0;
  const color = gaugeColor(winRate);
  const trackPath = `M ${START_X} ${START_Y} A ${R} ${R} 0 0 0 ${END_X} ${END_Y}`;

  return (
    <div className="flex flex-col items-center gap-1 shrink-0">
      {/* SVG arc — no text inside to avoid fill attribute issues */}
      <svg width="80" height="44" viewBox="0 0 80 44" aria-hidden="true">
        {/* Background track */}
        <path
          d={trackPath}
          fill="none"
          stroke="rgb(var(--border))"
          strokeWidth={SW}
          strokeLinecap="round"
        />
        {/* Win-rate fill */}
        {total > 0 && winRate > 0 && (
          <path
            d={buildFillPath(winRate)}
            fill="none"
            stroke={color}
            strokeWidth={SW}
            strokeLinecap="round"
          />
        )}
      </svg>
      {/* Percentage — HTML span so Tailwind token resolves correctly in dark & light */}
      <span className="text-xs font-bold tabular-nums text-foreground leading-none">
        {total > 0 ? `${Math.round(winRate)}%` : "—"}
      </span>
    </div>
  );
}
