/**
 * VÉRIFICATEUR DE COHÉRENCE D'UNE STRATÉGIE.
 *
 * ── LA LIGNE QU'ON NE FRANCHIT PAS ──────────────────────────────────────────
 *
 * L'idée d'origine était un catalogue de règles notées : « celle-ci marche
 * mieux sur indices en séance de New York ». On ne le fait pas, et pour la même
 * raison qu'on a refusé le backtest. Une note de rentabilité vient forcément de
 * l'une de ces trois sources, et les trois sont mauvaises : d'un backtest qu'on
 * ne peut pas faire honnêtement, d'un chiffre qu'on inventerait, ou des
 * journaux des autres traders, ce qui n'est plus un journal mais un signal.
 *
 * ⚠️ CE FICHIER NE DIT JAMAIS QU'UNE RÈGLE EST BONNE, RENTABLE, OU MEILLEURE
 * QU'UNE AUTRE. Il ne fait que des MULTIPLICATIONS sur ce que le trader a
 * lui-même écrit, et il les confronte aux limites de son propre compte. Chaque
 * constat ci-dessous est vérifiable à la main sur un coin de table ; aucun ne
 * suppose de savoir ce que fera le marché.
 *
 * ── POURQUOI ÇA VAUT PLUS QU'UNE NOTE ───────────────────────────────────────
 *
 * Parce que la plupart des fiches ne sont pas « peu rentables », elles sont
 * INAPPLICABLES, et personne ne l'a jamais dit à leur auteur. Exemple réel,
 * tiré du banc d'essai du coach :
 *
 *     RR 2, SL max 100 pips, risque 5 % par trade, 5 trades/jour max,
 *     arrêt après 3 pertes consécutives, session de 120 minutes.
 *
 * Trois pertes à 5 % font -14 % en une séance : sa propre règle d'arrêt
 * autorise donc de perdre un septième du compte dans la journée. Et s'il est
 * sur un challenge dont la perte journalière maximale est de 5 %, il est
 * disqualifié à la troisième perte du premier jour. Sa fiche et son compte se
 * contredisent, sans qu'aucun des deux ne soit « faux ».
 *
 * ── CE QUE LA SORTIE CONTIENT, ET CE QU'ELLE NE CONTIENT PAS ────────────────
 *
 * Des CODES et des NOMBRES, jamais de phrases. La rédaction vit dans les
 * fichiers de traduction, ce qui garde ce module pur, testable, et traduit dans
 * les quatre langues sans duplication.
 */

/** Les champs structurés d'une fiche stratégie. Tous facultatifs : c'est le sujet. */
export interface RegleStrategie {
  pairs?: string[] | null;
  sessions?: string[] | null;
  risk_reward?: number | null;
  max_sl_pips?: number | null;
  max_trades_per_day?: number | null;
  max_consecutive_losses?: number | null;
  max_session_minutes?: number | null;
  risk_per_trade_pct?: number | null;
}

/** Ce qu'on sait du compte sur lequel la stratégie sera jouée. */
export interface ContrainteCompte {
  /** Perte journalière maximale tolérée, en % du capital. Null si compte perso. */
  max_daily_dd_pct?: number | null;
  /** Perte totale maximale tolérée, en % du capital. Null si compte perso. */
  max_total_dd_pct?: number | null;
}

export type Gravite =
  /** Contradiction arithmétique : la fiche ne peut pas être appliquée telle quelle. */
  | "bloquant"
  /** Applicable, mais une conséquence chiffrée que le trader n'a probablement pas vue. */
  | "serieux"
  /** Une règle manque, et son absence rend la fiche inapplicable ou invérifiable. */
  | "incomplet";

export interface Constat {
  /** Clé de traduction. La copie vit dans lib/i18n, jamais ici. */
  code: string;
  gravite: Gravite;
  /** Nombres à interpoler dans la copie, déjà arrondis pour l'affichage. */
  valeurs: Record<string, number>;
}

export interface Coherence {
  constats: Constat[];
  /** Champs renseignés sur les six qui rendent une fiche applicable. */
  completude: number;
  /** Total des champs attendus. */
  completudeTotal: number;
  /** Y a-t-il au moins une contradiction arithmétique ? */
  bloquant: boolean;
}

/**
 * Les six règles sans lesquelles une fiche n'est pas applicable.
 *
 * C'est la même liste que celle que le prompt du coach impose quand il
 * construit une méthode avec un débutant, et ce n'est pas un hasard : la
 * quatrième, l'invalidation, est celle qu'on oublie, et sans elle le trader n'a
 * aucun moyen de savoir qu'il s'est trompé.
 */
const CHAMPS_ATTENDUS = 6;

/** Au-delà, on considère que le trader ne peut pas exécuter proprement. */
const MINUTES_MIN_PAR_TRADE = 15;

/**
 * Seuil de risque par trade au-delà duquel on alerte, faute de compte connu.
 *
 * Ce n'est PAS un avis sur la rentabilité : c'est le point où la série de
 * pertes qui ruine un compte devient courte au point d'être atteignable en une
 * semaine. On l'exprime d'ailleurs comme ça au trader (« N pertes d'affilée
 * pour perdre la moitié »), pas comme une note.
 */
const RISQUE_PAR_TRADE_ALERTE = 2;

const arrondi = (v: number, d = 0) => {
  const f = 10 ** d;
  return Math.round(v * f) / f;
};

/** Perte cumulée après n pertes consécutives de p %, en % du capital initial. */
export function pertesCumulees(pourcentParTrade: number, nombreDePertes: number): number {
  if (pourcentParTrade <= 0 || nombreDePertes <= 0) return 0;
  const restant = (1 - pourcentParTrade / 100) ** nombreDePertes;
  return (1 - restant) * 100;
}

/** Nombre de pertes consécutives pour perdre la moitié du capital. */
export function pertesPourMoitie(pourcentParTrade: number): number | null {
  if (pourcentParTrade <= 0 || pourcentParTrade >= 100) return null;
  return Math.ceil(Math.log(0.5) / Math.log(1 - pourcentParTrade / 100));
}

/**
 * Confronte une fiche à elle-même, puis aux limites du compte.
 *
 * L'ordre des constats est celui de leur gravité : ce qui empêche d'appliquer
 * la stratégie passe avant ce qui manque pour la décrire.
 */
export function verifierCoherence(
  regle: RegleStrategie,
  compte: ContrainteCompte = {},
): Coherence {
  const constats: Constat[] = [];

  const risque = num(regle.risk_per_trade_pct);
  const pertesDAffilee = num(regle.max_consecutive_losses);
  const tradesParJour = num(regle.max_trades_per_day);
  const minutes = num(regle.max_session_minutes);
  const ddJour = num(compte.max_daily_dd_pct);
  const ddTotal = num(compte.max_total_dd_pct);

  // ── 1. La règle d'arrêt du trader contre la limite de son compte ──────────
  // Le constat le plus violent qu'on puisse rendre, et le plus factuel : sa
  // fiche autorise une perte que son compte ne survit pas. Aucun des deux
  // n'est faux séparément, c'est leur rencontre qui l'est.
  if (risque && pertesDAffilee) {
    const perteSerie = pertesCumulees(risque, pertesDAffilee);
    if (ddJour && perteSerie > ddJour) {
      constats.push({
        code: "coh_serie_depasse_dd_jour",
        gravite: "bloquant",
        valeurs: {
          pertes: pertesDAffilee,
          risque,
          perte: arrondi(perteSerie, 1),
          limite: arrondi(ddJour, 1),
        },
      });
    }
    if (ddTotal && perteSerie > ddTotal) {
      constats.push({
        code: "coh_serie_depasse_dd_total",
        gravite: "bloquant",
        valeurs: { pertes: pertesDAffilee, perte: arrondi(perteSerie, 1), limite: arrondi(ddTotal, 1) },
      });
    }
    // Sans compte à contraintes, on rend quand même le chiffre : c'est
    // généralement la première fois que le trader le voit écrit.
    if (!ddJour && !ddTotal && perteSerie >= 10) {
      constats.push({
        code: "coh_serie_lourde",
        gravite: "serieux",
        valeurs: { pertes: pertesDAffilee, risque, perte: arrondi(perteSerie, 1) },
      });
    }
  }

  // ── 2. L'exposition d'une journée entière ────────────────────────────────
  if (risque && tradesParJour) {
    const exposition = pertesCumulees(risque, tradesParJour);
    if (ddJour && exposition > ddJour) {
      constats.push({
        code: "coh_exposition_depasse_dd_jour",
        gravite: "bloquant",
        valeurs: {
          trades: tradesParJour,
          risque,
          exposition: arrondi(exposition, 1),
          limite: arrondi(ddJour, 1),
        },
      });
    }
  }

  // ── 3. Le risque par trade, exprimé en série de pertes ───────────────────
  // ⚠️ On ne dit pas « 5 % c'est trop », ce serait un avis. On dit combien de
  // pertes d'affilée il faut pour perdre la moitié du compte, ce qui est un
  // calcul, et on laisse le trader conclure.
  if (risque >= RISQUE_PAR_TRADE_ALERTE) {
    const moitie = pertesPourMoitie(risque);
    if (moitie !== null) {
      // ⚠️ JAMAIS « bloquant », ET C'EST UNE CORRECTION. J'avais rendu ce constat
      // bloquant au-delà de 4 % : c'était un JUGEMENT déguisé en gravité. Rien
      // ne se contredit ici, aucune limite n'est franchie ; on énonce combien de
      // pertes d'affilée il faudrait, et c'est au trader de dire si cette série
      // lui paraît hors de portée. Le mot « Contradiction » est réservé aux cas
      // où la fiche et le compte s'excluent réellement, sinon il ne veut plus
      // rien dire quand il compte vraiment.
      constats.push({
        code: "coh_risque_par_trade",
        gravite: "serieux",
        valeurs: { risque, pertes: moitie },
      });
    }
  }

  // ── 4. Une règle d'arrêt qui ne se déclenche jamais ──────────────────────
  // Si on s'arrête après 5 pertes mais qu'on ne prend que 3 trades par jour, la
  // règle est décorative : elle rassure sans jamais mordre.
  if (pertesDAffilee && tradesParJour && pertesDAffilee >= tradesParJour) {
    constats.push({
      code: "coh_arret_inatteignable",
      gravite: "serieux",
      valeurs: { pertes: pertesDAffilee, trades: tradesParJour },
    });
  }

  // ── 5. Le temps disponible contre le nombre de trades ────────────────────
  if (minutes && tradesParJour) {
    const parTrade = minutes / tradesParJour;
    if (parTrade < MINUTES_MIN_PAR_TRADE) {
      constats.push({
        code: "coh_cadence_intenable",
        gravite: "serieux",
        valeurs: { minutes, trades: tradesParJour, parTrade: arrondi(parTrade) },
      });
    }
  }

  // ── 6. Ce qui manque pour que la fiche soit applicable ───────────────────
  // ⚠️ L'INVALIDATION D'ABORD. C'est la règle qu'on oublie, et la seule dont
  // l'absence rend toutes les autres invérifiables : sans point d'invalidation,
  // le trader n'a aucun moyen de savoir qu'il s'est trompé, donc pas de perte
  // définie, donc pas de risque calculable, donc pas de taille de position.
  const manques: [string, boolean][] = [
    ["coh_manque_invalidation", !num(regle.max_sl_pips)],
    ["coh_manque_risque", !risque],
    ["coh_manque_instrument", !(regle.pairs && regle.pairs.length > 0)],
    ["coh_manque_session", !(regle.sessions && regle.sessions.length > 0)],
    ["coh_manque_objectif", !num(regle.risk_reward)],
    ["coh_manque_cadence", !tradesParJour],
  ];
  for (const [code, absent] of manques) {
    if (absent) constats.push({ code, gravite: "incomplet", valeurs: {} });
  }

  const completude = CHAMPS_ATTENDUS - manques.filter(([, absent]) => absent).length;

  return {
    constats,
    completude,
    completudeTotal: CHAMPS_ATTENDUS,
    bloquant: constats.some((c) => c.gravite === "bloquant"),
  };
}

/** Un nombre exploitable, ou 0. Évite de traiter null, NaN et 0 différemment. */
function num(v: unknown): number {
  return typeof v === "number" && Number.isFinite(v) && v > 0 ? v : 0;
}
