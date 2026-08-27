import { lancerBacktest } from "./engine";
import { MIN_TRADES_CONCLUSION } from "./verdict";
import type { PlanExecution, SerieM1 } from "./types";

/**
 * QUAND L'ÉCHANTILLON EST TROP PETIT, CHERCHER LE RÉGLAGE LE PLUS PROCHE QUI
 * EN PRODUIT ASSEZ.
 *
 * ── LE PROBLÈME MESURÉ ──────────────────────────────────────────────────────
 *
 * Sur 108 réglages plausibles d'une trendline sur le Nasdaq, 3 % rendent zéro
 * trade et 56 % en rendent moins de cent : plus d'un essai sur deux se solde par
 * « pas assez de trades pour conclure », c'est-à-dire par un écran vide. Un
 * trader qui vit ça deux fois de suite s'en va, et il a raison : un outil qui ne
 * sait que dire non n'aide personne.
 *
 * ⚠️⚠️ ON N'OPTIMISE QUE LA TAILLE DE L'ÉCHANTILLON, JAMAIS LE RÉSULTAT, ET
 * CETTE FRONTIÈRE EST TOUTE LA DIFFÉRENCE ENTRE AIDER ET TRICHER.
 *
 * Proposer « avec un pivot de 5 au lieu de 12, ton plan produit 287 trades » est
 * une aide : ça répond à « pourquoi je ne vois rien » sans rien dire de la
 * performance. Proposer « avec un pivot de 5, ton plan gagne +0,4R » serait de
 * la recherche de paramètres déguisée en assistance : on chercherait POUR le
 * trader le réglage qui brille, exactement ce que le compteur de tentatives
 * existe pour décourager.
 *
 * Concrètement, cette fonction ne LIT JAMAIS le résultat des variantes qu'elle
 * essaie. Elle ne connaît que leur nombre de trades, et c'est le seul chiffre
 * qu'elle rend. Un test le vérifie.
 *
 * ⚠️ ON NE CHANGE QU'UN LEVIER À LA FOIS, et on les propose du moins au plus
 * intrusif. Une suggestion qui réécrit trois réglages d'un coup ne serait plus
 * la stratégie du trader, et il ne pourrait plus dire ce qui a changé.
 */

export interface Suggestion {
  /** Clé de traduction du levier employé. */
  levier:
    | "tolerance"
    | "pivots"
    | "unite_de_temps"
    | "seance"
    | "touches"
    | "delai";
  /** Valeur avant et après, déjà formatées par l'appelant si besoin. */
  avant: string;
  apres: string;
  /** Nombre de trades obtenus. ⚠️ Le SEUL chiffre qu'on rend. */
  trades: number;
  /** Le plan modifié, prêt à être appliqué. */
  plan: PlanExecution;
}

/** Unités de temps, de la plus fine à la plus large. */
const ECHELLE_UT = [1, 3, 5, 15, 30, 60, 240];

/**
 * Fabrique les variantes candidates, du changement le plus léger au plus lourd.
 *
 * ⚠️ Un seul levier bouge par variante. La liste est courte volontairement :
 * chaque variante est un backtest complet, et en essayer trente ferait de cette
 * aide une recherche exhaustive, c'est-à-dire la chose qu'on refuse.
 */
function variantes(plan: PlanExecution, tailleTick: number): Omit<Suggestion, "trades">[] {
  const out: Omit<Suggestion, "trades">[] = [];
  const enPoints = (ticks: number) => (ticks * tailleTick).toFixed(3).replace(/\.?0+$/, "");

  if (plan.niveau.type === "trendline") {
    const n = plan.niveau;
    for (const facteur of [3, 8]) {
      out.push({
        levier: "tolerance",
        avant: enPoints(n.toleranceTicks),
        apres: enPoints(n.toleranceTicks * facteur),
        plan: { ...plan, niveau: { ...n, toleranceTicks: n.toleranceTicks * facteur } },
      });
    }
    for (const cible of [Math.round(n.pivots / 2), Math.max(3, Math.round(n.pivots / 4))]) {
      if (cible >= 2 && cible < n.pivots) {
        out.push({
          levier: "pivots",
          avant: String(n.pivots),
          apres: String(cible),
          plan: { ...plan, niveau: { ...n, pivots: cible } },
        });
      }
    }
  }

  if (plan.niveau.type === "liquidite_swing" && plan.niveau.pivots > 3) {
    const cible = Math.max(3, Math.round(plan.niveau.pivots / 2));
    out.push({
      levier: "pivots",
      avant: String(plan.niveau.pivots),
      apres: String(cible),
      plan: { ...plan, niveau: { ...plan.niveau, pivots: cible } },
    });
  }

  const ut = plan.uniteDeTemps ?? 1;
  const rang = ECHELLE_UT.indexOf(ut);
  for (const saut of [1, 2]) {
    const cible = ECHELLE_UT[rang - saut];
    if (rang > 0 && cible) {
      out.push({
        levier: "unite_de_temps",
        avant: `M${ut}`,
        apres: cible < 60 ? `M${cible}` : `H${cible / 60}`,
        plan: { ...plan, uniteDeTemps: cible },
      });
    }
  }

  // La séance n'est un levier que si elle borde vraiment quelque chose.
  const { debut, fin } = plan.contexte;
  if (debut !== "00:00" || fin !== "23:59") {
    out.push({
      levier: "seance",
      avant: `${debut}-${fin}`,
      apres: "00:00-23:59",
      plan: { ...plan, contexte: { ...plan.contexte, debut: "00:00", fin: "23:59" } },
    });
  }

  return out;
}

/**
 * Cherche les réglages voisins qui produisent assez de trades pour conclure.
 *
 * Rend au plus `max` suggestions, dans l'ordre du moins au plus intrusif.
 */
export function chercherReglagesViables(
  serie: SerieM1,
  plan: PlanExecution,
  tailleTick: number,
  max = 3,
): Suggestion[] {
  const trouvees: Suggestion[] = [];
  for (const v of variantes(plan, tailleTick)) {
    const r = lancerBacktest(serie, v.plan);
    // ⚠️ On ne lit QUE la longueur. Le contenu des trades n'est jamais consulté :
    // c'est ce qui empêche cette fonction de devenir un chercheur de paramètres.
    if (r.trades.length >= MIN_TRADES_CONCLUSION) {
      trouvees.push({ ...v, trades: r.trades.length });
      if (trouvees.length >= max) break;
    }
  }
  return trouvees;
}
