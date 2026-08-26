import type { Couts, ResultatBacktest, TradeSimule } from "./types";

/**
 * CE QU'ON A LE DROIT DE DIRE D'UN BACKTEST.
 *
 * Le moteur produit des trades. Ce fichier décide de ce qu'on en conclut, et
 * c'est lui le vrai produit : n'importe qui sait afficher un profit factor, la
 * difficulté est de refuser de conclure quand il n'y a rien à conclure.
 *
 * ── QUATRE RÈGLES DURES ─────────────────────────────────────────────────────
 *
 * 1. SOUS `MIN_TRADES_CONCLUSION`, ON NE REND AUCUN CHIFFRE DE PERFORMANCE.
 *    Pas « on calcule puis on masque » : le champ n'existe pas. Un chiffre
 *    calculé finit toujours par être lu par le premier composant distrait.
 *
 * 2. L'ESPÉRANCE NE VOYAGE JAMAIS SANS SON INTERVALLE À 95 %. +0,02R par trade
 *    avec un intervalle de -0,12 à +0,16 n'est pas un avantage, c'est une
 *    absence de conclusion, et c'est le cas le PLUS FRÉQUENT.
 *
 * 3. « POSITIF » EXIGE QUE LA BORNE BASSE SOIT AU-DESSUS DE ZÉRO. Tant que
 *    l'intervalle contient zéro, le verdict est « on ne peut pas conclure »,
 *    quel que soit le signe de la moyenne. Ça rend le vert rare. C'est voulu.
 *
 * 4. LE MOT « RENTABLE » N'APPARAÎT NULLE PART, ni ici ni dans la copie. On dit
 *    ce qu'on a mesuré, sur quelle période, avec quels coûts. La rentabilité
 *    d'un trader dépend de son exécution et de sa discipline autant que de sa
 *    méthode : la promettre depuis un backtest serait un mensonge, et un
 *    mensonge qui coûte de l'argent à celui qui y croit.
 *
 * ⚠️ Ce fichier ne connaît PAS le nombre de fois où le trader a rejoué le test
 * avec d'autres réglages. C'est l'appelant qui le lui passe (`tentatives`),
 * parce que chercher parmi vingt jeux de paramètres celui qui sort le mieux
 * trouve TOUJOURS quelque chose, même dans du bruit pur. C'est le piège numéro
 * un du backtesting et presque aucun outil ne l'affiche.
 */

/** En dessous, on ne conclut pas. Même seuil que la projection, volontairement. */
export const MIN_TRADES_CONCLUSION = 100;

/**
 * Au-delà de ce nombre de rejeux, le meilleur résultat obtenu doit être
 * présenté comme probablement sur-appris plutôt que comme une découverte.
 */
export const MAX_TENTATIVES_AVANT_ALERTE = 20;

/** Part du journal réservée au contrôle hors échantillon. */
const PART_HORS_ECHANTILLON = 0.3;

export type CodeVerdict = "insuffisant" | "negatif" | "non_concluant" | "positif";

export interface Statistiques {
  nbTrades: number;
  /** Part de trades à R positif. */
  tauxReussite: number;
  /** Moyenne des R nets. */
  esperanceR: number;
  /** Bornes à 95 % de cette moyenne. Elles ne se séparent jamais d'elle. */
  borneBasse: number;
  borneHaute: number;
  /** Somme des R nets. */
  totalR: number;
  /** Somme des gains divisée par la somme des pertes. Infini si aucune perte. */
  profitFactor: number;
  /** Pire recul de la courbe cumulée, en R. Toujours positif ou nul. */
  drawdownMaxR: number;
}

export interface AuditCouts {
  /** Espérance qu'on aurait sans aucun coût. */
  esperanceBruteR: number;
  esperanceNetteR: number;
  /** Coût moyen effectivement payé, en R par trade. */
  coutParTradeR: number;
  /** Risque moyen d'un trade, en ticks. Sert à traduire les R en ticks. */
  risqueMoyenTicks: number;
  /**
   * Coût aller-retour SUPPLÉMENTAIRE, en ticks, qui suffirait à annuler
   * l'avantage restant. Petit devant le spread réel, l'avantage n'existe pas.
   */
  coutBreakEvenTicks: number;
  /** Coût aller-retour déjà appliqué, en ticks. */
  coutApplique: number;
  /** Vrai si la méthode gagne en brut et perd une fois les coûts payés. */
  edgeDetruitParLesCouts: boolean;
}

export interface ControleHorsEchantillon {
  /** Trop peu de trades pour couper en deux : on ne contrôle rien. */
  applicable: boolean;
  esperanceDebutR: number;
  esperanceFinR: number;
  /**
   * Vrai quand la première partie gagne et la dernière perd. L'avantage
   * mesuré ne survit pas à la période qui n'a pas servi à le trouver.
   */
  neSurvitPas: boolean;
}

export interface LectureBacktest {
  verdict: CodeVerdict;
  /** Renseigné seulement si `verdict` vaut "insuffisant". */
  tradesManquants?: number;
  /** Absent tant que le verdict est "insuffisant". Voir règle 1. */
  stats?: Statistiques;
  couts?: AuditCouts;
  horsEchantillon?: ControleHorsEchantillon;
  /** Part des trades tranchés par la convention de collision. */
  partCollisions: number;
  /** Vrai au-delà de `MAX_TENTATIVES_AVANT_ALERTE` rejeux. */
  risqueDeSurApprentissage: boolean;
}

/** Moyenne et écart-type d'échantillon. */
function moyenneEtEcartType(xs: number[]): [number, number] {
  const n = xs.length;
  if (n === 0) return [0, 0];
  const m = xs.reduce((a, b) => a + b, 0) / n;
  if (n < 2) return [m, 0];
  const v = xs.reduce((a, b) => a + (b - m) * (b - m), 0) / (n - 1);
  return [m, Math.sqrt(v)];
}

function statistiques(trades: TradeSimule[]): Statistiques {
  const rs = trades.map((t) => t.r);
  const [esperanceR, ecartType] = moyenneEtEcartType(rs);
  // Intervalle normal à 95 %. L'échantillon d'un backtest est assez grand pour
  // que l'approximation tienne ; sous 100 trades on ne conclut de toute façon
  // pas, et la vraie dispersion est mesurée par la projection en aval.
  const marge = 1.96 * (ecartType / Math.sqrt(rs.length));

  const gains = rs.filter((r) => r > 0).reduce((a, b) => a + b, 0);
  const pertes = -rs.filter((r) => r < 0).reduce((a, b) => a + b, 0);

  let cumul = 0;
  let sommet = 0;
  let drawdownMaxR = 0;
  for (const r of rs) {
    cumul += r;
    if (cumul > sommet) sommet = cumul;
    const recul = sommet - cumul;
    if (recul > drawdownMaxR) drawdownMaxR = recul;
  }

  return {
    nbTrades: rs.length,
    tauxReussite: rs.filter((r) => r > 0).length / rs.length,
    esperanceR,
    borneBasse: esperanceR - marge,
    borneHaute: esperanceR + marge,
    totalR: cumul,
    profitFactor: pertes === 0 ? Infinity : gains / pertes,
    drawdownMaxR,
  };
}

function auditCouts(trades: TradeSimule[], couts: Couts): AuditCouts {
  const esperanceBruteR = trades.reduce((a, t) => a + t.rBrut, 0) / trades.length;
  const esperanceNetteR = trades.reduce((a, t) => a + t.r, 0) / trades.length;
  const risqueMoyenTicks = trades.reduce((a, t) => a + t.risqueTicks, 0) / trades.length;

  return {
    esperanceBruteR,
    esperanceNetteR,
    coutParTradeR: esperanceBruteR - esperanceNetteR,
    risqueMoyenTicks,
    coutBreakEvenTicks: esperanceNetteR * risqueMoyenTicks,
    coutApplique: couts.spreadTicks + 2 * couts.glissementTicks + couts.commissionTicks,
    edgeDetruitParLesCouts: esperanceBruteR > 0 && esperanceNetteR <= 0,
  };
}

function controleHorsEchantillon(trades: TradeSimule[]): ControleHorsEchantillon {
  const coupe = Math.floor(trades.length * (1 - PART_HORS_ECHANTILLON));
  const debut = trades.slice(0, coupe);
  const fin = trades.slice(coupe);
  // Sous 30 trades de chaque côté, la comparaison dirait n'importe quoi et on
  // l'annoncerait quand même. On préfère dire qu'on n'a pas contrôlé.
  if (debut.length < 30 || fin.length < 30) {
    return { applicable: false, esperanceDebutR: 0, esperanceFinR: 0, neSurvitPas: false };
  }
  const eDebut = debut.reduce((a, t) => a + t.r, 0) / debut.length;
  const eFin = fin.reduce((a, t) => a + t.r, 0) / fin.length;
  return {
    applicable: true,
    esperanceDebutR: eDebut,
    esperanceFinR: eFin,
    neSurvitPas: eDebut > 0 && eFin <= 0,
  };
}

export function lireBacktest(
  resultat: ResultatBacktest,
  couts: Couts,
  tentatives = 1,
): LectureBacktest {
  const trades = resultat.trades;
  const partCollisions = trades.length === 0 ? 0 : resultat.audit.collisions / trades.length;
  const risqueDeSurApprentissage = tentatives > MAX_TENTATIVES_AVANT_ALERTE;

  // Règle 1 : on sort AVANT de calculer quoi que ce soit. Rien à masquer plus
  // tard, rien à laisser traîner dans l'objet.
  if (trades.length < MIN_TRADES_CONCLUSION) {
    return {
      verdict: "insuffisant",
      tradesManquants: MIN_TRADES_CONCLUSION - trades.length,
      partCollisions,
      risqueDeSurApprentissage,
    };
  }

  const stats = statistiques(trades);

  // Règle 3 : le vert exige que zéro soit hors de l'intervalle.
  let verdict: CodeVerdict;
  if (stats.borneHaute < 0) verdict = "negatif";
  else if (stats.borneBasse > 0) verdict = "positif";
  else verdict = "non_concluant";

  return {
    verdict,
    stats,
    couts: auditCouts(trades, couts),
    horsEchantillon: controleHorsEchantillon(trades),
    partCollisions,
    risqueDeSurApprentissage,
  };
}
