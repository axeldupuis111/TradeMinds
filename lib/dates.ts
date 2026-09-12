import { langueCourante } from "@/lib/nombres";

/**
 * LES DATES SUIVENT LA LANGUE DE L'APPLICATION, PAS CELLE DU NAVIGATEUR NI
 * CELLE DU DÉVELOPPEUR.
 *
 * ── LE DÉFAUT, VU À L'ÉCRAN ─────────────────────────────────────────────────
 *
 * ⚠️⚠️ INTERFACE EN ANGLAIS, DATE EN FRANÇAIS. Sur la fiche d'un aperçu de
 * backtest : « Direction: Buy · Date: 02/01/2025 10:45 ». Le 2 janvier, écrit
 * dans un ordre que n'importe quel lecteur anglophone lit « February 1st ».
 * Sept appels à `toLocaleDateString()` SANS ARGUMENT demandaient la langue du
 * NAVIGATEUR, qui n'a aucune raison d'être celle choisie dans l'application.
 *
 * ⚠️⚠️ ET L'AUTRE MOITIÉ DU DÉFAUT EST L'INVERSE : sept appels ailleurs dans le
 * produit passaient « fr-FR » EN DUR. La date de renouvellement de
 * l'abonnement, celle qu'un abonné anglophone lit avant de payer, sortait en
 * « 9 juillet 2026 ». Une langue écrite en dur est aussi fausse qu'une langue
 * absente : elle est simplement fausse pour d'autres gens.
 *
 * ── LA RÈGLE ────────────────────────────────────────────────────────────────
 *
 * Une seule source : la langue de l'application, lue sur le document (voir
 * `langueCourante`). Deux fonctions, parce que les deux usages sont vraiment
 * différents : une date seule dans un titre, une date avec l'heure sur un
 * trade, où la minute est l'information.
 */

/** Une date seule : « 02/01/2025 » en français, « 1/2/2025 » en anglais. */
export function enDate(valeur: Date | number | string, langue?: string): string {
  return new Date(valeur).toLocaleDateString(langue ?? langueCourante());
}

/**
 * Une date avec l'heure.
 *
 * ⚠️ LA MINUTE EST L'INFORMATION, pas la décoration : sur un plan en M5, deux
 * trades à quatre minutes d'intervalle sont deux trades différents, et une
 * heure arrondie les confondrait.
 */
export function enDateEtHeure(valeur: Date | number | string, langue?: string): string {
  return new Date(valeur).toLocaleString(langue ?? langueCourante(), {
    dateStyle: "short",
    timeStyle: "short",
  });
}

/**
 * Une date écrite en toutes lettres : « 9 juillet 2026 », « July 9, 2026 ».
 *
 * ⚠️ POUR LES DATES QU'ON LIT UNE FOIS ET QUI ENGAGENT : un renouvellement
 * d'abonnement, une fin de challenge. Le format court y est ambigu d'une langue
 * à l'autre, et c'est précisément là qu'il ne faut pas l'être.
 */
export function enDateLongue(valeur: Date | number | string, langue?: string): string {
  return new Date(valeur).toLocaleDateString(langue ?? langueCourante(), {
    day: "numeric",
    month: "long",
    year: "numeric",
  });
}

/** Un jour et un mois, pour un axe de graphique : « 09/07 », « 07/09 ». */
export function enJourEtMois(valeur: Date | number | string, langue?: string): string {
  return new Date(valeur).toLocaleDateString(langue ?? langueCourante(), {
    day: "2-digit",
    month: "2-digit",
  });
}

/**
 * L'heure seule, à la minute : « 21:00 » en français, « 9:00 PM » en anglais.
 *
 * ⚠️ LE FORMAT HORAIRE EST UNE PROPRIÉTÉ DE LA LANGUE, pas une constante.
 * Un lecteur anglophone lit « 21:00 » sans difficulté, mais son produit ne
 * l'écrit pas comme ça, et le mélange (date à l'anglaise, heure à la française)
 * se remarque immédiatement.
 */
export function enHeure(valeur: Date | number | string, langue?: string): string {
  return new Date(valeur).toLocaleTimeString(langue ?? langueCourante(), {
    hour: "2-digit",
    minute: "2-digit",
  });
}
