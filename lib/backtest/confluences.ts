import { comparerMesures, type Verdict as VerdictComparaison } from "./comparaison";
import { lancerBacktest } from "./engine";
import type { Instrument } from "./instruments";
import { MIN_TRADES_CONCLUSION } from "./verdict";
import type { BlocConfirmation, Couts, PlanExecution, SerieM1 } from "./types";

/**
 * TES CONFLUENCES : CELLES QUI TRIENT VRAIMENT, ET CELLES QUI NE FONT QUE
 * RÉTRÉCIR TON ÉCHANTILLON.
 *
 * ── LA CRITIQUE QUI A FAIT NAÎTRE CE FICHIER ────────────────────────────────
 *
 * Un trader, devant les propositions : « il me parle de passer de 5 à 3 pour
 * reconnaître plus de sommets... on a tous notre façon de reconnaître un sommet.
 * Ce qu'on attend, c'est une vraie analyse : ajouter des confluences, en retirer.
 * Là il me montre des chiffres sans réellement changer ma stratégie. »
 *
 * Il a raison, et le diagnostic est exact. Les propositions tournaient des
 * MOLETTES DE MOTEUR (largeur de pivot, unité de temps, taille de stop). Aucune
 * ne parlait de sa méthode. Or la question que se pose vraiment un trader devant
 * son graphique n'est pas « et si un sommet dominait trois bougies au lieu de
 * cinq », c'est « est-ce que j'attends le RSI, ou est-ce qu'il me coûte des
 * trades pour rien ».
 *
 * ── CE QU'ON MESURE, ET POURQUOI C'EST UN VRAI CONSEIL ──────────────────────
 *
 * Un filtre ne crée jamais de trade : il en ÉCARTE. Il n'a donc qu'une seule
 * façon d'être utile, et elle est mesurable : écarter davantage de perdants que
 * de gagnants. Trois issues, et deux d'entre elles sont des mauvaises nouvelles
 * que personne ne dit jamais à un trader :
 *
 * 1. **Il ne trie rien.** Avec et sans lui, le résultat est le même à
 *    l'incertitude près. Il ne fait alors que réduire l'échantillon, donc élargir
 *    l'intervalle, donc rendre la stratégie MOINS démontrable. C'est le cas le
 *    plus fréquent, et c'est la découverte la plus utile de cet écran : une
 *    confluence qui ne trie rien coûte des trades sans rien acheter.
 * 2. **Il écarte des trades qui perdaient.** Il fait son travail.
 * 3. **Il écarte des trades qui gagnaient.** Il coûte de l'argent.
 *
 * ── LA FRONTIÈRE, ENCORE ────────────────────────────────────────────────────
 *
 * ⚠️⚠️ ESSAYER SEPT FILTRES ET GARDER CELUI QUI SORT LE MIEUX EST UN BALAYAGE,
 * exactement ce que cette page refuse partout ailleurs. Ce qui rend celui-ci
 * défendable :
 *
 * - **On rend TOUS les filtres, jamais un classement, jamais « le meilleur ».**
 * - **Le verdict porte sur la DISTINGUABILITÉ**, pas sur l'écart brut : deux
 *   espérances qui se ressemblent à l'incertitude près sont déclarées
 *   indiscernables, et c'est le résultat le plus fréquent.
 * - **Ce qu'on examine en priorité, ce sont les filtres QUE LE TRADER A DÉJÀ.**
 *   Lui dire que son RSI ne trie rien n'est pas une suggestion d'optimisation,
 *   c'est un fait sur sa méthode, et il est vrai qu'il le garde ou non.
 */

/** Les filtres du catalogue, avec les réglages par défaut de l'éditeur. */
function catalogue(instrument: Instrument): BlocConfirmation[] {
  const enTicks = (prix: number) => Math.max(1, Math.round(prix / instrument.tailleTick));
  return [
    { type: "bougie_reaction" },
    { type: "biais_moyenne", periode: 50 },
    { type: "rsi", periode: 14, seuil: 55, mode: "momentum" },
    { type: "macd", rapide: 12, lente: 26, signal: 9 },
    { type: "stochastique", periode: 14, seuil: 80, mode: "momentum" },
    { type: "divergence", periode: 14, pivots: 5 },
    { type: "amplitude_min", ticks: enTicks(instrument.spread * 3) },
  ];
}

export type EffetDuFiltre =
  /** Avec ou sans, on ne distingue rien : il rétrécit l'échantillon, c'est tout. */
  | "ne_trie_rien"
  /** Les trades qu'il écarte perdaient : il fait son travail. */
  | "ecarte_des_perdants"
  /** Les trades qu'il écarte gagnaient : il coûte de l'argent. */
  | "ecarte_des_gagnants"
  /** Il ne laisse plus assez de trades pour qu'on puisse conclure quoi que ce soit. */
  | "assechele";

export interface Confluence {
  /** Le type du bloc de confirmation, pour le nommer à l'écran. */
  type: string;
  /** Vrai quand le trader l'a DÉJÀ dans son plan : on mesure alors son retrait. */
  deja: boolean;
  /** Trades avec le filtre en place. */
  tradesAvec: number;
  /** Trades sans lui. */
  tradesSans: number;
  /** Part des trades qu'il écarte, en pourcentage de ceux qui existeraient sans. */
  partEcarteePct: number;
  esperanceAvecR: number | null;
  esperanceSansR: number | null;
  effet: EffetDuFiltre;
  /** Le verdict brut de la comparaison, pour ne rien affirmer de plus qu'elle. */
  comparaison: VerdictComparaison;
}

/**
 * Combien de filtres on accepte d'essayer.
 *
 * ⚠️ Chacun est un backtest complet. Et surtout : plus on en essaie, plus on
 * finit par en trouver un qui « marche », même dans du bruit. La borne n'est pas
 * qu'une question d'attente.
 */
export const FILTRES_MAX = 8;

interface Mesure {
  trades: number;
  esperanceR: number | null;
  borneBasse: number | null;
  borneHaute: number | null;
}

function mesurer(serie: SerieM1, plan: PlanExecution, couts: Couts): Mesure {
  const rs = lancerBacktest(serie, { ...plan, couts }).trades.map((t) => t.r);
  if (rs.length < MIN_TRADES_CONCLUSION) {
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

/** Deux confirmations décrivent-elles le même filtre ? */
function memeFiltre(a: BlocConfirmation, b: BlocConfirmation): boolean {
  return a.type === b.type;
}

export function mesurerConfluences(
  serie: SerieM1,
  plan: PlanExecution,
  couts: Couts,
  instrument: Instrument,
  avancement?: (faits: number, total: number) => void,
): Confluence[] {
  const siennes = plan.confirmations;
  const candidats = catalogue(instrument).filter(
    (c) => !siennes.some((s) => memeFiltre(s, c)),
  );

  // ⚠️ LES SIENS D'ABORD, ET C'EST TOUTE LA DIFFÉRENCE AVEC UNE OPTIMISATION.
  // Ce qu'il a déjà mis dans sa méthode passe avant ce qu'on pourrait lui
  // ajouter : le premier est un fait sur sa stratégie, le second une suggestion.
  const aTester: { filtre: BlocConfirmation; deja: boolean }[] = [
    ...siennes.map((filtre) => ({ filtre, deja: true })),
    ...candidats.map((filtre) => ({ filtre, deja: false })),
  ].slice(0, FILTRES_MAX);

  const out: Confluence[] = [];
  for (let i = 0; i < aTester.length; i++) {
    const { filtre, deja } = aTester[i];
    avancement?.(i + 1, aTester.length);

    // « Avec » = le filtre est en place. « Sans » = il ne l'est pas. Pour un
    // filtre qu'il a déjà, « sans » est le plan amputé ; pour un candidat,
    // « avec » est le plan augmenté.
    const planAvec: PlanExecution = deja
      ? plan
      : { ...plan, confirmations: [...siennes, filtre] };
    const planSans: PlanExecution = deja
      ? { ...plan, confirmations: siennes.filter((s) => !memeFiltre(s, filtre)) }
      : plan;

    const avec = mesurer(serie, planAvec, couts);
    const sans = mesurer(serie, planSans, couts);

    // Même période des deux côtés : la comparaison ne signalera donc jamais de
    // décalage d'époque, et c'est juste, c'est le même rejeu.
    const c = comparerMesures(avec, sans, { de: "", a: "" }, { de: "", a: "" });

    let effet: EffetDuFiltre;
    if (avec.esperanceR == null) {
      // ⚠️ Un filtre qui assèche est une information à part entière, pas un
      // échec de mesure : il empêche la stratégie d'être démontrable du tout.
      effet = "assechele";
    } else if (c.verdict !== "un_ecart_mesurable") {
      effet = "ne_trie_rien";
    } else {
      effet = (c.ecartR ?? 0) > 0 ? "ecarte_des_perdants" : "ecarte_des_gagnants";
    }

    out.push({
      type: filtre.type,
      deja,
      tradesAvec: avec.trades,
      tradesSans: sans.trades,
      partEcarteePct:
        sans.trades > 0 ? ((sans.trades - avec.trades) / sans.trades) * 100 : 0,
      esperanceAvecR: avec.esperanceR,
      esperanceSansR: sans.esperanceR,
      effet,
      comparaison: c.verdict,
    });
  }
  return out;
}
