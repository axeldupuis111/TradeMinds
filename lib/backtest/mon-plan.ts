import type { Completude, LigneCompletude } from "./completude";
import type { LigneDuPlan, PlanComplet } from "./plan-complet";
import type { Synthese } from "./synthese";

/**
 * LE PLAN QUE LE TRADER EMPORTE.
 *
 * ── POURQUOI CE FICHIER EXISTE ──────────────────────────────────────────────
 *
 * ⚠️⚠️ C'EST L'OBJECTIF DE L'ONGLET, ÉNONCÉ PAR AXEL, ET IL N'ÉTAIT PAS LIVRÉ :
 *
 *   « L'objectif principal est qu'à la fin, l'utilisateur sorte avec un plan
 *     clair et complet de sa stratégie afin de pouvoir être discipliné. »
 *
 * Le plan écrit EXISTAIT déjà, et il était bon. Mais il ne s'affichait que dans
 * la carte « Chercher », donc uniquement pour la combinaison sortie d'une
 * recherche. Le trader qui traduit sa fiche, lance son test et obtient un
 * résultat correct ne voyait JAMAIS son plan : il repartait avec des mesures et
 * sans le document. C'est le parcours le plus fréquent, et c'est celui qui ne
 * produisait rien à emporter.
 *
 * ── CE QUE « COMPLET » VEUT DIRE ICI ────────────────────────────────────────
 *
 * ⚠️ NI LE MOTEUR NI LE TRADER SEULS NE SUFFISENT, et c'est tout le sujet. Un
 * backtest sait dire à quelle heure entrer, où poser le stop, combien de pertes
 * d'affilée attendre. Il ne saura jamais dire quand le trader ne doit RIEN
 * prendre, ni ce qu'il note après coup. Ces lignes-là ne se déduisent pas, elles
 * s'écrivent, et ce sont exactement celles qui manquent aux plans incomplets.
 *
 * Ce module assemble donc les deux sources, en gardant à chaque ligne d'où elle
 * vient :
 *
 *   RÉGLÉE   — recopiée de ses blocs. Il l'a choisie.
 *   MESURÉE  — déduite de ce que ces blocs lui ont réellement fait.
 *   ÉCRITE   — sa propre réponse à une des treize questions.
 *   MANQUANTE— une question sans réponse, nommée plutôt que passée sous silence.
 *
 * ⚠️ UNE LIGNE MANQUANTE RESTE DANS LE PLAN. La retirer donnerait un document
 * qui a l'air complet et ne l'est pas, ce qui est pire que pas de document : le
 * trader croirait avoir répondu.
 */

export type Provenance = "reglee" | "mesuree" | "ecrite" | "manquante";

export interface LigneDeMonPlan {
  /** `bt_plan_<cle>` pour les lignes du moteur, `bt_q_<code>` pour les questions. */
  cle: string;
  provenance: Provenance;
  /** Les valeurs de la phrase, pour les lignes qui viennent du moteur. */
  valeurs?: Record<string, string | number>;
  /** Sa réponse, mot pour mot, pour les lignes écrites. */
  texte?: string;
}

export interface MonPlan {
  /** Les règles à suivre, dans l'ordre où on en a besoin devant l'écran. */
  lignes: LigneDeMonPlan[];
  reglees: number;
  mesurees: number;
  ecrites: number;
  manquantes: number;
  /**
   * Ce que la mesure a établi, et ce qu'elle n'a pas établi.
   *
   * ⚠️ LE PLAN S'IMPRIME MÊME QUAND RIEN N'EST DÉMONTRÉ, et c'est volontaire :
   * un plan est un engagement de DISCIPLINE, pas un certificat de rentabilité.
   * Un trader qui suit des règles claires sur une méthode non démontrée est
   * dans une bien meilleure position que celui qui improvise sur une méthode
   * qui l'était.
   */
  etablis: number;
  ouverts: number;
}

/**
 * Les questions dont la réponse ne peut venir QUE du trader.
 *
 * ⚠️ LES AUTRES SONT DÉJÀ DANS LE PLAN DU MOTEUR : « à quelles heures »,
 * « le stop », « la sortie », « le risque par trade » sont des blocs réglés, et
 * les redemander en fin de document ferait dire deux fois la même chose avec
 * deux formulations, ce que cette page passe son temps à corriger.
 */
export const QUESTIONS_HORS_MOTEUR = [
  "regime",
  "ne_pas_trader",
  "contexte_directionnel",
  "invalidation",
  "trace",
] as const;

/**
 * L'ordre du document.
 *
 * ⚠️ CELUI DE LA SÉANCE, PAS CELUI DU CODE. Le trader lit ce plan devant son
 * écran : il veut d'abord savoir sur quoi et quand il travaille, ensuite ce
 * qu'il attend, ensuite ce qu'il fait quand ça arrive, et enfin ce qui l'arrête.
 */
const ORDRE_MOTEUR = [
  "actif",
  "unite_de_temps",
  "jours",
  "heures",
  "sens",
  "niveau",
  "declencheur",
  "confirmations",
  "stop",
  "objectif",
  "risque",
  "risque_plafond",
  "risque_aucun",
  "serie_de_pertes",
  "arret_pertes",
  "arret_pertes_absent",
  "rythme",
  "rythme_un",
  "rythme_plafond",
  "rythme_un_plafond",
];

/** Où glisser chaque question écrite dans le fil du document. */
const PLACE_DES_QUESTIONS: Record<string, string> = {
  // Le marché dans lequel la méthode vit : juste après l'actif et l'unité.
  regime: "unite_de_temps",
  // Le contexte qu'il lit avant de chercher : juste avant le niveau qu'il trace.
  contexte_directionnel: "sens",
  // Ce qui rend la thèse fausse : collé au stop, qui en est la traduction.
  invalidation: "declencheur",
  // Quand il ne prend rien : juste après les filtres, c'est le dernier filtre.
  ne_pas_trader: "confirmations",
  // Ce qu'il note : à la fin, c'est ce qui reste après la séance.
  trace: "",
};

export function composerMonPlan(
  plan: PlanComplet,
  completude: Completude,
  /**
   * Ses réponses, mot pour mot.
   *
   * ⚠️ SÉPARÉES DE LA COMPLÉTUDE, qui ne porte que l'ÉTAT de chaque question.
   * Le document, lui, doit citer le texte : « je ne prends rien dans l'heure qui
   * précède une annonce » n'a de valeur que dans ses mots.
   */
  reponses: Record<string, string>,
  synthese: Synthese | null,
): MonPlan {
  const parCle = new Map<string, LigneDuPlan>();
  for (const l of plan.lignes) parCle.set(l.cle, l);

  const question = new Map<string, LigneCompletude>();
  for (const l of completude.lignes) question.set(l.code, l);

  const lignes: LigneDeMonPlan[] = [];

  const poserLaQuestion = (code: string) => {
    const q = question.get(code);
    if (!q) return;
    lignes.push({
      cle: `bt_q_${code}`,
      // ⚠️ « flou » compte comme manquant DANS UN PLAN. Une règle qu'on ne peut
      // pas appliquer sans l'interpréter n'est pas une règle : c'est le moment
      // où la discipline se négocie.
      provenance: q.etat === "ecrit" ? "ecrite" : "manquante",
      texte: reponses[code]?.trim() || undefined,
    });
  };

  for (const cle of ORDRE_MOTEUR) {
    const l = parCle.get(cle);
    if (l) {
      lignes.push({
        cle: `bt_plan_${l.cle}`,
        provenance: l.deduite ? "mesuree" : "reglee",
        valeurs: l.valeurs,
      });
    }
    // Les questions accrochées à cette ligne viennent juste après elle.
    for (const [code, ancre] of Object.entries(PLACE_DES_QUESTIONS)) {
      if (ancre === cle) poserLaQuestion(code);
    }
  }

  /**
   * ⚠️ CE QUE LE MOTEUR A PRODUIT ET QUE L'ORDRE NE CONNAÎT PAS. Ajouter une
   * ligne à `plan-complet.ts` sans la déclarer ici la ferait disparaître du
   * document sans que personne s'en aperçoive : elle passe donc à la fin plutôt
   * que d'être perdue.
   */
  for (const l of plan.lignes) {
    if (!ORDRE_MOTEUR.includes(l.cle)) {
      lignes.push({
        cle: `bt_plan_${l.cle}`,
        provenance: l.deduite ? "mesuree" : "reglee",
        valeurs: l.valeurs,
      });
    }
  }

  // Et ce qu'il note, qui clôt le document.
  poserLaQuestion("trace");

  const compte = (p: Provenance) => lignes.filter((l) => l.provenance === p).length;
  const piliers = synthese?.piliers ?? [];

  return {
    lignes,
    reglees: compte("reglee"),
    mesurees: compte("mesuree"),
    ecrites: compte("ecrite"),
    manquantes: compte("manquante"),
    etablis: piliers.filter((p) => p.etat === "etabli").length,
    ouverts: piliers.filter((p) => p.etat !== "etabli").length,
  };
}
