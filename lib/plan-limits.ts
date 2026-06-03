export const PLAN_LIMITS = {
  analyze: {
    free:    { limit: 1,  resetMode: "week" as const },
    plus:    { limit: 1,  resetMode: "day"  as const },
    premium: { limit: 10, resetMode: "day"  as const },
  },
  chat: {
    free:    { limit: 0,  resetMode: "day" as const },
    plus:    { limit: 5,  resetMode: "day" as const },
    premium: { limit: 30, resetMode: "day" as const },
  },
} as const;
