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
 * absente de sa fiche n'est pas violée, elle n'existe pas. La seule exception
 * est la limite de perte de son COMPTE, qui n'est pas une opinion de notre part
 * mais une contrainte que son broker ou sa prop firm lui impose.
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

/** Ce que le compte impose, indépendamment de ce que le trader a écrit. */
export interface LimitesCompte {
  /** Capital de référence, pour convertir les pourcentages. */
  capital?: number | null;
  /** Perte journalière maximale tolérée, en % du capital. */
  max_daily_dd_pct?: number | null;
}

export type GraviteAlerte =
  /** La séance met le COMPTE en danger. Rien ne passe avant. */
  | "compte"
  /** Une règle qu'il a lui-même écrite est franchie. */
  | "regle";

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
 * L'ordre des alertes est celui de leur gravité : ce qui menace le compte passe
 * avant ce qui contredit une règle personnelle.
 */
export function alertesDeSeance(
  tradesDuJour: TradeDuJour[],
  regles: ReglesSurveillees,
  compte: LimitesCompte = {},
): Alerte[] {
  const alertes: Alerte[] = [];
  if (tradesDuJour.length === 0) return alertes;

  const cumul = tradesDuJour.reduce((s, t) => s + t.netPnl, 0);
  const capital = positif(compte.capital);
  const ddJour = positif(compte.max_daily_dd_pct);

  // ── 1. La perte du jour contre ce que le compte tolère ───────────────────
  // La seule alerte qui ne vienne pas d'une règle qu'il a écrite, et c'est
  // assumé : ce n'est pas notre opinion, c'est la limite que son broker ou sa
  // prop firm lui impose. La franchir ne le met pas en tort avec lui-même, elle
  // le disqualifie.
  if (capital && ddJour && cumul < 0) {
    const plafond = (ddJour / 100) * capital;
    const perte = -cumul;
    if (perte >= plafond) {
      alertes.push({
        code: "alerte_dd_jour",
        gravite: "compte",
        valeurs: { perte: arrondi(perte), limite: arrondi(plafond), pct: arrondi(ddJour, 1) },
        question: "alerte_dd_jour_question",
      });
    }
  }

  // ── 2. La série de pertes consécutives, en cours ─────────────────────────
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

  // ── 3. Le nombre de trades du jour ───────────────────────────────────────
  const cadence = positif(regles.max_trades_per_day);
  if (cadence && tradesDuJour.length >= cadence) {
    alertes.push({
      code: "alerte_cadence",
      gravite: "regle",
      valeurs: { trades: tradesDuJour.length, limite: cadence },
      question: "alerte_cadence_question",
    });
  }

  // ── 4. Une perte plus lourde que ce que sa fiche autorise ────────────────
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

/**
 * L'alerte à montrer quand on n'en montre qu'une.
 *
 * ⚠️ UNE SEULE À LA FOIS, ET C'EST UNE DÉCISION DE PRODUIT. Un trader en séance
 * qui reçoit trois avertissements d'un coup n'en lit aucun, et il apprend
 * surtout à fermer le bandeau sans regarder. Ce qui menace le compte passe
 * devant tout le reste ; à gravité égale, l'ordre de détection fait foi.
 */
export function alerteLaPlusUrgente(alertes: Alerte[]): Alerte | null {
  if (alertes.length === 0) return null;
  return alertes.find((a) => a.gravite === "compte") ?? alertes[0];
}
