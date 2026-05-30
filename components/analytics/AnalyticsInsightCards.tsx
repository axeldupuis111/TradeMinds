"use client";

import { KpiCardPremium } from "@/components/dashboard/KpiCardPremium";
import { useLanguage } from "@/lib/LanguageContext";
import { AlertTriangle, Brain, Clock, TrendingDown } from "lucide-react";

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
}

export function AnalyticsInsightCards({ worstDay, bestHour, riskyPairInfo, byEmotion }: Props) {
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
              <p className="text-xs text-loss tabular-nums mt-0.5">
                {worstDay.pnl.toFixed(2)}€ · WR {worstDay.winrate}%
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
              <p className="text-xs text-profit tabular-nums mt-0.5">
                +{bestHour.pnl.toFixed(2)}€ · WR {bestHour.winrate}%
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
            <div>
              <p className="text-[10px] text-warning/80 font-semibold uppercase tracking-wider mb-1">
                {t("analytics_insight_risk_pair")}
              </p>
              {riskyPairInfo.type === "good" ? (
                /* Neutre — pas de couleur "ça va bien" en vert sur fond amber */
                <p className="text-sm font-semibold text-foreground-muted">{t("analytics_no_risk_pair")}</p>
              ) : (
                <>
                  <p className="text-sm font-semibold text-foreground">
                    {riskyPairInfo.pair} · WR {riskyPairInfo.winrate}%
                  </p>
                  <p className="text-xs text-loss tabular-nums mt-0.5">
                    {riskyPairInfo.pnl.toFixed(2)}€
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
                <p className="text-xs text-loss tabular-nums mt-0.5">{riskyEmotion.pnl.toFixed(2)}€</p>
              </div>
            </div>
          </KpiCardPremium>
        );
      })()}

    </div>
  );
}
