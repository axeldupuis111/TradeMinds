import { lancerBacktest } from "./engine";
import type { Couts, PlanExecution, SerieM1 } from "./types";
import { MIN_TRADES_CONCLUSION } from "./verdict";

/**
 * CHERCHER CE QUI POURRAIT MARCHER, SANS FABRIQUER UNE COÏNCIDENCE.
 *
 * ── LA CRITIQUE QUI A FAIT NAÎTRE CE FICHIER ────────────────────────────────
 *
 * « Je ne vois toujours pas l'utilité de l'onglet backtest. On voit si c'est
 * rentable ou non, mais ça ne donne aucune vraie solution. Ça nous décourage, on
 * a l'impression que n'importe quelle stratégie n'est pas rentable. Il devrait
 * nous aider à trouver une stratégie rentable : quel actif, quel moment de la
 * journée, quelles confluences, les moments à trader ou non. »
 *
 * Il a raison, et c'est un défaut de conception. L'outil savait dire non et ne
 * savait rien proposer : un instrument de mesure, pas un outil de travail.
 *
 * ── POURQUOI J'AVAIS REFUSÉ DE CHERCHER, ET CE QUI CHANGE ───────────────────
 *
 * ⚠️⚠️ Le refus reposait sur un fait mesuré ICI : le meilleur de neuf essais
 * donnait +0,397 R sur 2024-2025 et +0,002 R sur 2022-2023. Chercher et garder
 * le maximum ne trouve pas un avantage, ça trouve une coïncidence bien habillée,
 * et le trader la découvre avec son argent.
 *
 * Mais ce n'est pas la recherche qui est fautive, c'est la recherche NON
 * COMPTÉE. Une exploration honnête existe, et elle tient en quatre règles que
 * ce fichier applique toutes les quatre :
 *
 * 1. **ON NE CHERCHE QUE SUR LA FENÊTRE D'ENTRAÎNEMENT.** La fenêtre de
 *    confirmation n'est jamais ouverte pendant la recherche. Ce module ne reçoit
 *    même pas ses bougies : il ne peut pas tricher.
 * 2. **CHAQUE ESSAI EST COMPTÉ, ET LA BARRE MONTE AVEC.** Le maximum de N
 *    tirages de bruit pur vaut environ `√(2 ln N)` écarts-types : c'est
 *    exactement la barre qu'on exige, au lieu des 1,96 habituels. Vingt-six
 *    essais demandent 2,55 ; deux cents en demandent 3,26.
 * 3. **RIEN N'EST CACHÉ.** Le journal rend TOUS les essais avec leur t, pas
 *    seulement le survivant. Une exploration dont on ne voit que le gagnant est
 *    indiscernable d'une exploration truquée.
 * 4. **UNE SEULE CANDIDATE PART EN CONFIRMATION, UNE SEULE FOIS.** La
 *    confirmation se fait ailleurs (voir le worker), sur la fenêtre intacte, au
 *    seuil ordinaire : un test unique n'a pas à être corrigé.
 *
 * ⚠️ ON SÉLECTIONNE SUR LE t, PAS SUR L'ESPÉRANCE. Une combinaison qui rend
 * +0,4 R sur 60 trades est moins solide qu'une qui rend +0,08 R sur 900, et
 * trier par espérance retiendrait systématiquement la première : la moins
 * mesurée, donc la plus chanceuse.
 *
 * ⚠️ ON EXPLORE PAR COORDONNÉES, PAS EN GRILLE COMPLÈTE, et ce n'est pas qu'une
 * question de temps de calcul. Une grille de mille combinaisons ferait monter la
 * barre à 3,72 écarts-types, que presque rien ne franchit : chercher plus large
 * rend le résultat MOINS crédible, pas plus. Le budget de recherche est une
 * ressource, on la dépense là où le mécanisme est explicable.
 */

/** Une valeur essayable sur une dimension, avec de quoi la nommer à l'écran. */
export interface Valeur {
  /** Clé de traduction du libellé, ou libellé déjà lisible. */
  etiquette: string;
  appliquer: (plan: PlanExecution) => PlanExecution;
}

export interface Dimension {
  /** Sert de clé de traduction : `bt_exp_dim_<cle>`. */
  cle: string;
  valeurs: Valeur[];
}

/** Un essai, gardé ou non : le journal les rend tous. */
export interface Essai {
  dimension: string;
  etiquette: string;
  trades: number;
  esperanceR: number | null;
  /** Écarts-types au-dessus de zéro. `null` sous le seuil de conclusion. */
  t: number | null;
  /** Vrai pour la valeur retenue à l'issue de sa dimension. */
  retenu: boolean;
}

export interface Exploration {
  /** Le plan qui a survécu à la recherche. */
  plan: PlanExecution;
  /** Tous les essais, dans l'ordre où ils ont été faits. */
  journal: Essai[];
  /** Nombre de combinaisons évaluées. */
  essais: number;
  /** Le t qu'il fallait franchir, compte tenu du nombre d'essais. */
  barre: number;
  /** Le t de la candidate retenue, sur la fenêtre d'entraînement. */
  t: number | null;
  trades: number;
  esperanceR: number | null;
  /**
   * La candidate franchit-elle la barre de la recherche ?
   *
   * ⚠️ FAUX EST LE CAS NORMAL, et l'écran doit le dire ainsi. Un « non » qui a
   * essayé vingt-six combinaisons et les montre toutes vaut infiniment plus
   * qu'un « non » qui n'a rien tenté : il dit où on a cherché.
   */
  franchitLaBarre: boolean;
}

interface Mesure {
  trades: number;
  esperanceR: number | null;
  t: number | null;
}

function mesurer(serie: SerieM1, plan: PlanExecution, couts: Couts): Mesure {
  const rs = lancerBacktest(serie, { ...plan, couts }).trades.map((x) => x.r);
  if (rs.length < MIN_TRADES_CONCLUSION) {
    return { trades: rs.length, esperanceR: null, t: null };
  }
  const moyenne = rs.reduce((a, b) => a + b, 0) / rs.length;
  const variance = rs.reduce((a, b) => a + (b - moyenne) * (b - moyenne), 0) / (rs.length - 1);
  const ecartType = Math.sqrt(variance);
  if (!(ecartType > 0)) return { trades: rs.length, esperanceR: moyenne, t: null };
  return {
    trades: rs.length,
    esperanceR: moyenne,
    t: moyenne / (ecartType / Math.sqrt(rs.length)),
  };
}

/**
 * La barre à franchir quand on a essayé `n` combinaisons.
 *
 * ⚠️ CE N'EST PAS UN SEUIL CHOISI, C'EST LE MAXIMUM ATTENDU DU BRUIT. Tirer `n`
 * échantillons d'une loi centrée et garder le plus grand donne environ
 * `√(2 ln n)` écarts-types, sans qu'aucun avantage n'existe. Exiger moins que
 * ça, c'est se laisser convaincre par sa propre recherche.
 *
 * ⚠️ Jamais en dessous de 1,96 : un seul essai reste soumis au seuil ordinaire.
 */
export function barreDeRecherche(n: number): number {
  if (n <= 1) return 1.96;
  return Math.max(1.96, Math.sqrt(2 * Math.log(n)));
}

/**
 * Explore les dimensions l'une après l'autre, en gardant à chaque étape la
 * valeur au meilleur t.
 *
 * ⚠️ L'ORDRE DES DIMENSIONS EST UN CHOIX, ET IL SE JUSTIFIE. On commence par ce
 * dont le mécanisme est le plus clair (l'unité de temps change la taille des
 * stops, donc le poids des coûts) et on finit par ce qui relève du réglage fin.
 * Une descente par coordonnées dépend de son ordre : le taire ferait passer un
 * choix pour une propriété du marché.
 */
export function explorer(
  serie: SerieM1,
  planDepart: PlanExecution,
  couts: Couts,
  dimensions: Dimension[],
  avancement?: (faits: number, total: number) => void,
): Exploration {
  const total = dimensions.reduce((n, d) => n + d.valeurs.length, 0);
  let faits = 0;
  const journal: Essai[] = [];

  let planCourant = planDepart;
  let mesureCourante = mesurer(serie, planCourant, couts);

  for (const dimension of dimensions) {
    let meilleur: { valeur: Valeur; mesure: Mesure; index: number } | null = null;

    /**
     * LA LIGNE DE RÉFÉRENCE : CE QUE LE TRADER FAIT DÉJÀ.
     *
     * ⚠️⚠️ VU À L'ÉCRAN SUR SA VRAIE STRATÉGIE. Le journal affichait « Ce que tu
     * traces · Trendline · 73 · trop peu de trades » alors que sa trendline en
     * produisait 167 deux lignes plus haut. La valeur « trendline » du catalogue
     * n'est PAS la sienne : elle emporte ses propres pivots, ses propres touches
     * et sa propre tolérance. Le trader lisait donc que sa méthode ne produit
     * rien, sur une mesure qui ne portait pas sur sa méthode.
     *
     * La ligne de référence coûte zéro backtest : la mesure courante est déjà
     * là. Elle ne compte donc pas comme un essai, et ne fait pas monter la barre.
     */
    journal.push({
      dimension: dimension.cle,
      etiquette: "bt_exp_ta_valeur",
      trades: mesureCourante.trades,
      esperanceR: mesureCourante.esperanceR,
      t: mesureCourante.t,
      retenu: false,
    });
    const indexDeLaReference = journal.length - 1;
    const debutDeDimension = journal.length;

    for (let i = 0; i < dimension.valeurs.length; i++) {
      const valeur = dimension.valeurs[i];
      const candidat = valeur.appliquer(planCourant);
      const m = mesurer(serie, candidat, couts);
      faits++;
      avancement?.(faits, total);

      journal.push({
        dimension: dimension.cle,
        etiquette: valeur.etiquette,
        trades: m.trades,
        esperanceR: m.esperanceR,
        t: m.t,
        retenu: false,
      });

      // ⚠️ Une candidate sans t n'est pas « moins bonne », elle est
      // INMESURABLE : la comparer à une autre reviendrait à préférer le silence
      // à un chiffre, ou l'inverse, selon l'humeur du code.
      if (m.t != null && (meilleur == null || m.t > meilleur.mesure.t!)) {
        meilleur = { valeur, mesure: m, index: debutDeDimension + i };
      }
    }

    // ⚠️ ON NE CHANGE QUE SI ÇA AMÉLIORE VRAIMENT. Sans cette garde, la descente
    // adopterait la première valeur mesurable venue même quand l'actuelle fait
    // mieux, et le « plan retenu » dépendrait de l'ordre du catalogue.
    if (meilleur && (mesureCourante.t == null || meilleur.mesure.t! > mesureCourante.t)) {
      planCourant = meilleur.valeur.appliquer(planCourant);
      mesureCourante = meilleur.mesure;
      journal[meilleur.index].retenu = true;
    } else {
      // ⚠️ « Rien n'a battu ce que tu fais déjà » est un résultat, et il doit se
      // voir. Sans cette ligne marquée, une dimension entière apparaissait sans
      // aucun « retenu », et le trader ne savait pas ce qui avait été gardé.
      journal[indexDeLaReference].retenu = true;
    }
  }

  const barre = barreDeRecherche(faits);
  return {
    plan: planCourant,
    journal,
    essais: faits,
    barre,
    t: mesureCourante.t,
    trades: mesureCourante.trades,
    esperanceR: mesureCourante.esperanceR,
    franchitLaBarre: mesureCourante.t != null && mesureCourante.t >= barre,
  };
}
