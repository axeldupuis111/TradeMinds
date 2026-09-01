import { agreger } from "./serie";
import { coutsPourInstrument, type Instrument } from "./instruments";
import type { BlocConfirmation, PlanExecution, SerieM1 } from "./types";

/**
 * TA MÉTHODE SUR D'AUTRES MARCHÉS, SANS CLASSEMENT.
 *
 * ── POURQUOI J'AVAIS REFUSÉ, ET CE QUI A CHANGÉ ─────────────────────────────
 *
 * Refus initial : les réglages de prix du plan sont en TICKS. Une tolérance de
 * 3000 ticks vaut 3 points sur le Nasdaq et n'a strictement aucun sens
 * transposée telle quelle sur l'EURUSD. Rejouer le plan « tel quel » ailleurs
 * aurait produit des chiffres qui ressemblent à une mesure et n'en sont pas.
 *
 * Ce qui a changé : rien au problème, tout à la solution. Il fallait une RÈGLE
 * D'ÉCHELLE, et il en existe une défendable, à condition de l'écrire.
 *
 * ── LA RÈGLE, ET ELLE EST AFFICHÉE À L'ÉCRAN ────────────────────────────────
 *
 * ⚠️ On ramène chaque distance à l'AMPLITUDE TYPIQUE D'UNE BOUGIE du marché,
 * mesurée sur les données réelles, à l'unité de temps du plan. « Une tolérance
 * de 3 points sur le Nasdaq » devient « une tolérance de 0,2 bougie moyenne »,
 * et c'est ce 0,2 qu'on transporte. Sur le S&P, ça redonne des points du S&P.
 *
 * C'est une convention, pas une vérité, et elle a ses limites : deux marchés de
 * même amplitude peuvent avoir des microstructures très différentes. Mais elle
 * a le mérite décisif d'être EXPLICITE et vérifiable, là où « on garde les
 * mêmes ticks » est une erreur silencieuse.
 *
 * ⚠️ CE QUI NE SE MET PAS À L'ÉCHELLE N'EST PAS TOUCHÉ. Une largeur de pivot,
 * une période d'indicateur, un délai de retest se comptent en BOUGIES : ils ne
 * dépendent pas du prix et les convertir serait une faute. Un objectif en R et
 * un risque en pourcent ne dépendent d'aucun marché non plus.
 *
 * ── LA FRONTIÈRE, ET ELLE EST PLUS ÉTROITE QUE PARTOUT AILLEURS ─────────────
 *
 * ⚠️⚠️ « SUR QUEL MARCHÉ MA STRATÉGIE MARCHE-T-ELLE LE MIEUX » EST LA PIRE
 * QUESTION QU'ON PUISSE POSER À CET ÉCRAN. Essayer huit marchés et garder celui
 * qui sort le mieux, c'est le sur-apprentissage de la période déplacé sur
 * l'instrument, en pire : il y a moins de marchés que de réglages, donc
 * l'illusion est plus facile à fabriquer.
 *
 * La question à laquelle cet écran répond est l'inverse : **sur combien de
 * marchés comparables l'avantage se retrouve-t-il ?** Une méthode qui tient sur
 * quatre indices décrit peut-être quelque chose. Une méthode qui ne tient que
 * sur un seul ne décrit pas ce marché-là : elle décrit la chance qu'elle y a
 * eue. Aucun classement, aucun bouton, aucun plan rendu.
 */

/**
 * L'amplitude typique d'une bougie, en POINTS.
 *
 * ⚠️ LA MÉDIANE, PAS LA MOYENNE. Une poignée de bougies de publication
 * économique suffit à doubler une moyenne, et l'échelle de transposition
 * partirait alors avec elle.
 */
export function amplitudeTypique(serie: SerieM1, uniteDeTemps: number): number {
  const vue = agreger(serie, uniteDeTemps);
  const n = vue.t.length;
  if (n === 0) return 0;
  const amplitudes = new Float64Array(n);
  for (let i = 0; i < n; i++) amplitudes[i] = vue.h[i] - vue.l[i];
  const triees = Array.from(amplitudes).sort((a, b) => a - b);
  const mediane = triees[Math.floor(triees.length / 2)];
  return mediane * serie.tailleTick;
}

/** Met à l'échelle une distance exprimée en ticks de `source` vers `cible`. */
function transposerTicks(
  ticks: number,
  source: Instrument,
  cible: Instrument,
  amplitudeSource: number,
  amplitudeCible: number,
): number {
  if (amplitudeSource <= 0 || amplitudeCible <= 0) return ticks;
  const enPoints = ticks * source.tailleTick;
  const enBougies = enPoints / amplitudeSource;
  const pointsCible = enBougies * amplitudeCible;
  // ⚠️ Jamais zéro : une distance nulle rend un stop ou une tolérance
  // inutilisables, et le marché cible sortirait « zéro trade » pour une raison
  // qui n'a rien à voir avec la méthode.
  return Math.max(1, Math.round(pointsCible / cible.tailleTick));
}

/**
 * Le même plan, exprimé dans les prix d'un autre marché.
 *
 * ⚠️ Les coûts sont ceux du marché CIBLE, pas ceux d'origine. Transporter les
 * coûts du Nasdaq sur l'or donnerait un avantage fabriqué de toutes pièces, et
 * c'est exactement l'erreur que le projet a documentée sur la vidéo du
 * concurrent : le spread est ce qui décide.
 */
export function transposerPlan(
  plan: PlanExecution,
  source: Instrument,
  cible: Instrument,
  amplitudeSource: number,
  amplitudeCible: number,
): PlanExecution {
  const t = (ticks: number) =>
    transposerTicks(ticks, source, cible, amplitudeSource, amplitudeCible);

  const niveau = { ...plan.niveau };
  if (niveau.type === "trendline") niveau.toleranceTicks = t(niveau.toleranceTicks);
  if (niveau.type === "order_block" || niveau.type === "breaker") {
    niveau.impulsionMinTicks = t(niveau.impulsionMinTicks);
  }
  if (niveau.type === "fvg_zone") niveau.tailleMinTicks = t(niveau.tailleMinTicks);

  const declencheur = { ...plan.declencheur };
  if (declencheur.type === "retest_apres_cassure") {
    declencheur.toleranceTicks = t(declencheur.toleranceTicks);
  }

  const stop = { ...plan.stop };
  if (stop.type === "fixe") stop.ticks = t(stop.ticks);
  else if (stop.type !== "atr") stop.bufferTicks = t(stop.bufferTicks);

  const confirmations: BlocConfirmation[] = plan.confirmations.map((c) =>
    c.type === "amplitude_min" ? { ...c, ticks: t(c.ticks) } : { ...c },
  );

  return {
    ...plan,
    instrument: cible.code,
    niveau,
    declencheur,
    stop,
    confirmations,
    couts: coutsPourInstrument(cible),
  };
}

export interface ResultatMarche {
  code: string;
  nom: string;
  trades: number;
  esperanceR: number | null;
  borneBasse: number | null;
  borneHaute: number | null;
  /** Vrai quand zéro est hors de l'intervalle, du bon côté. */
  avantageRetrouve: boolean;
  /** Vrai quand l'échantillon est trop petit pour qu'on dise quoi que ce soit. */
  insuffisant: boolean;
  /** Le marché sur lequel le plan a été réglé. */
  sien: boolean;
  /** Mois de données introuvables : le résultat porte sur moins que la période. */
  moisManquants: number;
}

export type VerdictMarches =
  /** Trop peu de marchés mesurables pour conclure. */
  | "indecidable"
  /** L'avantage ne se retrouve que sur le marché d'origine. */
  | "seul_le_sien"
  /** Il se retrouve sur une partie des marchés comparables. */
  | "partage"
  /** Il ne se retrouve nulle part, pas même chez lui. */
  | "nulle_part";

export function lireLesMarches(resultats: ResultatMarche[]): {
  verdict: VerdictMarches;
  retrouves: number;
  mesurables: number;
} {
  const mesurables = resultats.filter((r) => !r.insuffisant);
  const retrouves = mesurables.filter((r) => r.avantageRetrouve);
  if (mesurables.length < 2) {
    return { verdict: "indecidable", retrouves: retrouves.length, mesurables: mesurables.length };
  }
  if (retrouves.length === 0) {
    return { verdict: "nulle_part", retrouves: 0, mesurables: mesurables.length };
  }
  // ⚠️ « Seul le sien » est le cas qu'il faut savoir nommer : c'est celui qui
  // ressemble le plus à une bonne nouvelle et qui en est le contraire.
  if (retrouves.length === 1 && retrouves[0].sien) {
    return { verdict: "seul_le_sien", retrouves: 1, mesurables: mesurables.length };
  }
  return { verdict: "partage", retrouves: retrouves.length, mesurables: mesurables.length };
}
