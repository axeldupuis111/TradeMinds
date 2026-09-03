import type { Instrument } from "./instruments";
import type { Objectif } from "./propositions";
import type { BlocConfirmation, PlanExecution } from "./types";

/**
 * CE QUI A CHANGÉ ENTRE LA FICHE ET LE PLAN TESTÉ, DIT EN FRANÇAIS.
 *
 * ── LE TROU QUE CE FICHIER BOUCHE ───────────────────────────────────────────
 *
 * Un trader a cliqué « appliquer » sur une proposition, relancé, vu un meilleur
 * résultat, et nous a écrit ceci : « j'ai accepté qu'il modifie un réglage sans
 * trop savoir exactement ce qu'il a changé ni ce que je dois changer dans ma
 * façon de trader ». C'est un défaut grave et il en cachait deux :
 *
 * 1. Le plan dérivait de la fiche sans que rien ne tienne le compte. Après trois
 *    clics, l'écran ne montrait plus la stratégie du trader, et rien ne le
 *    disait.
 * 2. Un réglage de moteur n'est pas un geste de trading. « pivots : 20 → 10 »
 *    n'apprend rien. « tu vas tracer tes droites sur des sommets plus petits,
 *    que tu ignorais jusqu'ici » se fait devant un graphique.
 *
 * ── LA MÉTHODE : DES DESCRIPTEURS DÉCLARÉS, PAS UNE COMPARAISON GÉNÉRIQUE ────
 *
 * Un `diff` récursif sur `PlanExecution` produirait « niveau.toleranceTicks : 3
 * → 9 », c'est-à-dire le chemin d'une propriété, pas une phrase. Pire, il
 * traverserait des unions (`BlocNiveau`) où changer de `type` change la liste
 * des champs, et sortirait des lignes qui n'ont aucun sens ensemble.
 *
 * On énumère donc ce qui est comparable, avec pour chaque entrée : comment le
 * lire, comment le REMETTRE comme dans la fiche, et comment l'écrire en toutes
 * lettres. Ce qui n'est pas dans cette liste ne peut pas être expliqué, donc ne
 * doit pas pouvoir être proposé : un test lie les deux fichiers dans ce sens.
 */

/** Une valeur comparable. `null` = ce réglage n'existe pas dans ce plan. */
type Valeur = string | number | null;

export interface Descripteur {
  /** Sert de clé de traduction : `bt_modif_<cle>` et `bt_geste_<cle>`. */
  cle: string;
  /** Le bloc de l'éditeur concerné, pour pouvoir y renvoyer le trader. */
  bloc: string;
  /**
   * Vrai pour le descripteur qui porte la NATURE du bloc.
   *
   * ⚠️ Quand la nature change, les réglages du bloc n'ont plus de vis-à-vis :
   * comparer la largeur de pivot d'une trendline à celle d'une moyenne mobile
   * afficherait « 20 → aucun », ce qui est vrai et inutile. Une seule ligne
   * suffit alors, et elle restaure le bloc entier.
   */
  nature?: boolean;
  lire(plan: PlanExecution): Valeur;
  /** Remet ce réglage tel qu'il était dans la fiche, sans toucher au reste. */
  restaurer(actuel: PlanExecution, reference: PlanExecution): PlanExecution;
  /** L'unité, pour l'affichage seulement. */
  unite?: "ticks" | "pct" | "bougies";
  /**
   * Ce réglage laisse-t-il les trades EXACTEMENT identiques ?
   *
   * ⚠️ La distinction décide si un contrôle hors période a un sens. Le moteur
   * ignore volontairement le risque par trade : mêmes entrées, mêmes sorties,
   * même suite de R, seule la taille de position change. Rejouer ça sur une
   * autre période ne vérifierait rien du tout, et l'exiger transformerait un
   * garde-fou en formalité, c'est-à-dire en quelque chose qu'on apprend à
   * contourner.
   */
  sansEffetSurLesTrades?: boolean;
}

/** Les pivots, quels que soient les blocs qui en portent. */
function pivotsDuNiveau(plan: PlanExecution): number | null {
  const n = plan.niveau;
  if (n.type === "trendline" || n.type === "liquidite_swing" || n.type === "ote_fibonacci") {
    return n.pivots;
  }
  return null;
}

function bufferDuStop(plan: PlanExecution): number | null {
  const s = plan.stop;
  if (s.type === "fixe" || s.type === "atr") return null;
  return s.bufferTicks;
}

/** Recopie un champ d'un bloc vers le même bloc de l'autre plan, s'il existe des deux côtés. */
function memeType<T extends { type: string }>(a: T, b: T): boolean {
  return a.type === b.type;
}

/** Un filtre, avec ses réglages, en une chaîne lisible et comparable. */
function resumerConfirmation(c: BlocConfirmation): string {
  const params = Object.entries(c)
    .filter(([k]) => k !== "type")
    .map(([, v]) => String(v));
  return params.length > 0 ? `${c.type} (${params.join("/")})` : c.type;
}

/**
 * Le résumé des filtres, avec des noms lisibles à la place des codes.
 *
 * ⚠️⚠️ VU À L'ÉCRAN, SUR LA MÊME CARTE. La liste des écarts affichait « Filtres
 * avant d'entrer : biais_moyenne (80) → biais_moyenne (50) », trois lignes
 * au-dessus de « Conditions supplémentaires exigées : Sens de la moyenne
 * mobile ». Le même filtre, deux écritures, dont une que personne ne comprend.
 *
 * ⚠️ LA TABLE DE NOMS NE PEUT PAS VIVRE DANS LES DESCRIPTEURS : ce sont des
 * constantes de module, sans accès aux traductions. On renomme donc APRÈS coup,
 * sur la chaîne déjà composée, en ne touchant qu'au préfixe de chaque filtre et
 * jamais à ses paramètres.
 */
export function nommerLesFiltres(resume: string, nommer: (type: string) => string): string {
  return resume
    .split(", ")
    .map((part) => {
      const m = part.match(/^([a-z_0-9]+)(\s*\(.*\))?$/);
      if (!m) return part;
      return `${nommer(m[1])}${m[2] ?? ""}`;
    })
    .join(", ");
}
/** Renomme les filtres, et seulement eux. */
function nommerSiFiltre(
  valeur: string,
  d: Descripteur,
  nommer: (type: string) => string,
): string {
  return d.cle === "confirmations" ? nommerLesFiltres(valeur, nommer) : valeur;
}


export const DESCRIPTEURS: Descripteur[] = [
  {
    cle: "unite_de_temps",
    bloc: "uniteDeTemps",
    lire: (p) => p.uniteDeTemps ?? 1,
    restaurer: (a, r) => ({ ...a, uniteDeTemps: r.uniteDeTemps }),
  },
  {
    cle: "sens",
    bloc: "sens",
    lire: (p) => p.sens,
    restaurer: (a, r) => ({ ...a, sens: r.sens }),
  },
  {
    cle: "seance",
    bloc: "contexte",
    lire: (p) => `${p.contexte.debut}-${p.contexte.fin}`,
    restaurer: (a, r) => ({
      ...a,
      contexte: { ...a.contexte, debut: r.contexte.debut, fin: r.contexte.fin },
    }),
  },
  {
    cle: "jours",
    bloc: "contexte",
    lire: (p) => [...p.contexte.jours].sort((x, y) => x - y).join(","),
    restaurer: (a, r) => ({ ...a, contexte: { ...a.contexte, jours: [...r.contexte.jours] } }),
  },

  // ── Le niveau ────────────────────────────────────────────────────────────
  {
    cle: "niveau_type",
    bloc: "niveau",
    nature: true,
    lire: (p) => p.niveau.type,
    restaurer: (a, r) => ({ ...a, niveau: { ...r.niveau } }),
  },
  {
    cle: "niveau_pivots",
    bloc: "niveau",
    unite: "bougies",
    lire: pivotsDuNiveau,
    restaurer: (a, r) => {
      const cible = pivotsDuNiveau(r);
      if (cible == null || !memeType(a.niveau, r.niveau)) return a;
      return { ...a, niveau: { ...a.niveau, pivots: cible } as typeof a.niveau };
    },
  },
  {
    cle: "niveau_tolerance",
    bloc: "niveau",
    unite: "ticks",
    lire: (p) => (p.niveau.type === "trendline" ? p.niveau.toleranceTicks : null),
    restaurer: (a, r) => {
      if (a.niveau.type !== "trendline" || r.niveau.type !== "trendline") return a;
      return { ...a, niveau: { ...a.niveau, toleranceTicks: r.niveau.toleranceTicks } };
    },
  },
  {
    cle: "niveau_touches",
    bloc: "niveau",
    lire: (p) => (p.niveau.type === "trendline" ? p.niveau.touchesMin : null),
    restaurer: (a, r) => {
      if (a.niveau.type !== "trendline" || r.niveau.type !== "trendline") return a;
      return { ...a, niveau: { ...a.niveau, touchesMin: r.niveau.touchesMin } };
    },
  },
  {
    cle: "niveau_periode",
    bloc: "niveau",
    unite: "bougies",
    lire: (p) =>
      p.niveau.type === "moyenne_mobile" || p.niveau.type === "bollinger" ? p.niveau.periode : null,
    restaurer: (a, r) => {
      if (!memeType(a.niveau, r.niveau)) return a;
      if (a.niveau.type !== "moyenne_mobile" && a.niveau.type !== "bollinger") return a;
      if (r.niveau.type !== "moyenne_mobile" && r.niveau.type !== "bollinger") return a;
      return { ...a, niveau: { ...a.niveau, periode: r.niveau.periode } };
    },
  },

  // ── Le déclencheur et l'entrée ───────────────────────────────────────────
  {
    cle: "declencheur_type",
    bloc: "declencheur",
    nature: true,
    lire: (p) => p.declencheur.type,
    restaurer: (a, r) => ({ ...a, declencheur: { ...r.declencheur } }),
  },
  {
    cle: "declencheur_delai",
    bloc: "declencheur",
    unite: "bougies",
    lire: (p) => {
      const d = p.declencheur;
      if (d.type === "balayage_puis_fvg") return d.delaiRetest;
      if (
        d.type === "retest_apres_cassure" ||
        d.type === "fvg_puis_retest" ||
        d.type === "entree_dans_zone"
      ) {
        return d.delaiMaxBarres;
      }
      return null;
    },
    restaurer: (a, r) => {
      if (!memeType(a.declencheur, r.declencheur)) return a;
      const d = r.declencheur;
      if (d.type === "balayage_puis_fvg" && a.declencheur.type === "balayage_puis_fvg") {
        return { ...a, declencheur: { ...a.declencheur, delaiRetest: d.delaiRetest } };
      }
      if ("delaiMaxBarres" in d && "delaiMaxBarres" in a.declencheur) {
        return { ...a, declencheur: { ...a.declencheur, delaiMaxBarres: d.delaiMaxBarres } };
      }
      return a;
    },
  },
  {
    cle: "declencheur_reaction",
    bloc: "declencheur",
    unite: "bougies",
    lire: (p) => (p.declencheur.type === "balayage_puis_fvg" ? p.declencheur.delaiReaction : null),
    restaurer: (a, r) => {
      if (a.declencheur.type !== "balayage_puis_fvg" || r.declencheur.type !== "balayage_puis_fvg") {
        return a;
      }
      return { ...a, declencheur: { ...a.declencheur, delaiReaction: r.declencheur.delaiReaction } };
    },
  },
  {
    cle: "declencheur_mode",
    bloc: "declencheur",
    lire: (p) => (p.declencheur.type === "cassure" ? p.declencheur.mode : null),
    restaurer: (a, r) => {
      if (a.declencheur.type !== "cassure" || r.declencheur.type !== "cassure") return a;
      return { ...a, declencheur: { ...a.declencheur, mode: r.declencheur.mode } };
    },
  },
  {
    cle: "entree_type",
    bloc: "entree",
    nature: true,
    lire: (p) => p.entree.type,
    restaurer: (a, r) => ({ ...a, entree: { ...r.entree } }),
  },

  // ── Les filtres ──────────────────────────────────────────────────────────
  {
    cle: "confirmations",
    bloc: "confirmations",
    nature: true,
    /**
     * ⚠️ LE RÉSUMÉ PORTE LES RÉGLAGES, PAS SEULEMENT LES NOMS. Comparer la seule
     * liste des types laissait passer en silence un RSI dont la période ou le
     * seuil avaient changé : le filtre s'appelait pareil et se comportait
     * autrement, ce qui est exactement le genre d'écart que cette carte existe
     * pour rendre visible.
     */
    lire: (p) =>
      p.confirmations.length === 0
        ? null
        : p.confirmations.map(resumerConfirmation).sort().join(", "),
    restaurer: (a, r) => ({ ...a, confirmations: r.confirmations.map((c) => ({ ...c })) }),
  },

  // ── Les sorties ──────────────────────────────────────────────────────────
  {
    cle: "stop_type",
    bloc: "stop",
    nature: true,
    lire: (p) => p.stop.type,
    restaurer: (a, r) => ({ ...a, stop: { ...r.stop } }),
  },
  {
    cle: "stop_distance",
    bloc: "stop",
    unite: "ticks",
    lire: (p) => (p.stop.type === "fixe" ? p.stop.ticks : null),
    restaurer: (a, r) => {
      if (a.stop.type !== "fixe" || r.stop.type !== "fixe") return a;
      return { ...a, stop: { ...a.stop, ticks: r.stop.ticks } };
    },
  },
  {
    cle: "stop_buffer",
    bloc: "stop",
    unite: "ticks",
    lire: bufferDuStop,
    restaurer: (a, r) => {
      const cible = bufferDuStop(r);
      if (cible == null || !memeType(a.stop, r.stop)) return a;
      return { ...a, stop: { ...a.stop, bufferTicks: cible } as typeof a.stop };
    },
  },
  {
    cle: "stop_pivots",
    bloc: "stop",
    unite: "bougies",
    lire: (p) => (p.stop.type === "dernier_pivot" ? p.stop.pivots ?? null : null),
    restaurer: (a, r) => {
      if (a.stop.type !== "dernier_pivot" || r.stop.type !== "dernier_pivot") return a;
      return { ...a, stop: { ...a.stop, pivots: r.stop.pivots } };
    },
  },
  {
    cle: "objectif_type",
    bloc: "objectif",
    nature: true,
    lire: (p) => p.objectif.type,
    restaurer: (a, r) => ({ ...a, objectif: { ...r.objectif } }),
  },
  {
    cle: "objectif_r",
    bloc: "objectif",
    lire: (p) => (p.objectif.type === "multiple_r" ? p.objectif.r : null),
    restaurer: (a, r) => {
      if (a.objectif.type !== "multiple_r" || r.objectif.type !== "multiple_r") return a;
      return { ...a, objectif: { ...a.objectif, r: r.objectif.r } };
    },
  },

  // ── Les sorties auxiliaires ──────────────────────────────────────────────
  {
    cle: "break_even",
    bloc: "sortiesAuxiliaires",
    lire: (p) => p.sortiesAuxiliaires.breakEvenApresR ?? null,
    restaurer: (a, r) => ({
      ...a,
      sortiesAuxiliaires: {
        ...a.sortiesAuxiliaires,
        breakEvenApresR: r.sortiesAuxiliaires.breakEvenApresR,
      },
    }),
  },
  {
    cle: "fin_de_session",
    bloc: "sortiesAuxiliaires",
    lire: (p) => p.sortiesAuxiliaires.finDeSession ?? null,
    restaurer: (a, r) => ({
      ...a,
      sortiesAuxiliaires: {
        ...a.sortiesAuxiliaires,
        finDeSession: r.sortiesAuxiliaires.finDeSession,
      },
    }),
  },
  {
    cle: "apres_n_barres",
    bloc: "sortiesAuxiliaires",
    unite: "bougies",
    lire: (p) => p.sortiesAuxiliaires.apresNBarres ?? null,
    restaurer: (a, r) => ({
      ...a,
      sortiesAuxiliaires: {
        ...a.sortiesAuxiliaires,
        apresNBarres: r.sortiesAuxiliaires.apresNBarres,
      },
    }),
  },

  // ── Les garde-fous ───────────────────────────────────────────────────────
  {
    cle: "risque_par_trade",
    bloc: "gestion",
    unite: "pct",
    // ⚠️ Le moteur ne le lit jamais : il raisonne en R. Voir `Gestion` dans
    // types.ts. C'est de l'arithmétique sur la taille de position, rien d'autre.
    sansEffetSurLesTrades: true,
    lire: (p) => p.gestion.risqueParTradePct ?? null,
    restaurer: (a, r) => ({
      ...a,
      gestion: { ...a.gestion, risqueParTradePct: r.gestion.risqueParTradePct },
    }),
  },
  {
    cle: "pertes_daffilee",
    bloc: "gestion",
    lire: (p) => p.gestion.maxPertesConsecutives ?? null,
    restaurer: (a, r) => ({
      ...a,
      gestion: { ...a.gestion, maxPertesConsecutives: r.gestion.maxPertesConsecutives },
    }),
  },
  {
    cle: "trades_par_jour",
    bloc: "gestion",
    lire: (p) => p.gestion.maxTradesParJour ?? null,
    restaurer: (a, r) => ({
      ...a,
      gestion: { ...a.gestion, maxTradesParJour: r.gestion.maxTradesParJour },
    }),
  },
  {
    cle: "perte_journaliere",
    bloc: "gestion",
    lire: (p) => p.gestion.maxPerteJournaliereR ?? null,
    restaurer: (a, r) => ({
      ...a,
      gestion: { ...a.gestion, maxPerteJournaliereR: r.gestion.maxPerteJournaliereR },
    }),
  },
];

/**
 * Le levier d'une proposition, traduit en descripteur.
 *
 * ⚠️ CETTE TABLE EST LA CHARNIÈRE ENTRE LES DEUX FICHIERS, et un test la tient
 * complète : il lit `propositions.ts`, en extrait chaque `levier`, et échoue si
 * l'un d'eux n'est pas ici. Sans ce lien, ajouter un levier resterait possible
 * sans savoir l'expliquer, c'est-à-dire recréer exactement le défaut d'origine.
 */
export const CLES_PAR_LEVIER: Record<string, string[]> = {
  tolerance: ["niveau_tolerance"],
  pivots: ["niveau_pivots"],
  unite_de_temps: ["unite_de_temps"],
  unite_de_temps_haute: ["unite_de_temps"],
  seance: ["seance"],
  risque_par_trade: ["risque_par_trade"],
  pertes_daffilee: ["pertes_daffilee"],
  stop_plus_large: ["stop_distance", "stop_buffer"],
  // Leviers propres aux suggestions de réglage voisin, quand l'échantillon est
  // trop petit pour conclure. Elles appliquent un plan exactement comme une
  // proposition, donc elles doivent savoir se décrire pareillement.
  touches: ["niveau_touches"],
  delai: ["declencheur_delai", "declencheur_reaction"],
};

/**
 * Le bloc de l'éditeur où le réglage se trouve, en clés de traduction.
 *
 * ⚠️ Le trader doit pouvoir aller le corriger. Écrire « le bloc niveau » sans le
 * renvoyer au titre exact qu'il lit plus haut dans la page lui laisse chercher.
 */
export const BLOC_I18N: Record<string, string> = {
  uniteDeTemps: "bt_bloc_contexte",
  sens: "bt_bloc_contexte",
  contexte: "bt_bloc_contexte",
  niveau: "bt_bloc_niveau",
  declencheur: "bt_bloc_declencheur",
  confirmations: "bt_bloc_confirmations",
  sortiesAuxiliaires: "bt_bloc_sorties",
  entree: "bt_bloc_execution",
  stop: "bt_bloc_execution",
  objectif: "bt_bloc_execution",
  gestion: "bt_bloc_gestion",
};

/** D'où vient un changement, tel que la page l'a enregistré au moment du clic. */
export interface Origine {
  levier: string;
  objectif: Objectif;
}

export interface Modification {
  cle: string;
  bloc: string;
  avant: string;
  apres: string;
  /**
   * ⚠️ « manuel » n'est pas un détail de traçabilité. Un réglage que le trader
   * a posé lui-même engage sa méthode ; un réglage venu d'une proposition a été
   * calculé pour un OBJECTIF précis, et c'est cet objectif-là qui doit être
   * rappelé, pas le résultat qu'il a produit.
   */
  origine: "proposition" | "manuel";
  objectif?: Objectif;
}

/**
 * Un prix en POINTS, jamais en ticks.
 *
 * ⚠️ TROIS DÉCIMALES FIXES, comme dans `propositions.ts`, et pas les décimales
 * d'affichage de l'instrument. Le tick du Nasdaq vaut 0,001 point : arrondir à
 * deux décimales afficherait « 0 » pour une tolérance qui vaut trois ticks, et
 * un réglage changé de 3 à 9 se lirait « 0 → 0 ». Un `toFixed(3)` laisse
 * toujours un point décimal, ce qui rend en prime le rognage des zéros sûr :
 * sur un instrument affiché sans décimale, `"100"` serait rogné en `"1"`.
 */
export function pointsDe(ticks: number, tailleTick: number): string {
  return (ticks * tailleTick).toFixed(3).replace(/\.?0+$/, "");
}

function formater(v: Valeur, d: Descripteur, instrument: Instrument, absent: string): string {
  if (v === null) return absent;
  if (typeof v === "string") return v;
  if (d.unite === "ticks") return pointsDe(v, instrument.tailleTick);
  if (d.unite === "pct") return `${v} %`;
  return String(v);
}

/**
 * Tout ce qui sépare le plan testé de celui compilé depuis la fiche.
 *
 * ⚠️ ON COMPARE À LA FICHE, PAS AU DERNIER ÉTAT. Tenir une pile de « ce que
 * chaque clic a fait » donnerait un historique qui ne se referme jamais : trois
 * allers-retours sur le même réglage laisseraient six lignes décrivant un plan
 * identique à celui de départ. Ce qui compte n'est pas le chemin parcouru,
 * c'est l'écart avec la méthode que le trader a écrite.
 */
export function comparerPlans(
  reference: PlanExecution,
  actuel: PlanExecution,
  instrument: Instrument,
  origines: Record<string, Origine> = {},
  /**
   * Comment dire « ce réglage n'existait pas ».
   *
   * ⚠️ PAS UN TIRET CADRATIN. Ces lignes finissent recopiées dans la fiche de
   * stratégie du trader, c'est-à-dire dans un texte signé de lui et relu par le
   * coach. Un « — » y est un marqueur de rédaction automatique, et la règle du
   * projet l'interdit dans tout ce qui s'écrit en son nom.
   */
  absent = "non défini",
  /**
   * Comment nommer un type de filtre.
   *
   * ⚠️ Par défaut on rend le code brut, comme avant : les appelants qui n'ont
   * pas de traductions sous la main (les tests) gardent le comportement d'hier,
   * et seul l'écran, qui en a, affiche des noms.
   */
  nommerFiltre: (type: string) => string = (type) => type,
): Modification[] {
  const naturesChangees = new Set<string>();
  for (const d of DESCRIPTEURS) {
    if (d.nature && d.lire(reference) !== d.lire(actuel)) naturesChangees.add(d.bloc);
  }

  const out: Modification[] = [];
  for (const d of DESCRIPTEURS) {
    // Le bloc a changé de nature : sa ligne le dit déjà, ses réglages n'ont
    // plus de vis-à-vis.
    if (!d.nature && naturesChangees.has(d.bloc)) continue;
    const avant = d.lire(reference);
    const apres = d.lire(actuel);
    if (avant === apres) continue;
    const origine = origines[d.cle];
    out.push({
      cle: d.cle,
      bloc: d.bloc,
      avant: nommerSiFiltre(formater(avant, d, instrument, absent), d, nommerFiltre),
      apres: nommerSiFiltre(formater(apres, d, instrument, absent), d, nommerFiltre),
      origine: origine ? "proposition" : "manuel",
      objectif: origine?.objectif,
    });
  }

  // ⚠️ LE FILET. Cette carte a été écrite parce qu'un trader ne savait pas ce
  // qui avait changé. Une liste de descripteurs qui oublierait un réglage
  // laisserait exactement le même trou, en donnant en plus l'assurance
  // trompeuse d'un inventaire complet. On remet donc tout ce qu'on sait
  // remettre : s'il subsiste un écart, c'est qu'un réglage nous échappe, et on
  // le DÉCLARE au lieu de le taire. C'est la règle du compilateur, appliquée
  // ici : ce qu'on ne sait pas traduire se dit.
  if (essenceDuPlan(restaurerLesDecrits(actuel, reference)) !== essenceDuPlan(reference)) {
    out.push({ cle: "autre", bloc: "", avant: absent, apres: absent, origine: "manuel" });
  }
  return out;
}

/**
 * Ce qui, dans un plan, appartient à la MÉTHODE du trader.
 *
 * ⚠️ Ni l'instrument ni les coûts : ils appartiennent à la page. Les inclure
 * ferait crier au réglage inconnu à chaque changement de marché.
 */
function essenceDuPlan(p: PlanExecution): string {
  const reste: Record<string, unknown> = { ...p };
  delete reste.instrument;
  delete reste.couts;
  return stable(reste);
}

/**
 * Une sérialisation qui ne dépend PAS de l'ordre des clés.
 *
 * ⚠️ `JSON.stringify` suit l'ordre d'insertion. Un plan reconstruit par
 * `{ ...plan, niveau: … }` place ses clés autrement qu'un plan sorti du
 * compilateur, et deux objets identiques rendraient deux chaînes différentes :
 * le filet crierait au réglage inconnu à chaque clic. Les `undefined` sont
 * écartés pour la même raison : un champ optionnel absent et un champ optionnel
 * mis à `undefined` décrivent le même plan.
 */
function stable(v: unknown): string {
  if (v === null || typeof v !== "object") return JSON.stringify(v ?? null);
  if (Array.isArray(v)) return `[${v.map(stable).join(",")}]`;
  const o = v as Record<string, unknown>;
  return `{${Object.keys(o)
    .filter((k) => o[k] !== undefined)
    .sort()
    .map((k) => `${JSON.stringify(k)}:${stable(o[k])}`)
    .join(",")}}`;
}

/**
 * Ces changements-là méritent-ils un contrôle sur une autre période ?
 *
 * ⚠️ NON quand aucun ne touche à un seul trade. Exiger de rejouer quatre ans de
 * bougies pour inscrire « je risque 2,5 % au lieu de 5 % » donnerait la même
 * suite de R au tick près : le contrôle ne vérifierait rien, et une vérification
 * qui ne vérifie rien apprend surtout à cliquer sans lire.
 *
 * ⚠️ La ligne « d'autres réglages diffèrent » compte comme un vrai changement :
 * on ne sait pas ce qu'elle recouvre, donc on ne peut pas la dire inoffensive.
 */
export function demandeUnControle(modifications: Modification[]): boolean {
  return modifications.some(
    (m) => !DESCRIPTEURS.find((d) => d.cle === m.cle)?.sansEffetSurLesTrades,
  );
}

/**
 * Remet un réglage en place.
 *
 * ⚠️ UN DESCRIPTEUR DE NATURE NE RESTAURE SON BLOC QUE SI LA NATURE A CHANGÉ.
 * Sinon il écraserait, au passage, tous les réglages du bloc qui ont leurs
 * propres lignes : annuler « largeur du pivot » remettrait aussi la tolérance et
 * le nombre de touches, sans qu'aucun bouton ne l'ait annoncé. C'est aussi ce
 * qui permet au filet de fonctionner : un bloc de même nature dont un réglage
 * inconnu a bougé n'est pas remis en place, donc l'écart subsiste et se déclare.
 */
function restaurerUn(
  d: Descripteur,
  actuel: PlanExecution,
  reference: PlanExecution,
): PlanExecution {
  if (d.nature && d.lire(actuel) === d.lire(reference)) return actuel;
  return d.restaurer(actuel, reference);
}

/** Remet un seul réglage comme dans la fiche. */
export function annulerModification(
  cle: string,
  actuel: PlanExecution,
  reference: PlanExecution,
): PlanExecution {
  // ⚠️ La ligne « d'autres réglages diffèrent » ne nomme rien de précis : son
  // seul retour possible est le retour complet. Un bouton qui ne ferait rien
  // serait pire que pas de bouton.
  if (cle === "autre") return toutAnnuler(actuel, reference);
  const d = DESCRIPTEURS.find((x) => x.cle === cle);
  return d ? restaurerUn(d, actuel, reference) : actuel;
}

/**
 * Remet TOUS les réglages comme dans la fiche.
 *
 * ⚠️ Pas `{ ...reference }` : l'instrument, les coûts et le fuseau appartiennent
 * à la page et pas à la fiche. Les écraser ferait repartir le trader sur un
 * autre instrument que celui qu'il regarde.
 */
export function toutAnnuler(actuel: PlanExecution, reference: PlanExecution): PlanExecution {
  // ⚠️ ON REPART DE LA FICHE, ON NE DÉFAIT PAS DESCRIPTEUR PAR DESCRIPTEUR. La
  // version précédente rejouait chaque restauration connue, et laissait donc
  // en place précisément ce que la liste ne sait pas nommer : le bouton « tout
  // remettre comme dans ma fiche » rendait un plan qui n'était pas celui de la
  // fiche, tout en l'affirmant. Un test l'a attrapé.
  return { ...reference, instrument: actuel.instrument, couts: actuel.couts };
}

/**
 * Tout ce que la liste SAIT remettre, et rien d'autre.
 *
 * ⚠️ Sert uniquement au filet : si un écart subsiste après ça, c'est qu'un
 * réglage échappe aux descripteurs. Ne jamais l'utiliser comme un « annuler »,
 * il laisse justement en place ce qu'on ne sait pas nommer.
 */
function restaurerLesDecrits(actuel: PlanExecution, reference: PlanExecution): PlanExecution {
  let plan = actuel;
  // Les natures d'abord : remettre une trendline avant d'y reposer sa largeur
  // de pivot, sinon la largeur se pose sur un bloc qui n'en veut pas.
  for (const d of DESCRIPTEURS) {
    if (d.nature) plan = restaurerUn(d, plan, reference);
  }
  for (const d of DESCRIPTEURS) {
    if (!d.nature) plan = restaurerUn(d, plan, reference);
  }
  return plan;
}

/**
 * Une empreinte du plan, pour savoir si un contrôle porte encore sur lui.
 *
 * ⚠️ NÉE D'UN RISQUE PRÉCIS. Le contrôle hors période est le seul argument
 * sérieux qu'on puisse opposer au sur-apprentissage. S'il restait affiché après
 * qu'un réglage a bougé, il certifierait un plan qui n'existe plus, et il
 * vaudrait alors moins que rien : le trader enregistrerait sa stratégie en
 * croyant l'avoir vérifiée.
 */
export function empreintePlan(plan: PlanExecution): string {
  return JSON.stringify(
    DESCRIPTEURS.map((d) => [d.cle, d.lire(plan)]),
  );
}
