"use client";

import { useState, useEffect } from "react";
import { createPortal } from "react-dom";
import { useLanguage } from "@/lib/LanguageContext";

// ─── Props ────────────────────────────────────────────────────────────────────
// `visible` est géré côté HourDayHeatmap via rendu conditionnel ; le tooltip
// est donc toujours monté = visible, démonté = caché.

export type HeatmapTooltipProps = {
  x: number;
  y: number;
  day: string;
  hour: number;
  trades: number;
  pnl: number;
  winRate: number;
};

// ─── Helpers ──────────────────────────────────────────────────────────────────

function fmtPnl(n: number): string {
  const r = Math.round(n);
  if (r === 0) return "0 €";
  return `${r > 0 ? "+" : ""}${r} €`;
}

// ─── Constants ────────────────────────────────────────────────────────────────

const TOOLTIP_WIDTH = 180;
const OFFSET_X      = 16;
const OFFSET_Y      = 12;

// ─── Component ────────────────────────────────────────────────────────────────

export function HeatmapTooltip({
  x,
  y,
  day,
  hour,
  trades,
  pnl,
  winRate,
}: HeatmapTooltipProps) {
  const { t } = useLanguage();
  // Fade-in au montage : opacity 0 → 1 après le premier paint.
  // Le fade-out n'est pas nécessaire car le composant est démonté immédiatement.
  const [opacity, setOpacity] = useState(0);
  useEffect(() => {
    const id = requestAnimationFrame(() => setOpacity(1));
    return () => cancelAnimationFrame(id);
  }, []);

  // SSR safety — createPortal n'existe qu'en environnement navigateur
  if (typeof document === "undefined") return null;

  const winW = window.innerWidth;
  const flipLeft = x + OFFSET_X + TOOLTIP_WIDTH > winW;
  const left = flipLeft ? x - TOOLTIP_WIDTH - 8 : x + OFFSET_X;

  return createPortal(
    <div
      style={{
        position: "fixed",
        top: y + OFFSET_Y,
        left,
        minWidth: TOOLTIP_WIDTH,
        zIndex: 9999,
        pointerEvents: "none",
        opacity,
        transition: "opacity 100ms ease",
        background: "rgb(var(--card))",
        border: "1px solid rgb(var(--border))",
        borderRadius: 8,
        padding: "12px 14px",
        boxShadow: "0 12px 32px -8px rgb(0 0 0 / 0.6)",
      }}
    >
      {/* Header */}
      <p
        style={{
          fontSize: 12,
          fontWeight: 600,
          color: "rgb(var(--foreground))",
          marginBottom: 6,
          lineHeight: 1,
        }}
      >
        {day} · {hour}h
      </p>

      {/* Body */}
      {trades === 0 ? (
        <p style={{ fontSize: 11, color: "rgb(var(--foreground-muted))" }}>
          {t("analytics_no_trade")}
        </p>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
          {/* Trades */}
          <div style={{ display: "flex", justifyContent: "space-between", gap: 16 }}>
            <span style={{ fontSize: 11, color: "rgb(var(--foreground-muted))" }}>
              Trades
            </span>
            <span
              style={{
                fontSize: 11,
                fontWeight: 500,
                color: "rgb(var(--foreground))",
                fontVariantNumeric: "tabular-nums",
              }}
            >
              {trades}
            </span>
          </div>

          {/* P&L */}
          <div style={{ display: "flex", justifyContent: "space-between", gap: 16 }}>
            <span style={{ fontSize: 11, color: "rgb(var(--foreground-muted))" }}>
              P&amp;L
            </span>
            <span
              style={{
                fontSize: 11,
                fontWeight: 600,
                fontVariantNumeric: "tabular-nums",
                color: pnl >= 0 ? "rgb(var(--profit))" : "rgb(var(--loss))",
              }}
            >
              {fmtPnl(pnl)}
            </span>
          </div>

          {/* Win rate */}
          <div style={{ display: "flex", justifyContent: "space-between", gap: 16 }}>
            <span style={{ fontSize: 11, color: "rgb(var(--foreground-muted))" }}>
              Win rate
            </span>
            <span
              style={{
                fontSize: 11,
                fontWeight: 500,
                color: "rgb(var(--foreground))",
                fontVariantNumeric: "tabular-nums",
              }}
            >
              {Math.round(winRate * 100)} %
            </span>
          </div>
        </div>
      )}
    </div>,
    document.body,
  );
}
