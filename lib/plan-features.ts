/**
 * Matrice marketing des fonctionnalités par plan — source de vérité unique,
 * partagée entre la page « gérer mon plan » et le comparatif de la landing.
 *
 * Reflète le gating réel du code (PlanContext, PLAN_LIMITS et les gardes API).
 * À tenir à jour quand un gate change.
 *
 * Valeurs : true = inclus, false = non inclus, "1" = quantité,
 * "1/plan_day" = quantité + clé i18n de période, "plan_unlimited" = illimité.
 * Un quota peut porter DEUX bornes séparées par « | »
 * (« 30/plan_day|340/plan_month_max ») : voir planQuotaSegments ci-dessous.
 */

import { toolCountForPlan } from "@/lib/coach-capabilities";

export interface PlanFeature {
  key: string;
  free: boolean | string;
  plus: boolean | string;
  premium: boolean | string;
  /** En-tête de groupe affiché au-dessus de cette ligne dans le tableau. */
  groupKey?: string;
}

/**
 * Découpe une valeur de quota en segments affichables.
 *
 * Un quota journalier ne dit pas toute la vérité quand un plafond mensuel
 * mord avant la fin du mois : Premium annonçait « 30 messages/jour » alors
 * que le disjoncteur s'arrête à 340 par mois, soit 12/jour en moyenne. Le
 * trader qui consommait vraiment ses 30 quotidiens heurtait un mur vers le 15.
 *
 * Les deux bornes s'affichent donc ensemble, et la mensuelle porte la clé
 * `plan_month_max` (« /mois max ») et non `plan_month` : « 30/jour · 340/mois »
 * se lit comme deux promesses qui se contredisent, « 30/jour · 340/mois max »
 * se lit comme un débit et une enveloppe.
 *
 * Rendu ici plutôt que dans les pages : la landing et la page d'upgrade
 * dupliquaient la même logique et pouvaient diverger.
 */
export function planQuotaSegments(val: string): { count: string; periodKey: string }[] {
  return val.split("|").map((part) => {
    const [count, periodKey] = part.split("/");
    return { count, periodKey };
  });
}

export const PLAN_FEATURES: PlanFeature[] = [
  // ── Journal & suivi ──
  { key: "plan_feat_csv_import",        free: "1/plan_day",  plus: "plan_unlimited", premium: "plan_unlimited", groupKey: "plan_group_journal" },
  { key: "plan_feat_manual_trades",     free: true,          plus: true,             premium: true },
  { key: "plan_feat_accounts",          free: "1",           plus: "plan_unlimited", premium: "plan_unlimited" },
  { key: "plan_feat_calendar",          free: true,          plus: true,             premium: true },
  { key: "plan_feat_equity_curve",      free: true,          plus: true,             premium: true },
  { key: "plan_feat_analytics",         free: true,          plus: true,             premium: true },
  { key: "plan_feat_eco_calendar",      free: true,          plus: true,             premium: true },
  { key: "plan_feat_session_pretrade",  free: true,          plus: true,             premium: true },
  { key: "plan_feat_position_sizer",    free: true,          plus: true,             premium: true },
  { key: "plan_feat_leaderboard",       free: true,          plus: true,             premium: true },
  // Free : seul le 1er badge est déblocable (gate UI dans la page classement).
  { key: "plan_feat_badges",            free: "1",           plus: true,             premium: true },
  // ── IA ──
  { key: "plan_feat_strategy_ai",       free: "1",           plus: "plan_unlimited", premium: "plan_unlimited", groupKey: "plan_group_ai" },
  // Free : 1 analyse « découverte » à vie (gate serveur dans /api/analyze).
  // Plus : 1/jour × 30 = 30 = son plafond mensuel, les deux coïncident.
  // Premium : 2/jour mais 40/mois, le mensuel mord avant — on affiche les deux.
  { key: "plan_feat_analysis_ai",       free: "plan_taster_once", plus: "1/plan_day", premium: "2/plan_day|40/plan_month_max" },
  // Analyse visuelle des graphiques (vision Sonnet 5) — exclusivité Premium.
  // Free : forfait découverte à vie (FREE_LIFETIME_CHAT_MESSAGES, gate serveur
  // dans chat-coach). Un seul message ne démontrait plus rien depuis que le
  // coach construit une méthode avec le débutant, ce qui demande un échange.
  // Plus : 5/jour × 30 = 150 = son plafond mensuel, cohérent.
  // Premium : 30/jour mais 340/mois, soit 12/jour en moyenne — les deux bornes.
  { key: "plan_feat_coach_ai",          free: "plan_taster_coach", plus: "5/plan_day", premium: "30/plan_day|340/plan_month_max" },
  { key: "plan_feat_debrief_ai",        free: false,         plus: true,             premium: true },
  { key: "plan_feat_weekly_plan",       free: false,         plus: true,             premium: true },
  { key: "plan_feat_daily_summary",     free: false,         plus: true,             premium: true },
  { key: "plan_feat_goals_ai",          free: false,         plus: true,             premium: true },
  // ── Ce que le coach fait pour toi ──
  // Le nombre d'outils est calculé depuis TOOL_MIN_PLAN : il ne peut pas
  // sur-promettre, et il suit tout seul quand le catalogue grandit.
  { key: "plan_feat_coach_tools",    free: String(toolCountForPlan("free")), plus: String(toolCountForPlan("plus")), premium: String(toolCountForPlan("premium")), groupKey: "plan_group_coach" },
  { key: "plan_feat_coach_reads",    free: true,  plus: true,  premium: true },
  { key: "plan_feat_coach_sizes",    free: true,  plus: true,  premium: true },
  { key: "plan_feat_coach_coaches",  free: false, plus: true,  premium: true },
  { key: "plan_feat_coach_reports",  free: false, plus: true,  premium: true },
  { key: "plan_feat_coach_operates", free: false, plus: false, premium: true },
  { key: "plan_feat_coach_accounts", free: false, plus: false, premium: true },
  { key: "plan_feat_coach_voice",    free: false, plus: true,  premium: true },

  // ── Discipline & bilan ──
  // Page Objectifs & centre de discipline (gate UI dans la page + verrou sidebar).
  { key: "plan_feat_goals_hub",         free: false,         plus: true,             premium: true, groupKey: "plan_group_review" },
  { key: "plan_feat_tags_emotions",     free: false,         plus: true,             premium: true },
  { key: "plan_feat_monthly_review",    free: false,         plus: true,             premium: true },
  { key: "plan_feat_pdf_export",        free: false,         plus: true,             premium: true },
  { key: "plan_feat_public_profile",    free: false,         plus: true,             premium: true },
  // ── Automatisation & protection (exclusif Premium) ──
  { key: "plan_feat_mt_sync",           free: false,         plus: false,            premium: true, groupKey: "plan_group_automation" },
  { key: "plan_feat_challenge_guardian", free: false,        plus: false,            premium: true },
  { key: "plan_feat_macro",             free: false,         plus: false,            premium: true },
  { key: "plan_feat_sizer_dd",          free: false,         plus: false,            premium: true },
  { key: "plan_feat_badge_premium",     free: false,         plus: false,            premium: true },
  { key: "plan_feat_priority_support",  free: false,         plus: false,            premium: true },
];

/** Nombre de fonctionnalités totalement verrouillées pour un plan donné
 *  (les lignes en quota ne comptent pas — l'utilisateur y a accès).
 *  Affiché comme compteur de manque (sidebar, dashboard). */
export function countLockedFeatures(plan: "free" | "plus" | "premium"): number {
  return PLAN_FEATURES.filter((f) => f[plan] === false).length;
}

// Listes courtes affichées dans les cartes de pricing (landing + upgrade).
export const FREE_BENEFITS = [
  "plan_benefit_free_1", "plan_benefit_free_2", "plan_benefit_free_3",
  "plan_benefit_free_4", "plan_benefit_free_5",
] as const;

export const PLUS_BENEFITS = [
  "plan_benefit_plus_coach", "plan_benefit_plus_2", "plan_benefit_plus_3", "plan_benefit_plus_4",
  "plan_benefit_plus_5", "plan_benefit_plus_6", "plan_benefit_plus_7",
] as const;

// Uniquement ce que le Premium AJOUTE par rapport au Plus — jamais mélangé
// avec le contenu du Plus (affiché à part sous « Tout le plan Plus inclus »).
export const PREMIUM_BENEFITS = [
  "plan_benefit_premium_coach", "plan_benefit_premium_1", "plan_benefit_premium_2", "plan_benefit_premium_3",
  "plan_benefit_premium_4", "plan_benefit_premium_5", "plan_benefit_premium_6",
] as const;
