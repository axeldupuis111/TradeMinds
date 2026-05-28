/**
 * ScoreRing — anneau SVG de progression pour le score de discipline.
 * Couleur sémantique selon le score, pas l'accent cyan.
 */

interface ScoreRingProps {
  score: number;
  size?: "sm" | "md" | "lg";
}

const sizeMeta = {
  sm: { px: 36, cx: 18, cy: 18, r: 14, sw: 3 },
  md: { px: 48, cx: 24, cy: 24, r: 20, sw: 3.5 },
  lg: { px: 64, cx: 32, cy: 32, r: 28, sw: 4 },
} as const;

function ringColor(score: number): string {
  if (score >= 75) return "rgb(var(--profit))";
  if (score >= 40) return "rgb(var(--warning))";
  return "rgb(var(--loss))";
}

export function ScoreRing({ score, size = "sm" }: ScoreRingProps) {
  const { px, cx, cy, r, sw } = sizeMeta[size];
  const circumference = 2 * Math.PI * r;
  const offset = circumference - (Math.min(100, Math.max(0, score)) / 100) * circumference;
  const color = ringColor(score);

  return (
    <svg
      width={px}
      height={px}
      viewBox={`0 0 ${px} ${px}`}
      className="shrink-0"
      aria-hidden="true"
    >
      {/* Track */}
      <circle
        cx={cx} cy={cy} r={r}
        fill="none"
        stroke="rgb(var(--border))"
        strokeWidth={sw}
      />
      {/* Fill */}
      <circle
        cx={cx} cy={cy} r={r}
        fill="none"
        stroke={color}
        strokeWidth={sw}
        strokeLinecap="round"
        strokeDasharray={circumference}
        strokeDashoffset={offset}
        transform={`rotate(-90 ${cx} ${cy})`}
        className="transition-all duration-700"
      />
    </svg>
  );
}
