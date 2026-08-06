/**
 * Plafonds MENSUELS des routes IA — le disjoncteur.
 *
 * Les quotas journaliers existants ne changent pas : ce sont eux que le trader
 * voit et comprend. Le problème qu'ils ne résolvent pas est que « 2 par jour »
 * autorise 60 par mois, alors qu'un trader professionnel à plein temps en fait
 * 12. L'exposition mensuelle n'était donc bornée par rien (pire cas mesuré :
 * 83,49 € pour un abonné Premium à 29,99 €).
 *
 * Ces valeurs valent environ 3× l'usage d'un utilisateur INTENSIF, modélisé
 * ainsi sur un mois de 22 jours de trading :
 *   analyse 12 · vision 44 · coach 176 · débrief 22 · résumé 22 · plan hebdo 4
 *   bilan mensuel 1 · parsing 1 · objectifs 4 · calendrier 12 · communauté 5
 *
 * Autrement dit : pour rencontrer un de ces plafonds, il faut faire trois fois
 * plus qu'une personne dont c'est le métier. Rien n'est affiché, rien n'est à
 * gérer, il n'y a pas de reliquat à perdre en fin de mois — c'est un fusible,
 * pas un budget. Et il se relève compte par compte
 * (profiles.ai_ceiling_multiplier) quand l'usage est légitime.
 */

import type { PlanType } from "@/lib/PlanContext";

/**
 * Plafonds des deux routes à quota de plan (analyse et coach).
 *
 * DOCTRINE — le disjoncteur ne sert que là où le quota journalier ne borne pas
 * assez le mois :
 *  - PLUS : 1 analyse/jour et 5 messages/jour bornent déjà le mois à 30 et 150.
 *    Le plafond est posé à cette valeur, donc il ne mord JAMAIS. Il n'est là
 *    que comme filet si un quota journalier était desserré un jour.
 *  - PREMIUM : 2 analyses/jour et 30 messages/jour autorisent 60 et 900 par
 *    mois, très au-delà de tout usage réel. C'est là que le fusible sert.
 */
export const PLAN_MONTHLY_CEILING: Record<"analyze" | "chat", Record<PlanType, number>> = {
  // Julie, intensive : 12 analyses/mois. Premium = ×3,3.
  analyze: { free: 3, plus: 30, premium: 40 },
  // Julie : 176 messages/mois. Premium = ×2,6.
  chat: { free: 3, plus: 150, premium: 450 },
};

/**
 * Plafonds des routes secondaires. Indépendants du plan : elles sont déjà
 * fermées aux comptes gratuits quand elles doivent l'être, et leur coût
 * unitaire est faible (Haiku). La clé est le `feature` passé à rateLimitAi.
 */
export const FEATURE_MONTHLY_CEILING: Record<string, number> = {
  vision_review: 90, // Julie : 44 (Sonnet 5 + image : la plus chère des secondaires)
  "session-debrief": 70, // Julie : 22
  "daily-summary": 70, // Julie : 22
  "weekly-plan": 40, // désormais mis en cache par semaine et par langue : 4 à 8 suffisent
  "monthly-review": 10, // Julie : 1
  "parse-strategy": 20, // Julie : 1
  "goals-interpret": 40, // Julie : 4
  "calendar-explain": 60, // Julie : 12
  "community-interpret": 60, // Julie : 5
};

/** Clé de mois "2026-08" dans le fuseau du trader (défaut UTC). */
export function monthKey(timezone?: string): string {
  const now = new Date();
  try {
    // en-CA donne "2026-08-06", on garde l'année et le mois.
    return new Intl.DateTimeFormat("en-CA", {
      timeZone: timezone || "UTC",
      year: "numeric",
      month: "2-digit",
    })
      .format(now)
      .slice(0, 7);
  } catch {
    return now.toISOString().slice(0, 7);
  }
}
