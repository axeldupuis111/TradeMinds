import { MIN_TRADES, projeter, type Projection, type ProjectionTrade } from "../projection";
import type { TradeSimule } from "./types";

/**
 * ET SI TU TRADAIS ÇA PENDANT UN AN ?
 *
 * ── POURQUOI ON PEUT BRANCHER LES DEUX, ET CE QU'IL NE FAUT PAS CONFONDRE ───
 *
 * `lib/projection.ts` mange une série de résultats de trades et rend une
 * distribution d'avenirs. Le backtest sort exactement ça. Le branchement est
 * donc gratuit, et il répond à la question que le verdict ne traite pas : une
 * espérance par trade ne dit rien du chemin, et c'est le chemin qui vide les
 * comptes.
 *
 * ⚠️⚠️ MAIS CE N'EST PAS LA MÊME PROJECTION QUE CELLE DE L'ONGLET STRATÉGIE, et
 * la différence est tout sauf un détail.
 *
 * - Celle de l'onglet Stratégie part des trades que le trader a RÉELLEMENT
 *   pris. Elle projette un avantage qu'il a déjà démontré, avec son exécution,
 *   ses hésitations et ses frais réels.
 * - Celle-ci part de trades qui N'ONT JAMAIS EXISTÉ. Elle projette un avantage
 *   simulé, obtenu en rejouant des bougies passées sur des règles mécanisées.
 *
 * Les deux écrans se ressemblent, les deux chiffres se ressemblent, et un
 * trader qui les confond croira avoir démontré ce qu'il a seulement supposé.
 * L'interface doit donc le dire en toutes lettres, et l'en-tête de
 * `projection.ts` reste vrai sur ce point : le rééchantillonnage suppose que le
 * prochain trade ressemble aux précédents, ce qui ne tient déjà pas sur un vrai
 * journal, et encore moins sur des trades qu'on n'a pas passés.
 *
 * ── LE CAPITAL, ET POURQUOI IL VAUT 100 ─────────────────────────────────────
 *
 * ⚠️ ON NE DEMANDE PAS SON CAPITAL AU TRADER. Le moteur raisonne en R ; la seule
 * chose qui traduit un R en argent est le risque par trade, qui est déjà dans le
 * plan. En posant un capital de 100, tout ce que rend la projection se lit
 * directement en POURCENTAGE du capital de départ, quel qu'il soit. C'est vrai
 * pour n'importe quel compte, ça n'invente aucun chiffre, et ça évite un champ
 * de formulaire dont la réponse ne changerait rien à la forme du résultat.
 */

/** Capital nominal : tous les montants rendus se lisent alors en % du capital. */
export const CAPITAL_NOMINAL = 100;

export interface ProjectionDuBacktest {
  projection: Projection;
  /** Le risque par trade employé, en % : sans lui, rien n'est convertible. */
  risquePct: number;
}

/**
 * @param risquePct part du capital risquée par trade. `undefined` ou 0 rend
 * `null` : ⚠️ sans risque par trade, un R n'a pas de valeur en argent, et
 * choisir 1 % à sa place produirait un risque de ruine qui n'est pas le sien.
 */
export function projeterLeBacktest(
  trades: TradeSimule[],
  risquePct: number | undefined,
  annees = 1,
): ProjectionDuBacktest | null {
  if (!risquePct || risquePct <= 0) return null;
  if (trades.length < MIN_TRADES) return null;

  const pourProjection: ProjectionTrade[] = trades.map((t) => ({
    // ⚠️ La date d'OUVERTURE : la projection s'en sert pour déduire le rythme,
    // donc combien de trades par an. Prendre la sortie décalerait ce rythme
    // d'autant que les positions durent.
    open_time: new Date(t.entreeMs).toISOString(),
    netPnl: t.r * risquePct,
  }));

  return {
    projection: projeter(pourProjection, { annees, capitalDepart: CAPITAL_NOMINAL }),
    risquePct,
  };
}
