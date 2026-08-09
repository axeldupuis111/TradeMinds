/**
 * Plan minimum requis par chaque outil du coach.
 *
 * Isolé de `coach-tools` a dessein : la landing et la matrice des plans ont
 * besoin de cette table, mais pas des 2000 lignes d'exécution qui vont avec.
 * Les importer entraînerait tout le module serveur dans le bundle client.
 */

import type { PlanType } from "@/lib/PlanContext";

/**
 * Plan minimum requis par outil.
 *
 * La doctrine produit est constante : le gratuit vend le DIAGNOSTIC (mesurer),
 * les plans payants vendent le TRAITEMENT (changer). On la transpose ici :
 *
 *  - free    : lecture seule. Le coach explique, montre, calcule, mais n'écrit
 *              rien. C'est cohérent avec son message unique « découverte ».
 *  - plus    : les actions de coaching (objectifs, annotations, stratégie).
 *              C'est le coach qui corrige tes erreurs.
 *  - premium : l'écriture sur les trades et les comptes. C'est l'assistant qui
 *              fait le travail à ta place, et c'est ce qui justifie l'écart de
 *              prix : le calculateur de lot reste gratuit partout sur le web,
 *              l'automatisation non.
 *
 * Un outil absent de cette table est traité comme `free` (lecture).
 */
export const TOOL_MIN_PLAN: Record<string, PlanType> = {
  // Lecture — accessible à tous
  list_goals: "free",
  list_challenges: "free",
  find_trades: "free",
  list_strategies: "free",

  list_open_trades: "free",
  list_accounts: "free",
  list_economic_events: "free",
  get_challenge_status: "free",
  get_performance: "free",
  get_leaderboard_standing: "free",
  // Le PDF est gratuit dans le produit : le gater ici serait incoherent.
  export_pdf: "plus",
  // Les rapports IA consomment un credit : reserves aux plans qui en ont.
  run_ai_report: "plus",
  list_communities: "free",
  // Le check emotionnel appartient au rituel de session, donc au meme plan.
  log_emotional_check: "plus",
  // Suppressions de structures : meme niveau que l ecriture sur les trades.
  delete_strategy: "premium",
  delete_account: "premium",
  open_page: "free",
  // La macro est une exclusivite Premium : la lire par le coach ne doit pas
  // devenir une porte derobee vers un contenu que les autres plans paient.
  get_macro_briefing: "premium",
  // La session est le rituel quotidien des plans payants.
  start_session: "plus",
  end_session: "plus",
  // Le calculateur de lot est gratuit partout sur le web : le gater ne
  // convertirait pas, il ferait seulement passer le coach pour avare.
  calculate_position_size: "free",

  // Écriture sur le journal et les comptes — exclusivité Premium. C'est la
  // frontière entre « le coach me conseille » et « l'assistant fait le travail ».
  create_trade: "premium",
  update_trade: "premium",
  close_trade: "premium",
  delete_trades: "premium",
  reassign_trades: "premium",
  create_account: "premium",
  update_account: "premium",

  // Coaching — plans payants
  create_goal: "plus",
  update_goal: "plus",
  delete_goal: "plus",
  manage_challenge: "plus",
  annotate_trades: "plus",
  create_strategy: "plus",
  update_strategy: "plus",
  add_checklist_item: "plus",
  remove_checklist_item: "plus",
  export_trades: "plus",
  save_coach_note: "plus",
};

const PLAN_RANK: Record<PlanType, number> = { free: 0, plus: 1, premium: 2 };

/** Le plan couvre-t-il cet outil ? */
export function planAllowsTool(plan: PlanType, toolName: string): boolean {
  return PLAN_RANK[plan] >= PLAN_RANK[TOOL_MIN_PLAN[toolName] ?? "free"];
}
