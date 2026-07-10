interface PlanLimit {
  limit: number;
  resetMode: "day" | "week";
}

export const PLAN_LIMITS: Record<"analyze" | "chat", Record<"free" | "plus" | "premium", PlanLimit>> = {
  analyze: {
    // Free : 1 analyse « découverte » à vie, gérée hors quota dans
    // /api/analyze (marqueur session_reviews, même mécanique que le coach).
    // limit 0 = défense en profondeur si un chemin passe quand même par ici.
    free:    { limit: 0,  resetMode: "week" },
    plus:    { limit: 1,  resetMode: "day" },
    premium: { limit: 10, resetMode: "day" },
  },
  chat: {
    free:    { limit: 0,  resetMode: "day" },
    plus:    { limit: 5,  resetMode: "day" },
    premium: { limit: 30, resetMode: "day" },
  },
};
