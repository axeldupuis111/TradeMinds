/**
 * MODÈLE ÉCONOMIQUE DU PRODUIT : reste-t-il de la marge quand un abonné
 * consomme TOUS ses quotas ?
 *
 * POURQUOI CE FICHIER. L'enveloppe IA du coach vivait comme une constante de
 * 8,36 € posée à la main dans `coach-budget.eval.ts`, sans que rien ne dise
 * d'où elle venait ni ce qui restait pour les NEUF autres routes IA. On
 * arbitrait donc le coach dans le noir : impossible de savoir si ajouter un
 * outil au coach mangeait de la marge réelle ou du vide.
 *
 * Ce fichier renverse le raisonnement. On part du prix payé par le trader, on
 * retire ce qui part avant nous (Stripe, cotisations, infrastructure), on
 * chiffre CHAQUE route IA à son plafond mensuel, et ce qui reste est la marge.
 * L'enveloppe du coach n'est plus une constante : c'est ce que le modèle
 * autorise une fois tout le reste payé.
 *
 * ⚠️ RÈGLE DURE : le pire cas doit rester à l'équilibre ou mieux. Un abonné
 * qui utilise tout ce qu'on lui vend ne doit jamais coûter plus qu'il ne
 * rapporte. C'est ce que tient `product-margin.test.ts`.
 */

import type { PlanType } from "@/lib/PlanContext";
import { PLAN_MONTHLY_CEILING, FEATURE_MONTHLY_CEILING } from "@/lib/ai-ceilings";

/** Prix mensuel TTC encaissé, en euros. Franchise de TVA (art. 293 B). */
export const PLAN_PRICE_EUR: Record<Exclude<PlanType, "free">, number> = {
  plus: 14.99,
  premium: 29.99,
};

/**
 * Frais Stripe, cartes européennes : 1,5 % + 0,25 € par transaction.
 * Une transaction par mois et par abonné.
 */
export const STRIPE_RATE = 0.015;
export const STRIPE_FIXED_EUR = 0.25;

/**
 * Cotisations sociales micro-entreprise, assises sur le CHIFFRE D'AFFAIRES
 * (pas sur le bénéfice) : c'est ce qui rend la marge si sensible au coût IA.
 *
 * ⚠️ À CONFIRMER PAR AXEL. Le taux dépend du régime exact (BIC prestations de
 * services contre BNC libéral) et il a été relevé plusieurs fois. La valeur
 * ci-dessous est le taux BNC ; si le régime est BIC, il est plus bas et la
 * marge est meilleure que ce que ce modèle annonce. Aucune décision ici ne
 * bascule sur cette valeur, mais elle change la marge affichée.
 */
export const SOCIAL_CHARGE_RATE = 0.246;

/**
 * Infrastructure amortie par abonné payant. Vercel + Supabase sont des coûts
 * fixes : ils écrasent la marge tant que la base est petite, et deviennent
 * négligeables ensuite. On modélise donc le coût fixe total, pas un forfait
 * par tête.
 */
export const INFRA_FIXED_EUR_PER_MONTH = 45;

/**
 * Une route IA, telle qu'elle coûte réellement.
 *
 * `inputTokens` / `outputTokens` sont par APPEL. Les valeurs marquées MESURÉE
 * viennent de `count_tokens` sur le vrai prompt (2026-08-10 et 2026-08-14) ;
 * les autres sont des majorants assumés, bornés par le `max_tokens` de la
 * route. Les routes Haiku secondaires pèsent ~1,4 € à elles toutes : une
 * erreur d'estimation y est sans effet sur les décisions.
 */
export interface AiRoute {
  nom: string;
  model: string;
  /** Plafond mensuel par plan. */
  plafond: Record<Exclude<PlanType, "free">, number>;
  inputTokens: number;
  outputTokens: number;
  /** Le préfixe est-il mis en cache ? Seul le coach l'est aujourd'hui. */
  cache?: boolean;
  /** Origine des chiffres, pour qu'on sache lesquels re-mesurer. */
  source: "mesurée" | "majorant";
}

const PREMIUM_ONLY = { plus: 0, premium: 0 } as const;

export const AI_ROUTES: AiRoute[] = [
  {
    nom: "analyse de trades",
    model: "claude-sonnet-5",
    plafond: { plus: PLAN_MONTHLY_CEILING.analyze.plus, premium: PLAN_MONTHLY_CEILING.analyze.premium },
    inputTokens: 7426,
    outputTokens: 3702,
    source: "mesurée",
  },
  {
    nom: "analyse visuelle (vision)",
    model: "claude-sonnet-5",
    // Premium uniquement. L'image seule pèse jusqu'à 4 784 tokens en haute
    // résolution, et c'est ce qui rend cette route la plus chère du produit.
    plafond: { ...PREMIUM_ONLY, premium: FEATURE_MONTHLY_CEILING.vision_review },
    inputTokens: 7300,
    // Sortie plafonnée à 2 000 dans la route depuis le 2026-08-14 ; 1 200 est
    // le majorant retenu pour un rapport structuré de sept champs.
    outputTokens: 1200,
    source: "majorant",
  },
  {
    nom: "lecture de communauté",
    model: "claude-sonnet-5",
    plafond: { plus: FEATURE_MONTHLY_CEILING["community-interpret"], premium: FEATURE_MONTHLY_CEILING["community-interpret"] },
    inputTokens: 2000,
    outputTokens: 350,
    source: "majorant",
  },
  {
    nom: "débrief de session",
    model: "claude-haiku-4-5-20251001",
    plafond: { plus: FEATURE_MONTHLY_CEILING["session-debrief"], premium: FEATURE_MONTHLY_CEILING["session-debrief"] },
    inputTokens: 3000,
    outputTokens: 800,
    source: "majorant",
  },
  {
    nom: "fiche stratégie (parsing)",
    model: "claude-haiku-4-5-20251001",
    plafond: { plus: FEATURE_MONTHLY_CEILING["parse-strategy"], premium: FEATURE_MONTHLY_CEILING["parse-strategy"] },
    inputTokens: 2000,
    outputTokens: 3000,
    source: "majorant",
  },
  {
    nom: "résumé quotidien",
    model: "claude-haiku-4-5-20251001",
    plafond: { plus: FEATURE_MONTHLY_CEILING["daily-summary"], premium: FEATURE_MONTHLY_CEILING["daily-summary"] },
    inputTokens: 1500,
    outputTokens: 250,
    source: "majorant",
  },
  {
    nom: "calendrier économique",
    model: "claude-haiku-4-5-20251001",
    plafond: { plus: FEATURE_MONTHLY_CEILING["calendar-explain"], premium: FEATURE_MONTHLY_CEILING["calendar-explain"] },
    inputTokens: 1500,
    outputTokens: 350,
    source: "majorant",
  },
  {
    nom: "plan hebdomadaire",
    model: "claude-haiku-4-5-20251001",
    plafond: { plus: FEATURE_MONTHLY_CEILING["weekly-plan"], premium: FEATURE_MONTHLY_CEILING["weekly-plan"] },
    inputTokens: 2000,
    outputTokens: 400,
    source: "majorant",
  },
  {
    nom: "objectifs (interprétation)",
    model: "claude-haiku-4-5-20251001",
    plafond: { plus: FEATURE_MONTHLY_CEILING["goals-interpret"], premium: FEATURE_MONTHLY_CEILING["goals-interpret"] },
    inputTokens: 1500,
    outputTokens: 180,
    source: "majorant",
  },
  {
    nom: "bilan mensuel",
    model: "claude-haiku-4-5-20251001",
    plafond: { plus: FEATURE_MONTHLY_CEILING["monthly-review"], premium: FEATURE_MONTHLY_CEILING["monthly-review"] },
    inputTokens: 4000,
    outputTokens: 500,
    source: "majorant",
  },
];

/**
 * Paramètres du coach, isolés parce que ce sont EUX qu'on arbitre. Le reste du
 * modèle est subi ; ici on choisit.
 */
export interface CoachConfig {
  /** Modèle par plan : Premium et Plus ne tournent pas sur le même. */
  model: Record<Exclude<PlanType, "free">, string>;
  /**
   * ⚠️ LE PRÉFIXE SE COMPTE PAR MODÈLE, PAS UNE FOIS POUR TOUTES.
   *
   * Piège découvert le 2026-08-14 en confrontant le modèle à une mesure réelle :
   * le MÊME prompt, mêmes outils, compte 14 297 tokens sur Haiku 4.5 et 20 690
   * sur Sonnet 5, soit +45 %. Sonnet embarque un tokenizer différent. Combiné à
   * son tarif d'entrée 3× supérieur, un token de préfixe y coûte donc **4,3×**
   * ce qu'il coûte sur Haiku, et non 3×.
   *
   * J'avais mesuré sur Haiku et appliqué le chiffre au tarif Sonnet : l'erreur
   * valait 2,25 € par abonné au plafond, assez pour faire passer une
   * configuration déficitaire pour rentable. D'où ce champ par plan, et le test
   * du banc qui confronte chaque valeur à une mesure réelle.
   */
  prefixeParModele: Record<Exclude<PlanType, "free">, number>;
  /** Plafond mensuel de messages, par plan. */
  plafond: Record<Exclude<PlanType, "free">, number>;
  /** Appels modèle par message (boucle d'outils). */
  roundsParMessage: number;
  /**
   * Messages tenant dans une même fenêtre de cache. La route pose un TTL d'une
   * heure : ce ne sont donc PAS les sessions qui comptent (mesurées à 1,67
   * message), mais les fenêtres d'une heure où le trader est actif. Toute
   * fenêtre nouvelle repaie une écriture complète du préfixe.
   */
  messagesParFenetre: number;
  historiqueTokens: number;
  sortieTokens: number;
  /** Part des messages déclenchant une recherche web (0 = outil absent). */
  partRechercheWeb: number;
}

/**
 * Configuration RÉELLEMENT DÉPLOYÉE. Toute divergence avec la route est un
 * mensonge du modèle économique : les deux se relisent ensemble.
 */
export const COACH_DEFAULT: CoachConfig = {
  // Sonnet 5 sur Premium : mesuré meilleur, et rendu payable par le catalogue
  // différé. Haiku ailleurs, l'enveloppe Plus ne le couvre pas.
  model: { premium: "claude-sonnet-5", plus: "claude-haiku-4-5-20251001" },
  // Mesurés le 2026-08-14 via /v1/messages, catalogue en `defer_loading`.
  // ⚠️ CES CHIFFRES SONT LE PIVOT DE TOUTE L'ÉCONOMIE DU COACH : le préfixe est
  // réécrit en cache une fois par fenêtre d'une heure, à 2× le tarif d'entrée,
  // ce qui en fait le premier poste de dépense. Le voir grossir, c'est voir le
  // plafond de messages baisser. Le banc les confronte à une mesure réelle.
  // Premium : catalogue différé sur Sonnet. Plus : catalogue PLEIN sur Haiku,
  // le report n'y finançant rien et faisant perdre des outils au débutant.
  // ⚠️ 18 784 et non 21 022 : Plus n'a pas les mêmes outils que Premium
  // (`coachToolsForPlan` filtre par plan). J'avais mesuré Plus avec le
  // catalogue de Premium ; le garde-fou du banc a attrapé l'écart. Mesurer un
  // plan avec la configuration d'un autre est la façon la plus facile de se
  // mentir dans ce fichier.
  prefixeParModele: { premium: 20_690, plus: 18_784 },
  plafond: { plus: PLAN_MONTHLY_CEILING.chat.plus, premium: PLAN_MONTHLY_CEILING.chat.premium },
  roundsParMessage: 1.4,
  messagesParFenetre: 5,
  historiqueTokens: 3000,
  sortieTokens: 800,
  // Recherche web retirée du coach le 2026-08-14 : mesurée inerte sur Haiku
  // (0 déclenchement sur 6 appels) et inutile sur Sonnet, qui répond juste
  // sans elle. Le paramètre reste, l'outil est prêt à revenir avec un plafond
  // mensuel de recherches.
  partRechercheWeb: 0,
};

/** Recherche web côté serveur : 10 $ les 1 000 requêtes. */
export const RECHERCHE_WEB_USD = 0.01;
/** Résultats de recherche réinjectés en entrée du modèle. */
export const RECHERCHE_WEB_TOKENS = 2500;

const USD_EUR = 0.92;

/** Tarifs $/million de tokens. Doublon assumé de `ai-cost-log` : ce modèle
 *  doit pouvoir chiffrer un modèle qu'aucune route n'utilise encore. */
const PRICING: Record<string, { in: number; out: number }> = {
  "claude-haiku-4-5-20251001": { in: 1, out: 5 },
  "claude-haiku-4-5": { in: 1, out: 5 },
  "claude-sonnet-5": { in: 3, out: 15 },
  "claude-sonnet-4-6": { in: 3, out: 15 },
  "claude-opus-5": { in: 5, out: 25 },
};

function tarif(model: string): { in: number; out: number } {
  const p = PRICING[model];
  if (!p) throw new Error(`Tarif inconnu pour ${model} : compléter PRICING avant de chiffrer.`);
  return p;
}

/** Coût mensuel d'une route à son plafond, en euros. */
export function coutRouteEur(route: AiRoute, plan: Exclude<PlanType, "free">): number {
  const n = route.plafond[plan];
  if (!n) return 0;
  const p = tarif(route.model);
  const usd = (n * route.inputTokens * p.in + n * route.outputTokens * p.out) / 1e6;
  return usd * USD_EUR;
}

/**
 * Coût mensuel du coach à son plafond.
 *
 * ⚠️ Deux mécaniques que la route implémente déjà et qu'un modèle naïf rate :
 *  1. le TTL est d'UNE HEURE, donc l'écriture coûte 2× l'entrée et non 1,25× ;
 *  2. l'HISTORIQUE de conversation porte lui aussi un point de cache, il se
 *     relit donc à 0,1× dans la fenêtre au lieu d'être repayé plein tarif.
 * Les deux jouent en sens contraire et se compensent en partie ; les ignorer
 * fausse l'arbitrage entre modèles, parce que le préfixe pèse 3× plus cher sur
 * Sonnet que sur Haiku.
 */
export function coutCoachEur(c: CoachConfig, plan: Exclude<PlanType, "free">): number {
  const messages = c.plafond[plan];
  if (!messages) return 0;
  const p = tarif(c.model[plan]);
  const appels = messages * c.roundsParMessage;
  const prefixe = c.prefixeParModele[plan];
  const fenetres = Math.max(1, Math.ceil(messages / c.messagesParFenetre));
  const appelsCaches = Math.max(0, appels - fenetres);

  // TTL 1 h : écriture à 2× l'entrée, lecture à 0,1×.
  const ecritures = fenetres * prefixe * p.in * 2;
  const lectures = appelsCaches * prefixe * p.in * 0.1;
  // L'historique est plein tarif au premier appel d'une fenêtre, caché ensuite.
  const historique = (fenetres + appelsCaches * 0.1) * c.historiqueTokens * p.in;
  const sortie = appels * c.sortieTokens * p.out;

  let usd = (ecritures + lectures + historique + sortie) / 1e6;

  if (c.partRechercheWeb > 0) {
    const recherches = messages * c.partRechercheWeb;
    usd += recherches * RECHERCHE_WEB_USD;
    usd += (recherches * RECHERCHE_WEB_TOKENS * p.in) / 1e6;
  }
  return usd * USD_EUR;
}

export interface Marge {
  plan: Exclude<PlanType, "free">;
  revenu: number;
  stripe: number;
  cotisations: number;
  infra: number;
  /** Coût IA de toutes les routes SAUF le coach. */
  iaAutres: number;
  coach: number;
  /** Ce qui reste après tout, à plein quota. Doit rester >= 0. */
  marge: number;
  /** Ce que le coach POURRAIT dépenser en restant à l'équilibre. */
  enveloppeCoach: number;
}

/**
 * Marge au PIRE CAS : l'abonné consomme tous ses quotas, toutes routes
 * confondues. `abonnes` sert à amortir l'infrastructure fixe.
 */
export function margeAuPlafond(
  plan: Exclude<PlanType, "free">,
  coach: CoachConfig = COACH_DEFAULT,
  abonnes = 100,
): Marge {
  const revenu = PLAN_PRICE_EUR[plan];
  const stripe = revenu * STRIPE_RATE + STRIPE_FIXED_EUR;
  const cotisations = revenu * SOCIAL_CHARGE_RATE;
  const infra = INFRA_FIXED_EUR_PER_MONTH / Math.max(1, abonnes);
  const iaAutres = AI_ROUTES.reduce((n, r) => n + coutRouteEur(r, plan), 0);
  const coachCout = coutCoachEur(coach, plan);

  const disponible = revenu - stripe - cotisations - infra - iaAutres;
  return {
    plan,
    revenu,
    stripe,
    cotisations,
    infra,
    iaAutres,
    coach: coachCout,
    marge: disponible - coachCout,
    enveloppeCoach: disponible,
  };
}
