"use client";

import { Fragment, useMemo } from "react";
import {
  buildHeatmap,
  getHeatmapBounds,
  type HeatmapBounds,
  type HeatmapCell,
} from "@/lib/analytics/heatmap";
import type { AnalyticsTrade } from "@/lib/analytics/types";
import { useLanguage } from "@/lib/LanguageContext";

type Props = { trades: AnalyticsTrade[] };

// Monday-first ordering matches buildHeatmap (day 0 = Lundi)
const DAY_KEYS_MON_FIRST = [
  "analytics_mon",
  "analytics_tue",
  "analytics_wed",
  "analytics_thu",
  "analytics_fri",
  "analytics_sat",
  "analytics_sun",
] as const;

// ─── Session pivot hours ──────────────────────────────────────────────────────
// Labels shown at these hours; guide lines on the column BEFORE each pivot.
const PIVOT_HOURS = new Set([0, 6, 12, 18, 23]);
// Columns that get a right-edge guide line (just before a session pivot)
const GUIDE_HOURS = new Set([5, 11, 17]);

const CELL_HEIGHT = 32; // px — FIX 6

// ─── Colour interpolation (FIX 2 + 3) ────────────────────────────────────────

/**
 * Sqrt-boosted opacity: lifts mid-range cells so they read clearly without
 * over-saturating the max cell.
 *   ratio 0.0 → opacity 0.25
 *   ratio 0.3 → opacity ~0.63  (sqrt(0.3)=0.55 → 0.25+0.55×0.70)
 *   ratio 1.0 → opacity 0.95
 */
function boostedOpacity(ratio: number): number {
  const clamped = Math.max(0, Math.min(1, ratio));
  return 0.25 + Math.sqrt(clamped) * 0.70;
}

function cellBg(cell: HeatmapCell, bounds: HeatmapBounds): string {
  // FIX 3 — empty cells: very subtle, border supplied separately
  if (cell.trades === 0) return "rgb(var(--foreground-muted) / 0.06)";

  if (cell.pnl === 0) return "rgb(var(--foreground-muted) / 0.15)";

  if (cell.pnl > 0) {
    const clip = bounds.pClipHigh > 0 ? bounds.pClipHigh : 1;
    const opacity = boostedOpacity(cell.pnl / clip);
    return `rgb(var(--profit) / ${opacity.toFixed(2)})`;
  }

  // cell.pnl < 0
  const clip = bounds.pClipLow < 0 ? Math.abs(bounds.pClipLow) : 1;
  const opacity = boostedOpacity(Math.abs(cell.pnl) / clip);
  return `rgb(var(--loss) / ${opacity.toFixed(2)})`;
}

// ─── Formatting ───────────────────────────────────────────────────────────────

function fmtPnl(n: number): string {
  const r = Math.round(n);
  if (r === 0) return "0 €";
  return `${r > 0 ? "+" : ""}${r} €`;
}

function fmtTooltip(cell: HeatmapCell, dayLabel: string): string {
  if (cell.trades === 0) return `${dayLabel} ${cell.hour}h · 0 trade`;
  const wr = Math.round(cell.winRate * 100);
  return (
    `${dayLabel} ${cell.hour}h · ` +
    `${cell.trades} trade${cell.trades > 1 ? "s" : ""} · ` +
    `${fmtPnl(cell.pnl)} · WR ${wr} %`
  );
}

// ─── Component ────────────────────────────────────────────────────────────────

export function HourDayHeatmap({ trades }: Props) {
  const { t } = useLanguage();

  const heatmap = useMemo(() => buildHeatmap(trades), [trades]);
  const bounds  = useMemo(() => getHeatmapBounds(heatmap), [heatmap]);

  if (bounds.totalTrades < 10) {
    return (
      <div className="text-foreground-muted text-sm py-12 text-center">
        Pas assez de données pour la heatmap. Reviens après plus de trades.
      </div>
    );
  }

  return (
    <div>
      {/* ── Grid ─────────────────────────────────────────────────────────── */}
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "40px repeat(24, minmax(0, 1fr))",
          gap: 3,
        }}
      >
        {/* 7 day rows */}
        {heatmap.map((row, dayIdx) => {
          const dayLabel = t(DAY_KEYS_MON_FIRST[dayIdx]);
          return (
            <Fragment key={dayIdx}>
              {/* Day label */}
              <div
                className="flex items-center justify-end pr-1.5 text-[10px] text-foreground-muted select-none"
                style={{ height: CELL_HEIGHT }}
              >
                {dayLabel}
              </div>

              {/* 24 hour cells */}
              {row.map((cell) => (
                <div
                  key={cell.hour}
                  title={fmtTooltip(cell, dayLabel)}
                  style={{
                    height: CELL_HEIGHT,
                    borderRadius: 4,
                    backgroundColor: cellBg(cell, bounds),
                    // FIX 3 — subtle border on empty cells for grid structure
                    border: cell.trades === 0
                      ? "1px solid rgb(var(--foreground-muted) / 0.10)"
                      : "1px solid transparent",
                    // FIX 4 — guide line just before each session pivot
                    borderRight: GUIDE_HOURS.has(cell.hour)
                      ? "1px solid rgb(var(--foreground-muted) / 0.18)"
                      : undefined,
                    cursor: "pointer",
                    transition: "opacity 100ms ease",
                  }}
                  className="hover:opacity-75 motion-reduce:transition-none"
                />
              ))}
            </Fragment>
          );
        })}

        {/* Hour label row (FIX 4) */}
        <div style={{ height: 18 }} /> {/* spacer under day-label column */}
        {Array.from({ length: 24 }, (_, h) => (
          <div
            key={`hl-${h}`}
            className="text-center text-foreground-muted select-none font-mono"
            style={{ fontSize: 9, lineHeight: "18px" }}
          >
            {PIVOT_HOURS.has(h) ? `${h}h` : ""}
          </div>
        ))}
      </div>

      {/* ── Legend (FIX 5) ───────────────────────────────────────────────── */}
      <div className="flex flex-col items-end gap-1 mt-3">
        <span className="text-[10px] text-foreground-muted/60 select-none">
          P&amp;L par cellule
        </span>
        <div className="flex items-center gap-2">
          <span className="text-[11px] text-foreground-muted tabular-nums">
            {fmtPnl(bounds.minPnl)}
          </span>
          <div
            style={{
              width: 140,
              height: 8,
              borderRadius: 4,
              background:
                "linear-gradient(to right, rgb(var(--loss) / 0.90), rgb(var(--foreground) / 0.08), rgb(var(--profit) / 0.90))",
            }}
          />
          <span className="text-[11px] text-foreground-muted tabular-nums">
            {fmtPnl(bounds.maxPnl)}
          </span>
        </div>
      </div>
    </div>
  );
}
