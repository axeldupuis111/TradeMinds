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
 * Les deux bornes d'une séance, élargies d'un nombre d'heures.
 *
 * ⚠️ ON NE PASSE PAS MINUIT. Une séance 22:00-02:00 existe, mais l'élargir en
 * franchissant minuit produirait un intervalle dont on ne sait plus dire s'il
 * couvre deux heures ou vingt-deux. On s'arrête aux bornes de la journée, et le
 * palier suivant, lui, ouvre franchement les vingt-quatre heures.
 */
function reculerDe(heure: string, heures: number): string {
  const [h, m] = heure.split(":").map(Number);
  const total = Math.max(0, h * 60 + m - heures * 60);
  return total === 0 ? "00:00" : formater(total);
}

function avancerDe(heure: string, heures: number): string {
  const [h, m] = heure.split(":").map(Number);
  const total = Math.min(23 * 60 + 59, h * 60 + m + heures * 60);
  return formater(total);
}

function formater(minutes: number): string {
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
}


/**
 * Fabrique les variantes candidates, du changement le plus léger au plus lourd.
 *
 * ⚠️ Un seul levier bouge par variante. La liste est courte volontairement :
 * chaque variante est un backtest complet, et en essayer trente ferait de cette
 * aide une recherche exhaustive, c'est-à-dire la chose qu'on refuse.
 */
export function variantes(plan: PlanExecution, tailleTick: number): Omit<Suggestion, "trades">[] {
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

  /**
   * La séance s'élargit PAR PALIERS, et c'est la promesse de la carte.
   *
   * ⚠️⚠️ VU À L'ÉCRAN, SOUS LE TITRE « LE RÉGLAGE VOISIN LE PLUS PROCHE » :
   * « Séance ouverte à 00:00-23:59 au lieu de 08:00-17:00 ». Passer de neuf
   * heures à vingt-quatre est le contraire d'un voisin : c'est le changement le
   * plus lourd que cette liste puisse contenir, et c'était le SEUL proposé sur
   * ce levier.
   *
   * ⚠️ ET CE LEVIER N'EST PAS COMME LES AUTRES. Descendre d'une unité de temps
   * se fait devant le même écran, aux mêmes heures. Ouvrir la séance 24 h
   * demande au trader d'être là la nuit : c'est sa vie qu'on règle, pas son
   * graphique, et cet onglet existe pour produire un plan qu'il puisse tenir.
   * On propose donc d'abord une heure de chaque côté, puis deux, puis quatre.
   */
  const { debut, fin } = plan.contexte;
  if (debut !== "00:00" || fin !== "23:59") {
    /**
     * ⚠️ UN PALIER PEUT DÉJÀ OUVRIR LA JOURNÉE, et le test me l'a appris : sur
     * une séance 01:00-23:00, le premier palier atteint déjà 00:00-23:59, et le
     * dernier bloc la reproposait à l'identique. Deux lignes identiques dans
     * une liste de « réglages voisins » n'apprennent rien et font douter du
     * reste.
     */
    let journeeOuverte = false;
    for (const heures of [1, 2, 4]) {
      const d = reculerDe(debut, heures);
      const f = avancerDe(fin, heures);
      if (d === debut && f === fin) continue;
      out.push({
        levier: "seance",
        avant: `${debut}-${fin}`,
        apres: `${d}-${f}`,
        plan: { ...plan, contexte: { ...plan.contexte, debut: d, fin: f } },
      });
      if (d === "00:00" && f === "23:59") {
        journeeOuverte = true;
        break;
      }
    }
    if (!journeeOuverte) {
      out.push({
        levier: "seance",
        avant: `${debut}-${fin}`,
        apres: "00:00-23:59",
        plan: { ...plan, contexte: { ...plan.contexte, debut: "00:00", fin: "23:59" } },
      });
    }
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
