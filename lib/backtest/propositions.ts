import { effetSurLeCompte } from "./capital";
import { lancerBacktest } from "./engine";
import type { Couts, PlanExecution, SerieM1 } from "./types";

/**
 * LES PROPOSITIONS : « voici ce que tu pourrais changer, et ce que ça ferait ».
 *
 * ── LA FRONTIÈRE, ET POURQUOI ELLE EST LÀ ───────────────────────────────────
 *
 * Un trader veut légitimement plus de trades, moins de risque, et de meilleurs
 * gains. Les deux premiers se proposent honnêtement. Le troisième, non, et il
 * faut savoir dire pourquoi plutôt que de faire semblant.
 *
 * ⚠️⚠️ ON NE CHERCHE JAMAIS LE RÉGLAGE QUI GAGNE LE PLUS. Essayer vingt valeurs
 * et garder celle qui sort le meilleur chiffre trouve TOUJOURS quelque chose,
 * même dans du bruit pur : c'est la définition du sur-apprentissage, et c'est
 * exactement ce que le compteur de tentatives de cette page existe pour
 * décourager. Un bouton qui le ferait à la place du trader serait pire que le
 * trader qui le fait à la main, parce qu'il aurait l'air d'un conseil.
 *
 * Ce que cette fonction s'autorise, à la place :
 *
 * 1. **Des leviers choisis par RAISONNEMENT, pas par balayage.** Élargir la
 *    tolérance d'une trendline produit mécaniquement plus de droites. Diviser
 *    le risque par deux divise mécaniquement le recul. On sait DIRE pourquoi
 *    chaque levier agit, avant de l'essayer.
 * 2. **Une mesure, jamais un classement.** On rend l'effet de chaque levier sur
 *    l'objectif demandé. On ne trie pas par performance, on ne recommande pas
 *    « le meilleur », et on n'en cache aucun.
 * 3. **Les coûts sont le seul chemin honnête vers de meilleurs gains**, parce
 *    qu'ils se réduisent structurellement (un stop plus large, une unité de
 *    temps plus grande) et non en cherchant un nombre chanceux.
 *
 * ⚠️ UN SEUL LEVIER PAR PROPOSITION. Une proposition qui réécrirait trois
 * réglages ne serait plus la stratégie du trader, et il ne pourrait plus dire
 * ce qui a changé ni pourquoi.
 */

/** Ce que le trader cherche à obtenir. */
export type Objectif =
  /** Assez de trades pour qu'un chiffre veuille dire quelque chose. */
  | "plus_de_trades"
  /** Un compte qui survit à la pire série de la période. */
  | "proteger_le_compte"
  /** Des coûts qui pèsent moins lourd dans chaque trade. */
  | "couts_moins_lourds";

export const OBJECTIFS: Objectif[] = [
  "plus_de_trades",
  "proteger_le_compte",
  "couts_moins_lourds",
];

export interface Proposition {
  objectif: Objectif;
  /** Clé de traduction du levier employé. */
  levier: string;
  /** Le bloc du plan que ça touche, pour le montrer dans l'éditeur. */
  bloc: string;
  avant: string;
  apres: string;
  /** Le plan modifié, prêt à appliquer. */
  plan: PlanExecution;
  /** Trades produits par la variante. */
  trades: number;
  /** Pire recul du compte, en % de son sommet. */
  reculComptePct: number;
  /** Le compte est-il vidé en route ? */
  ruine: boolean;
  /**
   * Part du risque moyen mangée par l'aller-retour, en pourcentage.
   * C'est le seul chiffre de « performance » qu'on rend, et il est structurel :
   * il ne dépend pas de la chance qu'a eue la stratégie sur cette période.
   */
  partDesCoutsPct: number;
  /**
   * Vrai quand la variante ne change AUCUN trade : l'effet est arithmétique.
   *
   * ⚠️ La distinction compte. Diviser le risque par trade ne modifie pas une
   * seule entrée : les mêmes trades, la même suite de R, seule la taille change.
   * Il n'y a donc là aucun sur-apprentissage possible, et il serait injuste de
   * mettre cette proposition sur le même plan qu'un changement de réglage.
   */
  sansRejeu: boolean;
}

/** Unités de temps, de la plus fine à la plus large. */
const ECHELLE_UT = [1, 3, 5, 15, 30, 60, 240];

/** Une variante candidate, avant qu'on la mesure. */
type Candidate = Omit<
  Proposition,
  "trades" | "reculComptePct" | "ruine" | "partDesCoutsPct"
>;

function pointsDe(ticks: number, tailleTick: number): string {
  return (ticks * tailleTick).toFixed(3).replace(/\.?0+$/, "");
}

/**
 * PLUS DE TRADES. Chaque levier est choisi parce qu'on sait dire pourquoi il
 * augmente le nombre d'occasions, pas parce qu'il a bien marché.
 */
function pourPlusDeTrades(plan: PlanExecution, tailleTick: number): Candidate[] {
  const out: Candidate[] = [];
  const pts = (t: number) => pointsDe(t, tailleTick);

  if (plan.niveau.type === "trendline") {
    const n = plan.niveau;
    // Une droite plus épaisse accepte des touches un peu moins parfaites, donc
    // se confirme plus souvent.
    out.push({
      objectif: "plus_de_trades",
      levier: "tolerance",
      bloc: "niveau",
      avant: pts(n.toleranceTicks),
      apres: pts(n.toleranceTicks * 3),
      plan: { ...plan, niveau: { ...n, toleranceTicks: n.toleranceTicks * 3 } },
      sansRejeu: false,
    });
    // Un pivot plus étroit reconnaît des sommets plus modestes, donc en trouve
    // davantage à relier.
    const etroit = Math.max(2, Math.round(n.pivots / 2));
    if (etroit < n.pivots) {
      out.push({
        objectif: "plus_de_trades",
        levier: "pivots",
        bloc: "niveau",
        avant: String(n.pivots),
        apres: String(etroit),
        plan: { ...plan, niveau: { ...n, pivots: etroit } },
        sansRejeu: false,
      });
    }
  }

  // Descendre d'une unité de temps multiplie mécaniquement les bougies, donc
  // les occasions. ⚠️ Et rétrécit les stops : la proposition rend aussi la part
  // des coûts, pour que le trader voie les deux faces.
  const rangUT = ECHELLE_UT.indexOf(plan.uniteDeTemps ?? 1);
  if (rangUT > 0) {
    out.push({
      objectif: "plus_de_trades",
      levier: "unite_de_temps",
      bloc: "uniteDeTemps",
      avant: String(plan.uniteDeTemps ?? 1),
      apres: String(ECHELLE_UT[rangUT - 1]),
      plan: { ...plan, uniteDeTemps: ECHELLE_UT[rangUT - 1] },
      sansRejeu: false,
    });
  }

  // Une séance restreinte écarte des heures entières. L'ouvrir en rend l'accès.
  if (plan.contexte.debut !== "00:00" || plan.contexte.fin !== "23:59") {
    out.push({
      objectif: "plus_de_trades",
      levier: "seance",
      bloc: "contexte",
      avant: `${plan.contexte.debut}-${plan.contexte.fin}`,
      apres: "00:00-23:59",
      plan: { ...plan, contexte: { ...plan.contexte, debut: "00:00", fin: "23:59" } },
      sansRejeu: false,
    });
  }

  return out;
}

/**
 * PROTÉGER LE COMPTE. Le premier levier ne touche à aucun trade : c'est de
 * l'arithmétique, et c'est le plus efficace des trois.
 */
function pourProtegerLeCompte(plan: PlanExecution): Candidate[] {
  const out: Candidate[] = [];
  const risque = plan.gestion.risqueParTradePct;

  if (risque && risque > 0.5) {
    for (const cible of [Math.round(risque / 2 * 100) / 100, 1]) {
      if (cible < risque && cible >= 0.1) {
        out.push({
          objectif: "proteger_le_compte",
          levier: "risque_par_trade",
          bloc: "gestion",
          avant: `${risque} %`,
          apres: `${cible} %`,
          plan: { ...plan, gestion: { ...plan.gestion, risqueParTradePct: cible } },
          // ⚠️ Les trades sont IDENTIQUES : seule la taille de position change.
          sansRejeu: true,
        });
      }
    }
  }

  // Couper la journée après N pertes borne la pire journée possible. Ça change
  // les trades, donc ça se rejoue.
  const actuel = plan.gestion.maxPertesConsecutives;
  for (const cible of [3, 2]) {
    if (actuel == null || cible < actuel) {
      out.push({
        objectif: "proteger_le_compte",
        levier: "pertes_daffilee",
        bloc: "gestion",
        avant: actuel == null ? "—" : String(actuel),
        apres: String(cible),
        plan: { ...plan, gestion: { ...plan.gestion, maxPertesConsecutives: cible } },
        sansRejeu: false,
      });
    }
  }

  return out;
}

/**
 * DES COÛTS QUI PÈSENT MOINS.
 *
 * ⚠️ C'EST LE SEUL CHEMIN HONNÊTE VERS DE MEILLEURS GAINS, et il mérite d'être
 * expliqué. Le coût d'un aller-retour est fixe en points ; ce qui varie, c'est
 * la taille du risque auquel on le compare. Un stop deux fois plus large fait
 * peser le même coût deux fois moins lourd, sans qu'on ait cherché quoi que ce
 * soit. C'est structurel, donc ça ne dépend pas de la chance qu'a eue la
 * stratégie sur cette période — contrairement à n'importe quel réglage retenu
 * parce qu'il sortait le meilleur chiffre.
 */
function pourReduireLesCouts(plan: PlanExecution, tailleTick: number): Candidate[] {
  const out: Candidate[] = [];

  const rangUT = ECHELLE_UT.indexOf(plan.uniteDeTemps ?? 1);
  if (rangUT >= 0 && rangUT < ECHELLE_UT.length - 1) {
    out.push({
      objectif: "couts_moins_lourds",
      levier: "unite_de_temps_haute",
      bloc: "uniteDeTemps",
      avant: String(plan.uniteDeTemps ?? 1),
      apres: String(ECHELLE_UT[rangUT + 1]),
      plan: { ...plan, uniteDeTemps: ECHELLE_UT[rangUT + 1] },
      sansRejeu: false,
    });
  }

  const s = plan.stop;
  if (s.type === "fixe") {
    out.push({
      objectif: "couts_moins_lourds",
      levier: "stop_plus_large",
      bloc: "stop",
      avant: pointsDe(s.ticks, tailleTick),
      apres: pointsDe(s.ticks * 2, tailleTick),
      plan: { ...plan, stop: { ...s, ticks: s.ticks * 2 } },
      sansRejeu: false,
    });
  } else if (s.type !== "atr") {
    out.push({
      objectif: "couts_moins_lourds",
      levier: "stop_plus_large",
      bloc: "stop",
      avant: pointsDe(s.bufferTicks, tailleTick),
      apres: pointsDe(Math.max(1, s.bufferTicks * 3), tailleTick),
      plan: { ...plan, stop: { ...s, bufferTicks: Math.max(1, s.bufferTicks * 3) } },
      sansRejeu: false,
    });
  }

  return out;
}

/** Ce qu'un backtest rend d'utile a une proposition. */
interface Mesure {
  trades: number;
  rs: number[];
  risqueMoyenTicks: number;
}

function mesurerPlan(serie: SerieM1, plan: PlanExecution, couts: Couts): Mesure {
  const r = lancerBacktest(serie, { ...plan, couts });
  const risques = r.trades.map((t) => t.risqueTicks);
  return {
    trades: r.trades.length,
    rs: r.trades.map((t) => t.r),
    risqueMoyenTicks:
      risques.length > 0 ? risques.reduce((a, b) => a + b, 0) / risques.length : 0,
  };
}

/**
 * Transforme une mesure en proposition.
 *
 * ⚠️ ON NE LIT NI L'ESPERANCE NI LE TOTAL. Rien ici ne permet de classer les
 * propositions par ce qu'elles ont RAPPORTE sur la periode : seulement le
 * nombre de trades, ce que le compte encaisse, et la part des couts. C'est la
 * frontiere decrite en tete de fichier, et elle doit tenir dans le code, pas
 * seulement dans le commentaire.
 */
function enProposition(candidate: Candidate, m: Mesure, couts: Couts, risquePct: number): Proposition {
  const compte = effetSurLeCompte(m.rs, risquePct);
  const allerRetour = couts.spreadTicks + couts.glissementTicks + couts.commissionTicks;
  return {
    ...candidate,
    trades: m.trades,
    reculComptePct: compte.reculPct,
    ruine: compte.ruine,
    partDesCoutsPct: m.risqueMoyenTicks > 0 ? (allerRetour / m.risqueMoyenTicks) * 100 : 0,
  };
}

/**
 * Toutes les propositions, mesurées.
 *
 * ⚠️ LE NOMBRE DE VARIANTES EST BORNÉ ET DÉCLARÉ. Chacune est un backtest
 * complet : en essayer trente ferait de cette aide la recherche exhaustive
 * qu'on refuse, et coûterait une minute d'attente pour le dire.
 */
export const VARIANTES_MAX = 12;

/**
 * La proposition fait-elle vraiment ce qu'elle annonce ?
 *
 * ⚠️ ON FILTRE SUR L'OBJECTIF, JAMAIS SUR LA PERFORMANCE, et la distinction est
 * toute la difference entre aider et tricher. « Ce reglage produit plus de
 * trades » est un fait mecanique sur la taille de l'echantillon. « Ce reglage a
 * rapporte davantage » serait un choix fait apres coup sur une periode connue,
 * c'est-a-dire du sur-apprentissage.
 *
 * ⚠️ NE D'UN CONSTAT : sur la vraie strategie, « epaissir la trendline » figurait
 * sous « avoir plus de trades » et en rendait 449 au lieu de 522. Une droite
 * plus epaisse se confirme plus tot, donc meurt plus tot. Afficher ca sous cet
 * objectif ferait passer l'outil pour approximatif, a juste titre.
 */
function tientSaPromesse(prop: Proposition, actuel: Proposition): boolean {
  // ⚠️ UN GAIN VISIBLE, PAS UN GAIN THEORIQUE. Une proposition qui fait passer
  // la part des couts de 1,24 % a 1,21 % s'affiche « 1,2 % -> 1,2 % » : elle
  // encombre la liste, elle n'apprend rien, et elle donne l'impression que
  // l'outil propose au hasard. On exige un dixieme d'ecart au moins.
  const NET = 1.1;
  if (prop.objectif === "plus_de_trades") return prop.trades > actuel.trades * NET;
  if (prop.objectif === "proteger_le_compte") {
    // Un compte vide reste un compte vide : ce n'est pas une protection.
    if (prop.ruine) return false;
    return prop.reculComptePct * NET < actuel.reculComptePct;
  }
  // Alleger les couts suppose aussi qu'il reste des trades a peser.
  return prop.partDesCoutsPct * NET < actuel.partDesCoutsPct && prop.trades > 0;
}

export function chercherPropositions(
  serie: SerieM1,
  plan: PlanExecution,
  couts: Couts,
  avancement?: (faits: number, total: number) => void,
): Proposition[] {
  const tailleTick = serie.tailleTick;
  const candidates = [
    ...pourPlusDeTrades(plan, tailleTick),
    ...pourProtegerLeCompte(plan),
    ...pourReduireLesCouts(plan, tailleTick),
  ].slice(0, VARIANTES_MAX);

  // ⚠️ La reference sert aux variantes qui ne changent AUCUN trade. Rejouer le
  // plan pour un simple changement de taille de position serait du temps
  // depense a recalculer une suite de R identique au tick pres.
  const reference = mesurerPlan(serie, plan, couts);

  const actuel = enProposition(
    { objectif: "plus_de_trades", levier: "", bloc: "", avant: "", apres: "", plan, sansRejeu: true },
    reference,
    couts,
    plan.gestion.risqueParTradePct ?? 0,
  );

  const out: Proposition[] = [];
  for (let i = 0; i < candidates.length; i++) {
    const cand = candidates[i];
    const m = cand.sansRejeu ? reference : mesurerPlan(serie, cand.plan, couts);
    const prop = enProposition(cand, m, couts, cand.plan.gestion.risqueParTradePct ?? 0);
    if (tientSaPromesse(prop, actuel)) out.push(prop);
    avancement?.(i + 1, candidates.length);
  }
  return out;
}
