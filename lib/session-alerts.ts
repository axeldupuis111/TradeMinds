/**
 * LE COACH PARLE LE PREMIER, ET ÇA NE COÛTE RIEN.
 *
 * ── LE PROBLÈME QU'ON ATTAQUE ───────────────────────────────────────────────
 *
 * Mesure de production : 4 messages coach en 30 jours pour 12 abonnés payants.
 * La meilleure fonctionnalité du produit n'est quasiment pas utilisée, et la
 * raison est simple : elle ATTEND qu'on la sollicite. Un trader en pleine
 * séance, qui vient de prendre sa quatrième perte d'affilée, n'ouvre pas un chat
 * pour demander conseil. C'est précisément à ce moment-là qu'il en aurait besoin,
 * et précisément à ce moment-là qu'il ne le fera pas.
 *
 * ── ⚠️ ET POURQUOI CE FICHIER NE CONTIENT AUCUN APPEL À UN MODÈLE ───────────
 *
 * La tentation évidente serait de faire rédiger l'alerte par l'IA. Ce serait une
 * erreur sur les deux plans.
 *
 * Économiquement : une route qui se déclenche toute seule, plusieurs fois par
 * séance, sur chaque abonné, est une dépense qu'aucun plafond mensuel ne borne
 * proprement. On l'a payé assez cher sur le coach pour ne pas recommencer.
 *
 * Et sur le fond : on connaît DÉJÀ le fait exact. « Tu viens de prendre ta
 * quatrième perte d'affilée, ta fiche s'arrête à trois » est plus fort qu'une
 * paraphrase générée. Faire reformuler un fait connu par un modèle ne peut que
 * l'affaiblir, et y ajoute un risque d'invention.
 *
 * Le modèle n'entre en jeu QUE si le trader clique pour en parler. L'alerte est
 * gratuite, la conversation est facturée à celui qui la demande.
 *
 * ── ⚠️ ON N'ALERTE QUE SUR CE QU'IL A ÉCRIT ────────────────────────────────
 *
 * Même règle que la mesure de respect : aucune norme extérieure. Une règle
 * absente de sa fiche n'est pas violée, elle n'existe pas.
 *
 * ── ⚠️ CE MODULE NE TOUCHE PAS À LA PERTE JOURNALIÈRE DU COMPTE ────────────
 *
 * Il l'a fait pendant quelques heures, et c'était un DOUBLON que j'avais raté.
 * `StopTradingGuard` surveille déjà cette limite depuis le layout, donc sur
 * toutes les pages, et avec une échelle bien plus fine que la mienne : 50 %,
 * 75 %, 95 % puis 100 % de la limite, chacun avec son niveau de gravité. La
 * réécrire n'aurait rien apporté et aurait risqué une régression sur une
 * fonctionnalité en production.
 *
 * Ce module détecte donc les TROIS RÈGLES DE SA FICHE, et `StopTradingGuard`
 * l'appelle. Ce que la fusion apporte : sa détection, jusque-là écrite à la
 * main dans le composant et non testée, passe derrière les tests de ce fichier,
 * et gagne la surveillance du risque par trade qui lui manquait.
 */

/** Un trade de la journée en cours, dans l'ordre chronologique. */
export interface TradeDuJour {
  netPnl: number;
}

/** Les règles chiffrées de sa fiche. Null = règle non posée, donc non surveillée. */
export interface ReglesSurveillees {
  max_trades_per_day?: number | null;
  max_consecutive_losses?: number | null;
  risk_per_trade_pct?: number | null;
}

/**
 * Ce qu'il faut du compte pour convertir un pourcentage en argent.
 *
 * ⚠️ Rien d'autre : la limite de perte journalière appartient à
 * `StopTradingGuard`, qui la traite avec une échelle plus fine.
 */
export interface LimitesCompte {
  capital?: number | null;
}

/** Une règle que le trader a lui-même écrite est franchie. */
export type GraviteAlerte = "regle";

export interface Alerte {
  /** Clé de traduction. La rédaction vit dans lib/i18n, jamais ici. */
  code: string;
  gravite: GraviteAlerte;
  /** Nombres à interpoler, déjà arrondis. */
  valeurs: Record<string, number>;
  /**
   * Clé de la question pré-remplie si le trader veut en parler au coach.
   *
   * ⚠️ Une CLÉ, pas une phrase : c'est l'interface qui la traduit, sinon un
   * trader allemand ouvrirait le chat avec une question en français.
   */
  question: string;
}

const arrondi = (v: number, d = 0) => {
  const f = 10 ** d;
  return Math.round(v * f) / f;
};

function positif(v: unknown): number {
  return typeof v === "number" && Number.isFinite(v) && v > 0 ? v : 0;
}

/**
 * Ce qui, à cet instant, mérite qu'on interrompe le trader.
 *
 * ⚠️ ON ALERTE SUR CE QUI EST ARRIVÉ, JAMAIS SUR CE QUI POURRAIT ARRIVER. Pas
 * de « attention, tu approches de ta limite » : une prédiction est discutable,
 * un franchissement ne l'est pas. C'est ce qui rend l'alerte impossible à
 * balayer d'un revers de main, et donc utile.
 *
 * L'ordre est celui de la détection : la série qui court d'abord, parce que
 * c'est la décision que le trader est en train de prendre.
 */
export function alertesDeSeance(
  tradesDuJour: TradeDuJour[],
  regles: ReglesSurveillees,
  compte: LimitesCompte = {},
): Alerte[] {
  const alertes: Alerte[] = [];
  if (tradesDuJour.length === 0) return alertes;

  const capital = positif(compte.capital);

  // ── 1. La série de pertes consécutives, en cours ─────────────────────────
  // ⚠️ On compte la série QUI COURT MAINTENANT, pas la plus longue de la
  // journée. Une série de quatre pertes interrompue par un gain il y a deux
  // heures est de l'histoire ; celle qui court est une décision qu'il est en
  // train de prendre.
  const serieMax = positif(regles.max_consecutive_losses);
  if (serieMax) {
    let enCours = 0;
    for (let i = tradesDuJour.length - 1; i >= 0; i--) {
      if (tradesDuJour[i].netPnl < 0) enCours++;
      else break;
    }
    if (enCours >= serieMax) {
      alertes.push({
        code: "alerte_serie",
        gravite: "regle",
        valeurs: { serie: enCours, limite: serieMax },
        question: "alerte_serie_question",
      });
    }
  }

  // ── 2. Le nombre de trades du jour ───────────────────────────────────────
  const cadence = positif(regles.max_trades_per_day);
  if (cadence && tradesDuJour.length >= cadence) {
    alertes.push({
      code: "alerte_cadence",
      gravite: "regle",
      valeurs: { trades: tradesDuJour.length, limite: cadence },
      question: "alerte_cadence_question",
    });
  }

  // ── 3. Une perte plus lourde que ce que sa fiche autorise ────────────────
  // Signifie l'une de deux choses : la position était trop grosse, ou le stop
  // n'a pas été tenu. Les deux valent d'être dites au moment où c'est frais.
  const risquePct = positif(regles.risk_per_trade_pct);
  if (risquePct && capital) {
    const plafond = (risquePct / 100) * capital;
    let depassements = 0;
    let pire = 0;
    for (const t of tradesDuJour) {
      const perte = -Math.min(0, t.netPnl);
      if (perte > plafond) {
        depassements++;
        pire = Math.max(pire, perte);
      }
    }
    if (depassements > 0) {
      alertes.push({
        code: "alerte_risque",
        gravite: "regle",
        valeurs: {
          depassements,
          limite: arrondi(plafond),
          pire: arrondi(pire),
          pct: arrondi(risquePct, 1),
        },
        question: "alerte_risque_question",
      });
    }
  }

  return alertes;
}
