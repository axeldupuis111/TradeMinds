import { effetSurLeCompte } from "./capital";
import type { Instrument } from "./instruments";
import type { PlanExecution, TradeSimule } from "./types";

/**
 * LE PLAN COMPLET, ÉCRIT, QU'ON PEUT RESPECTER LE LENDEMAIN MATIN.
 *
 * ── CE QUE LE TRADER DEMANDAIT, ET QUE L'OUTIL NE DONNAIT PAS ───────────────
 *
 * « Les utilisateurs ont un seul objectif quand ils vont dans backtest : trouver
 * une stratégie rentable, améliorer la leur, et mettre en place un plan complet
 * afin de pouvoir être disciplinés et respecter les règles. »
 *
 * L'onglet mesurait, chiffrait, nuançait, et ne rendait jamais l'objet dont il
 * avait besoin : une liste de règles à suivre. Ce fichier la fabrique.
 *
 * ── CE QUI FAIT LA VALEUR DE CETTE LISTE ────────────────────────────────────
 *
 * ⚠️ LA MOITIÉ DES LIGNES EST DÉDUITE DE LA MESURE, PAS RECOPIÉE DU PLAN. Un
 * plan qui redirait « risque par trade : 5 % » parce que c'est ce qui était
 * réglé n'apprendrait rien. Ce qui manque à un trader, ce n'est pas la liste de
 * ses réglages, c'est ce que ces réglages LUI ONT FAIT :
 *
 * - le risque par trade le plus haut qui garde le recul du compte sous un seuil
 *   qu'il a choisi, calculé sur SA suite de R ;
 * - la plus longue série de pertes qu'il a réellement traversée, parce que c'est
 *   celle qu'il devra tenir sans dévier ;
 * - combien de fois sa règle d'arrêt se serait déclenchée, parce qu'une règle
 *   qu'on n'applique jamais n'est pas une règle ;
 * - combien de trades par jour attendre, pour savoir quand s'arrêter de
 *   chercher.
 *
 * ⚠️ AUCUNE DE CES DÉDUCTIONS N'EST UNE PRÉVISION. Ce sont des additions et des
 * multiplications sur des R déjà mesurés. « Trois pertes à 5 % font -14 % » est
 * une multiplication ; « tu perdras 14 % » serait une promesse.
 *
 * ⚠️ DES CODES ET DES NOMBRES, JAMAIS DE PHRASES. Même règle que partout
 * ailleurs : la rédaction vit dans les traductions.
 */

export interface LigneDuPlan {
  /** Clé de traduction : `bt_plan_<cle>`. */
  cle: string;
  valeurs: Record<string, string | number>;
  /**
   * Vrai quand la valeur vient de la MESURE et non du réglage.
   *
   * ⚠️ La distinction se voit à l'écran. « Ton stop est derrière le dernier
   * sommet » est une recopie ; « tu as traversé onze pertes d'affilée » est une
   * découverte, et les deux ne se lisent pas avec le même poids.
   */
  deduite?: boolean;
}

/** Ce qu'un niveau de risque fait au compte, sur la suite de R mesurée. */
export interface NiveauDeRisque {
  risquePct: number;
  reculPct: number;
  ruine: boolean;
}

export interface PlanComplet {
  lignes: LigneDuPlan[];
  /** Le tableau risque / recul, pour que le trader choisisse lui-même. */
  risques: NiveauDeRisque[];
  /** Le plus haut risque qui garde le recul sous le seuil. `null` si aucun. */
  risqueRecommandePct: number | null;
  /** Le seuil de recul employé, pour pouvoir le dire à l'écran. */
  seuilReculPct: number;
}

/**
 * Risques essayés, du plus prudent au plus agressif.
 *
 * ⚠️ UNE LISTE FIXE, PAS UNE OPTIMISATION. On ne cherche pas « le meilleur
 * risque » : on montre ce que chacun fait au compte et on laisse le trader
 * trancher. Un risque « optimal » calculé sur le passé est la façon la plus
 * rapide de faire sauter un compte sur l'avenir.
 */
const RISQUES = [0.25, 0.5, 0.75, 1, 1.5, 2, 3, 5];

/**
 * Recul du compte qu'on prend comme limite par défaut.
 *
 * ⚠️ C'EST UNE CONVENTION, ET ELLE EST DÉCLARÉE À L'ÉCRAN. Vingt pour cent est
 * la perte totale que tolèrent la plupart des financements, et à peu près la
 * limite de ce qu'un trader tient sans changer de méthode en cours de route.
 * Ce n'est pas une vérité, c'est un point de départ modifiable.
 */
export const SEUIL_RECUL_PAR_DEFAUT = 20;

/** La plus longue série de pertes consécutives de la suite. */
function plusLongueSerieDePertes(rs: number[]): number {
  let max = 0;
  let courante = 0;
  for (const r of rs) {
    if (r < 0) {
      courante++;
      if (courante > max) max = courante;
    } else {
      courante = 0;
    }
  }
  return max;
}

/** Combien de fois `n` pertes se sont suivies. */
function occurrencesDeSerie(rs: number[], n: number): number {
  if (n <= 0) return 0;
  let fois = 0;
  let courante = 0;
  for (const r of rs) {
    if (r < 0) {
      courante++;
      // ⚠️ On compte une occurrence à CHAQUE fois que le seuil est atteint, pas
      // à chaque perte au-delà : une série de six pertes avec une règle à trois
      // vaut deux déclenchements, pas quatre.
      if (courante % n === 0) fois++;
    } else {
      courante = 0;
    }
  }
  return fois;
}

/** Trades par jour, au plus haut et au neuvième décile. */
function rythmeParJour(trades: TradeSimule[]): { max: number; d9: number } {
  const parJour = new Map<string, number>();
  for (const t of trades) {
    const jour = new Date(t.entreeMs).toISOString().slice(0, 10);
    parJour.set(jour, (parJour.get(jour) ?? 0) + 1);
  }
  const comptes = Array.from(parJour.values()).sort((a, b) => a - b);
  if (comptes.length === 0) return { max: 0, d9: 0 };
  return {
    max: comptes[comptes.length - 1],
    d9: comptes[Math.min(comptes.length - 1, Math.floor(comptes.length * 0.9))],
  };
}

const JOURS = ["D", "L", "M", "M", "J", "V", "S"];

export function composerPlanComplet(
  plan: PlanExecution,
  trades: TradeSimule[],
  instrument: Instrument,
  seuilReculPct = SEUIL_RECUL_PAR_DEFAUT,
): PlanComplet {
  const rs = trades.map((t) => t.r);
  const lignes: LigneDuPlan[] = [];
  const ajouter = (cle: string, valeurs: Record<string, string | number>, deduite = false) =>
    lignes.push({ cle, valeurs, deduite });

  // ── Ce qui se recopie du plan : le quoi, le quand, le comment ────────────
  ajouter("actif", { instrument: instrument.nom });
  ajouter("unite_de_temps", { minutes: plan.uniteDeTemps ?? 1 });
  ajouter("jours", {
    jours: [...plan.contexte.jours]
      .sort((a, b) => a - b)
      .map((j) => JOURS[j])
      .join(" "),
  });
  ajouter("heures", { debut: plan.contexte.debut, fin: plan.contexte.fin });
  ajouter("sens", { sens: plan.sens });
  ajouter("niveau", { type: plan.niveau.type });
  ajouter("declencheur", { type: plan.declencheur.type });
  ajouter("confirmations", {
    liste: plan.confirmations.map((c) => c.type).join(", "),
    n: plan.confirmations.length,
  });
  ajouter("stop", { type: plan.stop.type });
  ajouter("objectif", {
    type: plan.objectif.type,
    r: plan.objectif.type === "multiple_r" ? plan.objectif.r : 0,
  });

  // ── Ce qui se DÉDUIT de la mesure : ce que ces réglages t'ont fait ───────
  const risques: NiveauDeRisque[] = RISQUES.map((risquePct) => {
    const e = effetSurLeCompte(rs, risquePct);
    return { risquePct, reculPct: e.reculPct, ruine: e.ruine };
  });
  // ⚠️ LE PLUS HAUT QUI TIENT, PAS LE PLUS RENTABLE. On ne cherche pas à
  // maximiser quoi que ce soit : on cherche la limite au-delà de laquelle le
  // trader ne tiendrait pas, et on s'arrête juste en dessous.
  const tenables = risques.filter((r) => !r.ruine && r.reculPct <= seuilReculPct);
  const risqueRecommandePct = tenables.length > 0 ? tenables[tenables.length - 1].risquePct : null;

  if (risqueRecommandePct != null) {
    const choisi = risques.find((r) => r.risquePct === risqueRecommandePct)!;
    /**
     * ⚠️⚠️ « LE PLUS HAUT RISQUE QUI TIENT » N'EST PAS LA MÊME PHRASE QUAND ON
     * A BUTÉ SUR LE HAUT DE LA LISTE.
     *
     * Vu à l'écran : « tu risques 5 % du capital par trade, c'est le plus haut
     * risque qui garde ton recul sous 20 %. Au-dessus, tu ne tiendrais pas la
     * série. » Or 5 % est simplement le dernier de RISQUES : on n'a jamais
     * regardé 6 %, et rien ne dit qu'il casserait. La phrase affirmait une
     * limite trouvée là où il n'y avait qu'un bout de tableau.
     */
    const auPlafond = risqueRecommandePct === RISQUES[RISQUES.length - 1];
    ajouter(
      auPlafond ? "risque_plafond" : "risque",
      { pct: risqueRecommandePct, recul: choisi.reculPct.toFixed(1), seuil: seuilReculPct },
      true,
    );
  } else {
    ajouter("risque_aucun", { seuil: seuilReculPct, mini: RISQUES[0] }, true);
  }

  const serie = plusLongueSerieDePertes(rs);
  ajouter("serie_de_pertes", { n: serie }, true);

  // ⚠️ CE QUE SA PROPRE RÈGLE AURAIT FAIT. Une règle d'arrêt qu'on n'a jamais
  // vue s'appliquer n'est pas une règle, c'est une intention : le nombre de
  // déclenchements est la seule chose qui la rende réelle.
  const arret = plan.gestion.maxPertesConsecutives;
  if (arret != null && arret > 0) {
    ajouter("arret_pertes", { n: arret, fois: occurrencesDeSerie(rs, arret) }, true);
  } else {
    ajouter("arret_pertes_absent", { serie }, true);
  }

  const rythme = rythmeParJour(trades);
  // ⚠️ « 1 trades par jour » dans un plan qu'on imprime pour le suivre : la même
  // faute que « 1 journées » et « 3 année(s) », et elle se voit tout autant.
  ajouter(rythme.d9 <= 1 ? "rythme_un" : "rythme", { d9: rythme.d9, max: rythme.max }, true);

  return { lignes, risques, risqueRecommandePct, seuilReculPct };
}
