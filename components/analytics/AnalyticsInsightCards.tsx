"use client";

import { KpiCardPremium } from "@/components/dashboard/KpiCardPremium";
import { DEFAULT_CURRENCY, money } from "@/lib/account-currency";
import { useLanguage } from "@/lib/LanguageContext";
import { AlertTriangle, Brain, Clock, TrendingDown } from "lucide-react";
import { pourcent } from "@/lib/nombres";

interface DayEntry    { name: string; count: number; pnl: number; winrate: number }
interface HourEntry   { name: string; count: number; pnl: number; winrate: number }
interface EmotionEntry { name: string; pnl: number; count: number }

type RiskyPairInfo =
  | { type: "insufficient" }
  | { type: "good" }
  | { type: "risky"; pair: string; winrate: number; pnl: number };

interface Props {
  worstDay:      DayEntry | null;
  bestHour:      HourEntry | null;
  riskyPairInfo: RiskyPairInfo;
  byEmotion:     EmotionEntry[];
  /** Devise du compte filtré ; euro sur une vue multi-comptes. */
  currency?: string;
}

/**
 * LA COULEUR D'UN MONTANT SUIT SON SIGNE, PAS LE TITRE DE SA CARTE.
 *
 * ⚠️⚠️ VU À L'ÉCRAN, SUR ANALYTICS : « PAIRE À RISQUE · GBPUSD · WR 43 % »
 * suivi de « 393,00 € » EN ROUGE ET SANS SIGNE. Ces 393 € sont un GAIN : la
 * paire est retenue parce qu'elle a le plus faible taux de réussite, ce qui
 * n'empêche pas d'y gagner de l'argent. Le trader lit une perte de 393 €.
 *
 * ⚠️ ET LES QUATRE CARTES AVAIENT LE MÊME DÉFAUT, dans les deux sens : « pire
 * journée » et « émotion à risque » peignaient en rouge un montant qui peut
 * être positif, « meilleure heure » peignait en VERT un montant qui peut être
 * négatif quand toutes les heures perdent.
 *
 * Le titre de la carte décrit un CLASSEMENT (le pire, le meilleur) ; le montant
 * décrit un FAIT. Les deux n'ont pas le même signe, et c'est justement quand
 * ils divergent que la carte a quelque chose à apprendre au trader.
 */
function tonDuMontant(v: number): string {
  if (v > 0) return "text-profit";
  if (v < 0) return "text-loss";
  return "text-foreground-muted";
}

export function AnalyticsInsightCards({ worstDay, bestHour, riskyPairInfo, byEmotion, currency = DEFAULT_CURRENCY }: Props) {
  const { t } = useLanguage();

  const hasAny =
    worstDay != null ||
    bestHour != null ||
    riskyPairInfo.type !== "insufficient" ||
    byEmotion.length > 0;

  if (!hasAny) return null;

  return (
    <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-6">

      {/* Worst day */}
      {worstDay && (
        <KpiCardPremium layout="full" accentColor="loss">
          <div className="flex items-start gap-2">
            <TrendingDown className="w-4 h-4 text-loss mt-0.5 shrink-0" strokeWidth={1.75} />
            <div>
              <p className="text-[10px] text-loss/80 font-semibold uppercase tracking-wider mb-1">
                {t("analytics_insight_worst_day")}
              </p>
              <p className="text-sm font-semibold text-foreground">
                {worstDay.name} ({worstDay.count} trades)
              </p>
              <p className={`text-xs tabular-nums mt-0.5 ${tonDuMontant(worstDay.pnl)}`}>
                {money(worstDay.pnl, currency, { digits: 2, signed: true })} · WR {pourcent(worstDay.winrate)}
              </p>
            </div>
          </div>
        </KpiCardPremium>
      )}

      {/* Best hour */}
      {bestHour && (
        <KpiCardPremium layout="full" accentColor="green">
          <div className="flex items-start gap-2">
            <Clock className="w-4 h-4 text-profit mt-0.5 shrink-0" strokeWidth={1.75} />
            <div>
              <p className="text-[10px] text-profit/80 font-semibold uppercase tracking-wider mb-1">
                {t("analytics_insight_best_hour")}
              </p>
              <p className="text-sm font-semibold text-foreground">
                {bestHour.name} ({bestHour.count} trades)
              </p>
              <p className={`text-xs tabular-nums mt-0.5 ${tonDuMontant(bestHour.pnl)}`}>
                {money(bestHour.pnl, currency, { digits: 2, signed: true })} · WR {pourcent(bestHour.winrate)}
              </p>
            </div>
          </div>
        </KpiCardPremium>
      )}

      {/* Risky pair — aura toujours amber (la card existe pour alerter) */}
      {riskyPairInfo.type !== "insufficient" && (
        <KpiCardPremium layout="full" accentColor="amber">
          <div className="flex items-start gap-2">
            <AlertTriangle
              className="w-4 h-4 mt-0.5 shrink-0 text-warning"
              strokeWidth={1.75}
            />
            <div className="min-w-0 flex-1">
              <p className="text-[10px] text-warning/80 font-semibold uppercase tracking-wider mb-1">
                {t("analytics_insight_risk_pair")}
              </p>
              {riskyPairInfo.type === "good" ? (
                /* Neutre — pas de couleur "ça va bien" en vert sur fond amber */
                <p className="text-sm font-semibold text-left text-foreground-muted">{t("analytics_no_risk_pair")}</p>
              ) : (
                <>
                  <p className="text-sm font-semibold text-foreground">
                    {riskyPairInfo.pair} · WR {pourcent(riskyPairInfo.winrate)}
                  </p>
                  <p className={`text-xs tabular-nums mt-0.5 ${tonDuMontant(riskyPairInfo.pnl)}`}>
                    {money(riskyPairInfo.pnl, currency, { digits: 2, signed: true })}
                  </p>
                </>
              )}
            </div>
          </div>
        </KpiCardPremium>
      )}

      {/* Emotion risk */}
      {byEmotion.length > 0 && (() => {
        const riskyEmotion = [...byEmotion].sort((a, b) => a.pnl - b.pnl)[0];
        return (
          <KpiCardPremium layout="full" accentColor="cyan">
            <div className="flex items-start gap-2">
              <Brain className="w-4 h-4 text-accent mt-0.5 shrink-0" strokeWidth={1.75} />
              <div>
                <p className="text-[10px] text-accent/80 font-semibold uppercase tracking-wider mb-1">
                  {t("analytics_insight_emotion")}
                </p>
                <p className="text-sm font-semibold text-foreground">{riskyEmotion.name}</p>
                <p className={`text-xs tabular-nums mt-0.5 ${tonDuMontant(riskyEmotion.pnl)}`}>
                  {money(riskyEmotion.pnl, currency, { digits: 2, signed: true })}
                </p>
              </div>
            </div>
          </KpiCardPremium>
        );
      })()}

    </div>
  );
}
