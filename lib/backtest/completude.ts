import type { Methode } from "./methodes";
import type { PlanExecution } from "./types";

/**
 * LES TREIZE QUESTIONS D'UNE STRATÉGIE COMPLÈTE.
 *
 * ── LA DEMANDE QUI A FAIT NAÎTRE CE FICHIER ─────────────────────────────────
 *
 * « Certains tradent des stratégies pas viables, vouées à perdre de l'argent.
 * D'autres n'ont pas un plan complet, ce qui les empêche de suivre de A à Z leur
 * plan. Je veux que tu aides chaque utilisateur vers une stratégie pro et
 * adaptée à son trading. »
 *
 * ── POURQUOI DES QUESTIONS ET PAS UN CHIFFRE ────────────────────────────────
 *
 * L'onglet savait répondre « est-ce rentable », c'est-à-dire la seule question
 * à laquelle il est honnêtement impossible de répondre. Il ne savait pas
 * répondre à « ta méthode est-elle une méthode », qui se vérifie entièrement.
 *
 * ⚠️⚠️ LA COMPLÉTUDE SE CONSTATE, ELLE NE SE PRÉDIT PAS. Chacune de ces treize
 * lignes est soit écrite, soit floue, soit absente, et le trader peut vérifier
 * lui-même. C'est le seul endroit de cette page où l'outil peut dire quelque
 * chose de certain, et c'est aussi celui qui manque au plus grand nombre.
 *
 * ⚠️⚠️ ÇA MARCHE POUR UNE MÉTHODE QU'ON NE SAIT PAS REJOUER. Un trader
 * d'orderflow ne verra jamais un backtest de sa méthode, et il a pourtant
 * exactement les mêmes treize trous à combler qu'un autre. C'est pour lui que ce
 * fichier existe autant que pour les autres.
 *
 * ── CE QU'ON NE FAIT PAS ────────────────────────────────────────────────────
 *
 * ⚠️ AUCUNE NOTE, AUCUN POURCENTAGE DE COMPLÉTUDE. Un score se compare entre
 * traders, se capture en photo, et transforme « il me manque l'invalidation » en
 * « je suis à 78 % ». On compte les lignes, on ne les moyenne pas.
 *
 * ⚠️ AUCUN APPEL À L'IA. Tout se lit dans le plan compilé, dans les colonnes de
 * la fiche, et dans ce que le trader a répondu lui-même. Le diagnostic doit
 * pouvoir tourner à chaque affichage sans coûter un centime.
 */

export type EtatReponse =
  /** La question a une réponse nette, et on sait où elle est écrite. */
  | "ecrit"
  /** Quelque chose y répond en partie, mais pas de quoi exécuter sans hésiter. */
  | "flou"
  /** Rien n'y répond. */
  | "absent";

/** D'où vient la réponse, pour que le trader sache où aller la corriger. */
export type SourceReponse = "plan" | "fiche" | "toi" | "aucune";

/** Les colonnes chiffrées de la fiche de stratégie, telles qu'elles existent. */
export interface FicheChiffree {
  pairs?: string[] | null;
  sessions?: string[] | null;
  riskReward?: number | null;
  maxSlPips?: number | null;
  maxTradesParJour?: number | null;
  maxPertesConsecutives?: number | null;
  risqueParTradePct?: number | null;
  reglesSetup?: string[] | null;
}

export interface ContexteCompletude {
  /** Le plan mécanique, quand la fiche a pu être traduite. Souvent absent. */
  plan?: PlanExecution;
  fiche?: FicheChiffree;
  /**
   * Ce que le trader a répondu lui-même, par code de question.
   *
   * ⚠️ C'est la moitié qui ne se devine pas. « Quand est-ce que je ne trade
   * pas » n'est écrit nulle part ailleurs que dans sa tête, et c'est justement
   * la ligne qui manque le plus souvent.
   */
  reponses: Record<string, string>;
  /** La méthode de référence déclarée, quand il en a choisi une. */
  methode?: Methode;
}

export interface LigneCompletude {
  /** Clé de traduction : `bt_q_<code>` et `bt_q_<code>_aide`. */
  code: string;
  etat: EtatReponse;
  source: SourceReponse;
  /**
   * Ce que le référentiel de la méthode déclare sur cette question.
   *
   * ⚠️ JAMAIS UNE RÉPONSE INVENTÉE. On ne rend que ce que la méthode DÉCLARE
   * dans le référentiel (ses régimes, sa séance, ses marchés, ses besoins de
   * données). Fabriquer une réponse de référence en prose serait un conseil
   * d'investissement déguisé en aide au remplissage.
   */
  reference?: { cle: string; valeurs: Record<string, string | number> };
}

export interface Completude {
  lignes: LigneCompletude[];
  ecrits: number;
  flous: number;
  absents: number;
}

/** Une plage qui couvre la journée entière ne restreint rien. */
function plageOuverte(debut: string, fin: string): boolean {
  return debut <= "00:01" && fin >= "23:58";
}

function rempli(v: unknown): boolean {
  if (v == null) return false;
  if (Array.isArray(v)) return v.length > 0;
  if (typeof v === "number") return Number.isFinite(v) && v > 0;
  return String(v).trim().length > 0;
}

/** Combien de garde-fous chiffrés sont réellement actifs. */
function gardeFousActifs(c: ContexteCompletude): number {
  const g = c.plan?.gestion;
  const f = c.fiche;
  const valeurs = [
    g?.maxTradesParJour ?? f?.maxTradesParJour,
    g?.maxPertesConsecutives ?? f?.maxPertesConsecutives,
    g?.maxPerteJournaliereR,
  ];
  return valeurs.filter((v) => rempli(v)).length;
}

/**
 * Un stop qui porte une invalidation de thèse, par opposition à une distance.
 *
 * ⚠️ LA DISTINCTION N'EST PAS COSMÉTIQUE. « Mon stop est à 20 points » ne dit
 * pas à quel moment on avait tort : un stop de distance se déplace pour laisser
 * respirer, un stop d'invalidation ne se déplace jamais. Les traders qui font
 * sauter leur compte confondent presque toujours les deux.
 */
const STOPS_STRUCTURELS = ["dernier_pivot", "extreme_balayage", "structurel", "niveau_oppose"];

/**
 * LES QUESTIONS, DANS L'ORDRE OÙ ON EN A BESOIN DEVANT SON ÉCRAN.
 *
 * ⚠️ L'ORDRE EST CELUI DE L'EXÉCUTION, PAS CELUI DE L'IMPORTANCE. On décide le
 * marché avant l'heure, l'heure avant le contexte, le contexte avant le setup,
 * et le risque avant d'avoir cliqué. Un plan rangé dans un autre ordre se lit,
 * mais ne se suit pas.
 */
const QUESTIONS: {
  code: string;
  lire: (c: ContexteCompletude) => { etat: EtatReponse; source: SourceReponse };
  reference?: (m: Methode) => { cle: string; valeurs: Record<string, string | number> } | undefined;
}[] = [
  {
    code: "marche",
    lire: (c) => {
      if (rempli(c.reponses.marche)) return { etat: "ecrit", source: "toi" };
      if (rempli(c.fiche?.pairs)) return { etat: "ecrit", source: "fiche" };
      if (c.plan) return { etat: "flou", source: "plan" };
      return { etat: "absent", source: "aucune" };
    },
    reference: (m) =>
      m.marches.length > 0
        ? { cle: "bt_ref_marches", valeurs: { liste: m.marches.join(", ") } }
        : { cle: "bt_ref_marches_tous", valeurs: {} as Record<string, string | number> },
  },
  {
    code: "regime",
    lire: (c) => {
      if (rempli(c.reponses.regime)) return { etat: "ecrit", source: "toi" };
      // Un filtre directionnel approche « seulement dans le sens de la
      // tendance », mais ne dit rien du range ni de la contraction.
      const filtre = c.plan?.confirmations.some(
        (x) => x.type === "biais_moyenne" || x.type === "macd",
      );
      return filtre ? { etat: "flou", source: "plan" } : { etat: "absent", source: "aucune" };
    },
    reference: (m) => ({ cle: "bt_ref_regimes", valeurs: { liste: m.regimes.join(", ") } }),
  },
  {
    code: "seance",
    lire: (c) => {
      if (c.plan && !plageOuverte(c.plan.contexte.debut, c.plan.contexte.fin)) {
        return { etat: "ecrit", source: "plan" };
      }
      if (rempli(c.reponses.seance)) return { etat: "ecrit", source: "toi" };
      if (rempli(c.fiche?.sessions)) return { etat: "flou", source: "fiche" };
      return { etat: "absent", source: "aucune" };
    },
    reference: (m) =>
      m.seance
        ? { cle: "bt_ref_seance", valeurs: { plage: `${m.seance.debut} → ${m.seance.fin}` } }
        : undefined,
  },
  {
    code: "ne_pas_trader",
    lire: (c) => {
      if (rempli(c.reponses.ne_pas_trader)) return { etat: "ecrit", source: "toi" };
      // ⚠️ Les garde-fous chiffrés disent quand ARRÊTER, jamais quand
      // s'abstenir : ils se déclenchent après les pertes, pas avant l'entrée.
      return gardeFousActifs(c) > 0
        ? { etat: "flou", source: "plan" }
        : { etat: "absent", source: "aucune" };
    },
    reference: (m) =>
      m.tueurs.length > 0 ? { cle: "bt_ref_tueurs", valeurs: { n: m.tueurs.length } } : undefined,
  },
  {
    code: "contexte_directionnel",
    lire: (c) => {
      if (rempli(c.reponses.contexte_directionnel)) return { etat: "ecrit", source: "toi" };
      if (c.plan && c.plan.sens !== "les_deux") return { etat: "ecrit", source: "plan" };
      const filtre = c.plan?.confirmations.some(
        (x) => x.type === "biais_moyenne" || x.type === "macd",
      );
      return filtre ? { etat: "ecrit", source: "plan" } : { etat: "absent", source: "aucune" };
    },
  },
  {
    code: "setup",
    lire: (c) => {
      if (c.plan) return { etat: "ecrit", source: "plan" };
      if (rempli(c.reponses.setup)) return { etat: "ecrit", source: "toi" };
      if (rempli(c.fiche?.reglesSetup)) return { etat: "flou", source: "fiche" };
      return { etat: "absent", source: "aucune" };
    },
  },
  {
    code: "declencheur",
    lire: (c) => {
      if (c.plan) return { etat: "ecrit", source: "plan" };
      if (rempli(c.reponses.declencheur)) return { etat: "ecrit", source: "toi" };
      return { etat: "absent", source: "aucune" };
    },
  },
  {
    code: "invalidation",
    lire: (c) => {
      if (rempli(c.reponses.invalidation)) return { etat: "ecrit", source: "toi" };
      if (c.plan && STOPS_STRUCTURELS.includes(c.plan.stop.type)) {
        return { etat: "flou", source: "plan" };
      }
      return { etat: "absent", source: "aucune" };
    },
  },
  {
    code: "stop",
    lire: (c) => {
      if (c.plan) return { etat: "ecrit", source: "plan" };
      if (rempli(c.fiche?.maxSlPips)) return { etat: "flou", source: "fiche" };
      if (rempli(c.reponses.stop)) return { etat: "ecrit", source: "toi" };
      return { etat: "absent", source: "aucune" };
    },
  },
  {
    code: "sortie",
    lire: (c) => {
      if (c.plan) return { etat: "ecrit", source: "plan" };
      if (rempli(c.fiche?.riskReward)) return { etat: "flou", source: "fiche" };
      if (rempli(c.reponses.sortie)) return { etat: "ecrit", source: "toi" };
      return { etat: "absent", source: "aucune" };
    },
  },
  {
    code: "risque",
    lire: (c) => {
      const r = c.plan?.gestion.risqueParTradePct ?? c.fiche?.risqueParTradePct;
      if (rempli(r)) return { etat: "ecrit", source: c.plan ? "plan" : "fiche" };
      if (rempli(c.reponses.risque)) return { etat: "ecrit", source: "toi" };
      return { etat: "absent", source: "aucune" };
    },
  },
  {
    code: "garde_fous",
    lire: (c) => {
      const n = gardeFousActifs(c);
      if (n >= 2) return { etat: "ecrit", source: c.plan ? "plan" : "fiche" };
      if (n === 1) return { etat: "flou", source: c.plan ? "plan" : "fiche" };
      if (rempli(c.reponses.garde_fous)) return { etat: "ecrit", source: "toi" };
      return { etat: "absent", source: "aucune" };
    },
  },
  {
    code: "trace",
    lire: (c) =>
      rempli(c.reponses.trace)
        ? { etat: "ecrit", source: "toi" }
        : { etat: "absent", source: "aucune" },
  },
];

/** Les codes des questions, dans l'ordre. Sert aux écrans et aux tests. */
export const CODES_QUESTIONS = QUESTIONS.map((q) => q.code);

/** Les questions auxquelles seul le trader peut répondre. */
export const QUESTIONS_DECLARATIVES = [
  "regime",
  "ne_pas_trader",
  "invalidation",
  "trace",
  "marche",
];

export function evaluerCompletude(c: ContexteCompletude): Completude {
  const lignes: LigneCompletude[] = QUESTIONS.map((q) => {
    const { etat, source } = q.lire(c);
    const reference = c.methode && q.reference ? q.reference(c.methode) : undefined;
    return { code: q.code, etat, source, reference };
  });

  return {
    lignes,
    ecrits: lignes.filter((l) => l.etat === "ecrit").length,
    flous: lignes.filter((l) => l.etat === "flou").length,
    absents: lignes.filter((l) => l.etat === "absent").length,
  };
}
