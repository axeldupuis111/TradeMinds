/**
 * WinRateGauge — jauge semi-circulaire style Focuspips pour le win rate.
 * Partie gagnante en profit, fond en border. Affiche le % en dessous.
 */

interface WinRateGaugeProps {
  wins: number;
  total: number;
}

// SVG constants
const CX = 40;
const CY = 38;
const R = 30;
const SW = 7;
const START_X = CX - R; // 10
const START_Y = CY;      // 38
const END_X = CX + R;   // 70
const END_Y = CY;        // 38
// Track: M 10 38 A 30 30 0 0 0 70 38  (counterclockwise = upward arc)

function gaugeColor(winRate: number): string {
  if (winRate >= 60) return "rgb(var(--profit))";
  if (winRate >= 40) return "rgb(var(--warning))";
  return "rgb(var(--loss))";
}

function fillPath(winRate: number): string {
  if (winRate <= 0) return "";
  // Clamp to avoid degenerate 0% / 100% cases
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
    <svg
      width="80"
      height="52"
      viewBox="0 0 80 52"
      className="shrink-0"
      aria-hidden="true"
    >
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
          d={fillPath(winRate)}
          fill="none"
          stroke={color}
          strokeWidth={SW}
          strokeLinecap="round"
        />
      )}
      {/* Percentage label */}
      <text
        x={CX}
        y="50"
        textAnchor="middle"
        fill="rgb(var(--foreground))"
        fontSize="12"
        fontWeight="700"
        fontFamily="inherit"
      >
        {total > 0 ? `${Math.round(winRate)}%` : "—"}
      </text>
    </svg>
  );
}
