interface PlanLimit {
  limit: number;
  resetMode: "day" | "week";
}

/**
 * Messages coach offerts à vie sur le plan gratuit.
 *
 * Il y en avait UN. Or le coach construit désormais une méthode avec le
 * débutant puis l'écrit dans sa fiche : ça demande un échange, pas une
 * réplique. Un seul message ne démontrait donc plus rien de ce qui a de la
 * valeur, au moment précis où l'inscrit décide s'il paie.
 *
 * Le coût n'est pas le sujet : un compte gratuit voit 13 outils sur 39 et n'a
 * ni fiche ni historique, son préfixe pèse ~6 350 tokens. Le premier message
 * coûte ~0,017 € (cache froid), les suivants ~0,008 € (cache chaud, TTL 1 h),
 * soit ~0,05 € pour les cinq. À 1 000 inscrits gratuits, il suffit de QUATRE
 * conversions vers Plus pour rembourser la démonstration entière.
 *
 * Déclaré ici et importé des deux côtés : le serveur en fait une porte, le
 * client un compteur. Deux nombres écrits séparément finiraient par diverger.
 */
export const FREE_LIFETIME_CHAT_MESSAGES = 5;

export const PLAN_LIMITS: Record<"analyze" | "chat", Record<"free" | "plus" | "premium", PlanLimit>> = {
  analyze: {
    // Free : 1 analyse « découverte » à vie, gérée hors quota dans
    // /api/analyze (marqueur session_reviews, même mécanique que le coach).
    // limit 0 = défense en profondeur si un chemin passe quand même par ici.
    free:    { limit: 0, resetMode: "week" },
    plus:    { limit: 1, resetMode: "day" },
    // Premium : 2/jour (au lieu de 10). L'analyse tourne sur Sonnet 5 ; 10/jour
    // exposait au pire cas (10 × 500 trades) un coût qui dépassait la marge.
    // 2/jour couvre tout usage réaliste et garde le plan rentable même saturé.
    premium: { limit: 2, resetMode: "day" },
  },
  chat: {
    free:    { limit: 0,  resetMode: "day" },
    plus:    { limit: 5,  resetMode: "day" },
    premium: { limit: 30, resetMode: "day" },
  },
};
