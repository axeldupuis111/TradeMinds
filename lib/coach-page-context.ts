/**
 * Contexte de la page courante, transmis au coach par le dock global.
 *
 * C'est ce qui rend le dock utile plutôt que décoratif : sur la page Trades,
 * « supprime celui-là » ou « annote les perdants d'hier » se comprend sans que
 * le trader ait à préciser de quoi il parle. Sans ce contexte, un coach
 * omniprésent oblige à tout re-décrire, et fait donc perdre le temps qu'il est
 * censé faire gagner.
 *
 * Volontairement pauvre : la ROUTE, pas les données affichées. Le coach a des
 * outils pour aller chercher les données lui-même ; lui envoyer le contenu de
 * l'écran regonflerait le prompt, ce qu'on vient précisément de corriger.
 */

const PAGES: { match: (p: string) => boolean; describe: () => string }[] = [
  { match: (p) => p === "/dashboard", describe: () => "le tableau de bord (vue d'ensemble : équité, série en cours, raccourcis)" },
  { match: (p) => p.startsWith("/dashboard/trades"), describe: () => "la liste de ses trades (il peut en sélectionner, les annoter, les modifier)" },
  { match: (p) => p.startsWith("/dashboard/analytics"), describe: () => "ses statistiques détaillées (performance par paire, par heure, par jour)" },
  { match: (p) => p.startsWith("/dashboard/analysis"), describe: () => "la page d'analyse IA de ses trades" },
  { match: (p) => p.startsWith("/dashboard/strategy"), describe: () => "sa stratégie (règles de setup, checklist, paires et sessions autorisées)" },
  { match: (p) => p.startsWith("/dashboard/goals"), describe: () => "ses objectifs et son centre de discipline" },
  { match: (p) => p.startsWith("/dashboard/session"), describe: () => "sa session de trading en cours (check émotionnel, calculateur de lot, garde-fous)" },
  { match: (p) => p.startsWith("/dashboard/calendar"), describe: () => "son calendrier de trading (équité jour par jour)" },
  { match: (p) => p.startsWith("/dashboard/review"), describe: () => "son bilan mensuel" },
  { match: (p) => p.startsWith("/dashboard/leaderboard"), describe: () => "le classement et les défis de la communauté" },
  { match: (p) => p.startsWith("/dashboard/challenge"), describe: () => "son challenge de prop firm (drawdown, objectif, jours restants)" },
  { match: (p) => p.startsWith("/dashboard/macro"), describe: () => "l'analyse macro du jour" },
  { match: (p) => p.startsWith("/dashboard/sizer"), describe: () => "le calculateur de taille de position" },
  { match: (p) => p.startsWith("/dashboard/accounts"), describe: () => "ses comptes de trading" },
  { match: (p) => p.startsWith("/dashboard/community"), describe: () => "sa communauté partenaire" },
  { match: (p) => p.startsWith("/dashboard/settings"), describe: () => "ses réglages" },
  { match: (p) => p.startsWith("/dashboard/upgrade"), describe: () => "la page des abonnements" },
];

/**
 * Renvoie une phrase décrivant où se trouve le trader, ou `undefined` hors
 * périmètre connu (on préfère ne rien dire que de dire quelque chose de faux).
 */
export function describePage(pathname: string): string | undefined {
  const page = PAGES.find((p) => p.match(pathname));
  return page?.describe();
}
