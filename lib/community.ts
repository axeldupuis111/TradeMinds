/**
 * Communautés partenaires — catalogue de métriques et validation des défis
 * privés créés par un partenaire (voir migration 20260731_partner_communities).
 *
 * Le partenaire écrit le titre et choisit la cible, mais PAS la façon de
 * mesurer : la métrique est prise dans la liste ci-dessous, la seule que le
 * serveur sait recalculer depuis les trades et les séances. Deux raisons, et
 * les deux sont structurantes :
 *  - une métrique libre serait déclarative, donc invérifiable et trichable ;
 *  - aucune métrique n'est basée sur le P&L, ce qui interdit par construction
 *    le défi « +10 % cette semaine » (clause anti promesses de gains du contrat
 *    de partenariat, loi influenceurs n° 2023-451).
 *
 * Client-safe : aucun import serveur ici, le formulaire de création s'en sert.
 */

import type { ChallengeMetric } from "@/lib/community-challenges";
import { containsForbiddenTerm } from "@/lib/username-moderation";

/** Unité de la cible — pilote le libellé et les bornes du formulaire. */
export type MetricUnit = "days" | "sessions" | "score" | "points";

export interface CommunityMetricSpec {
  metric: ChallengeMetric;
  /** Clés i18n : ccm_<metric>_label / _hint. */
  labelKey: string;
  hintKey: string;
  unit: MetricUnit;
  min: number;
  max: number;
  defaultTarget: number;
}

function spec(
  metric: ChallengeMetric,
  unit: MetricUnit,
  min: number,
  max: number,
  defaultTarget: number,
): CommunityMetricSpec {
  return { metric, unit, min, max, defaultTarget, labelKey: `ccm_${metric}_label`, hintKey: `ccm_${metric}_hint` };
}

/**
 * Métriques proposables. L'ordre est celui du menu déroulant : les plus
 * parlantes pour un coach d'abord.
 */
export const COMMUNITY_METRICS: CommunityMetricSpec[] = [
  spec("clean_days", "days", 1, 90, 4),
  spec("journal_days", "days", 1, 90, 4),
  spec("sessions", "sessions", 1, 200, 5),
  spec("clean_run", "days", 1, 90, 4),
  spec("calm_days", "days", 1, 90, 4),
  spec("gold_days", "days", 1, 90, 3),
  spec("gold_avg", "score", 50, 100, 85),
  spec("early_bird", "sessions", 1, 200, 3),
  spec("weekend_days", "days", 1, 60, 2),
  spec("score_climb", "points", 1, 50, 3),
];

export function getMetricSpec(metric: string): CommunityMetricSpec | undefined {
  return COMMUNITY_METRICS.find((m) => m.metric === metric);
}

/** Plafond de défis en cours (à venir ou actifs) par communauté — anti-spam. */
export const MAX_OPEN_CHALLENGES = 5;
/** Durée maximale d'un défi, en jours (bornes incluses). */
export const MAX_CHALLENGE_DAYS = 90;
/** Un défi peut démarrer un peu dans le passé (rattrapage) mais pas rétroactivement. */
export const MAX_BACKDATE_DAYS = 7;
/** Et pas non plus être programmé un an à l'avance. */
export const MAX_LEAD_DAYS = 90;

export const TITLE_MAX = 60;
export const DESC_MAX = 220;

/**
 * Termes qui transforment un défi de discipline en promesse de performance.
 * Volontairement large côté argent (symboles monétaires, « pips », « R »
 * chiffré) : sur ce terrain, un faux positif coûte un titre à reformuler,
 * un faux négatif coûte une infraction à la loi influenceurs — pour le
 * partenaire comme pour nous.
 */
const GAIN_SUBSTRINGS = [
  "gain",
  "gagn",
  "profit",
  "benefice",
  "rendement",
  "pips",
  "payout",
  "doubler",
  "pnl",
];

// Mots trop courts ou trop communs pour être cherchés en sous-chaîne :
// « roi » vit dans « trois » et « endroit », « earn » dans « learn ».
const GAIN_TOKENS = new Set(["roi", "x2", "x3", "capital", "earn", "earnings", "money", "cash", "pl"]);

const MONEY_RE = /(\d\s*(€|\$|£|usd|eur)|(€|\$|£)\s*\d)/i;

/**
 * « Gagner en discipline » n'est pas une promesse de gain, et un coach l'écrira
 * spontanément. On neutralise ces tournures avant le test plutôt que de retirer
 * « gagn » de la liste : « gagner de l'argent » doit rester bloqué.
 */
const DISCIPLINE_NOUNS =
  "discipline|regularite|rigueur|confiance|serenite|constance|patience|clarte|maitrise|calme|sang-froid|recul|lucidite|temps";
const SAFE_GAIN_RE = new RegExp(`(gagn\\w*|gain\\w*)\\s+(en|de la|du|plus de)\\s+(${DISCIPLINE_NOUNS})`, "g");

/**
 * Un pourcentage signé est toujours une promesse (« +10 % cette semaine ») ;
 * « 100 % » est l'idiome français de « totalement » (« 100 % respect du plan »)
 * et reste autorisé tant qu'il n'est pas signé.
 */
function hasPerformancePercent(folded: string): boolean {
  const re = /([+-])?\s*(\d+(?:[.,]\d+)?)\s*%/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(folded)) !== null) {
    const value = parseFloat(m[2].replace(",", "."));
    if (m[1] || value !== 100) return true;
  }
  return false;
}

function foldForGainCheck(s: string): string {
  return s
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");
}

/** true si le texte promet (ou suggère) un résultat financier. */
export function containsGainPromise(text: string): boolean {
  const folded = foldForGainCheck(text);
  if (MONEY_RE.test(folded)) return true;
  if (hasPerformancePercent(folded)) return true;
  if (folded.includes("p&l")) return true;

  const withoutSafe = folded.replace(SAFE_GAIN_RE, " ");
  if (GAIN_SUBSTRINGS.some((term) => withoutSafe.includes(term))) return true;
  const tokens = withoutSafe.split(/[^a-z0-9]+/).filter(Boolean);
  return tokens.some((tk) => GAIN_TOKENS.has(tk));
}

export interface ChallengeDraft {
  title: string;
  description: string;
  metric: string;
  target: number;
  startsOn: string; // "YYYY-MM-DD"
  endsOn: string;   // "YYYY-MM-DD"
}

/** Clé i18n de l'erreur, ou null si le brouillon est valide. */
export type DraftError =
  | "cc_err_title"
  | "cc_err_metric"
  | "cc_err_target"
  | "cc_err_dates"
  | "cc_err_duration"
  | "cc_err_backdate"
  | "cc_err_lead"
  | "cc_err_desc"
  | "cc_err_forbidden"
  | "cc_err_gain";

const DAY_MS = 86_400_000;
const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

function parseDay(key: string): number | null {
  if (!DATE_RE.test(key)) return null;
  const ms = Date.parse(`${key}T00:00:00Z`);
  return Number.isNaN(ms) ? null : ms;
}

/**
 * Valide un brouillon de défi. `today` est la date locale du créateur
 * ("YYYY-MM-DD") : les bornes se jugent dans SON calendrier, pas en UTC.
 */
export function validateChallengeDraft(draft: ChallengeDraft, today: string): DraftError | null {
  const title = draft.title.trim();
  if (title.length < 3 || title.length > TITLE_MAX) return "cc_err_title";
  const desc = (draft.description || "").trim();
  if (desc.length > DESC_MAX) return "cc_err_desc";

  if (containsForbiddenTerm(title) || (desc && containsForbiddenTerm(desc))) return "cc_err_forbidden";
  if (containsGainPromise(title) || (desc && containsGainPromise(desc))) return "cc_err_gain";

  const spec = getMetricSpec(draft.metric);
  if (!spec) return "cc_err_metric";
  if (!Number.isInteger(draft.target) || draft.target < spec.min || draft.target > spec.max) {
    return "cc_err_target";
  }

  const start = parseDay(draft.startsOn);
  const end = parseDay(draft.endsOn);
  const now = parseDay(today);
  if (start === null || end === null || now === null || end < start) return "cc_err_dates";

  const days = Math.round((end - start) / DAY_MS) + 1;
  if (days > MAX_CHALLENGE_DAYS) return "cc_err_duration";
  if (start < now - MAX_BACKDATE_DAYS * DAY_MS) return "cc_err_backdate";
  if (start > now + MAX_LEAD_DAYS * DAY_MS) return "cc_err_lead";

  return null;
}

/** Les clés de jour ("YYYY-MM-DD") couvertes par le défi, bornes incluses. */
export function dayKeysBetween(startsOn: string, endsOn: string): string[] {
  const start = parseDay(startsOn);
  const end = parseDay(endsOn);
  if (start === null || end === null || end < start) return [];
  const out: string[] = [];
  for (let ms = start; ms <= end; ms += DAY_MS) out.push(new Date(ms).toISOString().slice(0, 10));
  return out;
}

/**
 * Fenêtre de référence du défi « en progression » (score_climb) : la période
 * de même durée qui précède immédiatement le défi.
 */
export function previousDayKeys(startsOn: string, endsOn: string): string[] {
  const days = dayKeysBetween(startsOn, endsOn);
  const start = parseDay(startsOn);
  if (start === null || days.length === 0) return [];
  const prevStart = start - days.length * DAY_MS;
  return Array.from({ length: days.length }, (_, i) => new Date(prevStart + i * DAY_MS).toISOString().slice(0, 10));
}

export type ChallengePhase = "upcoming" | "live" | "ended";

export function phaseOf(startsOn: string, endsOn: string, today: string): ChallengePhase {
  if (today < startsOn) return "upcoming";
  if (today > endsOn) return "ended";
  return "live";
}

/** Un slug de communauté suit les mêmes règles qu'un slug d'affiliation. */
export const COMMUNITY_SLUG_FORMAT = /^[a-z0-9][a-z0-9_-]{1,31}$/;

export function normalizeSlug(raw: string): string {
  return raw.trim().toLowerCase().slice(0, 32);
}
