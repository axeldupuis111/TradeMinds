"use client";

import { KpiCardPremium } from "@/components/dashboard/KpiCardPremium";
import { DEFAULT_CURRENCY, money } from "@/lib/account-currency";
import type { AccentColor } from "@/components/dashboard/KpiCardPremium";
import { Badge } from "@/components/ui/Badge";
import { ScoreRing } from "@/components/dashboard/ScoreRing";
import { useLanguage } from "@/lib/LanguageContext";
import { CheckCircle2, AlertTriangle } from "lucide-react";
import { nombre, pourcent } from "@/lib/nombres";

export interface AnalyticsKpiCardsProps {
  totalPnl: number;
  winrate: number;
  wins: number;
  tradesCount: number;
  best: number;
  worst: number;
  bestTrade?: { pnl: number; date: string } | null;
  worstTrade?: { pnl: number; date: string } | null;
  profitFactor: number | null;
  disciplineScore: number | undefined;
  prevKpis: { totalPnl: number; winrate: number; trades: number } | null;
  avgWin: number;
  avgLoss: number;
  /** Devise du compte filtré, ou devise commune aux trades affichés. */
  currency?: string;
  /**
   * Le P&L VENTILE PAR DEVISE, quand les trades affiches en melangent
   * plusieurs.
   *
   * ⚠️⚠️ SANS LUI, CETTE PAGE ADDITIONNAIT DES EUROS ET DES DOLLARS.
   * Mesure en production : « Mes Trades » affichait « -6 619,77 € · -449,36 $ »
   * et Analytics, a un clic de la, « P&L TOTAL -7 069,13 $ ». La somme des deux
   * montants, avec le symbole du plus recent. C'est exactement le defaut
   * corrige dans le coach le meme jour, a un autre endroit du produit.
   *
   * ⚠️ LA CAUSE ETAIT SUBTILE : la devise de la page se deduisait des
   * comptes ACTIFS (un seul, en dollars), alors que les totaux portent sur TOUS
   * les trades, y compris ceux des comptes clotures et ceux qui n'ont pas de
   * compte du tout.
   */
  pnlParDevise?: [string, number][];
  /** La devise du meilleur trade, et celle du pire : ce sont deux lignes, pas un total. */
  deviseMeilleur?: string;
  devisePire?: string;
}

export function AnalyticsKpiCards({
  totalPnl,
  winrate,
  wins,
  tradesCount,
  best,
  worst,
  bestTrade,
  worstTrade,
  profitFactor,
  disciplineScore,
  prevKpis,
  avgWin,
  avgLoss,
  currency = DEFAULT_CURRENCY,
  pnlParDevise,
  deviseMeilleur,
  devisePire,
}: AnalyticsKpiCardsProps) {
  const { t, lang } = useLanguage();
  const dateLocale = ({ fr: "fr-FR", en: "en-US", de: "de-DE", es: "es-ES" } as const)[lang] ?? "en-US";

  const pnlDiff    = prevKpis ? totalPnl - prevKpis.totalPnl : null;
  const wrDiff     = prevKpis ? winrate - prevKpis.winrate : null;
  const tradesDiff = prevKpis ? tradesCount - prevKpis.trades : null;

  // Expectancy = winRate × avgWin - (1-winRate) × avgLoss
  const wr01        = winrate / 100;
  const expectancy  = tradesCount > 0 ? wr01 * avgWin - (1 - wr01) * avgLoss : null;
  const projection  = expectancy !== null && tradesCount >= 20
    ? Math.round(expectancy * 100)
    : null;

  /**
   * ⚠️ PLUSIEURS DEVISES : ON NE REND PAS UN TOTAL, ON REND LA LISTE. Le
   * signe global n'a alors plus de sens non plus (gagner 100 $ et perdre 100 €
   * n'est ni un gain ni une perte), d'ou l'accent neutre.
   */
  const melange = (pnlParDevise?.length ?? 0) > 1;
  const pnlAccent: AccentColor = melange
    ? "cyan"
    : totalPnl > 0 ? "green" : totalPnl < 0 ? "loss" : "cyan";
  const synthAccent: AccentColor = totalPnl >= 0 ? "green" : "loss";

  return (
    <div className="mb-6 space-y-2">

      {/* ── Ligne 1 : 4 KPIs principaux ──────────────────────────────────── */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">

        {/* P&L total */}
        <KpiCardPremium
          layout="kpi"
          accentColor={pnlAccent}
          label={t("analytics_kpi_pnl")}
          value={
            melange ? (
              <span className="flex flex-col items-start leading-tight">
                {pnlParDevise!.map(([devise, montant]) => (
                  <span key={devise} className="tabular-nums">
                    {money(montant, devise, { digits: 2, signed: true })}
                  </span>
                ))}
              </span>
            ) : (
              money(totalPnl, currency, { digits: 2, signed: true })
            )
          }
          trend={melange ? undefined : totalPnl >= 0 ? "up" : "down"}
          sublabel={
            // ⚠️ Comparer deux sommes de devises mêlées ne veut rien dire.
            melange
              ? t("analytics_devises_melangees_court")
              : pnlDiff !== null && pnlDiff !== 0
                ? `${pnlDiff > 0 ? "↑" : "↓"} ${nombre(Math.abs(pnlDiff), 2)}`
                : undefined
          }
        />

        {/* Winrate */}
        <KpiCardPremium
          layout="kpi"
          accentColor="cyan"
          label={t("analytics_kpi_winrate")}
          value={pourcent(winrate, 1)}
          trend={winrate >= 50 ? "up" : "down"}
          sublabel={
            wrDiff !== null && wrDiff !== 0
              ? `${wrDiff > 0 ? "↑" : "↓"} ${nombre(Math.abs(wrDiff), 1)}pp`
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
          value={money(best, deviseMeilleur ?? currency, { digits: 2, signed: true })}
          trend="up"
          sublabel={
            bestTrade?.date
              ? new Date(bestTrade.date).toLocaleDateString(dateLocale, { day: "2-digit", month: "2-digit" })
              : undefined
          }
        />

        {/* Worst trade */}
        <KpiCardPremium
          layout="kpi"
          accentColor="loss"
          label={t("analytics_kpi_worst")}
          value={money(worst, devisePire ?? currency, { digits: 2 })}
          trend="down"
          sublabel={
            worstTrade?.date
              ? new Date(worstTrade.date).toLocaleDateString(dateLocale, { day: "2-digit", month: "2-digit" })
              : undefined
          }
        />

        {/* Synthèse — Profit Factor
            ⚠️ Un facteur de profit calculé sur des devises mêlées est un
            rapport entre deux sommes qui n'existent pas : la carte le dit au
            lieu de rendre un nombre. */}
        <KpiCardPremium
          layout="kpi"
          accentColor={melange ? "cyan" : synthAccent}
          label={t("analytics_kpi_title")}
          value={
            melange
              ? "—"
              : profitFactor !== null
                ? isFinite(profitFactor)
                  ? nombre(profitFactor, 2)
                  : "∞"
                : "—"
          }
          sublabel="Profit Factor"
          badge={melange ? undefined : (
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
          )}
        >
          {!melange && expectancy !== null && (
            <div className="flex flex-col gap-0.5">
              <div className="flex items-center justify-between text-xs">
                <span className="text-foreground-muted">{t("analytics_expectancy")}</span>
                <span
                  className={
                    expectancy >= 0 ? "text-profit font-semibold tabular-nums" : "text-loss font-semibold tabular-nums"
                  }
                >
                  {expectancy >= 0 ? "+" : ""}
                  {/*
                    ⚠️⚠️ AU CENTIME, PARCE QUE LA LIGNE D'EN DESSOUS MULTIPLIE
                    CELLE-CI PAR CENT. Arrondie à l'unité, la carte affichait
                    « Espérance +93€/trade » puis « Proj. 100 trades +9 304€ » :
                    le lecteur qui fait la multiplication trouve 9 300 et croit
                    à une erreur, alors que c'est l'espérance qui était
                    tronquée (93,04). Les deux lignes se recollent maintenant.
                  */}
                  {money(expectancy, currency, { digits: 2 })}/trade
                </span>
              </div>
              {projection !== null && (
                <div className="flex items-center justify-between text-xs">
                  <span className="text-foreground-subtle">{t("analytics_proj100")}</span>
                  <span className="text-foreground-muted tabular-nums">
                    {projection >= 0 ? "+" : ""}
                    {money(projection, currency)}
                  </span>
                </div>
              )}
            </div>
          )}
        </KpiCardPremium>

      </div>
    </div>
  );
}
