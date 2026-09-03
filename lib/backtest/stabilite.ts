import { lancerBacktest } from "./engine";
import type { Modification } from "./modifications";
import type { Couts, PlanExecution, SerieM1 } from "./types";

/**
 * LE RÉGLAGE CHOISI EST-IL SUR UN PLATEAU, OU SUR UN PIC ISOLÉ ?
 *
 * ── POURQUOI C'EST LA MESURE LA PLUS UTILE DE LA PAGE ───────────────────────
 *
 * Un réglage qui ne marche qu'à UNE valeur exacte, et qui s'effondre dès qu'on
 * le bouge d'un cran, n'a pas été trouvé : il a été rencontré. Le marché ne sait
 * pas qu'un sommet doit dominer exactement dix bougies plutôt que neuf ou onze ;
 * si le résultat en dépend, c'est le hasard de la période qui parle, pas la
 * méthode.
 *
 * Un réglage posé au milieu d'un plateau, lui, décrit quelque chose : ses
 * voisins racontent la même histoire, et on peut le déplacer sans que tout
 * tombe.
 *
 * ── LA FRONTIÈRE, ET ELLE EST ÉTROITE ───────────────────────────────────────
 *
 * ⚠️⚠️ CECI EST UN BALAYAGE DE PARAMÈTRES, exactement ce que le reste de la page
 * refuse de faire. Trois règles le séparent de la pêche au meilleur chiffre, et
 * aucune n'est négociable :
 *
 * 1. **ON NE BALAIE QUE DES VALEURS QUI SONT DÉJÀ LES SIENNES.** Le voisinage
 *    d'un réglage qu'il porte, jamais un espace de recherche. C'est un contrôle
 *    sur SON choix, pas une exploration à sa place.
 *
 *    ⚠️⚠️ Ça inclut les réglages qu'il n'a pas touchés. Vu à l'écran : un trader
 *    dont le plan collait exactement à sa fiche lisait « un réglage qui ne tient
 *    pas à une valeur exacte : pas encore regardé », définitivement, parce que la
 *    mesure ne partait que sur des réglages MODIFIÉS. Le pilier le plus utile de
 *    la page restait gris pour quiconque ne bricole pas, c'est-à-dire pour celui
 *    qui en a le plus besoin. Un réglage compilé depuis sa fiche est son réglage
 *    autant qu'un réglage tapé à la main, et la question « ton résultat tient-il
 *    si ton pivot passe de 5 à 6 » se pose exactement pareil.
 * 2. **AUCUN PLAN N'EST RENDU, DONC RIEN N'EST APPLICABLE.** Le résultat ne
 *    contient que des nombres. Un bouton « appliquer » sur le voisin qui sort le
 *    mieux transformerait ce garde-fou en son contraire, et un test lit ce
 *    fichier pour interdire d'y écrire `plan`.
 * 3. **AUCUN CLASSEMENT, AUCUNE MISE EN AVANT.** Les valeurs s'affichent dans
 *    leur ordre naturel, celle du trader marquée comme la sienne, et rien
 *    d'autre n'est souligné.
 */

/** Les réglages numériques dont on sait fabriquer un voisinage. */
type Setteur = (plan: PlanExecution, valeur: number) => PlanExecution | null;

const SETTEURS: Record<string, { lire: (p: PlanExecution) => number | null; ecrire: Setteur }> = {
  niveau_pivots: {
    lire: (p) =>
      p.niveau.type === "trendline" ||
      p.niveau.type === "liquidite_swing" ||
      p.niveau.type === "ote_fibonacci"
        ? p.niveau.pivots
        : null,
    ecrire: (p, v) => {
      if (
        p.niveau.type !== "trendline" &&
        p.niveau.type !== "liquidite_swing" &&
        p.niveau.type !== "ote_fibonacci"
      ) {
        return null;
      }
      return { ...p, niveau: { ...p.niveau, pivots: v } };
    },
  },
  niveau_touches: {
    lire: (p) => (p.niveau.type === "trendline" ? p.niveau.touchesMin : null),
    ecrire: (p, v) =>
      p.niveau.type === "trendline" ? { ...p, niveau: { ...p.niveau, touchesMin: v } } : null,
  },
  niveau_tolerance: {
    lire: (p) => (p.niveau.type === "trendline" ? p.niveau.toleranceTicks : null),
    ecrire: (p, v) =>
      p.niveau.type === "trendline" ? { ...p, niveau: { ...p.niveau, toleranceTicks: v } } : null,
  },
  stop_pivots: {
    lire: (p) => (p.stop.type === "dernier_pivot" ? p.stop.pivots ?? null : null),
    ecrire: (p, v) =>
      p.stop.type === "dernier_pivot" ? { ...p, stop: { ...p.stop, pivots: v } } : null,
  },
  objectif_r: {
    lire: (p) => (p.objectif.type === "multiple_r" ? p.objectif.r : null),
    ecrire: (p, v) =>
      p.objectif.type === "multiple_r" ? { ...p, objectif: { ...p.objectif, r: v } } : null,
  },
};

/**
 * L'unité d'un réglage balayé.
 *
 * ⚠️⚠️ VU À L'ÉCRAN : « Épaisseur de la droite · 9000 · 12000 · 15000 ». Ce
 * sont des TICKS, et le trader lit des points partout ailleurs — la même
 * tolérance s'écrit « 15 » dans l'éditeur et dans la liste des écarts. Un
 * millier de fois trop grand, sur un tableau censé l'aider à juger si son
 * réglage est sur un plateau : il ne pouvait même pas reconnaître le sien.
 */
const UNITE_DU_REGLAGE: Record<string, "ticks" | "bougies" | "r"> = {
  niveau_pivots: "bougies",
  niveau_touches: "bougies",
  niveau_tolerance: "ticks",
  stop_pivots: "bougies",
  objectif_r: "r",
};

/** Un point du voisinage : une valeur, et ce qu'elle a produit. */
export interface Point {
  valeur: number;
  /** Vrai pour la valeur que le trader a retenue. */
  sienne: boolean;
  trades: number;
  /** `null` sous le seuil de conclusion : on ne calcule pas ce qu'on ne dirait pas. */
  esperanceR: number | null;
  borneBasse: number | null;
  borneHaute: number | null;
}

export type FormeDuVoisinage =
  /** Trop peu de points mesurables pour dire quoi que ce soit. */
  | "indecidable"
  /** Les voisins racontent la même histoire : le réglage n'est pas un accident. */
  | "plateau"
  /** Le réglage choisi dépasse ses voisins immédiats de plus que son incertitude. */
  | "pic_isole";

export interface Stabilite {
  /**
   * Comment lire les valeurs du voisinage.
   *
   * ⚠️ Rendu ici plutôt que deviné à l'écran : une deuxième table finirait par
   * diverger de celle-ci, et le trader lirait des ticks sur une carte et des
   * points sur l'autre.
   */
  unite: "ticks" | "bougies" | "r";
  cle: string;
  points: Point[];
  forme: FormeDuVoisinage;
}

/** Le voisinage testé autour de la valeur du trader. */
function voisinage(v: number, cle: string): number[] {
  // ⚠️ DES PAS PROPORTIONNELS, PAS FIXES. Une largeur de pivot de 5 et une
  // tolérance de 3000 ticks n'ont pas la même échelle : « plus ou moins deux »
  // serait un pas énorme pour la première et invisible pour la seconde.
  const pas = Math.max(1, Math.round(v * 0.2));
  const brut =
    cle === "objectif_r"
      ? [v - 1, v - 0.5, v, v + 0.5, v + 1]
      : [v - 2 * pas, v - pas, v, v + pas, v + 2 * pas];
  // Un réglage négatif ou nul n'existe pas ; on garde l'ordre et on dédoublonne.
  return Array.from(new Set(brut.filter((x) => x > 0))).sort((a, b) => a - b);
}

/**
 * Le seuil de trades sous lequel on ne rend aucun chiffre.
 *
 * ⚠️ Repris de `verdict.ts` plutôt que redéfini plus bas. Un voisinage dont les
 * points seraient jugés sur trente trades chacun ferait une belle courbe de
 * bruit, et une belle courbe de bruit est plus convaincante qu'un chiffre seul.
 */
export const MIN_TRADES_POINT = 100;

/** Combien de réglages on accepte de balayer. Chaque point est un backtest complet. */
export const REGLAGES_MAX = 2;

/**
 * À DÉFAUT DE RÉGLAGE MODIFIÉ, CEUX-LÀ, DANS CET ORDRE.
 *
 * ⚠️ L'ORDRE EST DÉCLARÉ, PAS DÉDUIT D'UN RÉSULTAT. On regarde d'abord ce qui
 * décide COMBIEN de signaux existent (la largeur du pivot, puis la tolérance
 * d'alignement), et seulement ensuite ce qui décide de leur issue. Choisir
 * l'ordre d'après ce qui sort le mieux serait exactement le balayage que ce
 * fichier refuse.
 */
const REGLAGES_PAR_DEFAUT = ["niveau_pivots", "niveau_tolerance", "niveau_touches", "objectif_r"];

function mesurer(serie: SerieM1, plan: PlanExecution, couts: Couts): Omit<Point, "valeur" | "sienne"> {
  const r = lancerBacktest(serie, { ...plan, couts });
  const rs = r.trades.map((t) => t.r);
  if (rs.length < MIN_TRADES_POINT) {
    return { trades: rs.length, esperanceR: null, borneBasse: null, borneHaute: null };
  }
  const moyenne = rs.reduce((a, b) => a + b, 0) / rs.length;
  const variance = rs.reduce((a, b) => a + (b - moyenne) * (b - moyenne), 0) / (rs.length - 1);
  const marge = 1.96 * (Math.sqrt(variance) / Math.sqrt(rs.length));
  return {
    trades: rs.length,
    esperanceR: moyenne,
    borneBasse: moyenne - marge,
    borneHaute: moyenne + marge,
  };
}

/**
 * La forme du voisinage.
 *
 * ⚠️ ON COMPARE AUX VOISINS IMMÉDIATS, PAS À LA MOYENNE DE TOUT. Un réglage
 * peut légitimement faire mieux que des valeurs très éloignées ; ce qui trahit
 * un accident, c'est de faire nettement mieux que ses voisins d'à côté, ceux qui
 * décrivent presque la même chose.
 *
 * ⚠️ LE SEUIL EST L'INCERTITUDE DU RÉGLAGE LUI-MÊME, pas un nombre choisi. Si
 * l'écart avec le meilleur voisin tient dans la demi-largeur de son propre
 * intervalle, il n'y a rien à voir : c'est du bruit de mesure.
 */
function forme(points: Point[]): FormeDuVoisinage {
  const mesurables = points.filter((p) => p.esperanceR != null);
  const sien = points.find((p) => p.sienne);
  if (mesurables.length < 3 || !sien || sien.esperanceR == null || sien.borneHaute == null) {
    return "indecidable";
  }
  const i = points.indexOf(sien);
  const voisins = [points[i - 1], points[i + 1]].filter(
    (p): p is Point => !!p && p.esperanceR != null,
  );
  if (voisins.length === 0) return "indecidable";

  const meilleurVoisin = Math.max(...voisins.map((p) => p.esperanceR!));
  const demiIntervalle = sien.borneHaute - sien.esperanceR;
  return sien.esperanceR - meilleurVoisin > demiIntervalle ? "pic_isole" : "plateau";
}

/**
 * Mesure le voisinage des réglages que le trader a changés.
 *
 * ⚠️ RIEN DANS LA SORTIE N'EST APPLICABLE. Voir la règle 2 en tête de fichier :
 * on ne rend que des nombres, jamais un plan.
 */
export function mesurerStabilite(
  serie: SerieM1,
  plan: PlanExecution,
  couts: Couts,
  modifications: Modification[],
  avancement?: (faits: number, total: number) => void,
): Stabilite[] {
  const demandees = modifications.map((m) => m.cle);
  const cles = (demandees.length > 0 ? demandees : REGLAGES_PAR_DEFAUT)
    .filter((cle) => SETTEURS[cle] && SETTEURS[cle].lire(plan) != null)
    .slice(0, REGLAGES_MAX);

  const total = cles.reduce((n, cle) => n + voisinage(SETTEURS[cle].lire(plan)!, cle).length, 0);
  let faits = 0;

  const out: Stabilite[] = [];
  for (const cle of cles) {
    const sienne = SETTEURS[cle].lire(plan)!;
    const points: Point[] = [];
    for (const valeur of voisinage(sienne, cle)) {
      const variante = SETTEURS[cle].ecrire(plan, valeur);
      faits++;
      avancement?.(faits, total);
      if (!variante) continue;
      points.push({ valeur, sienne: valeur === sienne, ...mesurer(serie, variante, couts) });
    }
    if (points.length > 0) {
      out.push({
        cle,
        unite: UNITE_DU_REGLAGE[cle] ?? "bougies",
        points,
        forme: forme(points),
      });
    }
  }
  return out;
}
