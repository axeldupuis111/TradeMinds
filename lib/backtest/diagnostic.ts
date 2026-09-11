import type { PlanExecution, TradeSimule } from "./types";

/**
 * CE QUI NE FONCTIONNE PAS, ET LE BLOC QUI LE PORTE.
 *
 * ── POURQUOI CE FICHIER EXISTE ──────────────────────────────────────────────
 *
 * ⚠️⚠️ LE REPROCHE D'AXEL, FORMULÉ TROIS FOIS ET JAMAIS TRAITÉ :
 *
 *   « Je vois que ma stratégie n'est pas rentable, mais ça me dit pas
 *     concrètement ce qui ne fonctionne pas, ce qu'il faut changer pour
 *     réussir. Si au backtest ce n'est pas rentable, ça ne donne pas envie de
 *     trader cette stratégie. »
 *
 * Il a raison, et le défaut est structurel. La page savait faire deux choses :
 * MESURER (« -0.037 R par trade, intervalle [-0.141 ; 0.067] ») et BALAYER
 * (« essaie pivot = 3, essaie M15 »). Aucune des deux ne répond à « qu'est-ce
 * qui cloche ». La mesure constate ; le balayage propose au hasard.
 *
 * Un diagnostic est autre chose : il nomme un MÉCANISME, avec le chiffre qui le
 * prouve et le bloc qui le porte. « Tes perdants montaient à +1.4 R avant de
 * revenir » ne se devine pas d'un balayage, et ce n'est pas la même information
 * que « l'espérance est négative ».
 *
 * ── CE QUI REND ÇA POSSIBLE ─────────────────────────────────────────────────
 *
 * Les excursions, ajoutées au moteur pour ce fichier : jusqu'où chaque trade
 * est allé dans le bon sens (`mfeR`) et dans le mauvais (`maeR`) avant de
 * finir. Sans elles, on ne peut pas distinguer une méthode qui entre mal d'une
 * méthode qui sort mal, et c'est LA question qu'un trader se pose.
 *
 * ── CE QUE CE FICHIER NE FAIT PAS ───────────────────────────────────────────
 *
 * ⚠️ IL NE PROMET AUCUN GAIN, et un test l'interdit. « Ton stop est frôlé sur la
 * moitié de tes gagnants » est un fait ; « élargis-le et tu gagneras » est une
 * promesse que personne ne peut tenir. Chaque constat dit ce qui est MESURÉ et
 * ce qu'il faudrait ESSAYER, jamais ce que ça donnerait.
 *
 * ⚠️ IL NE CHOISIT PAS LA MEILLEURE TRANCHE. Découper les trades par heure, par
 * jour et par sens, puis garder la tranche qui gagne, c'est du sur-apprentissage
 * avec l'accent du diagnostic. Les seuils ci-dessous sont donc HAUTS, et chaque
 * constat de tranche porte le nombre de tranches regardées.
 */

/** Combien de trades il faut dans une tranche avant d'en dire quoi que ce soit. */
export const MIN_TRADES_TRANCHE = 30;

/**
 * Part des perdants qui doivent avoir été largement gagnants pour le dire.
 *
 * ⚠️ UN TIERS, ET C'EST DÉJÀ BEAUCOUP. Un trade sur trois qui monte à plus d'un
 * demi-risque avant de revenir mourir au stop décrit une méthode qui trouve ses
 * entrées et rend ses gains.
 */
export const PART_PERDANTS_RENDUS = 0.33;
/** À partir de quel parcours un perdant compte comme « rendu ». */
export const SEUIL_RENDU_R = 0.5;

/**
 * Part des gagnants dont le stop a été frôlé.
 *
 * ⚠️ « FRÔLÉ » VEUT DIRE À MOINS D'UN DIXIÈME DU STOP. Sur ceux-là, quelques
 * ticks de plus faisaient un perdant : le résultat de la méthode tient alors à
 * la précision du placement, pas à la lecture du marché.
 */
export const PART_GAGNANTS_FROLES = 0.3;
export const SEUIL_FROLE = 0.9;

/**
 * Écart entre deux tranches à partir duquel il vaut la peine d'être signalé.
 *
 * ⚠️ UN DEMI-R D'ÉCART, PAS UN DIXIÈME. Avec cinq tranches et trente trades
 * chacune, un écart de 0,1 R sort tout seul du bruit une fois sur deux.
 */
export const ECART_TRANCHE_R = 0.5;

export type CodeDiagnostic =
  /** Les perdants étaient gagnants : le problème est la sortie, pas l'entrée. */
  | "gains_rendus"
  /** Le stop est frôlé sur les gagnants : la méthode tient à quelques ticks. */
  | "stop_frole"
  /** L'objectif est plus loin que ce que le marché offre à cette méthode. */
  | "objectif_trop_loin"
  /** Le marché va plus loin que l'objectif : le gain est laissé sur la table. */
  | "objectif_trop_pres"
  /** Une plage horaire concentre les pertes. */
  | "heure_qui_perd"
  /** Un sens perd pendant que l'autre tient. */
  | "sens_qui_perd";

export interface Diagnostic {
  code: CodeDiagnostic;
  valeurs: Record<string, string | number>;
  /** Le bloc du plan à regarder. Sert à renvoyer le trader au bon endroit. */
  bloc: string;
}

const moyenne = (xs: number[]) => (xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : 0);

/** L'heure locale d'un trade, dans le fuseau du plan. */
function heureDe(ms: number, fuseau: string): number {
  const s = new Intl.DateTimeFormat("en-GB", {
    timeZone: fuseau,
    hour: "2-digit",
    hour12: false,
  }).format(new Date(ms));
  return Number(s);
}

export function diagnostiquer(trades: TradeSimule[], plan: PlanExecution): Diagnostic[] {
  const out: Diagnostic[] = [];
  if (trades.length < MIN_TRADES_TRANCHE) return out;

  const perdants = trades.filter((t) => t.r <= 0);
  const gagnants = trades.filter((t) => t.r > 0);

  /**
   * ── 1. Des gains rendus ────────────────────────────────────────────────
   *
   * ⚠️ LE DIAGNOSTIC LE PLUS UTILE QUE CETTE PAGE PUISSE PRODUIRE, parce qu'il
   * innocente l'entrée. Un trader dont les perdants sont montés à plus d'un
   * demi-risque avant de mourir n'a pas un problème de signal : il a un
   * problème de sortie, et c'est un bloc qu'il peut changer sans changer de
   * méthode.
   */
  if (perdants.length >= MIN_TRADES_TRANCHE) {
    const rendus = perdants.filter((t) => t.mfeR >= SEUIL_RENDU_R);
    const part = rendus.length / perdants.length;
    if (part >= PART_PERDANTS_RENDUS) {
      out.push({
        code: "gains_rendus",
        bloc: "sortiesAuxiliaires",
        valeurs: {
          part: Math.round(part * 100),
          n: rendus.length,
          total: perdants.length,
          parcours: moyenne(rendus.map((t) => t.mfeR)).toFixed(2),
          seuil: SEUIL_RENDU_R,
        },
      });
    }
  }

  /**
   * ── 2. Un stop frôlé ───────────────────────────────────────────────────
   *
   * ⚠️ L'INVERSE DU PRÉCÉDENT, ET IL FAUT LES DEUX. Si les gagnants sont
   * descendus tout près du stop avant de repartir, le résultat tient à la
   * distance du stop autant qu'à la lecture. C'est fragile, et ça se dit.
   */
  if (gagnants.length >= MIN_TRADES_TRANCHE) {
    const froles = gagnants.filter((t) => t.maeR <= -SEUIL_FROLE);
    const part = froles.length / gagnants.length;
    if (part >= PART_GAGNANTS_FROLES) {
      out.push({
        code: "stop_frole",
        bloc: "stop",
        valeurs: {
          part: Math.round(part * 100),
          n: froles.length,
          total: gagnants.length,
          seuil: SEUIL_FROLE,
        },
      });
    }
  }

  /**
   * ── 3. L'objectif contre ce que le marché offre ────────────────────────
   *
   * ⚠️ ON COMPARE L'OBJECTIF AU PARCOURS RÉEL, pas au résultat. Le résultat dit
   * ce qui a été encaissé ; le parcours dit ce qui était disponible. Un objectif
   * à 2 R sur une méthode dont les trades culminent à 1,1 R en moyenne demande
   * au marché quelque chose qu'il n'a pas donné une seule fois.
   */
  if (plan.objectif.type === "multiple_r" && trades.length >= MIN_TRADES_TRANCHE) {
    const cible = plan.objectif.r;
    const atteignent = trades.filter((t) => t.mfeR >= cible).length / trades.length;
    const culmine = moyenne(trades.map((t) => t.mfeR));
    // ⚠️ UN CINQUIÈME, PAS UN TIERS : une méthode en 1:2 n'a pas besoin
    // d'atteindre sa cible souvent, elle a besoin de l'atteindre assez.
    if (atteignent < 0.2 && culmine < cible * 0.75) {
      out.push({
        code: "objectif_trop_loin",
        bloc: "objectif",
        valeurs: {
          cible,
          part: Math.round(atteignent * 100),
          culmine: culmine.toFixed(2),
        },
      });
    }
    /**
     * ⚠️ ET LE CAS SYMÉTRIQUE, qu'aucun outil ne montre jamais : les gagnants
     * qui repartaient bien plus loin que la cible. Le dire n'est pas conseiller
     * de viser plus loin, c'est dire ce que la sortie a laissé.
     */
    const gagnantsCible = gagnants.filter((t) => t.motif === "objectif");
    if (gagnantsCible.length >= MIN_TRADES_TRANCHE) {
      const au_dela = moyenne(gagnantsCible.map((t) => t.mfeR));
      if (au_dela > cible * 1.5) {
        out.push({
          code: "objectif_trop_pres",
          bloc: "objectif",
          valeurs: { cible, culmine: au_dela.toFixed(2), n: gagnantsCible.length },
        });
      }
    }
  }

  /**
   * ── 4. Une plage horaire qui perd ──────────────────────────────────────
   *
   * ⚠️⚠️ LE CONSTAT LE PLUS DANGEREUX DU FICHIER, et c'est pour ça qu'il est le
   * plus contraint. Découper par heure puis garder les heures qui gagnent
   * produit TOUJOURS une amélioration, même dans du bruit pur. On exige donc
   * trente trades de chaque côté, un demi-R d'écart, et on annonce combien de
   * tranches ont été regardées : c'est ce chiffre qui dit au trader à quel point
   * le résultat est facile à obtenir par hasard.
   */
  const fuseau = plan.contexte.fuseau;
  const parHeure = new Map<number, number[]>();
  for (const t of trades) {
    const h = heureDe(t.entreeMs, fuseau);
    const l = parHeure.get(h) ?? [];
    l.push(t.r);
    parHeure.set(h, l);
  }
  const tranches = Array.from(parHeure.entries())
    .filter(([, rs]) => rs.length >= MIN_TRADES_TRANCHE)
    .map(([h, rs]) => ({ h, n: rs.length, m: moyenne(rs) }))
    .sort((a, b) => a.m - b.m);
  if (tranches.length >= 2) {
    const pire = tranches[0];
    const reste = trades.filter((t) => heureDe(t.entreeMs, fuseau) !== pire.h);
    const ecart = moyenne(reste.map((t) => t.r)) - pire.m;
    if (ecart >= ECART_TRANCHE_R && reste.length >= MIN_TRADES_TRANCHE) {
      out.push({
        code: "heure_qui_perd",
        bloc: "contexte",
        valeurs: {
          heure: String(pire.h).padStart(2, "0"),
          n: pire.n,
          r: pire.m.toFixed(3),
          reste: moyenne(reste.map((t) => t.r)).toFixed(3),
          tranches: tranches.length,
        },
      });
    }
  }

  /**
   * ── 5. Un sens qui perd ────────────────────────────────────────────────
   *
   * ⚠️ DEUX TRANCHES SEULEMENT, donc beaucoup moins d'occasions de se tromper
   * qu'avec les heures. Un achat et une vente ne sont pas la même opération sur
   * un marché qui monte structurellement.
   */
  const longs = trades.filter((t) => t.sens === "long").map((t) => t.r);
  const shorts = trades.filter((t) => t.sens === "short").map((t) => t.r);
  if (longs.length >= MIN_TRADES_TRANCHE && shorts.length >= MIN_TRADES_TRANCHE) {
    const mL = moyenne(longs);
    const mS = moyenne(shorts);
    if (Math.abs(mL - mS) >= ECART_TRANCHE_R) {
      const perd = mL < mS ? "long" : "short";
      out.push({
        code: "sens_qui_perd",
        bloc: "sens",
        valeurs: {
          sens: perd,
          r: (perd === "long" ? mL : mS).toFixed(3),
          autre: (perd === "long" ? mS : mL).toFixed(3),
          n: perd === "long" ? longs.length : shorts.length,
        },
      });
    }
  }

  return out;
}
