import { coutAllerRetourTicks } from "./couts";
import { agreger } from "./serie";
import type { Couts, SerieM1 } from "./types";

/**
 * CE QUE VAUT UN MARCHÉ, INDÉPENDAMMENT DE TOUTE STRATÉGIE.
 *
 * ── LA DEMANDE QUI A FAIT NAÎTRE CE FICHIER ─────────────────────────────────
 *
 * « Certaines stratégies sont adaptées à des actifs précis. » Axel l'a répété
 * plusieurs fois, et l'outil n'en faisait rien : il rejouait une méthode sur le
 * marché choisi, et si ça ne marchait pas, il disait non.
 *
 * ── POURQUOI CE N'EST PAS DU SUR-APPRENTISSAGE ──────────────────────────────
 *
 * ⚠️⚠️ ON NE MESURE ICI AUCUNE PERFORMANCE, ET C'EST TOUT LE POINT. Essayer huit
 * marchés et garder celui où la stratégie sort le mieux, c'est du sur-
 * apprentissage déplacé, et la carte « ta méthode sur d'autres marchés » existe
 * précisément pour refuser ça.
 *
 * Ce fichier fait autre chose : il mesure des PROPRIÉTÉS DU MARCHÉ, sur les
 * bougies seules, sans qu'aucune stratégie n'entre dans le calcul. « L'or a
 * parcouru sa distance en ligne droite 31 % du temps » est un fait sur l'or,
 * vrai que le trader existe ou non. Le confronter à ce qu'une méthode DÉCLARE
 * exiger n'est donc pas une sélection sur le résultat : c'est vérifier qu'on
 * apporte un marteau à un clou.
 *
 * ⚠️ CHAQUE MESURE EST UNE FORMULE CONNUE, PAS UNE INVENTION MAISON. Le rapport
 * d'efficience est celui de Kaufman, publié et employé depuis quarante ans. Le
 * coût relatif est une division. La concentration horaire est une somme.
 *
 * ⚠️ LES SEUILS SONT DES CONVENTIONS, ET ILS SONT DÉCLARÉS À L'ÉCRAN. Aucun
 * n'est dérivé d'un résultat de backtest, sinon on retomberait exactement dans
 * ce que ce fichier prétend éviter.
 */

export interface CaractereMarche {
  /**
   * Le rapport d'efficience de Kaufman, entre 0 et 1.
   *
   * Distance nette parcourue divisée par la distance réellement marchée. À 1, le
   * prix est allé tout droit ; à 0, il est revenu d'où il venait après avoir
   * beaucoup bougé.
   *
   * ⚠️ C'EST LA SEULE MESURE QUI SÉPARE « TENDANCE » DE « RANGE » SANS AVIS. Une
   * moyenne mobile qui monte ne dit pas qu'il y a tendance : elle dit qu'il y en
   * a eu une. Ce rapport-là décrit le CHEMIN, pas le point d'arrivée.
   */
  efficience: number;
  /** Amplitude typique d'une bougie, en points. */
  amplitudePoints: number;
  /**
   * Ce qu'un aller-retour coûte, rapporté à l'amplitude d'une bougie.
   *
   * ⚠️ EN AMPLITUDES, PAS EN POINTS. « 1,5 point de spread » ne veut rien dire
   * tant qu'on ne sait pas si la bougie en fait trois ou trois cents.
   */
  coutEnBougies: number;
  /**
   * Part de l'amplitude de la journée réalisée dans ses quatre heures les plus
   * actives, entre 0 et 1.
   *
   * ⚠️ C'est ce qui distingue un marché à séance (les indices, qui ouvrent) d'un
   * marché continu (le forex, la crypto). Une méthode d'ouverture de séance n'a
   * aucun sens sur un marché qui n'ouvre jamais.
   */
  concentrationSeance: number;
  /** Les quatre heures en question, dans le fuseau demandé. */
  heurePointe: number;
}

/**
 * SEUILS, ET CE SONT DES CONVENTIONS ASSUMÉES.
 *
 * ⚠️ AUCUN N'EST DÉRIVÉ D'UN RÉSULTAT DE BACKTEST. Les calibrer sur ce qui fait
 * bien sortir une stratégie reviendrait à sélectionner sur la performance par un
 * détour, c'est-à-dire à faire exactement ce que ce fichier prétend éviter. Ils
 * sont affichés à l'écran à côté du chiffre qu'ils classent.
 */

/** Au-dessus, le marché est allé quelque part plutôt que de tourner en rond. */
export const EFFICIENCE_DIRECTIONNELLE = 0.3;
/** En dessous, le prix revient sur ses pas plus qu'il n'avance. */
export const EFFICIENCE_SANS_DIRECTION = 0.2;
/** Au-dessus, la journée se joue dans une poignée d'heures. */
export const CONCENTRATION_SEANCE = 0.45;
/** Nombre d'heures qui définissent « la pointe » d'une journée. */
const HEURES_DE_POINTE = 4;

/**
 * Le rapport d'efficience, moyenné sur des fenêtres glissantes.
 *
 * ⚠️ SUR DES FENÊTRES, PAS SUR TOUTE LA PÉRIODE. Mesuré d'un bout à l'autre de
 * quatre ans, le rapport tend vers zéro pour tout le monde : le prix revient
 * toujours à peu près d'où il vient à cette échelle. Ce qui intéresse un trader
 * intraday, c'est l'efficience à l'horizon de SES trades.
 */
function efficienceMoyenne(closes: Int32Array, fenetre: number): number {
  if (closes.length <= fenetre) return 0;
  let somme = 0;
  let n = 0;
  // Un pas d'une demi-fenêtre : assez pour lisser, sans repayer le parcours.
  const pas = Math.max(1, Math.floor(fenetre / 2));
  for (let debut = 0; debut + fenetre < closes.length; debut += pas) {
    const net = Math.abs(closes[debut + fenetre] - closes[debut]);
    let marche = 0;
    for (let i = debut; i < debut + fenetre; i++) {
      marche += Math.abs(closes[i + 1] - closes[i]);
    }
    if (marche > 0) {
      somme += net / marche;
      n++;
    }
  }
  return n === 0 ? 0 : somme / n;
}

/**
 * Mesure le caractère d'un marché sur la période chargée.
 *
 * @param uniteDeTemps l'unité du plan : l'efficience n'a de sens qu'à l'horizon
 * où le trader regarde. Le même marché est directionnel en H4 et brownien en M1.
 */
export function mesurerLeMarche(
  serie: SerieM1,
  uniteDeTemps: number,
  couts: Couts,
): CaractereMarche {
  const vue = agreger(serie, Math.max(1, uniteDeTemps));
  const n = vue.c.length;

  // ── Amplitude typique : la médiane, jamais la moyenne ───────────────────
  // ⚠️ Une seule journée d'annonce suffirait à doubler une moyenne, et
  // l'amplitude sert de dénominateur à presque tout ce qui suit.
  const amplitudes = new Float64Array(n);
  for (let i = 0; i < n; i++) amplitudes[i] = vue.h[i] - vue.l[i];
  const triees = Array.from(amplitudes).sort((a, b) => a - b);
  const medianeTicks = n === 0 ? 0 : triees[Math.floor(n / 2)];
  const amplitudePoints = medianeTicks * serie.tailleTick;

  const coutTicks = coutAllerRetourTicks(couts);

  // ── L'efficience, à l'horizon d'une vingtaine de bougies ────────────────
  const efficience = efficienceMoyenne(vue.c, 20);

  // ── La journée se joue-t-elle dans quelques heures ? ────────────────────
  // ⚠️ EN UTC, ET C'EST ASSUMÉ. On cherche si le marché a une pointe, pas à
  // quelle heure elle tombe chez le trader : un décalage de fuseau déplace la
  // pointe, il ne la crée pas et ne l'efface pas.
  const parHeure = new Float64Array(24);
  for (let i = 0; i < serie.t.length; i++) {
    const heure = Math.floor(serie.t[i] / 3_600_000) % 24;
    parHeure[heure] += serie.h[i] - serie.l[i];
  }
  const total = parHeure.reduce((a, b) => a + b, 0);
  let meilleure = 0;
  let sommeMeilleure = 0;
  for (let debut = 0; debut < 24; debut++) {
    let somme = 0;
    for (let k = 0; k < HEURES_DE_POINTE; k++) somme += parHeure[(debut + k) % 24];
    if (somme > sommeMeilleure) {
      sommeMeilleure = somme;
      meilleure = debut;
    }
  }

  return {
    efficience,
    amplitudePoints,
    coutEnBougies: medianeTicks > 0 ? coutTicks / medianeTicks : 0,
    concentrationSeance: total > 0 ? sommeMeilleure / total : 0,
    heurePointe: meilleure,
  };
}

/**
 * Ce qu'une méthode réclame du marché sur lequel on la pose.
 *
 * ⚠️ DÉCLARÉ DANS LE RÉFÉRENTIEL, PAS DÉDUIT D'UN RÉSULTAT. « Une méthode de
 * continuation a besoin d'un marché qui va quelque part » est une propriété de
 * la méthode, connue avant tout backtest.
 */
export type BesoinMarche =
  /** Il faut que le prix aille quelque part. */
  | "tendance"
  /** Il faut au contraire qu'il revienne sur ses pas. */
  | "range"
  /** Il faut une vraie ouverture, donc un marché qui ferme. */
  | "seance_marquee";

export type CodeAccordMarche =
  /** Le marché a le caractère que la méthode réclame. */
  | "va_bien"
  /** Il a exactement le caractère inverse. */
  | "contre_nature"
  /** Il n'a ni l'un ni l'autre franchement : la méthode n'y est pas chez elle. */
  | "sans_caractere"
  /** La méthode veut une séance, ce marché n'en a pas. */
  | "sans_seance";

export interface AccordMarche {
  code: CodeAccordMarche;
  besoin: BesoinMarche;
  valeurs: Record<string, string | number>;
}

/**
 * Confronte ce qu'une méthode réclame à ce que le marché a fait.
 *
 * ⚠️⚠️ AUCUNE PERFORMANCE N'ENTRE ICI. On compare une exigence déclarée à une
 * propriété mesurée sur les bougies. C'est ce qui sépare « cette méthode n'est
 * pas faite pour ce marché » d'un « ce marché sort mieux », le second étant du
 * sur-apprentissage déguisé en conseil.
 */
export function confronterAuMarche(
  besoins: BesoinMarche[],
  c: CaractereMarche,
): AccordMarche[] {
  const out: AccordMarche[] = [];
  const eff = c.efficience.toFixed(2);

  for (const besoin of besoins) {
    if (besoin === "tendance") {
      out.push({
        besoin,
        code:
          c.efficience >= EFFICIENCE_DIRECTIONNELLE
            ? "va_bien"
            : c.efficience <= EFFICIENCE_SANS_DIRECTION
              ? "contre_nature"
              : "sans_caractere",
        valeurs: { eff, haut: EFFICIENCE_DIRECTIONNELLE, bas: EFFICIENCE_SANS_DIRECTION },
      });
    } else if (besoin === "range") {
      out.push({
        besoin,
        code:
          c.efficience <= EFFICIENCE_SANS_DIRECTION
            ? "va_bien"
            : c.efficience >= EFFICIENCE_DIRECTIONNELLE
              ? "contre_nature"
              : "sans_caractere",
        valeurs: { eff, haut: EFFICIENCE_DIRECTIONNELLE, bas: EFFICIENCE_SANS_DIRECTION },
      });
    } else {
      out.push({
        besoin,
        code: c.concentrationSeance >= CONCENTRATION_SEANCE ? "va_bien" : "sans_seance",
        valeurs: {
          part: (c.concentrationSeance * 100).toFixed(0),
          seuil: (CONCENTRATION_SEANCE * 100).toFixed(0),
          heure: `${String(c.heurePointe).padStart(2, "0")}:00`,
          heures: HEURES_DE_POINTE,
        },
      });
    }
  }

  return out;
}
