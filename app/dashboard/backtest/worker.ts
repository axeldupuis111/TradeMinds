/// <reference lib="webworker" />

import { chargerSerie } from "@/lib/backtest/chargement";
import { courbeIndicateur, lancerBacktest } from "@/lib/backtest/engine";
import { agreger } from "@/lib/backtest/serie";
import { lireBacktest, MIN_TRADES_CONCLUSION, type LectureBacktest } from "@/lib/backtest/verdict";
import { chercherReglagesViables, type Suggestion } from "@/lib/backtest/suggestions";
import type { Couts, PlanExecution, ResultatBacktest, SerieM1, TradeSimule } from "@/lib/backtest/types";

/**
 * LE BACKTEST TOURNE ICI, PAS DANS LA PAGE.
 *
 * Une passe sur trois ans de M1 traverse plus d'un million de bougies. C'est
 * rapide (quelques centaines de millisecondes), mais assez long pour figer une
 * interface : pendant ce temps, plus une animation, plus un clic, et l'onglet
 * passe pour planté. Le worker garde le fil principal libre et permet
 * d'afficher une vraie progression pendant le téléchargement, qui est de loin
 * l'étape la plus lente.
 *
 * ⚠️ Le worker fait AUSSI le téléchargement. Charger vingt mégaoctets dans la
 * page pour les recopier ensuite dans le worker doublerait la mémoire utilisée
 * au moment le plus tendu.
 */

export interface DemandeBacktest {
  code: string;
  de: string;
  a: string;
  plan: PlanExecution;
  couts: Couts;
  /** Nombre de rejeux déjà effectués. Sert à l'alerte de sur-apprentissage. */
  tentatives: number;
}

/** Une bougie prête à dessiner, en unités de PRIX (plus en ticks). */
export interface BougieApercu {
  t: number;
  o: number;
  h: number;
  l: number;
  c: number;
}

/** La geometrie du niveau, en unites de PRIX, prete a dessiner. */
export type TraceDessin =
  | { forme: "droite"; a: { ms: number; prix: number }; b: { ms: number; prix: number }; touches: { ms: number; prix: number }[] }
  | { forme: "horizontale"; prix: number }
  | { forme: "zone"; haut: number; bas: number; debutMs: number; finMs: number };

/** Un trade et les bougies qui l'entourent, pour vérification à l'œil. */
export interface Apercu {
  trade: TradeSimule;
  bougies: BougieApercu[];
  /** Prix, en unités de PRIX, des repères à tracer. */
  entree: number;
  stop: number;
  objectif: number;
  sortie: number;
  niveau: number;
  /**
   * La COURBE de l'indicateur sur la fenetre, quand le niveau en est un.
   *
   * ⚠️ Une moyenne mobile ou un VWAP ne sont pas un prix fige : les dessiner
   * comme un trait horizontal au moment du signal montrerait un objet qui
   * n'existe pas. Le trader doit voir la courbe serpenter entre ses bougies,
   * sinon il ne reconnait pas son indicateur.
   */
  courbes?: { nom: string; points: (number | null)[] }[];
  /**
   * La forme du niveau telle que le trader l'aurait tracee.
   *
   * ⚠️ SANS ELLE, UNE TRENDLINE S'AFFICHAIT COMME UN TRAIT PLAT et le trader ne
   * reconnaissait rien de sa methode. C'est la piece qui rend la verification
   * possible : sans elle, il ne peut ni confirmer ni dementir.
   */
  trace?: TraceDessin;
}

/**
 * Combien de trades on prépare à dessiner.
 *
 * ⚠️ On prend les PREMIERS, pas les plus beaux. Choisir les gagnants ferait de
 * cette section une vitrine, alors qu'elle existe pour que le trader puisse
 * dire « ce n'est pas mon setup ».
 */
const APERCUS_MAX = 12;
/** Bougies visibles avant le signal et après la sortie. */
const AVANT = 40;
const APRES = 15;
/** Bougies gardees avant le premier ancrage d'une droite. */
const MARGE_AVANT_TRACE = 8;
/**
 * Largeur maximale de la fenetre, en bougies.
 *
 * ⚠️ Une trendline peut s'ancrer tres loin en arriere. Sans borne, la fenetre
 * atteint des centaines de bougies et chacune devient un cheveu : on aurait
 * remplace un graphique illisible par un autre.
 */
const FENETRE_MAX = 140;

function preparerApercus(serie: SerieM1, trades: TradeSimule[], plan: PlanExecution): Apercu[] {
  if (trades.length === 0) return [];
  const tick = serie.tailleTick;
  const pas = Math.max(1, Math.floor(trades.length / APERCUS_MAX));
  const choisis: TradeSimule[] = [];
  // Répartis sur toute la période plutôt que groupés au début : une méthode
  // peut être juste en janvier et absurde en novembre.
  for (let k = 0; k < trades.length && choisis.length < APERCUS_MAX; k += pas) {
    choisis.push(trades[k]);
  }

  const apercus: Apercu[] = [];
  for (const trade of choisis) {
    // ⚠️ La fenetre doit remonter jusqu'au PREMIER ancrage de la droite, sinon
    // on affiche une trendline dont on ne voit ni le depart ni les touches, et
    // le trader ne peut toujours pas reconnaitre son setup.
    const debutTrace =
      trade.trace?.forme === "droite" ? Math.min(trade.trace.a.ms, trade.trace.b.ms) : trade.signalMs;
    let debut = 0;
    let fin = serie.t.length - 1;
    for (let i = 0; i < serie.t.length; i++) {
      if (serie.t[i] === debutTrace) debut = Math.max(0, i - MARGE_AVANT_TRACE);
      if (serie.t[i] === trade.signalMs && debut === 0) debut = Math.max(0, i - AVANT);
      if (serie.t[i] === trade.sortieMs) {
        fin = Math.min(serie.t.length - 1, i + APRES);
        break;
      }
    }
    // Une droite tres ancienne donnerait une fenetre illisible : on la borne.
    if (fin - debut > FENETRE_MAX) debut = fin - FENETRE_MAX;
    const bougies: BougieApercu[] = [];
    for (let i = debut; i <= fin; i++) {
      bougies.push({
        t: serie.t[i],
        o: serie.o[i] * tick,
        h: serie.h[i] * tick,
        l: serie.l[i] * tick,
        c: serie.c[i] * tick,
      });
    }
    const signe = trade.sens === "long" ? 1 : -1;
    const brute = trade.trace;
    const trace: TraceDessin | undefined =
      brute?.forme === "droite"
        ? {
            forme: "droite",
            a: { ms: brute.a.ms, prix: brute.a.prixTicks * tick },
            b: { ms: brute.b.ms, prix: brute.b.prixTicks * tick },
            touches: brute.touches.map((x) => ({ ms: x.ms, prix: x.prixTicks * tick })),
          }
        : brute?.forme === "zone"
          ? {
              forme: "zone",
              haut: brute.hautTicks * tick,
              bas: brute.basTicks * tick,
              debutMs: brute.debutMs,
              finMs: brute.finMs,
            }
          : brute?.forme === "horizontale"
            ? { forme: "horizontale", prix: brute.prixTicks * tick }
            : undefined;

    apercus.push({
      trade,
      bougies,
      courbes: courbeIndicateur(serie, plan, debut, fin)?.map((c) => ({
        nom: c.nom,
        points: c.valeurs.map((v) => (v === null ? null : v * tick)),
      })),
      entree: trade.entreeTicks * tick,
      sortie: trade.sortieTicks * tick,
      stop: (trade.entreeTicks - signe * trade.risqueTicks) * tick,
      objectif: (trade.entreeTicks + signe * 2 * trade.risqueTicks) * tick,
      niveau: trade.niveauSignal * tick,
      trace,
    });
  }
  return apercus;
}

export type ReponseBacktest =
  | { type: "avancement"; faits: number; total: number }
  | { type: "calcul" }
  | {
      type: "fini";
      resultat: ResultatBacktest;
      lecture: LectureBacktest;
      moisCharges: string[];
      moisManquants: string[];
      octets: number;
      ms: number;
      apercus: Apercu[];
      /**
       * Réglages voisins qui produiraient assez de trades. Vide dès que le plan
       * conclut déjà.
       */
      suggestions: Suggestion[];
    }
  | { type: "erreur"; message: string };

const poste = (r: ReponseBacktest) => (self as unknown as Worker).postMessage(r);

self.onmessage = async (e: MessageEvent<DemandeBacktest>) => {
  const { code, de, a, plan, couts, tentatives } = e.data;
  try {
    const { serie, moisCharges, moisManquants, octets } = await chargerSerie(code, de, a, (faits, total) =>
      poste({ type: "avancement", faits, total }),
    );

    poste({ type: "calcul" });
    const t0 = performance.now();
    const complet = { ...plan, couts };
    const resultat = lancerBacktest(serie, complet);
    const ms = Math.round(performance.now() - t0);

    // Les aperçus se lisent sur les bougies REGROUPÉES, celles que le moteur a
    // vues : dessiner des M1 sous une stratégie de M15 montrerait un graphique
    // que le trader ne reconnaîtrait pas, et la vérification perdrait son sens.
    const vues = agreger(serie, complet.uniteDeTemps ?? 1);

    // ⚠️ On ne cherche des voisins QUE si l'échantillon est trop petit, et on ne
    // regarde que leur NOMBRE de trades. Chercher aussi quand le plan conclut
    // reviendrait à proposer au trader d'autres réglages « au cas où », c'est-à-
    // dire à lui suggérer d'aller pêcher un meilleur chiffre.
    const suggestions =
      resultat.trades.length < MIN_TRADES_CONCLUSION
        ? chercherReglagesViables(serie, complet, serie.tailleTick)
        : [];

    poste({
      type: "fini",
      resultat,
      lecture: lireBacktest(resultat, couts, tentatives),
      moisCharges,
      moisManquants,
      octets,
      ms,
      apercus: preparerApercus(vues, resultat.trades, complet),
      suggestions,
    });
  } catch (err) {
    poste({ type: "erreur", message: err instanceof Error ? err.message : String(err) });
  }
};
