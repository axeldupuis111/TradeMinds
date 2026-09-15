/**
 * coach-steps.ts — ce que le coach est en train de faire, dit au trader.
 *
 * POURQUOI. Entre l'envoi d'un message et le premier mot de la réponse, il
 * peut s'écouler plusieurs secondes : le serveur rassemble le journal, la
 * fiche stratégie et la mémoire, puis le modèle appelle un ou plusieurs outils
 * AVANT d'écrire quoi que ce soit. Pendant tout ce temps l'écran ne montrait
 * rien (le dock affichait « … »). Un silence sans explication ne se lit pas
 * comme « il réfléchit », il se lit comme « c'est cassé » : le trader ferme le
 * dock et ne revient pas.
 *
 * COMMENT. Le serveur émet un événement `{t:"step"}` à chaque étape réelle, le
 * client affiche l'étape courante. ⚠️ CE QUI EST AFFICHÉ EST VRAI : chaque
 * libellé correspond à un appel qui a effectivement lieu. Une animation qui
 * raconte une étape inventée rassure une fois, puis ment à chaque fois.
 */

/**
 * Familles d'étapes. Une par action que le trader peut reconnaître dans sa
 * propre langue, pas une par outil : « Je relis tes trades » veut dire quelque
 * chose, « find_trades » non.
 */
export type CoachStepKey =
  | "context"    // client : la requête part, le serveur rassemble les données
  | "thinking"   // premier appel modèle, rien n'est encore écrit
  | "search"     // le modèle cherche l'outil adapté (catalogue différé)
  | "journal"    // lecture des trades / performances
  | "strategy"   // lecture ou écriture de la fiche stratégie
  | "goals"      // objectifs
  | "challenges" // défis et communautés
  | "macro"      // calendrier économique, briefing macro
  | "trades"     // écriture dans le journal (création, clôture, annotation)
  | "reports"    // exports, rapports, PDF
  | "account"    // comptes de trading
  | "session"    // session de trading, note, check émotionnel
  | "tool"       // outil non classé : repli honnête
  | "writing";   // les outils ont répondu, le coach rédige

/** Outil → famille. Le défaut (`tool`) reste volontairement neutre. */
const FAMILLES: Record<string, CoachStepKey> = {
  // Lecture du journal
  find_trades: "journal",
  list_open_trades: "journal",
  get_journal_summary: "journal",
  get_performance: "journal",
  read_projection: "journal",
  get_leaderboard_standing: "journal",
  calculate_position_size: "journal",

  // Stratégie
  list_strategies: "strategy",
  create_strategy: "strategy",
  update_strategy: "strategy",
  delete_strategy: "strategy",
  add_checklist_item: "strategy",
  remove_checklist_item: "strategy",

  // Objectifs
  list_goals: "goals",
  create_goal: "goals",
  update_goal: "goals",
  delete_goal: "goals",

  // Défis et communautés
  list_challenges: "challenges",
  manage_challenge: "challenges",
  get_challenge_status: "challenges",
  list_communities: "challenges",

  // Macro
  list_economic_events: "macro",
  get_macro_briefing: "macro",

  // Écriture dans le journal
  create_trade: "trades",
  update_trade: "trades",
  close_trade: "trades",
  delete_trades: "trades",
  reassign_trades: "trades",
  annotate_trades: "trades",

  // Rapports
  export_trades: "reports",
  export_pdf: "reports",
  run_ai_report: "reports",

  // Comptes
  list_accounts: "account",
  create_account: "account",
  update_account: "account",
  delete_account: "account",

  // Session
  start_session: "session",
  end_session: "session",
  save_coach_note: "session",
  log_emotional_check: "session",
  open_page: "session",

  // Recherche d'outil (catalogue différé, plan Premium)
  tool_search_tool_bm25: "search",
};

/** Famille d'étape d'un outil du catalogue. */
export function familleOutil(nom: string): CoachStepKey {
  return FAMILLES[nom] ?? "tool";
}

/** Clé de traduction du libellé affiché pour une étape. */
export function coachStepLabelKey(step: CoachStepKey): string {
  return `coach_step_${step}`;
}

/** Les familles connues, pour les tests de couverture et de traduction. */
export const COACH_STEP_KEYS: CoachStepKey[] = [
  "context", "thinking", "search", "journal", "strategy", "goals",
  "challenges", "macro", "trades", "reports", "account", "session",
  "tool", "writing",
];
