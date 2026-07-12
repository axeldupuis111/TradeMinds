// Catalogue des badges du classement + récompenses réelles associées.
// Pur (pas d'I/O) : partagé entre la page classement (affichage/progression),
// l'API leaderboard (octroi serveur des awards — anti-triche : seul le serveur
// écrit dans badge_awards) et le widget de série (bonus de gels).

export type BadgeKey =
  | "first_session" | "regular" | "streak_7" | "streak_30" | "streak_90"
  | "discipline_gold" | "gold_days" | "marathon" | "comeback"
  | "early_bird" | "weekend" | "top10" | "podium";

export interface BadgeStats {
  /** Sessions notées (max période / tous-temps). */
  sessions: number;
  /** Meilleure série (max période / tous-temps). */
  streak: number;
  /** Score moyen de la période affichée. */
  score: number;
  /** Sessions de la période (pour discipline_gold : score fiable dès 3). */
  periodSessions: number;
  goldDays: number;
  comeback: boolean;
  earlyBird: number;
  weekendSessions: number;
  ranked: boolean;
  rank: number | null;
  percentile: number | null;
}

export interface BadgeState {
  key: BadgeKey;
  emoji: string;
  earned: boolean;
  progress: { current: number; target: number } | null;
}

/** Évaluation unique des 13 badges — source de vérité client ET serveur. */
export function computeBadges(s: BadgeStats): BadgeState[] {
  return [
    { key: "first_session", emoji: "✅", earned: s.sessions >= 1, progress: { current: s.sessions, target: 1 } },
    { key: "regular", emoji: "📅", earned: s.sessions >= 20, progress: { current: s.sessions, target: 20 } },
    { key: "streak_7", emoji: "🔥", earned: s.streak >= 7, progress: { current: s.streak, target: 7 } },
    { key: "streak_30", emoji: "⚡", earned: s.streak >= 30, progress: { current: s.streak, target: 30 } },
    { key: "streak_90", emoji: "🌋", earned: s.streak >= 90, progress: { current: s.streak, target: 90 } },
    { key: "discipline_gold", emoji: "🏅", earned: s.score >= 85 && s.periodSessions >= 3, progress: { current: s.score, target: 85 } },
    { key: "gold_days", emoji: "✨", earned: s.goldDays >= 10, progress: { current: s.goldDays, target: 10 } },
    { key: "marathon", emoji: "🏃", earned: s.sessions >= 100, progress: { current: s.sessions, target: 100 } },
    { key: "comeback", emoji: "💪", earned: s.comeback, progress: null },
    { key: "early_bird", emoji: "🌅", earned: s.earlyBird >= 10, progress: { current: s.earlyBird, target: 10 } },
    { key: "weekend", emoji: "🛡️", earned: s.weekendSessions >= 8, progress: { current: s.weekendSessions, target: 8 } },
    { key: "top10", emoji: "🎯", earned: s.ranked && s.percentile != null && s.percentile <= 10, progress: null },
    { key: "podium", emoji: "🏆", earned: s.ranked && s.rank != null && s.rank <= 3, progress: null },
  ];
}

/** Seul badge déblocable en plan free — les autres se gagnent à partir du Plus. */
export const FREE_BADGE_KEY: BadgeKey = "first_session";

// ── Récompenses ───────────────────────────────────────────────────────────────
// Chaque récompense doit être RÉELLEMENT utile quel que soit le plan :
// - freezeBonus : +N gels de série PAR MOIS, à vie (protège la série — la chose
//   que les traders de la page tiennent le plus à garder) ;
// - certificate : certificat officiel PDF téléchargeable (façon prop firm) ;
// - flair : l'emoji du badge s'affiche à côté du pseudo sur le classement,
//   visible par toute la communauté (statut).

export interface BadgeReward {
  freezeBonus?: number;
  certificate?: boolean;
  flair?: boolean;
}

export const BADGE_REWARDS: Record<BadgeKey, BadgeReward> = {
  first_session:   {},
  regular:         { freezeBonus: 1 },
  streak_7:        { freezeBonus: 1 },
  streak_30:       { certificate: true, flair: true },
  streak_90:       { certificate: true, flair: true },
  discipline_gold: { certificate: true, flair: true },
  gold_days:       { flair: true },
  marathon:        { certificate: true, flair: true },
  comeback:        { freezeBonus: 1 },
  early_bird:      { flair: true },
  weekend:         { flair: true },
  top10:           { flair: true },
  podium:          { certificate: true, flair: true },
};

export const BADGE_EMOJI: Record<BadgeKey, string> = {
  first_session: "✅", regular: "📅", streak_7: "🔥", streak_30: "⚡",
  streak_90: "🌋", discipline_gold: "🏅", gold_days: "✨", marathon: "🏃",
  comeback: "💪", early_bird: "🌅", weekend: "🛡️", top10: "🎯", podium: "🏆",
};

/** Ordre de prestige : le flair affiché est le plus « rare » des badges acquis. */
export const FLAIR_PRIORITY: BadgeKey[] = [
  "podium", "streak_90", "top10", "marathon", "streak_30",
  "discipline_gold", "gold_days", "early_bird", "weekend",
];

/** Emblème à afficher à côté du pseudo (null si aucun badge à flair). */
export function bestFlair(awardedKeys: string[]): string | null {
  const set = new Set(awardedKeys);
  for (const key of FLAIR_PRIORITY) {
    if (set.has(key) && BADGE_REWARDS[key].flair) return BADGE_EMOJI[key];
  }
  return null;
}

/** Gels de série par mois de base (sans badge). */
export const BASE_FREEZE_QUOTA = 2;

/** Gels bonus mensuels cumulés par les badges acquis. */
export function freezeBonusFor(awardedKeys: string[]): number {
  const set = new Set(awardedKeys);
  let bonus = 0;
  for (const [key, reward] of Object.entries(BADGE_REWARDS) as [BadgeKey, BadgeReward][]) {
    if (reward.freezeBonus && set.has(key)) bonus += reward.freezeBonus;
  }
  return bonus;
}

/** Contexte figé au moment de l'octroi (alimente le certificat). */
export function awardMeta(key: BadgeKey, s: BadgeStats, season: string): Record<string, number | string | boolean> {
  switch (key) {
    case "streak_7": case "streak_30": case "streak_90":
      return { streak: s.streak };
    case "regular": case "marathon": case "first_session":
      return { sessions: s.sessions };
    case "discipline_gold":
      return { score: s.score };
    case "gold_days":
      return { goldDays: s.goldDays };
    case "early_bird":
      return { earlyBird: s.earlyBird };
    case "weekend":
      return { weekendSessions: s.weekendSessions };
    case "comeback":
      return { comeback: true };
    case "top10":
      return { percentile: s.percentile ?? 0, season };
    case "podium":
      return { rank: s.rank ?? 0, season };
  }
}
