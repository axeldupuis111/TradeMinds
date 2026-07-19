interface PlanLimit {
  limit: number;
  resetMode: "day" | "week";
}

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
