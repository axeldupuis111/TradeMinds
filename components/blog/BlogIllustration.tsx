/**
 * Branded SVG illustrations for blog articles — used as article hero banners and
 * listing thumbnails. Theme-aware (CSS variables), zero external hosting, crisp
 * at any size. Add a motif here and reference it by key from a post's `cover`.
 */

type Motif = (a: string, m: string) => JSX.Element;

// a = accent color, m = muted line color (both CSS-var based)
const MOTIFS: Record<string, Motif> = {
  // Upward candlesticks + trend line
  trend: (a, m) => (
    <g>
      <path d="M40 150 L120 120 L180 130 L260 80 L340 60" fill="none" stroke={a} strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" />
      {[[40, 130, 30], [120, 110, 26], [180, 118, 24], [260, 70, 34], [340, 55, 28]].map(([x, y, h], i) => (
        <rect key={i} x={x - 6} y={y} width="12" height={h} rx="2" fill={i % 2 ? m : a} opacity={i % 2 ? 0.5 : 0.9} />
      ))}
    </g>
  ),
  // Shield + check = discipline
  discipline: (a, m) => (
    <g>
      <path d="M200 40 L260 62 V115 C260 150 234 172 200 182 C166 172 140 150 140 115 V62 Z" fill="none" stroke={m} strokeWidth="3" opacity="0.5" />
      <path d="M175 112 L193 130 L227 92" fill="none" stroke={a} strokeWidth="5" strokeLinecap="round" strokeLinejoin="round" />
    </g>
  ),
  // Flame = streak
  streak: (a, m) => (
    <g>
      <path d="M200 55 C230 90 240 110 240 132 C240 160 222 178 200 178 C178 178 160 160 160 132 C160 116 172 104 182 92 C192 108 196 96 200 55 Z" fill="none" stroke={a} strokeWidth="3.5" strokeLinejoin="round" />
      <path d="M200 120 C212 132 216 142 216 152 C216 166 209 176 200 176 C191 176 184 166 184 152 C184 142 190 136 195 130 Z" fill={a} opacity="0.25" />
      <line x1="120" y1="170" x2="150" y2="170" stroke={m} strokeWidth="3" strokeLinecap="round" opacity="0.4" />
      <line x1="250" y1="170" x2="280" y2="170" stroke={m} strokeWidth="3" strokeLinecap="round" opacity="0.4" />
    </g>
  ),
  // Target + arrow
  target: (a, m) => (
    <g>
      <circle cx="200" cy="112" r="60" fill="none" stroke={m} strokeWidth="3" opacity="0.5" />
      <circle cx="200" cy="112" r="36" fill="none" stroke={m} strokeWidth="3" opacity="0.5" />
      <circle cx="200" cy="112" r="12" fill={a} />
      <path d="M270 50 L205 108" stroke={a} strokeWidth="4" strokeLinecap="round" />
      <path d="M270 50 L256 54 M270 50 L266 64" stroke={a} strokeWidth="4" strokeLinecap="round" />
    </g>
  ),
  // Brain / psychology
  psychology: (a, m) => (
    <g>
      <path d="M170 90 C150 90 140 108 150 122 C138 134 148 156 166 154 C170 170 196 172 200 156 L200 78 C186 74 176 80 170 90 Z" fill="none" stroke={m} strokeWidth="3" opacity="0.55" />
      <path d="M230 90 C250 90 260 108 250 122 C262 134 252 156 234 154 C230 170 204 172 200 156 L200 78 C214 74 224 80 230 90 Z" fill="none" stroke={a} strokeWidth="3" />
      <circle cx="216" cy="112" r="3" fill={a} />
      <circle cx="228" cy="130" r="3" fill={a} />
    </g>
  ),
  // Open journal / book
  journal: (a, m) => (
    <g>
      <path d="M200 70 C180 60 150 60 130 68 V162 C150 154 180 154 200 164 Z" fill="none" stroke={m} strokeWidth="3" opacity="0.55" />
      <path d="M200 70 C220 60 250 60 270 68 V162 C250 154 220 154 200 164 Z" fill="none" stroke={a} strokeWidth="3" />
      {[92, 108, 124, 140].map((y, i) => <line key={i} x1="214" y1={y} x2="256" y2={y - 2} stroke={a} strokeWidth="2.5" strokeLinecap="round" opacity="0.7" />)}
      <line x1="200" y1="70" x2="200" y2="164" stroke={m} strokeWidth="3" opacity="0.55" />
    </g>
  ),
  // Calendar
  calendar: (a, m) => (
    <g>
      <rect x="140" y="66" width="120" height="104" rx="10" fill="none" stroke={m} strokeWidth="3" opacity="0.55" />
      <line x1="140" y1="92" x2="260" y2="92" stroke={m} strokeWidth="3" opacity="0.55" />
      <line x1="168" y1="58" x2="168" y2="74" stroke={a} strokeWidth="4" strokeLinecap="round" />
      <line x1="232" y1="58" x2="232" y2="74" stroke={a} strokeWidth="4" strokeLinecap="round" />
      {[0, 1, 2].map((r) => [0, 1, 2, 3].map((c) => <circle key={`${r}${c}`} cx={162 + c * 26} cy={112 + r * 18} r="3.5" fill={r === 1 && c === 2 ? a : m} opacity={r === 1 && c === 2 ? 1 : 0.4} />))}
    </g>
  ),
  // Risk / gauge
  risk: (a, m) => (
    <g>
      <path d="M140 160 A60 60 0 0 1 260 160" fill="none" stroke={m} strokeWidth="8" opacity="0.4" strokeLinecap="round" />
      <path d="M140 160 A60 60 0 0 1 190 104" fill="none" stroke={a} strokeWidth="8" strokeLinecap="round" />
      <line x1="200" y1="160" x2="182" y2="118" stroke={a} strokeWidth="4" strokeLinecap="round" />
      <circle cx="200" cy="160" r="7" fill={a} />
    </g>
  ),
  // Prop firm — flag / building
  prop: (a, m) => (
    <g>
      <line x1="160" y1="60" x2="160" y2="172" stroke={m} strokeWidth="4" strokeLinecap="round" opacity="0.6" />
      <path d="M160 66 L246 66 L232 88 L246 110 L160 110 Z" fill="none" stroke={a} strokeWidth="3.5" strokeLinejoin="round" />
      <text x="196" y="94" fontSize="20" fontWeight="700" fill={a} textAnchor="middle">%</text>
      <line x1="140" y1="172" x2="264" y2="172" stroke={m} strokeWidth="3" strokeLinecap="round" opacity="0.4" />
    </g>
  ),
  // Clock / routine
  routine: (a, m) => (
    <g>
      <circle cx="200" cy="115" r="58" fill="none" stroke={m} strokeWidth="3" opacity="0.55" />
      <line x1="200" y1="115" x2="200" y2="80" stroke={a} strokeWidth="4" strokeLinecap="round" />
      <line x1="200" y1="115" x2="228" y2="128" stroke={a} strokeWidth="4" strokeLinecap="round" />
      <circle cx="200" cy="115" r="5" fill={a} />
    </g>
  ),
};

export const ILLUSTRATION_KEYS = Object.keys(MOTIFS);

export default function BlogIllustration({ name, className }: { name?: string; className?: string }) {
  const motif = (name && MOTIFS[name]) || MOTIFS.trend;
  const accent = "rgb(var(--accent))";
  const muted = "rgb(var(--foreground))";
  return (
    <svg viewBox="0 0 400 220" className={className} role="img" aria-hidden preserveAspectRatio="xMidYMid slice">
      <defs>
        <linearGradient id="blogill-bg" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stopColor="rgb(var(--accent))" stopOpacity="0.12" />
          <stop offset="100%" stopColor="rgb(var(--surface))" stopOpacity="0.6" />
        </linearGradient>
      </defs>
      <rect x="0" y="0" width="400" height="220" fill="url(#blogill-bg)" />
      {motif(accent, muted)}
    </svg>
  );
}
