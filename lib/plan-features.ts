/**
 * Matrice marketing des fonctionnalités par plan — source de vérité unique,
 * partagée entre la page « gérer mon plan » et le comparatif de la landing.
 *
 * Reflète le gating réel du code (PlanContext, PLAN_LIMITS et les gardes API).
 * À tenir à jour quand un gate change.
 *
 * Valeurs : true = inclus, false = non inclus, "1" = quantité,
 * "1/plan_day" = quantité + clé i18n de période, "plan_unlimited" = illimité.
 */

export interface PlanFeature {
  key: string;
  free: boolean | string;
  plus: boolean | string;
  premium: boolean | string;
  /** En-tête de groupe affiché au-dessus de cette ligne dans le tableau. */
  groupKey?: string;
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
  { key: "plan_feat_leaderboard",       free: true,          plus: true,             premium: true },
  // ── IA ──
  { key: "plan_feat_strategy_ai",       free: "1",           plus: "plan_unlimited", premium: "plan_unlimited", groupKey: "plan_group_ai" },
  { key: "plan_feat_analysis_ai",       free: "1/plan_week", plus: "1/plan_day",     premium: "10/plan_day" },
  { key: "plan_feat_coach_ai",          free: false,         plus: "5/plan_day",     premium: "30/plan_day" },
  { key: "plan_feat_debrief_ai",        free: false,         plus: true,             premium: true },
  { key: "plan_feat_weekly_plan",       free: false,         plus: true,             premium: true },
  { key: "plan_feat_daily_summary",     free: false,         plus: true,             premium: true },
  { key: "plan_feat_goals_ai",          free: false,         plus: true,             premium: true },
  // ── Discipline & bilan ──
  { key: "plan_feat_tags_emotions",     free: false,         plus: true,             premium: true, groupKey: "plan_group_review" },
  { key: "plan_feat_monthly_review",    free: false,         plus: true,             premium: true },
  { key: "plan_feat_pdf_export",        free: false,         plus: true,             premium: true },
  { key: "plan_feat_public_profile",    free: false,         plus: true,             premium: true },
  // ── Automatisation & protection (exclusif Premium) ──
  { key: "plan_feat_mt_sync",           free: false,         plus: false,            premium: true, groupKey: "plan_group_automation" },
  { key: "plan_feat_challenge_guardian", free: false,        plus: false,            premium: true },
  { key: "plan_feat_macro",             free: false,         plus: false,            premium: true },
  { key: "plan_feat_position_sizer",    free: false,         plus: false,            premium: true },
  { key: "plan_feat_badge_premium",     free: false,         plus: false,            premium: true },
  { key: "plan_feat_priority_support",  free: false,         plus: false,            premium: true },
];

// Listes courtes affichées dans les cartes de pricing (landing + upgrade).
export const FREE_BENEFITS = [
  "plan_benefit_free_1", "plan_benefit_free_2", "plan_benefit_free_3",
  "plan_benefit_free_4", "plan_benefit_free_5",
] as const;

export const PLUS_BENEFITS = [
  "plan_benefit_plus_1", "plan_benefit_plus_2", "plan_benefit_plus_3", "plan_benefit_plus_4",
  "plan_benefit_plus_5", "plan_benefit_plus_6", "plan_benefit_plus_7",
] as const;

// Uniquement ce que le Premium AJOUTE par rapport au Plus — jamais mélangé
// avec le contenu du Plus (affiché à part sous « Tout le plan Plus inclus »).
export const PREMIUM_BENEFITS = [
  "plan_benefit_premium_1", "plan_benefit_premium_2", "plan_benefit_premium_3",
  "plan_benefit_premium_4", "plan_benefit_premium_5", "plan_benefit_premium_6",
] as const;
