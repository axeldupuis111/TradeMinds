export interface Violation {
  category: "strategy" | "behavior" | "execution";
  type: ViolationType;
  trade_ids: number[];
  occurrences: number;
  explanation: string;
}

export type ViolationType =
  | "wrong_pair"
  | "wrong_session"
  | "low_rr"
  | "sl_too_wide"
  | "max_trades_day"
  | "max_daily_loss"
  | "consecutive_losses"
  | "revenge_trading"
  | "overtrading"
  | "lot_increase_after_loss"
  | "fomo"
  | "missing_sl"
  | "missing_tp"
  | "missing_setup_tag";

export interface ViolationPenalty {
  type: ViolationType;
  category: "strategy" | "behavior" | "execution";
  points: number;
  occurrences: number;
  explanation: string;
}

export interface CategoryBreakdown {
  category: "strategy" | "behavior" | "execution";
  cap: number;
  totalRaw: number;
  totalCapped: number;
  penalties: ViolationPenalty[];
}

export interface DisciplineResult {
  score: number;
  insufficient: boolean;
  totalTrades: number;
  breakdown: CategoryBreakdown[];
  totalDeducted: number;
}

const PENALTY_MAP: Record<ViolationType, { perOccurrence: number }> = {
  wrong_pair: { perOccurrence: 10 },
  wrong_session: { perOccurrence: 8 },
  low_rr: { perOccurrence: 6 },
  sl_too_wide: { perOccurrence: 6 },
  max_trades_day: { perOccurrence: 12 },
  max_daily_loss: { perOccurrence: 15 },
  consecutive_losses: { perOccurrence: 15 },
  revenge_trading: { perOccurrence: 20 },
  overtrading: { perOccurrence: 15 },
  lot_increase_after_loss: { perOccurrence: 15 },
  fomo: { perOccurrence: 10 },
  missing_sl: { perOccurrence: 5 },
  missing_tp: { perOccurrence: 3 },
  missing_setup_tag: { perOccurrence: 2 },
};

const CATEGORY_CAPS: Record<string, number> = {
  strategy: 40,
  behavior: 40,
  execution: 20,
};

export function computeDisciplineScore(
  violations: Violation[],
  totalTrades: number,
): DisciplineResult {
  if (totalTrades < 1) {
    return {
      score: 0,
      insufficient: true,
      totalTrades,
      breakdown: [],
      totalDeducted: 0,
    };
  }

  const categoryPenalties: Record<string, ViolationPenalty[]> = {
    strategy: [],
    behavior: [],
    execution: [],
  };

  for (const v of violations) {
    const penalty = PENALTY_MAP[v.type];
    if (!penalty) continue;
    const points = penalty.perOccurrence * v.occurrences;
    categoryPenalties[v.category].push({
      type: v.type,
      category: v.category,
      points,
      occurrences: v.occurrences,
      explanation: v.explanation,
    });
  }

  const breakdown: CategoryBreakdown[] = (["strategy", "behavior", "execution"] as const).map((cat) => {
    const penalties = categoryPenalties[cat];
    const totalRaw = penalties.reduce((sum, p) => sum + p.points, 0);
    const cap = CATEGORY_CAPS[cat];
    return {
      category: cat,
      cap,
      totalRaw,
      totalCapped: Math.min(totalRaw, cap),
      penalties,
    };
  });

  const totalDeducted = breakdown.reduce((sum, b) => sum + b.totalCapped, 0);
  const score = Math.max(0, Math.min(100, 100 - totalDeducted));

  return {
    score,
    insufficient: false,
    totalTrades,
    breakdown,
    totalDeducted,
  };
}
