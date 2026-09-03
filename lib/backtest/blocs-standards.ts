import type { Instrument } from "./instruments";
import type { BlocDeclencheur, BlocNiveau } from "./types";

/**
 * UN BLOC RÉGLÉ « COMME TOUT LE MONDE », À UN SEUL ENDROIT.
 *
 * ── POURQUOI CE FICHIER EXISTE ──────────────────────────────────────────────
 *
 * Deux endroits ont besoin de fabriquer un bloc dont personne n'a fixé les
 * réglages : la recherche par dimensions, et le squelette d'une méthode qu'on ne
 * sait pas rejouer entièrement. Deux tables de valeurs par défaut finiraient par
 * diverger, et le trader lirait « order block » avec deux définitions selon la
 * carte qu'il regarde.
 *
 * ⚠️ LES DISTANCES SE DÉRIVENT DU SPREAD DE L'INSTRUMENT, JAMAIS D'UN NOMBRE
 * ÉCRIT EN DUR. « Six points » vaut un tiers de bougie sur le Nasdaq et six
 * bougies sur l'EUR/USD. Le spread est la seule échelle disponible avant
 * d'ouvrir les données, et il suit l'instrument.
 *
 * ⚠️ UN BLOC STANDARD N'EST PAS LE BLOC DU TRADER, et l'écran ne doit jamais les
 * confondre. Le journal de recherche affichait « ta trendline : 73 trades » sur
 * une trendline standard qui n'était pas la sienne : c'est de là que vient la
 * règle, et elle a coûté cher à trouver.
 */

/** Une distance de prix, exprimée en ticks de l'instrument. */
function enTicks(instrument: Instrument, prix: number): number {
  return Math.max(1, Math.round(prix / instrument.tailleTick));
}

/**
 * Un niveau réglé par défaut.
 *
 * @param reference plage horaire de référence, pour les niveaux qui en veulent
 * une. Sans elle, un `range_horaire` n'a pas de sens et la fonction rend `null`.
 */
export function niveauStandard(
  type: BlocNiveau["type"],
  instrument: Instrument,
  reference?: { debut: string; fin: string },
): BlocNiveau | null {
  switch (type) {
    case "trendline":
      return { type, pivots: 10, touchesMin: 3, toleranceTicks: enTicks(instrument, instrument.spread * 2) };
    case "liquidite_swing":
      return { type, pivots: 10 };
    case "extremes_n_bougies":
      return { type, n: 50 };
    case "extremes_veille":
      return { type };
    case "ote_fibonacci":
      return { type, pivots: 10, retraceMinPct: 62, retraceMaxPct: 79 };
    case "order_block":
      return { type, impulsionMinTicks: enTicks(instrument, instrument.spread * 6) };
    case "breaker":
      return { type, impulsionMinTicks: enTicks(instrument, instrument.spread * 6) };
    case "fvg_zone":
      return { type, tailleMinTicks: enTicks(instrument, instrument.spread) };
    case "moyenne_mobile":
      return { type, periode: 50 };
    case "vwap_session":
      return { type };
    case "bollinger":
      return { type, periode: 20, ecarts: 2 };
    case "range_horaire":
      // ⚠️ Sans plage de référence, on ne devine pas : une plage inventée
      // déciderait de tous les niveaux de la méthode.
      return reference ? { type, debut: reference.debut, fin: reference.fin } : null;
    default:
      return null;
  }
}

/** Un déclencheur réglé par défaut. */
export function declencheurStandard(
  type: BlocDeclencheur["type"],
  instrument: Instrument,
): BlocDeclencheur {
  switch (type) {
    case "cassure":
      return { type, mode: "cloture" };
    case "balayage_retour":
      return { type };
    case "retest_apres_cassure":
      return { type, delaiMaxBarres: 20, toleranceTicks: enTicks(instrument, instrument.spread * 2) };
    case "fvg_puis_retest":
      return { type, delaiMaxBarres: 20 };
    case "balayage_puis_fvg":
      return { type, delaiReaction: 10, delaiRetest: 15 };
    case "entree_dans_zone":
      return { type, delaiMaxBarres: 20 };
    default:
      return { type: "cassure", mode: "cloture" };
  }
}
