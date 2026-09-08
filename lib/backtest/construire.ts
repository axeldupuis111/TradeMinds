import { declencheurStandard, niveauStandard } from "./blocs-standards";
import type { Instrument } from "./instruments";
import type { PlanExecution } from "./types";

/**
 * CONSTRUIRE UNE STRATÉGIE À PARTIR DE GESTES QU'ON RECONNAÎT.
 *
 * ── LA DEMANDE, MOT POUR MOT ────────────────────────────────────────────────
 *
 *   « Limite tu lui proposes plein de choses, de règles qu'il connaît et est à
 *     l'aise à appliquer, et de là tu lui construis une stratégie. »
 *
 * ⚠️⚠️ CE QUI EXISTAIT N'ÉTAIT PAS ÇA, ET JE L'AI PRÉSENTÉ COMME TEL PENDANT
 * DES SEMAINES. « Partir d'une base qui tient debout » offre neuf méthodes
 * complètes montées sur son marché : c'est un MENU. Quelqu'un qui n'a pas de
 * stratégie doit y reconnaître un nom d'école (« OTE », « order block »,
 * « balayage de liquidité ») et faire confiance au reste. Il ne construit rien,
 * il adopte.
 *
 * Ici, il ne choisit pas une méthode : il choisit des GESTES. Ce qu'il regarde,
 * ce qu'il trace, ce qui le fait entrer, où il met son stop, ce qui le fait
 * sortir, ce qui l'arrête. Chacun est écrit dans les mots qu'il emploie déjà,
 * et l'assemblage donne un plan que le moteur rejoue tel quel.
 *
 * ── LES RÈGLES QUE CE FICHIER S'IMPOSE ──────────────────────────────────────
 *
 * ⚠️ ON NE POSE QUE CE QU'IL A CHOISI. Tout le reste garde la valeur du socle,
 * et `manquantes` le dit à l'écran. C'est la même règle que la compilation :
 * une valeur devinée qui ne s'annonce pas devient sa discipline sans qu'il l'ait
 * décidée.
 *
 * ⚠️ ON REFUSE LES COMBINAISONS QUE LE MOTEUR NE PEUT PAS REJOUER. « Mon stop
 * va au-delà de l'extrême du balayage » n'a aucun sens sans balayage : rejouer
 * ça produirait un chiffre exact à propos d'une méthode qui n'existe pas. Un
 * choix impossible se dit AVANT, il ne se corrige pas après.
 *
 * ⚠️ LES DISTANCES SE POSENT À L'ÉCHELLE DE L'INSTRUMENT. Écrire « 3 points »
 * ici donnerait un cinquième de bougie sur un indice et six bougies sur une
 * paire de devises. C'est la faute la plus insidieuse de cet onglet : elle ne
 * plante pas, elle rend zéro trade.
 */

export type CodeQuestion =
  /** Ce qu'il regarde avant même de chercher un signal. */
  | "regarde"
  /** Ce qu'il trace sur son graphique. */
  | "trace"
  /** L'événement qui le fait passer à l'action. */
  | "declenche"
  /** La façon dont l'ordre part. */
  | "entre"
  /** Où le scénario est faux. */
  | "stop"
  /** Ce qui met fin au trade du bon côté. */
  | "sortie"
  /** Ce qui met fin à sa journée. */
  | "arret";

/** Un geste, tel qu'il le reconnaîtrait dans sa propre bouche. */
export interface Geste {
  code: string;
  /**
   * Ce que ce geste pose dans le plan.
   *
   * ⚠️ Il rend un plan COMPLET, jamais un fragment : c'est ce qui permet de les
   * appliquer dans n'importe quel ordre sans qu'un geste en écrase un autre.
   */
  poser: (plan: PlanExecution, instrument: Instrument) => PlanExecution;
  /**
   * Gestes d'autres questions que celui-ci rend impossibles, avec la raison.
   *
   * ⚠️ La raison est une PHRASE POUR LUI, pas un code : « ton stop suit un
   * balayage, mais tu n'en attends aucun » se comprend, « incompatible » non.
   */
  exclut?: { geste: string; cle: string }[];
}

export interface QuestionDeConstruction {
  code: CodeQuestion;
  /**
   * Sans réponse, le plan reste rejouable mais décrit autre chose que lui.
   *
   * ⚠️ TOUT EST FACULTATIF SAUF CE QUI FAIT LE SIGNAL. Sans niveau ni
   * déclencheur, il n'y a pas de stratégie du tout ; sans stop choisi, il y en a
   * une, avec un stop par défaut qu'on lui annonce.
   */
  obligatoire: boolean;
  gestes: Geste[];
}

/** Une distance de prix, en ticks de l'instrument. */
const enTicks = (i: Instrument, prix: number) => Math.max(1, Math.round(prix / i.tailleTick));

/**
 * LES QUESTIONS, DANS L'ORDRE OÙ IL VIT SON TRADE.
 *
 * ⚠️ CET ORDRE EST CELUI DE LA SÉANCE, PAS CELUI DU CODE. Il regarde, il trace,
 * il attend, il entre, il se protège, il sort, il s'arrête. Poser « où est ton
 * stop » avant « qu'est-ce que tu traces » obligerait à répondre dans le vide.
 */
export const QUESTIONS_DE_CONSTRUCTION: QuestionDeConstruction[] = [
  {
    code: "regarde",
    obligatoire: false,
    gestes: [
      {
        code: "tendance_moyenne",
        poser: (p) => ({
          ...p,
          confirmations: [
            ...p.confirmations.filter((c) => c.type !== "biais_moyenne"),
            { type: "biais_moyenne", periode: 200 },
          ],
        }),
      },
      {
        code: "rien",
        poser: (p) => ({
          ...p,
          confirmations: p.confirmations.filter((c) => c.type !== "biais_moyenne"),
        }),
      },
    ],
  },
  {
    code: "trace",
    obligatoire: true,
    gestes: [
      {
        code: "trendline",
        poser: (p, i) => ({ ...p, niveau: niveauStandard("trendline", i) ?? p.niveau }),
      },
      {
        code: "sommets_creux",
        poser: (p, i) => ({ ...p, niveau: niveauStandard("liquidite_swing", i) ?? p.niveau }),
      },
      {
        code: "veille",
        poser: (p, i) => ({ ...p, niveau: niveauStandard("extremes_veille", i) ?? p.niveau }),
      },
      {
        code: "ouverture",
        poser: (p, i) => ({
          ...p,
          // ⚠️ Une plage de référence est obligatoire pour ce niveau : sans
          // elle, `niveauStandard` rend `null` et on garderait l'ancien niveau
          // en croyant l'avoir changé.
          niveau:
            niveauStandard("range_horaire", i, { debut: p.contexte.debut, fin: p.contexte.debut }) ??
            p.niveau,
        }),
      },
      {
        code: "zone_impulsion",
        poser: (p, i) => ({ ...p, niveau: niveauStandard("order_block", i) ?? p.niveau }),
      },
    ],
  },
  {
    code: "declenche",
    obligatoire: true,
    gestes: [
      {
        code: "cassure",
        poser: (p, i) => ({ ...p, declencheur: declencheurStandard("cassure", i) }),
        exclut: [{ geste: "stop_balayage", cle: "bt_cons_conflit_balayage" }],
      },
      {
        code: "retour_apres_cassure",
        poser: (p, i) => ({ ...p, declencheur: declencheurStandard("retest_apres_cassure", i) }),
        exclut: [{ geste: "stop_balayage", cle: "bt_cons_conflit_balayage" }],
      },
      {
        code: "rejet",
        poser: (p, i) => ({ ...p, declencheur: declencheurStandard("balayage_retour", i) }),
        exclut: [{ geste: "stop_balayage", cle: "bt_cons_conflit_balayage" }],
      },
      {
        code: "balayage_puis_retour",
        poser: (p, i) => ({ ...p, declencheur: declencheurStandard("balayage_puis_fvg", i) }),
      },
      {
        code: "retour_dans_zone",
        poser: (p, i) => ({ ...p, declencheur: declencheurStandard("entree_dans_zone", i) }),
        exclut: [{ geste: "stop_balayage", cle: "bt_cons_conflit_balayage" }],
      },
    ],
  },
  {
    code: "entre",
    obligatoire: false,
    gestes: [
      {
        code: "au_marche",
        poser: (p) => ({ ...p, entree: { type: "open_bougie_suivante" } }),
      },
      {
        code: "en_attente",
        poser: (p) => ({ ...p, entree: { type: "limite_au_niveau", valableNBarres: 20 } }),
      },
    ],
  },
  {
    code: "stop",
    obligatoire: false,
    gestes: [
      {
        code: "stop_structure",
        poser: (p, i) => ({
          ...p,
          stop: { type: "dernier_pivot", pivots: 10, bufferTicks: enTicks(i, i.spread) },
        }),
      },
      {
        code: "stop_bougie",
        poser: (p, i) => ({ ...p, stop: { type: "structurel", bufferTicks: enTicks(i, i.spread) } }),
      },
      {
        code: "stop_balayage",
        poser: (p, i) => ({
          ...p,
          stop: { type: "extreme_balayage", bufferTicks: enTicks(i, i.spread) },
        }),
      },
      {
        code: "stop_niveau",
        poser: (p, i) => ({
          ...p,
          stop: { type: "niveau_oppose", bufferTicks: enTicks(i, i.spread) },
        }),
      },
    ],
  },
  {
    code: "sortie",
    obligatoire: false,
    gestes: [
      { code: "objectif_2r", poser: (p) => ({ ...p, objectif: { type: "multiple_r", r: 2 } }) },
      { code: "objectif_3r", poser: (p) => ({ ...p, objectif: { type: "multiple_r", r: 3 } }) },
      { code: "objectif_niveau", poser: (p) => ({ ...p, objectif: { type: "niveau_oppose" } }) },
      {
        code: "fin_de_seance",
        poser: (p) => ({
          ...p,
          objectif: { type: "multiple_r", r: 2 },
          sortiesAuxiliaires: { ...p.sortiesAuxiliaires, finDeSession: p.contexte.fin },
        }),
      },
    ],
  },
  {
    code: "arret",
    obligatoire: false,
    gestes: [
      {
        code: "arret_deux_pertes",
        poser: (p) => ({ ...p, gestion: { ...p.gestion, maxPertesConsecutives: 2 } }),
      },
      {
        code: "arret_trois_pertes",
        poser: (p) => ({ ...p, gestion: { ...p.gestion, maxPertesConsecutives: 3 } }),
      },
      {
        code: "arret_trades",
        poser: (p) => ({ ...p, gestion: { ...p.gestion, maxTradesParJour: 3 } }),
      },
      {
        code: "arret_aucun",
        poser: (p) => ({
          ...p,
          gestion: {
            ...p.gestion,
            maxPertesConsecutives: undefined,
            maxTradesParJour: undefined,
          },
        }),
      },
    ],
  },
];

export interface PlanConstruit {
  plan: PlanExecution;
  /** Questions obligatoires restées sans réponse. */
  manquantes: CodeQuestion[];
  /** Paires de gestes qui ne peuvent pas coexister, avec la phrase qui l'explique. */
  conflits: { gestes: [string, string]; cle: string }[];
  /** Questions facultatives sans réponse : le socle décide, et on le dit. */
  laisseesAuSocle: CodeQuestion[];
}

/**
 * Assemble les gestes choisis en un plan.
 *
 * ⚠️ UN CONFLIT NE BLOQUE PAS L'ASSEMBLAGE, IL S'AFFICHE. Refuser de composer
 * laisserait l'écran vide devant quelqu'un qui vient de faire six choix ; on
 * compose, et on lui montre les deux gestes qui se contredisent pour qu'il en
 * retire un.
 */
export function construireLePlan(
  reponses: Partial<Record<CodeQuestion, string>>,
  socle: PlanExecution,
  instrument: Instrument,
): PlanConstruit {
  let plan = socle;
  const manquantes: CodeQuestion[] = [];
  const laisseesAuSocle: CodeQuestion[] = [];
  const conflits: { gestes: [string, string]; cle: string }[] = [];

  const choisis = new Set(
    QUESTIONS_DE_CONSTRUCTION.map((q) => reponses[q.code]).filter((x): x is string => Boolean(x)),
  );

  for (const question of QUESTIONS_DE_CONSTRUCTION) {
    const code = reponses[question.code];
    const geste = question.gestes.find((g) => g.code === code);
    if (!geste) {
      if (question.obligatoire) manquantes.push(question.code);
      else laisseesAuSocle.push(question.code);
      continue;
    }
    plan = geste.poser(plan, instrument);
    for (const { geste: autre, cle } of geste.exclut ?? []) {
      if (choisis.has(autre)) conflits.push({ gestes: [geste.code, autre], cle });
    }
  }

  return { plan, manquantes, conflits, laisseesAuSocle };
}

/**
 * Tous les gestes d'une question, pour l'écran.
 *
 * ⚠️ On les rend DANS L'ORDRE DU CATALOGUE, jamais triés par ce qui marche le
 * mieux : classer des gestes reviendrait à recommander une stratégie, et cet
 * onglet n'en recommande aucune.
 */
export function gestesDe(code: CodeQuestion): Geste[] {
  return QUESTIONS_DE_CONSTRUCTION.find((q) => q.code === code)?.gestes ?? [];
}
