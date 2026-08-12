/**
 * Ce que le coach sait faire, traduit en promesses vendables.
 *
 * Une page de vente qui liste des fonctionnalités à la main finit toujours par
 * mentir : on ajoute un outil sans toucher au marketing, ou on promet en Plus
 * ce que le code réserve au Premium. Ici le plan de chaque promesse est
 * DÉDUIT de `TOOL_MIN_PLAN` (le gate réel), jamais saisi à la main.
 *
 * Un test de couverture (coach-capabilities.test.ts) exige que chaque outil du
 * catalogue appartienne à exactement une promesse : ajouter un 40e outil casse
 * la suite tant que personne n'a décidé comment le vendre.
 */

import { PLAN_MONTHLY_CEILING } from "./ai-ceilings";
import { TOOL_MIN_PLAN } from "./coach-tool-plans";
import { FREE_LIFETIME_CHAT_MESSAGES, PLAN_LIMITS } from "./plan-limits";

export type CapabilityPlan = "free" | "plus" | "premium";

const PLAN_RANK: Record<CapabilityPlan, number> = { free: 0, plus: 1, premium: 2 };

export interface CoachCapability {
  /** Clé i18n : ce que le coach FAIT, jamais le nom technique de l'outil. */
  key: string;
  /** Outils réellement derrière la promesse. Ils en fixent le plan minimum. */
  tools: string[];
}

/**
 * Les 39 outils regroupés en promesses lisibles par un trader.
 *
 * L'ordre compte : il suit la montée en puissance (il lit, il corrige, il
 * fait), c'est aussi l'ordre d'affichage sur la landing.
 */
export const COACH_CAPABILITIES: CoachCapability[] = [
  // ── Il lit ton journal (gratuit) ──
  { key: "cap_find_trades", tools: ["find_trades", "list_open_trades"] },
  { key: "cap_diagnose", tools: ["get_performance", "get_challenge_status"] },
  { key: "cap_position_size", tools: ["calculate_position_size"] },
  { key: "cap_knows_setup", tools: ["list_accounts", "list_strategies", "list_goals"] },
  { key: "cap_navigate", tools: ["open_page"] },
  { key: "cap_economic", tools: ["list_economic_events"] },
  { key: "cap_standing", tools: ["get_leaderboard_standing", "list_challenges", "list_communities"] },

  // ── Il travaille ta discipline (Plus) ──
  { key: "cap_annotate", tools: ["annotate_trades"] },
  { key: "cap_goals", tools: ["create_goal", "update_goal", "delete_goal"] },
  { key: "cap_strategy", tools: ["create_strategy", "update_strategy", "add_checklist_item", "remove_checklist_item"] },
  { key: "cap_session", tools: ["start_session", "end_session", "log_emotional_check"] },
  { key: "cap_reports", tools: ["run_ai_report", "export_pdf", "export_trades"] },
  { key: "cap_challenges", tools: ["manage_challenge"] },
  { key: "cap_memory", tools: ["save_coach_note"] },

  // ── Il tient ton journal à ta place (Premium) ──
  { key: "cap_write_trades", tools: ["create_trade", "update_trade", "close_trade"] },
  { key: "cap_tidy_journal", tools: ["delete_trades", "reassign_trades", "delete_strategy"] },
  { key: "cap_accounts", tools: ["create_account", "update_account", "delete_account"] },
  { key: "cap_macro", tools: ["get_macro_briefing"] },
];

/**
 * Plan minimum d'une promesse : le plus exigeant de ses outils.
 *
 * Promettre la promesse sans son outil le plus verrouillé reviendrait à vendre
 * une capacité que le trader ne pourra pas déclencher.
 */
export function capabilityPlan(cap: CoachCapability): CapabilityPlan {
  return cap.tools.reduce<CapabilityPlan>((worst, tool) => {
    const plan = TOOL_MIN_PLAN[tool] ?? "premium";
    return PLAN_RANK[plan] > PLAN_RANK[worst] ? plan : worst;
  }, "free");
}

/** Promesses tenues par un plan donné (cumulatif : Premium contient tout). */
export function capabilitiesForPlan(plan: CapabilityPlan): CoachCapability[] {
  return COACH_CAPABILITIES.filter((c) => PLAN_RANK[plan] >= PLAN_RANK[capabilityPlan(c)]);
}

/** Nombre d'outils réellement ouverts par un plan. Sert de preuve chiffrée. */
export function toolCountForPlan(plan: CapabilityPlan): number {
  return Object.values(TOOL_MIN_PLAN).filter((min) => PLAN_RANK[plan] >= PLAN_RANK[min]).length;
}

/** Total du catalogue, pour ne jamais écrire « 39 » en dur dans la copy. */
export function totalToolCount(): number {
  return Object.keys(TOOL_MIN_PLAN).length;
}

/**
 * Combien de fois par jour le trader peut solliciter le coach.
 *
 * Sans ce chiffre, « 13 outils » en gratuit laisse croire a un coach utilisable
 * alors que le plan gratuit n'offre qu'UN message a vie : les outils existent,
 * l'occasion de s'en servir non. Annoncer la capacite sans la frequence est la
 * meilleure facon de decevoir a la premiere utilisation.
 */
export function coachQuotaKey(plan: CapabilityPlan): string {
  if (PLAN_LIMITS.chat[plan].limit === 0) return "cap_quota_taster";
  // Le plafond mensuel mord avant la fin du mois (Premium : 30/jour × 30 = 900
  // contre 450) : l'annoncer, sinon on promet un rythme intenable.
  const quotidien = PLAN_LIMITS.chat[plan].limit;
  const plafond = PLAN_MONTHLY_CEILING.chat[plan];
  return quotidien * JOURS_PAR_MOIS > plafond ? "cap_quota_daily_capped" : "cap_quota_daily";
}

/** Nombre d'echanges par jour, 0 pour le forfait decouverte. */
export function coachDailyMessages(plan: CapabilityPlan): number {
  return PLAN_LIMITS.chat[plan].limit;
}

/** Base de conversion journalier → mensuel, pour décider si le plafond mord. */
const JOURS_PAR_MOIS = 30;

/**
 * Ligne de quota d'un palier, entièrement résolue.
 *
 * La landing et la page d'upgrade faisaient chacune leur propre substitution
 * de `{count}`. Elles ne pouvaient pas suivre l'ajout du plafond mensuel sans
 * être modifiées toutes les deux, et l'une des deux finit toujours par être
 * oubliée. Une seule fonction, deux appelants.
 */
export function coachQuotaText(plan: CapabilityPlan, t: (k: string) => string): string {
  const key = coachQuotaKey(plan);
  if (key === "cap_quota_taster") {
    return t(key).replace("{count}", String(FREE_LIFETIME_CHAT_MESSAGES));
  }
  return t(key)
    .replace("{count}", String(PLAN_LIMITS.chat[plan].limit))
    .replace("{cap}", String(PLAN_MONTHLY_CEILING.chat[plan]));
}

/** Les trois paliers, dans l'ordre du récit : il lit, il corrige, il fait. */
export const CAPABILITY_TIERS: {
  plan: CapabilityPlan;
  /** Nom commercial du plan. Sans lui, le lecteur ne sait pas ce qu'il achète. */
  planKey: string;
  titleKey: string;
  promiseKey: string;
}[] = [
  { plan: "free", planKey: "plan_free", titleKey: "cap_tier_free", promiseKey: "cap_tier_free_promise" },
  { plan: "plus", planKey: "plan_plus", titleKey: "cap_tier_plus", promiseKey: "cap_tier_plus_promise" },
  { plan: "premium", planKey: "plan_premium", titleKey: "cap_tier_premium", promiseKey: "cap_tier_premium_promise" },
];
