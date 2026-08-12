"use client";

import { useLanguage } from "@/lib/LanguageContext";
import {
  CAPABILITY_TIERS,
  COACH_CAPABILITIES,
  capabilityPlan,
  coachQuotaText,
  toolCountForPlan,
  type CapabilityPlan,
} from "@/lib/coach-capabilities";

/**
 * Ce que le coach fait déjà pour toi, et ce qu'il ferait au palier suivant.
 *
 * Le problème mesuré : l'adoption du coach était quasi nulle alors que les
 * outils existaient. Un abonné ne peut pas demander ce qu'il ignore. Cet
 * encadré nomme ses capacités actuelles au lieu de les laisser deviner, et
 * montre le palier suivant sans le déguiser en fonctionnalité verrouillée.
 */

const RANK: Record<CapabilityPlan, number> = { free: 0, plus: 1, premium: 2 };

export default function CoachLadder({ plan }: { plan: CapabilityPlan }) {
  const { t } = useLanguage();

  return (
    <div className="mt-10 rounded-2xl border border-border bg-card p-5 sm:p-6">
      <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1 mb-1">
        <h2 className="text-lg font-bold text-foreground">{t("ladder_title")}</h2>
        <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-accent/15 text-accent">
          {t("op_tier_tools").replace("{count}", String(toolCountForPlan(plan)))}
        </span>
      </div>
      <p className="text-sm text-foreground-muted mb-5">{t("ladder_subtitle")}</p>

      <div className="grid md:grid-cols-3 gap-4">
        {CAPABILITY_TIERS.map((tier) => {
          const owned = RANK[plan] >= RANK[tier.plan];
          const gained = COACH_CAPABILITIES.filter((c) => capabilityPlan(c) === tier.plan);

          return (
            <div
              key={tier.plan}
              className={`rounded-xl border p-4 ${
                owned ? "border-accent/35 bg-accent/[0.05]" : "border-border bg-surface/40"
              }`}
            >
              <div className="flex items-center justify-between gap-2 mb-1">
                <span className="text-[10px] font-bold uppercase tracking-wider text-foreground-muted">
                  {t(tier.planKey)}
                </span>
                <span
                  className={`text-[10px] font-semibold px-1.5 py-0.5 rounded ${
                    owned ? "bg-accent/15 text-accent" : "bg-surface text-foreground-muted"
                  }`}
                >
                  {owned ? t("ladder_active") : t("ladder_locked")}
                </span>
              </div>
              <h3 className="text-sm font-bold text-foreground">{t(tier.titleKey)}</h3>
              <p className={`text-[11px] mb-3 ${owned ? "text-accent" : "text-foreground-muted"}`}>
                {coachQuotaText(tier.plan, t)}
              </p>
              <ul className="space-y-1.5">
                {gained.map((cap) => (
                  <li
                    key={cap.key}
                    className={`flex gap-1.5 text-[12px] leading-snug ${
                      owned ? "text-foreground" : "text-foreground-muted"
                    }`}
                  >
                    <span className={owned ? "text-accent" : "text-foreground-muted"} aria-hidden>
                      {owned ? "✓" : "·"}
                    </span>
                    <span>{t(cap.key)}</span>
                  </li>
                ))}
              </ul>
            </div>
          );
        })}
      </div>

      <p className="text-[12px] text-foreground-muted mt-4">{t("ladder_hint")}</p>
      <p className="text-[12px] text-foreground-muted mt-1">{t("op_not_a_broker")}</p>
    </div>
  );
}
