"use client";

import { Fragment, useMemo } from "react";
import { buildHeatmap, getHeatmapBounds, type HeatmapCell } from "@/lib/analytics/heatmap";
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

// Only show tick labels at these hours; others are empty
const LABELED_HOURS = new Set([0, 6, 12, 18, 23]);

// ─── Colour interpolation ─────────────────────────────────────────────────────

function cellBg(
  cell: HeatmapCell,
  bounds: { minPnl: number; maxPnl: number }
): string {
  if (cell.trades === 0) return "rgb(var(--foreground) / 0.04)";
  if (cell.pnl === 0) return "rgb(var(--foreground-muted) / 0.18)";
  if (cell.pnl > 0 && bounds.maxPnl > 0) {
    const a = Math.max(0.12, Math.min(0.85, (cell.pnl / bounds.maxPnl) * 0.85));
    return `rgb(var(--profit) / ${a.toFixed(2)})`;
  }
  if (cell.pnl < 0 && bounds.minPnl < 0) {
    const a = Math.max(
      0.12,
      Math.min(0.85, (Math.abs(cell.pnl) / Math.abs(bounds.minPnl)) * 0.85)
    );
    return `rgb(var(--loss) / ${a.toFixed(2)})`;
  }
  return "rgb(var(--foreground-muted) / 0.18)";
}

function fmtLegend(n: number): string {
  const r = Math.round(n);
  if (r === 0) return "0 €";
  return `${r > 0 ? "+" : ""}${r} €`;
}

function fmtTooltip(cell: HeatmapCell, dayLabel: string): string {
  if (cell.trades === 0) return `${dayLabel} ${cell.hour}h · Aucun trade`;
  const wr = Math.round(cell.winRate * 100);
  const pnlStr = fmtLegend(cell.pnl);
  return `${dayLabel} ${cell.hour}h · ${cell.trades} trade${cell.trades > 1 ? "s" : ""} · ${pnlStr} · WR ${wr} %`;
}

// ─── Component ────────────────────────────────────────────────────────────────

export function HourDayHeatmap({ trades }: Props) {
  const { t } = useLanguage();

  const heatmap = useMemo(() => buildHeatmap(trades), [trades]);
  const bounds = useMemo(() => getHeatmapBounds(heatmap), [heatmap]);

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
                style={{ height: 28 }}
              >
                {dayLabel}
              </div>

              {/* 24 hour cells */}
              {row.map((cell) => (
                <div
                  key={cell.hour}
                  title={fmtTooltip(cell, dayLabel)}
                  style={{
                    height: 28,
                    borderRadius: 4,
                    backgroundColor: cellBg(cell, bounds),
                    cursor: "pointer",
                    transition: "opacity 100ms ease",
                  }}
                  className="hover:opacity-75 motion-reduce:transition-none"
                />
              ))}
            </Fragment>
          );
        })}

        {/* Hour label row */}
        <div style={{ height: 16 }} /> {/* spacer under day labels */}
        {Array.from({ length: 24 }, (_, h) => (
          <div
            key={`hl-${h}`}
            className="text-center text-foreground-muted select-none"
            style={{ fontSize: 9, lineHeight: "16px" }}
          >
            {LABELED_HOURS.has(h) ? `${h}h` : ""}
          </div>
        ))}
      </div>

      {/* ── Legend ───────────────────────────────────────────────────────── */}
      <div className="flex items-center justify-end gap-2 mt-3">
        <span className="text-[10px] text-foreground-muted tabular-nums">
          {fmtLegend(bounds.minPnl)}
        </span>
        <div
          style={{
            width: 80,
            height: 8,
            borderRadius: 4,
            background:
              "linear-gradient(to right, rgb(var(--loss) / 0.80), rgb(var(--foreground) / 0.08), rgb(var(--profit) / 0.80))",
          }}
        />
        <span className="text-[10px] text-foreground-muted tabular-nums">
          {fmtLegend(bounds.maxPnl)}
        </span>
      </div>
    </div>
  );
}
