import { defaultLocale, locales } from "@/i18n/config";

/**
 * DANS QUELLE LANGUE LE MODÈLE RÉPOND-IL QUAND ON NE LUI DIT PAS ?
 *
 * ── DEUX RÉPONSES À LA MÊME QUESTION ────────────────────────────────────────
 *
 * Neuf routes IA résolvent la langue de leur réponse. Quatre répondaient
 * « anglais » quand la demande n'en portait pas (`monthly-review`,
 * `projection-verdict`, `weekly-plan`, `session-debrief`) et cinq répondaient
 * « français » (`analyze`, `chat-coach`, `compiler-strategie`,
 * `daily-summary`, `parse-strategy`), plus le catalogue d'outils du coach.
 *
 * Ce n'est pas un choix : c'est la même question tranchée deux fois, dans deux
 * sens, dans le même dépôt. Et le reste du produit a déjà tranché :
 * `i18n/config` pose `defaultLocale = 'en'`, `LanguageContext` pose
 * `DEFAULT_LANG = 'en'`, les trois crons d'e-mails et l'e-mail de félicitations
 * replient sur l'anglais. Le français était la réponse d'un produit conçu en
 * français, pas celle du produit tel qu'il est lu.
 *
 * ⚠️ CE N'EST PAS THÉORIQUE. Au 2026-09-12, 17 des 21 inscrits du mois sont
 * anglophones. Le jour où un appelant oublie de passer la langue (une reprise,
 * un cron, un rail serveur), c'est une analyse payante rendue en français à
 * quelqu'un qui ne le lit pas.
 *
 * ── ET UN CODE INCONNU N'EST PAS UNE LANGUE ─────────────────────────────────
 *
 * ⚠️ Les cinq routes « français » acceptaient N'IMPORTE QUELLE chaîne comme
 * code de langue et ne repliaient que sur l'échec de la recherche du NOM. Les
 * quatre routes « anglais » validaient d'abord le code. C'est ce second motif,
 * plus sûr, qui est repris ici : `« zz »` ne devient pas une langue.
 */

/** Le nom que le modèle reconnaît, dans la langue elle-même. */
export const LANGUES_DU_MODELE: Record<string, string> = {
  fr: "français",
  en: "English",
  de: "Deutsch",
  es: "español",
};

/**
 * Le code de langue demandé, ou celui du produit si la demande n'en porte pas
 * (ou en porte un qu'on ne sait pas écrire).
 */
export function codeDeLangue(demandee: unknown): string {
  const code = typeof demandee === "string" ? demandee.trim().toLowerCase() : "";
  return (locales as readonly string[]).includes(code) ? code : defaultLocale;
}

/** Le nom de la langue à écrire dans le prompt, jamais indéfini. */
export function nomDeLangue(demandee: unknown): string {
  return LANGUES_DU_MODELE[codeDeLangue(demandee)];
}
