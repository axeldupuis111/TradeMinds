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
 *   analyse 12 · coach 176 · débrief 22 · résumé 22 · plan hebdo 4
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
  // Julie : 176 messages/mois. Premium = ×1,48, soit 12 messages par jour ouvré
  // en moyenne, le quota JOURNALIER de 30 restant inchangé.
  //
  // ⚠️ RAMENÉ DE 450 À 260 PUIS REMONTÉ À 350 LE 2026-08-14, EN ÉCHANGE DE SONNET 5. Ce n'est pas
  // un resserrement : c'est le prix d'un coach qui répond juste. Mesuré, sur
  // une question à réponse vérifiable, Haiku donnait trois réponses fausses et
  // toutes différentes là où Sonnet répond juste trois fois sur trois.
  // À 260 messages, Sonnet coûte 12,43 € pour 13,95 € d'enveloppe, soit 1,52 €
  // de marge au pire cas, et encore +0,59 € si les routes estimées se révélaient
  // 20 % plus chères. À 280 le coussin disparaît.
  //
  // ⚠️ CE CHIFFRE A ÉTÉ POSÉ TROIS FOIS AVANT D'ÊTRE JUSTE (200, puis 340, puis
  // 320), parce que le préfixe avait été mesuré sur Haiku et appliqué au tarif
  // Sonnet. Le même prompt compte 14 297 tokens sur l'un et 20 690 sur l'autre :
  // un token de préfixe coûte 4,3× plus cher sur Sonnet, pas 3×. Ne jamais
  // reporter un comptage d'un modèle à un autre.
  //
  // ⚠️ CE CHIFFRE EST AFFICHÉ dans la matrice des plans et la FAQ en quatre
  // langues, et `plan-quota-copy.test.ts` échoue si la copy diverge : le
  // changer ici OBLIGE à changer les quatre traductions. C'est voulu.
  //
  // Ce qui l'a rendu possible : le catalogue d'outils est passé en
  // `defer_loading` (préfixe 21 022 → 14 297). Sans ce report, 350 messages sur
  // Sonnet coûteraient bien au-delà de l'enveloppe. Les deux vont ensemble.
  chat: { free: 3, plus: 150, premium: 350 },
};

/**
 * Plafonds des routes secondaires. Indépendants du plan : elles sont déjà
 * fermées aux comptes gratuits quand elles doivent l'être, et leur coût
 * unitaire est faible (Haiku). La clé est le `feature` passé à rateLimitAi.
 */
export const FEATURE_MONTHLY_CEILING: Record<string, number> = {
  "session-debrief": 70, // Julie : 22 (×3,2, conforme)
  "daily-summary": 70, // Julie : 22 (×3,2, conforme)
  "monthly-review": 10, // Julie : 1
  // ── Passe du 2026-08-14 : cinq plafonds avaient dérivé loin au-dessus du
  // ×3 que ce fichier énonce, sans que personne ne les additionne. Ramenés à
  // la doctrine, ils rendent 0,77 € par abonné Premium au plafond, soit
  // exactement le coussin qui manquait pour financer Sonnet 5 + recherche web
  // sur le coach. Aucun n'est descendu sous ×3 de l'usage de Julie.
  "weekly-plan": 20, // Julie : 4 à 8, et le plan est mis en cache par semaine
  "parse-strategy": 15, // Julie : 1 (une fiche ne se réécrit pas tous les jours)
  "goals-interpret": 15, // Julie : 4
  "calendar-explain": 36, // Julie : 12
  "community-interpret": 20, // Julie : 5 (était à ×12, le plus dérivé du lot)
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
