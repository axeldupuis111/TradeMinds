"use client";

import { Fragment, useMemo, useState, useEffect, useRef } from "react";
import {
  buildHeatmap,
  getHeatmapBounds,
  getActiveBounds,
  type HeatmapBounds,
  type HeatmapCell,
} from "@/lib/analytics/heatmap";
import { HeatmapTooltip } from "@/components/analytics/HeatmapTooltip";
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

// ─── Session pivot / guide hours (absolute, pre-crop) ────────────────────────
// Labels shown at these hours; guide lines on the column BEFORE each pivot.
const ALL_PIVOT_HOURS = new Set([0, 6, 12, 18, 23]);
const ALL_GUIDE_HOURS = new Set([5, 11, 17]);

const CELL_HEIGHT = 36; // FIX 5

// ─── Colour interpolation (FIX 2 — cbrt curve) ───────────────────────────────

/**
 * Cbrt-boosted opacity: lifts dim cells very quickly, then saturates smoothly.
 *   ratio 0.0 → opacity 0.25
 *   ratio 0.1 → opacity ~0.47  (cbrt(0.1)≈0.46 → 0.25+0.46×0.70)
 *   ratio 1.0 → opacity 0.95
 */
function boostedOpacity(ratio: number): number {
  const clamped = Math.max(0, Math.min(1, ratio));
  return 0.25 + Math.cbrt(clamped) * 0.70;
}

function cellBg(cell: HeatmapCell, bounds: HeatmapBounds): string {
  if (cell.trades === 0) return "rgb(var(--foreground-muted) / 0.06)";
  if (cell.pnl === 0)    return "rgb(var(--foreground-muted) / 0.15)";

  if (cell.pnl > 0) {
    const clip = bounds.pClipHigh > 0 ? bounds.pClipHigh : 1;
    const opacity = boostedOpacity(cell.pnl / clip);
    return `rgb(var(--profit) / ${opacity.toFixed(2)})`;
  }

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

// FIX 5 — compact in-cell label with k suffix above 1 000
function formatCellPnl(n: number): string {
  if (Math.abs(n) >= 1000) {
    return `${n > 0 ? "+" : ""}${(n / 1000).toFixed(1)}k`;
  }
  return `${n > 0 ? "+" : ""}${Math.round(n)}`;
}

// ─── Tooltip state ────────────────────────────────────────────────────────────

type TooltipState = {
  visible: boolean;
  x: number;
  y: number;
  day: string;
  hour: number;
  trades: number;
  pnl: number;
  winRate: number;
};

const HIDDEN_TOOLTIP: TooltipState = {
  visible: false, x: 0, y: 0, day: "", hour: 0, trades: 0, pnl: 0, winRate: 0,
};

// ─── Component ────────────────────────────────────────────────────────────────

export function HourDayHeatmap({ trades }: Props) {
  const { t } = useLanguage();

  const [tooltip, setTooltip] = useState<TooltipState>(HIDDEN_TOOLTIP);
  const wrapperRef = useRef<HTMLDivElement>(null);

  const heatmap = useMemo(() => buildHeatmap(trades),  [trades]);
  const bounds  = useMemo(() => getHeatmapBounds(heatmap), [heatmap]);
  const active  = useMemo(() => getActiveBounds(heatmap),  [heatmap]);

  // FIX 3 — Hide tooltip on window scroll
  useEffect(() => {
    const hide = () => setTooltip(HIDDEN_TOOLTIP);
    window.addEventListener("scroll", hide, { passive: true });
    return () => window.removeEventListener("scroll", hide);
  }, []);

  if (bounds.totalTrades < 10) {
    return (
      <div className="text-foreground-muted text-sm py-12 text-center">
        Pas assez de données pour la heatmap. Reviens après plus de trades.
      </div>
    );
  }

  // FIX 1 — Auto-crop: use bounding box of active cells
  const minDay  = active.hasData ? active.minDay  : 0;
  const maxDay  = active.hasData ? active.maxDay  : 6;
  const minHour = active.hasData ? active.minHour : 0;
  const maxHour = active.hasData ? active.maxHour : 23;
  const numHours = maxHour - minHour + 1;

  const visibleRows = heatmap.slice(minDay, maxDay + 1);

  // FIX 4 — Top 3 profit + top 3 loss cells (user-specified algorithm)
  const activeCells = heatmap.flat().filter(c => c.trades > 0);
  const top3Profit = [...activeCells].sort((a, b) => b.pnl - a.pnl).slice(0, 3);
  const top3Loss   = [...activeCells].sort((a, b) => a.pnl - b.pnl).slice(0, 3);
  const topSet     = new Set(
    [...top3Profit, ...top3Loss].map(c => `${c.day}-${c.hour}`)
  );

  return (
    <div
      ref={wrapperRef}
      onMouseLeave={() => setTooltip(HIDDEN_TOOLTIP)}
    >
      {/* ── Grid ─────────────────────────────────────────────────────────── */}
      <div
        style={{
          display: "grid",
          // FIX 1 — dynamic column count after crop
          gridTemplateColumns: `40px repeat(${numHours}, minmax(0, 1fr))`,
          gap: 3,
        }}
      >
        {/* Cropped day rows */}
        {visibleRows.map((row, rowIdx) => {
          const dayIdx   = minDay + rowIdx;
          const dayLabel = t(DAY_KEYS_MON_FIRST[dayIdx]);
          const visibleCells = row.slice(minHour, maxHour + 1);

          return (
            <Fragment key={dayIdx}>
              {/* Day label */}
              <div
                className="flex items-center justify-end pr-1.5 text-[10px] text-foreground-muted select-none"
                style={{ height: CELL_HEIGHT }}
              >
                {dayLabel}
              </div>

              {/* Cropped hour cells */}
              {visibleCells.map((cell) => {
                const cellKey  = `${cell.day}-${cell.hour}`;
                const isTop    = topSet.has(cellKey);
                const isProfit = cell.pnl > 0;

                return (
                  <div
                    key={cell.hour}
                    style={{
                      height: CELL_HEIGHT,
                      borderRadius: 4,
                      backgroundColor: cellBg(cell, bounds),
                      // Subtle grid structure on empty cells
                      border: cell.trades === 0
                        ? "1px solid rgb(var(--foreground-muted) / 0.10)"
                        : "1px solid transparent",
                      // Guide line just before each session pivot
                      borderRight: ALL_GUIDE_HOURS.has(cell.hour)
                        ? "1px solid rgb(var(--foreground-muted) / 0.18)"
                        : undefined,
                      // FIX 4 — glow on top 3 profit + top 3 loss
                      boxShadow: isTop && cell.trades > 0
                        ? `0 0 12px ${
                            isProfit
                              ? "rgb(var(--profit) / 0.45)"
                              : "rgb(var(--loss)   / 0.45)"
                          }`
                        : undefined,
                      position: "relative",
                      zIndex: isTop ? 5 : undefined,
                      cursor: "pointer",
                      transition: "opacity 100ms ease",
                      // FIX 5 — flex centre for in-cell text
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                    }}
                    className="hover:opacity-75 motion-reduce:transition-none"
                    onMouseEnter={(e) =>
                      setTooltip({
                        visible: true,
                        x: e.clientX,
                        y: e.clientY,
                        day: dayLabel,
                        hour: cell.hour,
                        trades: cell.trades,
                        pnl: cell.pnl,
                        winRate: cell.winRate,
                      })
                    }
                    onMouseMove={(e) =>
                      setTooltip(prev => ({ ...prev, x: e.clientX, y: e.clientY }))
                    }
                    onMouseLeave={() => setTooltip(HIDDEN_TOOLTIP)}
                  >
                    {/* FIX 5 — in-cell text for top 6 cells */}
                    {isTop && cell.trades > 0 && (
                      <span
                        style={{
                          fontSize: 10,
                          fontWeight: 600,
                          lineHeight: 1,
                          pointerEvents: "none",
                          userSelect: "none",
                          color: isProfit
                            ? "rgb(var(--profit))"
                            : "rgb(var(--loss))",
                          textShadow: "0 1px 3px rgb(0 0 0 / 0.6)",
                        }}
                      >
                        {formatCellPnl(cell.pnl)}
                      </span>
                    )}
                  </div>
                );
              })}
            </Fragment>
          );
        })}

        {/* Hour label row */}
        <div style={{ height: 18 }} /> {/* spacer under day-label column */}
        {Array.from({ length: numHours }, (_, i) => {
          const h = minHour + i;
          return (
            <div
              key={`hl-${h}`}
              className="text-center text-foreground-muted select-none font-mono"
              style={{ fontSize: 9, lineHeight: "18px" }}
            >
              {ALL_PIVOT_HOURS.has(h) ? `${h}h` : ""}
            </div>
          );
        })}
      </div>

      {/* ── Legend ───────────────────────────────────────────────────────── */}
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

      {/* ── Cursor-follow tooltip — portal vers document.body ────────────── */}
      {tooltip.visible && (
        <HeatmapTooltip
          x={tooltip.x}
          y={tooltip.y}
          day={tooltip.day}
          hour={tooltip.hour}
          trades={tooltip.trades}
          pnl={tooltip.pnl}
          winRate={tooltip.winRate}
        />
      )}
    </div>
  );
}
