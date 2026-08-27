import type {
  BlocConfirmation,
  BlocDeclencheur,
  BlocEntree,
  BlocNiveau,
  BlocObjectif,
  BlocStop,
  Contexte,
  Gestion,
  JourSemaine,
  PlanExecution,
  SortiesAuxiliaires,
} from "./types";

/**
 * DE LA FICHE ÉCRITE EN FRANÇAIS AU PLAN EXÉCUTABLE.
 *
 * ── LE SEUL POINT QUI COMPTE DANS CE FICHIER ────────────────────────────────
 *
 * Un modèle de langage propose une traduction de la fiche en blocs. Ce fichier
 * la VALIDE, bloc par bloc, paramètre par paramètre, contre le catalogue fermé.
 * Tout ce qui n'est pas reconnu est rejeté, pas corrigé, pas approché.
 *
 * On ne fait pas confiance à la sortie du modèle, même quand le prompt décrit le
 * schéma. Un champ manquant a déjà coûté un 500 et un crédit à un utilisateur
 * sur /analyze le 3 août. Ici l'enjeu est pire : un bloc mal formé ne planterait
 * pas, il produirait un backtest qui a l'air de marcher et qui teste autre chose
 * que la stratégie du trader.
 *
 * ⚠️ LE COMPILATEUR N'A PAS LE DROIT DE COMBLER UN TROU EN SILENCE. Une fiche
 * qui ne dit pas où est le stop laisse `stop` ABSENT, et l'interface le réclame.
 * Inventer « 2R » ou « sous le plus bas » donnerait un chiffre, et ce chiffre
 * porterait sur une stratégie que personne n'a écrite. La liste de ce qui n'a
 * pas pu être traduit est le VRAI produit de cette étape : c'est elle qui dit au
 * trader ce qu'il lui reste à écrire pour que sa méthode devienne vérifiable.
 */

/** Ce que le compilateur rend à l'interface, à côté du plan. */
export interface Couverture {
  /** Phrases de la fiche devenues des blocs. */
  traduites: { phrase: string; bloc: string }[];
  /**
   * Phrases reconnues mais non mécanisables (« une réaction claire »). Elles
   * s'affichent : le trader doit savoir que le chiffre ne les inclut pas.
   */
  nonTraduites: string[];
  /**
   * Choix que le compilateur a faits faute de règle écrite, avec le motif.
   * ⚠️ Un choix déduit n'est PAS une règle du trader. Il s'affiche comme tel.
   */
  deduites: { champ: string; pourquoi: string }[];
  /** Paramètres indispensables absents de la fiche. Le plan reste incomplet. */
  absents: ChampObligatoire[];
}

/** Unités de temps proposées, en minutes. */
export const UNITES_DE_TEMPS: number[] = [1, 3, 5, 15, 30, 60, 240];

/**
 * GRAVITÉ D'UNE INTERPRÉTATION, SELON LE BLOC QU'ELLE TOUCHE.
 *
 * ⚠️ CE CLASSEMENT EST NÉ D'UN ÉCHEC PRÉCIS. Sur la fiche trendline d'un
 * trader, le compilateur avait DÉCLARÉ deux interprétations : « les pivots de
 * swing approchent ses trendlines » et « derrière le dernier sommet = extrême
 * de la bougie de signal ». Les deux étaient fausses, les deux étaient à
 * l'écran, et les deux étaient dans le même paragraphe gris qu'une note anodine
 * sur le fuseau horaire. Personne ne les a vues.
 *
 * Une interprétation sur le NIVEAU, le DÉCLENCHEUR, l'ENTRÉE, le STOP,
 * l'OBJECTIF ou l'UNITÉ DE TEMPS ne se discute pas : ces six blocs SONT la
 * stratégie, et se tromper sur l'un d'eux fait tester autre chose. Une
 * supposition d'horaire ou de plafond de trades reste un réglage.
 */
export type Gravite = "critique" | "mineure";

const CHAMPS_CRITIQUES = new Set([
  "niveau",
  "declencheur",
  "entree",
  "stop",
  "objectif",
  "uniteDeTemps",
  "unite_de_temps",
  "sens",
]);

/**
 * Ramène un nom de champ à son bloc.
 *
 * ⚠️ LE MODÈLE NE NOMME PAS TOUJOURS LE BLOC SEUL. Vu en vrai : il rend
 * « niveau - pivots », « stop - bufferTicks », « niveau.toleranceTicks ». Sans
 * cette normalisation, deux choses cassent en silence : l'interprétation n'est
 * plus classée critique alors qu'elle touche le cœur de la méthode, et le bloc
 * refusé ne s'entoure jamais de rouge dans l'éditeur, alors que l'écran vient
 * de promettre au trader qu'il le serait. Une promesse non tenue vaut pire
 * qu'une absence de bouton.
 */
export function champDeBase(champ: string): string {
  return champ.split(/[\s\-.>:/]+/)[0].trim();
}

export function graviteDuChamp(champ: string): Gravite {
  return CHAMPS_CRITIQUES.has(champDeBase(champ)) ? "critique" : "mineure";
}

export type ChampObligatoire = "stop" | "objectif" | "risque" | "seance" | "unite_de_temps";

export interface PlanCompile {
  /** Incomplet tant que `couverture.absents` n'est pas vide. */
  plan: Partial<PlanExecution>;
  couverture: Couverture;
}

const entier = (v: unknown, min: number, max: number): number | null => {
  if (typeof v !== "number" || !Number.isFinite(v)) return null;
  const n = Math.round(v);
  return n >= min && n <= max ? n : null;
};

/**
 * Une distance ecrite en POINTS DE PRIX, convertie en ticks.
 *
 * ⚠️ LE MODELE NE PARLE JAMAIS EN TICKS, ET C'EST UNE REGLE DURE. Un tick vaut
 * 0,001 point sur le Nasdaq et 0,00001 sur l'euro : « 5 » n'a aucun sens absolu.
 * Mesure reelle du piege : le modele a ecrit 5 en pensant a une tolerance
 * raisonnable, ce qui faisait cinq milliemes de point sur un indice qui bouge de
 * cent points par heure. 1563 droites tracees, ZERO touchee, zero trade sur
 * quatre ans, et rien qui plante. La conversion se fait ici, une seule fois.
 */
function distance(v: unknown, tailleTick: number, min = 0, max = 1e9): number | null {
  if (typeof v !== "number" || !Number.isFinite(v) || v < min || v > max) return null;
  return Math.round(v / tailleTick);
}

const heure = (v: unknown): string | null =>
  typeof v === "string" && /^([01]?\d|2[0-3]):[0-5]\d$/.test(v.trim()) ? v.trim() : null;

/** Fuseaux acceptés : ceux que l'application propose déjà ailleurs. */
function fuseau(v: unknown): string | null {
  if (typeof v !== "string") return null;
  try {
    new Intl.DateTimeFormat("en-US", { timeZone: v });
    return v;
  } catch {
    return null;
  }
}

export function validerNiveau(v: unknown, tailleTick = 1): BlocNiveau | null {
  const o = v as Record<string, unknown>;
  if (!o || typeof o.type !== "string") return null;
  switch (o.type) {
    case "range_horaire": {
      const debut = heure(o.debut);
      const fin = heure(o.fin);
      // Une plage qui franchit minuit n'est pas gérée par le moteur : la
      // refuser vaut mieux que rendre un niveau vide sans le dire.
      if (!debut || !fin || debut >= fin) return null;
      return { type: "range_horaire", debut, fin };
    }
    case "extremes_n_bougies": {
      const n = entier(o.n, 2, 500);
      return n === null ? null : { type: "extremes_n_bougies", n };
    }
    case "extremes_veille":
      return { type: "extremes_veille" };
    case "liquidite_swing": {
      const pivots = entier(o.pivots, 2, 500);
      return pivots === null ? null : { type: "liquidite_swing", pivots };
    }
    case "trendline": {
      const pivots = entier(o.pivots, 2, 500);
      // ⚠️ Trois touches est le PLANCHER, pas un défaut modifiable vers le bas :
      // par deux points il passe toujours une droite, et une droite à deux
      // touches relie deux hasards.
      const touchesMin = entier(o.touchesMin, 3, 20);
      const toleranceTicks = distance(o.tolerance, tailleTick);
      return pivots === null || touchesMin === null || toleranceTicks === null
        ? null
        : { type: "trendline", pivots, touchesMin, toleranceTicks };
    }
    default:
      return null;
  }
}

export function validerDeclencheur(v: unknown, tailleTick = 1): BlocDeclencheur | null {
  const o = v as Record<string, unknown>;
  if (!o || typeof o.type !== "string") return null;
  switch (o.type) {
    case "cassure":
      return o.mode === "cloture" || o.mode === "meche"
        ? { type: "cassure", mode: o.mode }
        : null;
    case "balayage_retour":
      return { type: "balayage_retour" };
    case "retest_apres_cassure": {
      const d = entier(o.delaiMaxBarres, 1, 500);
      const tol = distance(o.tolerance, tailleTick);
      return d === null || tol === null
        ? null
        : { type: "retest_apres_cassure", delaiMaxBarres: d, toleranceTicks: tol };
    }
    case "fvg_puis_retest": {
      const d = entier(o.delaiMaxBarres, 1, 500);
      return d === null ? null : { type: "fvg_puis_retest", delaiMaxBarres: d };
    }
    case "balayage_puis_fvg": {
      const a = entier(o.delaiReaction, 1, 500);
      const b = entier(o.delaiRetest, 1, 500);
      return a === null || b === null
        ? null
        : { type: "balayage_puis_fvg", delaiReaction: a, delaiRetest: b };
    }
    default:
      return null;
  }
}

export function validerConfirmations(v: unknown, tailleTick = 1): BlocConfirmation[] {
  if (!Array.isArray(v)) return [];
  const out: BlocConfirmation[] = [];
  for (const x of v) {
    const o = x as Record<string, unknown>;
    if (!o || typeof o.type !== "string") continue;
    if (o.type === "bougie_reaction") out.push({ type: "bougie_reaction" });
    else if (o.type === "biais_moyenne") {
      const p = entier(o.periode, 2, 1000);
      if (p !== null) out.push({ type: "biais_moyenne", periode: p });
    } else if (o.type === "amplitude_min") {
      const ticks = distance(o.amplitude, tailleTick);
      if (ticks !== null && ticks > 0) out.push({ type: "amplitude_min", ticks });
    }
  }
  // Au-delà de trois filtres, on ne teste plus une méthode, on sculpte une
  // courbe. Le catalogue en propose trois, on n'en accepte pas davantage.
  return out.slice(0, 3);
}

export function validerEntree(v: unknown): BlocEntree | null {
  const o = v as Record<string, unknown>;
  if (!o || typeof o.type !== "string") return null;
  if (o.type === "open_bougie_suivante") return { type: "open_bougie_suivante" };
  if (o.type === "limite_au_niveau") {
    const n = entier(o.valableNBarres, 1, 500);
    return n === null ? null : { type: "limite_au_niveau", valableNBarres: n };
  }
  return null;
}

export function validerStop(v: unknown, tailleTick = 1): BlocStop | null {
  const o = v as Record<string, unknown>;
  if (!o || typeof o.type !== "string") return null;
  switch (o.type) {
    case "fixe": {
      const ticks = distance(o.distance, tailleTick);
      return ticks === null || ticks < 1 ? null : { type: "fixe", ticks };
    }
    case "structurel":
    case "niveau_oppose":
    case "extreme_balayage":
    case "dernier_pivot": {
      const b = distance(o.buffer, tailleTick);
      return b === null ? null : { type: o.type, bufferTicks: b };
    }
    default:
      return null;
  }
}

export function validerObjectif(v: unknown): BlocObjectif | null {
  const o = v as Record<string, unknown>;
  if (!o || typeof o.type !== "string") return null;
  if (o.type === "niveau_oppose") return { type: "niveau_oppose" };
  if (o.type === "multiple_r") {
    const r = typeof o.r === "number" && Number.isFinite(o.r) ? Math.round(o.r * 100) / 100 : null;
    // Un objectif sous 0,1R ou au-delà de 20R n'est pas une stratégie de
    // trader, c'est une faute de saisie du modèle.
    return r === null || r < 0.1 || r > 20 ? null : { type: "multiple_r", r };
  }
  return null;
}

export function validerContexte(v: unknown): Contexte | null {
  const o = v as Record<string, unknown>;
  if (!o) return null;
  const tz = fuseau(o.fuseau);
  const debut = heure(o.debut);
  const fin = heure(o.fin);
  if (!tz || !debut || !fin || debut >= fin) return null;
  const jours = Array.isArray(o.jours)
    ? (o.jours.filter((j) => typeof j === "number" && j >= 0 && j <= 6) as JourSemaine[])
    : [];
  return { fuseau: tz, debut, fin, jours };
}

export function validerGestion(v: unknown): Gestion {
  const o = (v ?? {}) as Record<string, unknown>;
  const g: Gestion = {};
  // Au-delà de 100 % on ne risque plus, on emprunte ; sous 0,01 % la lecture en
  // pourcents n'apprend plus rien.
  const risque =
    typeof o.risqueParTradePct === "number" && o.risqueParTradePct >= 0.01 && o.risqueParTradePct <= 100
      ? Math.round(o.risqueParTradePct * 100) / 100
      : null;
  if (risque !== null) g.risqueParTradePct = risque;
  const trades = entier(o.maxTradesParJour, 1, 100);
  if (trades !== null) g.maxTradesParJour = trades;
  const pertes = entier(o.maxPertesConsecutives, 1, 50);
  if (pertes !== null) g.maxPertesConsecutives = pertes;
  const perte = typeof o.maxPerteJournaliereR === "number" && o.maxPerteJournaliereR > 0
    ? Math.round(o.maxPerteJournaliereR * 100) / 100
    : null;
  if (perte !== null && perte <= 100) g.maxPerteJournaliereR = perte;
  return g;
}

export function validerSorties(v: unknown): SortiesAuxiliaires {
  const o = (v ?? {}) as Record<string, unknown>;
  const s: SortiesAuxiliaires = {};
  const be = typeof o.breakEvenApresR === "number" && o.breakEvenApresR > 0
    ? Math.round(o.breakEvenApresR * 100) / 100
    : null;
  if (be !== null && be <= 20) s.breakEvenApresR = be;
  const fin = heure(o.finDeSession);
  if (fin) s.finDeSession = fin;
  const n = entier(o.apresNBarres, 1, 100_000);
  if (n !== null) s.apresNBarres = n;
  return s;
}

/** Texte court, borné, et débarrassé de ce qui casserait l'affichage. */
function phrase(v: unknown, max = 200): string | null {
  if (typeof v !== "string") return null;
  const t = v.replace(/\s+/g, " ").trim();
  return t.length === 0 ? null : t.slice(0, max);
}

const BLOCS_CONNUS = new Set([
  "contexte", "niveau", "declencheur", "confirmations", "entree", "stop", "objectif",
  "sortiesAuxiliaires", "gestion", "sens",
]);

const CHAMPS_OBLIGATOIRES: ChampObligatoire[] = [
  "stop", "objectif", "risque", "seance", "unite_de_temps",
];

/**
 * Valide la proposition du modèle et rend un plan partiel plus sa couverture.
 *
 * ⚠️ Un bloc invalide n'est pas remplacé par un bloc par défaut : il est
 * ABSENT du plan rendu. L'interface le signale et demande au trader de trancher.
 */
export function compilerDepuisModele(
  brut: unknown,
  instrument: string,
  tailleTick = 1,
): PlanCompile {
  const o = (brut ?? {}) as Record<string, unknown>;
  const plan: Partial<PlanExecution> = { instrument };

  const contexte = validerContexte(o.contexte);
  if (contexte) plan.contexte = contexte;
  const niveau = validerNiveau(o.niveau, tailleTick);
  if (niveau) plan.niveau = niveau;
  const declencheur = validerDeclencheur(o.declencheur, tailleTick);
  if (declencheur) plan.declencheur = declencheur;
  plan.confirmations = validerConfirmations(o.confirmations, tailleTick);
  const entree = validerEntree(o.entree);
  if (entree) plan.entree = entree;
  const stop = validerStop(o.stop, tailleTick);
  if (stop) plan.stop = stop;
  const objectif = validerObjectif(o.objectif);
  if (objectif) plan.objectif = objectif;
  plan.sortiesAuxiliaires = validerSorties(o.sortiesAuxiliaires);
  plan.gestion = validerGestion(o.gestion);
  plan.sens =
    o.sens === "long" || o.sens === "short" || o.sens === "les_deux" ? o.sens : "les_deux";
  // Liste fermée, celle des plateformes. Une unité arbitraire (7 minutes)
  // n'existe chez aucun courtier et ne correspondrait au graphique de personne.
  plan.uniteDeTemps = UNITES_DE_TEMPS.includes(o.uniteDeTemps as number)
    ? (o.uniteDeTemps as number)
    : 1;

  const traduites: { phrase: string; bloc: string }[] = [];
  if (Array.isArray(o.traduites)) {
    for (const x of o.traduites) {
      const e = x as Record<string, unknown>;
      const p = phrase(e?.phrase);
      const b = phrase(e?.bloc, 40);
      // Un bloc que le catalogue ne connaît pas n'a pas pu traduire quoi que ce
      // soit : la ligne mentirait à l'écran.
      if (p && b && BLOCS_CONNUS.has(b)) traduites.push({ phrase: p, bloc: b });
    }
  }

  const nonTraduites = Array.isArray(o.nonTraduites)
    ? o.nonTraduites.map((x) => phrase(x)).filter((x): x is string => x !== null).slice(0, 12)
    : [];

  const deduites: { champ: string; pourquoi: string }[] = [];
  if (Array.isArray(o.deduites)) {
    for (const x of o.deduites) {
      const e = x as Record<string, unknown>;
      const champ = phrase(e?.champ, 40);
      const pourquoi = phrase(e?.pourquoi);
      if (champ && pourquoi) deduites.push({ champ, pourquoi });
    }
  }

  const declares = new Set(
    Array.isArray(o.absents)
      ? o.absents.filter((x): x is ChampObligatoire =>
          CHAMPS_OBLIGATOIRES.includes(x as ChampObligatoire),
        )
      : [],
  );
  // ⚠️ On ne se fie pas au modèle pour déclarer une absence qui se CONSTATE.
  // S'il a proposé un stop en le sachant déduit, on le garde, mais un stop
  // absent du plan est absent, qu'il l'ait dit ou non.
  if (!plan.stop) declares.add("stop");
  if (!plan.objectif) declares.add("objectif");
  if (!plan.contexte) declares.add("seance");

  return {
    plan,
    couverture: {
      traduites: traduites.slice(0, 20),
      nonTraduites,
      deduites: deduites.slice(0, 10),
      absents: CHAMPS_OBLIGATOIRES.filter((c) => declares.has(c)),
    },
  };
}

/** Un plan n'est jouable que si tous ses blocs indispensables sont là. */
export function planComplet(p: Partial<PlanExecution>): p is PlanExecution {
  return Boolean(
    p.instrument && p.sens && p.contexte && p.niveau && p.declencheur && p.entree && p.stop &&
      p.objectif && p.confirmations && p.sortiesAuxiliaires && p.gestion && p.couts,
  );
}

/**
 * Plan de départ quand le trader part de zéro, ou socle sur lequel le
 * compilateur pose ce qu'il a su traduire.
 *
 * ⚠️ Il ne contient NI stop NI objectif : ce sont justement les deux champs que
 * les vraies fiches omettent le plus souvent, et les pré-remplir ferait
 * disparaître la seule question que l'outil doit poser.
 */
export function socleDePlan(
  instrument: string,
  fuseau: string,
): Omit<PlanExecution, "stop" | "objectif" | "couts"> {
  return {
    instrument,
    uniteDeTemps: 5,
    sens: "les_deux",
    contexte: { fuseau, debut: "08:00", fin: "22:00", jours: [1, 2, 3, 4, 5] },
    niveau: { type: "liquidite_swing", pivots: 20 },
    declencheur: { type: "balayage_puis_fvg", delaiReaction: 10, delaiRetest: 15 },
    confirmations: [],
    entree: { type: "open_bougie_suivante" },
    sortiesAuxiliaires: {},
    gestion: {},
  };
}
