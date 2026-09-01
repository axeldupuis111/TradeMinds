/// <reference lib="webworker" />

import { chargerSerie } from "@/lib/backtest/chargement";
import { courbeIndicateur, lancerBacktest } from "@/lib/backtest/engine";
import { fenetreApercu, geometrieDessin } from "@/lib/backtest/apercu";
import { agreger } from "@/lib/backtest/serie";
import { lireBacktest, MIN_TRADES_CONCLUSION, type LectureBacktest } from "@/lib/backtest/verdict";
import { chercherReglagesViables, type Suggestion } from "@/lib/backtest/suggestions";
import { chercherPropositions, type Proposition } from "@/lib/backtest/propositions";
import { concentration, type Concentration } from "@/lib/backtest/robustesse";
import { mesurerConfluences, type Confluence } from "@/lib/backtest/confluences";
import { verifierLePlan, type Constat, type FicheConfrontable } from "@/lib/backtest/coherence-plan";
import {
  amplitudeTypique,
  transposerPlan,
  type ResultatMarche,
} from "@/lib/backtest/marches";
import { instrumentParCode, INSTRUMENTS } from "@/lib/backtest/instruments";
import { mesurerStabilite, type Stabilite } from "@/lib/backtest/stabilite";
import {
  projeterLeBacktest,
  type ProjectionDuBacktest,
} from "@/lib/backtest/projection-backtest";
import type { Modification } from "@/lib/backtest/modifications";
import type { MecaniqueDessin, TraceDessin } from "@/lib/backtest/apercu";
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
  /**
   * Chercher aussi ce que le trader pourrait changer ?
   *
   * ⚠️ SUR DEMANDE, JAMAIS D'OFFICE. Chaque proposition est un backtest
   * complet : une dizaine de variantes ajoutent plusieurs secondes sur un plan
   * en M1. Les calculer à chaque lancement ferait payer cette attente à tout le
   * monde, y compris à ceux qui ne les regardent pas.
   */
  propositions?: boolean;
  /**
   * Mesurer aussi le voisinage des réglages que le trader a changés ?
   *
   * ⚠️ SUR DEMANDE, ET SEULEMENT POUR CE QU'IL A CHANGÉ. C'est un balayage de
   * paramètres, donc la chose que cette page refuse partout ailleurs ; ce qui le
   * rend acceptable est décrit en tête de `stabilite.ts`, et repose entre autres
   * sur le fait qu'il ne rend aucun plan applicable.
   */
  stabilite?: Modification[];
  /**
   * Mesurer aussi l'effet de chaque confluence, avec et sans ?
   *
   * ⚠️ SUR DEMANDE. Chaque filtre coûte deux backtests complets, et il y en a
   * jusqu'à huit : c'est la mesure la plus lourde de la page.
   */
  confluences?: boolean;
  /**
   * Les champs de la fiche à confronter à ce que la mécanique produit.
   *
   * ⚠️ La CONFRONTATION est le sujet : sans eux, on ne peut pas dire « ta fiche
   * annonce trois trades par jour et ta méthode en produit quinze », qui est le
   * constat le plus utile de tout l'écran.
   */
  fiche?: FicheConfrontable;
  /**
   * Rejouer la même méthode sur d'autres marchés comparables.
   *
   * ⚠️ SUR DEMANDE, ET C'EST LA MESURE LA PLUS LOURDE DE TOUTES : chaque marché
   * demande de télécharger sa propre profondeur de bougies. La règle d'échelle
   * appliquée aux distances est décrite en tête de `marches.ts` et affichée au
   * trader ; sans elle, transposer un plan serait une faute silencieuse.
   */
  marches?: string[];
}

/** Une bougie prête à dessiner, en unités de PRIX (plus en ticks). */
export interface BougieApercu {
  t: number;
  o: number;
  h: number;
  l: number;
  c: number;
}

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
  /**
   * Ce que la mecanique d'entree a construit : le desequilibre ou le balayage.
   *
   * ⚠️ Sans elle, un trader ICT voyait une ligne et une bougie d'entree, et ne
   * pouvait pas dire si la machine avait reconnu SA mecanique ou une autre qui
   * tombe au meme endroit. C'est exactement le defaut qui avait ete constate
   * sur la trendline dessinee a plat.
   */
  mecanique?: MecaniqueDessin[];
}

/**
 * Combien de trades on prépare à dessiner.
 *
 * ⚠️ On prend les PREMIERS, pas les plus beaux. Choisir les gagnants ferait de
 * cette section une vitrine, alors qu'elle existe pour que le trader puisse
 * dire « ce n'est pas mon setup ».
 */
const APERCUS_MAX = 12;

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

  // ⚠️ Une table, pas un calcul : le pas entre deux bougies n'est PAS constant
  // (nuits, week-ends, jours feries). Toute conversion par division se trompe
  // des qu'une fermeture passe.
  const indexParMs = new Map<number, number>();
  for (let i = 0; i < serie.t.length; i++) indexParMs.set(serie.t[i], i);

  const apercus: Apercu[] = [];
  for (const trade of choisis) {
    // ⚠️ La fenetre doit remonter jusqu'au PREMIER ancrage de la droite, sinon
    // on affiche une trendline dont on ne voit ni le depart ni les touches, et
    // le trader ne peut toujours pas reconnaitre son setup.
    let debutTrace =
      trade.trace?.forme === "droite" ? Math.min(trade.trace.a.ms, trade.trace.b.ms) : trade.signalMs;
    if (trade.trace?.forme === "zone") debutTrace = Math.min(debutTrace, trade.trace.debutMs);
    // ⚠️ Un balayage peut preceder le signal de plusieurs centaines de bougies
    // (delaiReaction + delaiRetest). Dessine hors de la fenetre, il ne servirait
    // a rien : le trader verrait une entree sans la prise de liquidite qui la
    // justifie, donc exactement ce qu'on cherche a corriger.
    for (const m of trade.mecanique ?? []) {
      const ms = m.forme === "balayage" ? m.ms : m.debutMs;
      if (ms < debutTrace) debutTrace = ms;
    }
    const iSignal = indexParMs.get(trade.signalMs) ?? 0;
    const iSortie = indexParMs.get(trade.sortieMs) ?? iSignal;
    const iAncre = indexParMs.get(debutTrace) ?? iSignal;

    const { debut, fin } = fenetreApercu(iSignal, iSortie, iAncre, serie.t.length);

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
    const { trace, mecanique } = geometrieDessin(trade, indexParMs, debut, tick);

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
      mecanique,
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
      /** Ce que le trader pourrait changer, quand il l'a demandé. */
      propositions?: Proposition[];
      /** D'où vient le résultat dans le temps. Calculé toujours : c'est une addition. */
      concentration: Concentration | null;
      /** Le voisinage des réglages changés, quand il l'a demandé. */
      stabilite?: Stabilite[];
      /**
       * Ce que donnerait une année de ces trades-là, en pourcents du capital.
       * `null` sans risque par trade ou sous le seuil de conclusion.
       */
      projection: ProjectionDuBacktest | null;
      /** Ce que la fiche annonce contre ce que la mécanique a produit. */
      constats: Constat[];
      /** L'effet de chaque confluence, quand il l'a demandé. */
      confluences?: Confluence[];
      /** La même méthode sur d'autres marchés, quand il l'a demandé. */
      marches?: ResultatMarche[];
    }
  | { type: "erreur"; message: string };

const poste = (r: ReponseBacktest) => (self as unknown as Worker).postMessage(r);

self.onmessage = async (e: MessageEvent<DemandeBacktest>) => {
  const { code, de, a, plan, couts, tentatives, propositions, stabilite, confluences, fiche, marches } =
    e.data;
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

    // ⚠️ La lecture est calculée UNE fois et réutilisée : la recalculer pour la
    // cohérence donnerait deux objets qui pourraient diverger si un jour elle
    // devient dépendante d'autre chose que de ses arguments.
    const lecture = lireBacktest(resultat, couts, tentatives);

    /**
     * LA MÊME MÉTHODE AILLEURS.
     *
     * ⚠️ APRÈS TOUT LE RESTE, ET SÉQUENTIELLEMENT. Chaque marché demande son
     * propre téléchargement : les lancer en parallèle saturerait la mémoire du
     * navigateur au moment le plus tendu, et la progression deviendrait
     * illisible pour le trader qui attend.
     */
    let surDAutresMarches: ResultatMarche[] | undefined;
    if (marches && marches.length > 0) {
      const monInstrument = instrumentParCode(code) ?? INSTRUMENTS[0];
      const monAmplitude = amplitudeTypique(serie, complet.uniteDeTemps ?? 1);
      surDAutresMarches = [];

      for (const autre of marches) {
        const cible = instrumentParCode(autre);
        if (!cible) continue;
        try {
          const chargement =
            autre === code
              ? { serie, moisManquants: [] as string[] }
              : await chargerSerie(autre, de, a, (faits, total) =>
                  poste({ type: "avancement", faits, total }),
                );
          const amplitudeCible = amplitudeTypique(chargement.serie, complet.uniteDeTemps ?? 1);
          const planTranspose =
            autre === code
              ? complet
              : transposerPlan(complet, monInstrument, cible, monAmplitude, amplitudeCible);
          const r = lancerBacktest(chargement.serie, planTranspose);
          const l = lireBacktest(r, planTranspose.couts, 0);
          surDAutresMarches.push({
            code: cible.code,
            nom: cible.nom,
            trades: r.trades.length,
            esperanceR: l.stats?.esperanceR ?? null,
            borneBasse: l.stats?.borneBasse ?? null,
            borneHaute: l.stats?.borneHaute ?? null,
            // ⚠️ Le même critère que partout : zéro doit être HORS de
            // l'intervalle. On n'assouplit pas la règle parce qu'on compare.
            avantageRetrouve: l.verdict === "positif",
            insuffisant: l.verdict === "insuffisant",
            sien: autre === code,
            moisManquants: chargement.moisManquants.length,
          });
        } catch {
          // ⚠️ Un marché dont les bougies manquent ne doit pas faire tomber les
          // autres : on le déclare insuffisant, ce qu'il est, et on continue.
          surDAutresMarches.push({
            code: cible.code,
            nom: cible.nom,
            trades: 0,
            esperanceR: null,
            borneBasse: null,
            borneHaute: null,
            avantageRetrouve: false,
            insuffisant: true,
            sien: autre === code,
            moisManquants: 0,
          });
        }
      }
    }

    poste({
      type: "fini",
      resultat,
      lecture,
      moisCharges,
      moisManquants,
      octets,
      ms,
      apercus: preparerApercus(vues, resultat.trades, complet),
      suggestions,
      // ⚠️ Toujours calculée, jamais sur demande : c'est une addition sur les
      // trades déjà obtenus, elle ne coûte rien et elle répond à une question
      // que personne ne pense à poser (« ton résultat vient-il d'un seul mois »).
      concentration: concentration(resultat.trades),
      // ⚠️ Une espérance par trade ne dit rien du CHEMIN, et c'est le chemin qui
      // vide les comptes. Le rééchantillonnage par blocs est déjà écrit et
      // déjà testé : le brancher ne coûte rien.
      projection: projeterLeBacktest(resultat.trades, complet.gestion.risqueParTradePct),
      // ⚠️ Toujours calculés : ce ne sont que des comparaisons entre ce que le
      // trader a écrit et ce que le rejeu a produit. Aucun backtest de plus.
      constats: verifierLePlan(
        complet,
        resultat.audit,
        resultat.trades,
        instrumentParCode(code) ?? INSTRUMENTS[0],
        fiche ?? {},
        lecture.stats,
      ),
      marches: surDAutresMarches,
      confluences: confluences
        ? mesurerConfluences(
            serie,
            complet,
            couts,
            instrumentParCode(code) ?? INSTRUMENTS[0],
            (faits, total) => poste({ type: "avancement", faits, total }),
          )
        : undefined,
      stabilite:
        stabilite && stabilite.length > 0
          ? mesurerStabilite(serie, complet, couts, stabilite, (faits, total) =>
              poste({ type: "avancement", faits, total }),
            )
          : undefined,
      propositions: propositions
        ? chercherPropositions(serie, complet, couts, (faits, total) =>
            poste({ type: "avancement", faits, total }),
          )
        : undefined,
    });
  } catch (err) {
    poste({ type: "erreur", message: err instanceof Error ? err.message : String(err) });
  }
};
