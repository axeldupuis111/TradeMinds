"use client";

import { KpiCardPremium } from "@/components/dashboard/KpiCardPremium";
import type { AccentColor } from "@/components/dashboard/KpiCardPremium";
import { Badge } from "@/components/ui/Badge";
import { ScoreRing } from "@/components/dashboard/ScoreRing";
import { useLanguage } from "@/lib/LanguageContext";
import { CheckCircle2, AlertTriangle } from "lucide-react";

export interface AnalyticsKpiCardsProps {
  totalPnl: number;
  winrate: number;
  wins: number;
  tradesCount: number;
  best: number;
  worst: number;
  profitFactor: number | null;
  disciplineScore: number | undefined;
  prevKpis: { totalPnl: number; winrate: number; trades: number } | null;
}

export function AnalyticsKpiCards({
  totalPnl,
  winrate,
  wins,
  tradesCount,
  best,
  worst,
  profitFactor,
  disciplineScore,
  prevKpis,
}: AnalyticsKpiCardsProps) {
  const { t } = useLanguage();

  const pnlDiff    = prevKpis ? totalPnl - prevKpis.totalPnl : null;
  const wrDiff     = prevKpis ? winrate - prevKpis.winrate : null;
  const tradesDiff = prevKpis ? tradesCount - prevKpis.trades : null;

  const pnlAccent: AccentColor = totalPnl > 0 ? "green" : totalPnl < 0 ? "loss" : "cyan";
  const synthAccent: AccentColor = totalPnl >= 0 ? "green" : "loss";

  return (
    <div className="mb-6 space-y-3">

      {/* ── Ligne 1 : 4 KPIs principaux ──────────────────────────────────── */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">

        {/* P&L total */}
        <KpiCardPremium
          layout="kpi"
          accentColor={pnlAccent}
          label={t("analytics_kpi_pnl")}
          value={`${totalPnl >= 0 ? "+" : ""}${totalPnl.toFixed(2)}€`}
          trend={totalPnl >= 0 ? "up" : "down"}
          sublabel={
            pnlDiff !== null && pnlDiff !== 0
              ? `${pnlDiff > 0 ? "↑" : "↓"} ${Math.abs(pnlDiff).toFixed(2)}`
              : undefined
          }
        />

        {/* Winrate */}
        <KpiCardPremium
          layout="kpi"
          accentColor="cyan"
          label={t("analytics_kpi_winrate")}
          value={`${winrate.toFixed(1)}%`}
          trend={winrate >= 50 ? "up" : "down"}
          sublabel={
            wrDiff !== null && wrDiff !== 0
              ? `${wrDiff > 0 ? "↑" : "↓"} ${Math.abs(wrDiff).toFixed(1)}pp`
              : `${wins}/${tradesCount}`
          }
        />

        {/* Trades count */}
        <KpiCardPremium
          layout="kpi"
          accentColor="cyan"
          label={t("analytics_kpi_trades")}
          value={tradesCount}
          sublabel={
            tradesDiff !== null && tradesDiff !== 0
              ? `${tradesDiff > 0 ? "↑" : "↓"} ${Math.abs(tradesDiff)}`
              : undefined
          }
        />

        {/* Score discipline */}
        <KpiCardPremium
          layout="kpi"
          accentColor="cyan"
          label={t("ict_kpi_discipline")}
          value={disciplineScore != null ? `${disciplineScore}/100` : "—"}
          trend={
            disciplineScore != null
              ? disciplineScore >= 75 ? "up"
              : disciplineScore >= 40 ? "neutral"
              : "down"
              : undefined
          }
          visual={
            disciplineScore != null
              ? <ScoreRing score={disciplineScore} size="sm" />
              : undefined
          }
        />

      </div>

      {/* ── Ligne 2 : 3 KPIs détail ──────────────────────────────────────── */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">

        {/* Best trade */}
        <KpiCardPremium
          layout="kpi"
          accentColor="green"
          label={t("analytics_kpi_best")}
          value={`+${best.toFixed(2)}€`}
          trend="up"
        />

        {/* Worst trade */}
        <KpiCardPremium
          layout="kpi"
          accentColor="loss"
          label={t("analytics_kpi_worst")}
          value={`${worst.toFixed(2)}€`}
          trend="down"
        />

        {/* Synthèse — Profit Factor */}
        <KpiCardPremium
          layout="kpi"
          accentColor={synthAccent}
          label={t("analytics_kpi_title")}
          value={
            profitFactor !== null
              ? isFinite(profitFactor)
                ? profitFactor.toFixed(2)
                : "∞"
              : "—"
          }
          sublabel="Profit Factor"
          badge={
            <Badge variant={totalPnl >= 0 ? "success" : "danger"} size="sm">
              {totalPnl >= 0 ? (
                <>
                  <CheckCircle2 className="w-3 h-3 shrink-0" />
                  {t("analytics_kpi_profitable")}
                </>
              ) : (
                <>
                  <AlertTriangle className="w-3 h-3 shrink-0" />
                  {t("analytics_kpi_in_loss")}
                </>
              )}
            </Badge>
          }
        />

      </div>
    </div>
  );
}
