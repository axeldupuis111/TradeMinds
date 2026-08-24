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
  /**
   * Tokens de sortie d'une RÉPONSE RÉDIGÉE, celle que le trader lit.
   *
   * ⚠️ Mesuré à 1 079 tokens au banc, contre 800 supposés jusque-là. Le 800
   * n'avait jamais été compté : c'était un chiffre d'ambiance, et il était trop
   * bas de 35 %.
   */
  sortieTokens: number;
  /**
   * Tokens de sortie d'un TOUR D'OUTIL intermédiaire.
   *
   * ⚠️ CE CHAMP EXISTE PARCE QUE SON ABSENCE COÛTAIT 1,22 € PAR ABONNÉ.
   * Le modèle appliquait `sortieTokens` aux 476 appels, alors que 136 d'entre
   * eux ne sont pas des réponses : ce sont des tours où le modèle émet une
   * ligne de narration et un bloc `tool_use`, soit une fraction d'une réponse
   * rédigée. Surévaluer la sortie n'est pas prudent, c'est de l'enveloppe
   * retirée au trader pour une dépense qui n'a jamais lieu.
   */
  sortieOutilTokens: number;
  /** Part des messages déclenchant une recherche web (0 = outil absent). */
  partRechercheWeb: number;
  /**
   * Part du préfixe qui ne dépend d'AUCUN trader, et dont l'entrée de cache est
   * donc partagée par tout le produit.
   *
   * ⚠️ Ce chiffre n'est pas une hypothèse : il se lit sur les blocs réellement
   * construits par `buildCoachSystemBlocks`, et `product-margin-prompt.test.ts`
   * échoue si le prompt s'en écarte. Déplacer trois paragraphes du bloc
   * invariant vers le bloc contextuel change la facture sans changer une ligne
   * de ce fichier : il faut donc que quelque chose le remarque.
   */
  partStatique: number;
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
  prefixeParModele: { premium: 20_844, plus: 18_882 },
  plafond: { plus: PLAN_MONTHLY_CEILING.chat.plus, premium: PLAN_MONTHLY_CEILING.chat.premium },
  // ⚠️ MAJORANT MESURÉ AU BANC LE 2026-08-24 (1,54 appel par message sur 46
  // messages). Ce n'est PAS la moyenne d'un mois ordinaire : huit des 28
  // scénarios existent exprès pour forcer une sélection d'outil, le banc
  // sur-représente donc les tours d'outils. On garde la valeur haute quand
  // même, parce que se tromper vers le bas ici fait vendre un plafond qu'on ne
  // peut pas payer. La vraie moyenne se lit dans l'onglet « Coût IA » de
  // l'admin, sur des conversations réelles.
  roundsParMessage: 1.54,
  messagesParFenetre: 5,
  historiqueTokens: 3000,
  // ⚠️ MESURÉ À 1 079 AU BANC, ARRONDI EN MAJORANT. Le 800 précédent n'avait
  // jamais été compté. Même réserve que `roundsParMessage` : le banc pose des
  // questions dures (construis-moi une méthode, compare trois instruments), ses
  // réponses sont donc plus longues qu'un échange ordinaire. C'est un majorant
  // assumé, pas une moyenne de production.
  sortieTokens: 1100,
  // ⚠️ MESURÉ LE 2026-08-24 À 348 PUIS 393 TOKENS SUR DEUX PASSAGES, ARRONDI À 400. `coach-live.eval.ts`
  // compte les tokens de sortie de chaque appel des 28 scénarios et sépare les
  // tours d'outils des réponses rédigées ; le banc échoue si cette valeur
  // s'écarte de la mesure.
  //
  // ⚠️ J'AVAIS ÉCRIT 150 « PAR BON SENS », ET C'ÉTAIT FAUX DE 2,3×. Un tour
  // d'outil n'est pas qu'un bloc `tool_use` : le prompt demande explicitement au
  // coach de NARRER ce qu'il fait pendant qu'il enchaîne les outils, et le
  // catalogue différé lui fait dépenser un tour en recherche d'outil. Ces deux
  // choix produisent du texte, et ce texte se paie au tarif de sortie.
  //
  // C'est la deuxième fois qu'un chiffre « évident » de ce fichier se révèle
  // faux à la mesure (après le préfixe reporté d'un modèle à l'autre). La règle
  // qui s'en dégage : dans ce fichier, un nombre non mesuré est un nombre faux
  // tant qu'on ne l'a pas confronté.
  sortieOutilTokens: 400,
  // Recherche web retirée du coach le 2026-08-14 : mesurée inerte sur Haiku
  // (0 déclenchement sur 6 appels) et inutile sur Sonnet, qui répond juste
  // sans elle. Le paramètre reste, l'outil est prêt à revenir avec un plafond
  // mensuel de recherches.
  partRechercheWeb: 0,
  // Mesuré sur les blocs réels le 2026-08-24 : 20 624 caractères invariants sur
  // 28 953. Tenu par `product-margin-prompt.test.ts`.
  partStatique: 0.71,
};

/**
 * ── LE PRÉFIXE INVARIANT EST PARTAGÉ PAR TOUS LES ABONNÉS ───────────────────
 *
 * Le cache de prompt est attaché à la CLÉ D'API, pas au trader. Depuis que le
 * prompt système est coupé en trois (voir `coach-system-prompt.ts`), 71 % de
 * ses caractères ne dépendent plus de personne : le même bloc, au caractère
 * près, pour tous les traders et dans les quatre langues. La première requête
 * de l'heure l'écrit, TOUTES les autres le lisent à 0,1×, quel que soit le
 * trader qui les envoie.
 *
 * Le modèle facturait ce bloc à chacun, 68 fois par mois. C'est vrai pour un
 * produit à un seul abonné actif ; c'est faux dès qu'il y en a plusieurs, et
 * l'écart vaut plusieurs euros par tête.
 *
 * ⚠️ CE GAIN NE SE DÉCRÈTE PAS, IL VIENT AVEC L'ÉCHELLE. Les écritures
 * partagées sont bornées par le nombre d'heures du mois, pas par le nombre
 * d'abonnés : à 12 abonnés il n'y a rien à partager (chacun paie ses propres
 * écritures) et le modèle le dit. C'est la même mécanique que l'infrastructure
 * fixe, et il faut la lire pareil : ce n'est pas le coach qui décide de la
 * marge à cette taille, c'est le nombre d'abonnés.
 */
export const HEURES_PAR_MOIS = 720;

/**
 * Variantes du bloc invariant réellement servies. Le cache exige un préfixe
 * identique OUTILS COMPRIS : Premium (catalogue différé), Plus et gratuit
 * (catalogue plein) n'en partagent donc pas l'entrée. Trois familles, donc
 * trois écritures par heure au pire.
 */
export const VARIANTES_PREFIXE = 3;

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
export function coutCoachEur(
  c: CoachConfig,
  plan: Exclude<PlanType, "free">,
  abonnes = 1,
): number {
  const messages = c.plafond[plan];
  if (!messages) return 0;
  const p = tarif(c.model[plan]);
  const appels = messages * c.roundsParMessage;
  const prefixe = c.prefixeParModele[plan];
  const fenetres = Math.max(1, Math.ceil(messages / c.messagesParFenetre));
  const appelsCaches = Math.max(0, appels - fenetres);

  // ── Le préfixe se paie en DEUX morceaux, parce qu'ils ne s'invalident pas
  //    au même rythme (voir la coupe en trois de `coach-system-prompt.ts`).
  //
  //  · le bloc INVARIANT : identique pour tous les traders, son entrée de cache
  //    est partagée par tout le produit. Le nombre d'écritures n'est donc PAS
  //    proportionnel aux abonnés, il est borné par les heures du mois ;
  //  · le bloc VOLATILE (langue, fiche, statistiques, date, rappel final) :
  //    propre au trader, réécrit une fois par fenêtre, comme avant.
  //
  // ⚠️ `Math.min` fait tout le travail, et il faut le lire dans les deux sens :
  // à 12 abonnés c'est `fenetres * abonnes` qui gagne, autrement dit AUCUN
  // partage, chacun paie ses écritures. Le gain arrive avec l'échelle, il ne se
  // décrète pas. Un modèle qui accorderait le partage dès le premier abonné
  // annoncerait une marge que le produit n'a pas encore.
  const prefixeStatique = prefixe * c.partStatique;
  const prefixeVolatile = prefixe - prefixeStatique;
  const ecrituresStatiques =
    Math.min(fenetres * abonnes, HEURES_PAR_MOIS * VARIANTES_PREFIXE) / abonnes;

  // TTL 1 h : écriture à 2× l'entrée, lecture à 0,1×. Ce qui n'est pas écrit est
  // lu : un appel qui trouve le bloc invariant chaud le relit à 0,1×.
  const ecritures =
    (ecrituresStatiques * prefixeStatique + fenetres * prefixeVolatile) * p.in * 2;
  const lectures =
    ((appels - ecrituresStatiques) * prefixeStatique + appelsCaches * prefixeVolatile) *
    p.in *
    0.1;
  // L'historique est plein tarif au premier appel d'une fenêtre, caché ensuite.
  const historique = (fenetres + appelsCaches * 0.1) * c.historiqueTokens * p.in;
  // La sortie se compte par NATURE d'appel, pas au forfait : un message rend
  // une réponse rédigée, les tours d'outils qui la précèdent rendent un appel.
  const toursOutils = Math.max(0, appels - messages);
  const sortie = (messages * c.sortieTokens + toursOutils * c.sortieOutilTokens) * p.out;

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
  const coachCout = coutCoachEur(coach, plan, Math.max(1, abonnes));

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
