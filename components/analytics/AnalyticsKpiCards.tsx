"use client";

/**
 * AnalyticsKpiCards — la rangée de 7 KPIs en haut de la page Analytics.
 * Utilise Card + Stat (design system), ScoreRing pour la discipline.
 */

import { Card } from "@/components/ui/Card";
import { Stat } from "@/components/ui/Stat";
import { Badge } from "@/components/ui/Badge";
import { ScoreRing } from "@/components/dashboard/ScoreRing";
import { useLanguage } from "@/lib/LanguageContext";

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

  const pnlDiff   = prevKpis ? totalPnl - prevKpis.totalPnl : null;
  const wrDiff    = prevKpis ? winrate - prevKpis.winrate : null;
  const tradesDiff = prevKpis ? tradesCount - prevKpis.trades : null;

  return (
    <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-7 gap-3 mb-6">

      {/* P&L total */}
      <Card padding="sm">
        <Stat
          label={t("analytics_kpi_pnl")}
          value={`${totalPnl >= 0 ? "+" : ""}${totalPnl.toFixed(2)}€`}
          trend={totalPnl >= 0 ? "up" : "down"}
          sublabel={
            pnlDiff !== null && pnlDiff !== 0
              ? `${pnlDiff > 0 ? "↑" : "↓"} ${Math.abs(pnlDiff).toFixed(2)}`
              : undefined
          }
        />
      </Card>

      {/* Winrate */}
      <Card padding="sm">
        <Stat
          label={t("analytics_kpi_winrate")}
          value={`${winrate.toFixed(1)}%`}
          trend={winrate >= 50 ? "up" : "down"}
          sublabel={
            wrDiff !== null && wrDiff !== 0
              ? `${wrDiff > 0 ? "↑" : "↓"} ${Math.abs(wrDiff).toFixed(1)}pp`
              : undefined
          }
        />
      </Card>

      {/* Trades count */}
      <Card padding="sm">
        <Stat
          label={t("analytics_kpi_trades")}
          value={tradesCount}
          sublabel={
            tradesDiff !== null && tradesDiff !== 0
              ? `${tradesDiff > 0 ? "↑" : "↓"} ${Math.abs(tradesDiff)}`
              : undefined
          }
        />
      </Card>

      {/* Best trade */}
      <Card padding="sm">
        <Stat
          label={t("analytics_kpi_best")}
          value={`+${best.toFixed(2)}€`}
          trend="up"
        />
      </Card>

      {/* Worst trade */}
      <Card padding="sm">
        <Stat
          label={t("analytics_kpi_worst")}
          value={`${worst.toFixed(2)}€`}
          trend="down"
        />
      </Card>

      {/* Synthèse — Profit Factor + badge profitable/en perte */}
      <Card padding="sm">
        <Stat
          label={t("analytics_kpi_title")}
          value={
            profitFactor !== null
              ? isFinite(profitFactor)
                ? profitFactor.toFixed(2)
                : "∞"
              : "—"
          }
          sublabel="Profit Factor"
          visual={
            <Badge variant={totalPnl >= 0 ? "success" : "danger"} size="sm">
              {totalPnl >= 0 ? t("analytics_kpi_profitable") : t("analytics_kpi_in_loss")}
            </Badge>
          }
        />
      </Card>

      {/* Score discipline — ScoreRing sémantique */}
      <Card padding="sm">
        <Stat
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
      </Card>

    </div>
  );
}
