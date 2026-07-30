"use client";

import { DEFAULT_CURRENCY, money } from "@/lib/account-currency";
import { useLanguage } from "@/lib/LanguageContext";
import type { ChallengeProjection } from "@/lib/challenge-projection";
import { TrendingUp, Gauge } from "lucide-react";

const STATUS_META: Record<string, { color: string; bar: string; labelKey: string }> = {
  on_track: { color: "text-profit", bar: "bg-profit", labelKey: "challenge_proj_status_on_track" },
  behind: { color: "text-warning", bar: "bg-warning", labelKey: "challenge_proj_status_behind" },
  at_risk: { color: "text-loss", bar: "bg-loss", labelKey: "challenge_proj_status_at_risk" },
  insufficient: { color: "text-foreground-muted", bar: "bg-foreground-muted", labelKey: "challenge_proj_insufficient" },
};

export function ChallengeProjectionBlock({
  projection,
  currency = DEFAULT_CURRENCY,
}: {
  projection: ChallengeProjection;
  /** Devise du compte projeté. */
  currency?: string;
}) {
  const { t } = useLanguage();
  const fmtEur = (n: number) => money(n, currency, { signed: true });
  if (projection.status === "passed" || projection.status === "failed") return null;

  const meta = STATUS_META[projection.status];
  const pct = projection.successProb != null ? Math.round(projection.successProb * 100) : null;

  return (
    <div className="mt-6 rounded-xl border border-border bg-surface/40 p-4">
      <div className="flex items-center gap-2 mb-3">
        <Gauge className="w-4 h-4 text-accent" strokeWidth={1.75} />
        <h3 className="text-sm font-semibold text-foreground">{t("challenge_projection_title")}</h3>
      </div>

      {pct !== null ? (
        <>
          <div className="flex items-end justify-between mb-1.5">
            <span className="text-xs text-foreground-muted">{t("challenge_proj_success")}</span>
            <span className={`text-2xl font-black tabular-nums leading-none ${meta.color}`}>{pct}%</span>
          </div>
          <div className="h-2 bg-foreground/5 rounded-full overflow-hidden">
            <div className={`h-full rounded-full transition-all duration-700 ${meta.bar}`} style={{ width: `${pct}%` }} />
          </div>
          <p className={`text-xs font-medium mt-1.5 ${meta.color}`}>{t(meta.labelKey)}</p>
        </>
      ) : (
        <p className="text-xs text-foreground-muted">{t("challenge_proj_insufficient")}</p>
      )}

      <div className="mt-3 flex flex-wrap gap-x-5 gap-y-1 text-xs text-foreground-muted">
        {projection.daysToTarget !== null && (
          <span className="inline-flex items-center gap-1.5">
            <TrendingUp className="w-3.5 h-3.5 text-profit" />
            {t("challenge_proj_eta").replace("{n}", String(projection.daysToTarget))}
          </span>
        )}
        <span className="tabular-nums">
          {t("challenge_proj_pace").replace("{v}", fmtEur(projection.pacePerDay))}
        </span>
      </div>

      {pct !== null && (
        <p className="mt-2 text-[10px] text-foreground-muted/60 italic leading-snug">
          {t("challenge_proj_disclaimer")}
        </p>
      )}
    </div>
  );
}
