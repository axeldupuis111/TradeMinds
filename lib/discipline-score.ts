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
  missing_setup_tag: { perOccurrence: 1 },
};

/**
 * LA CATEGORIE D'UNE VIOLATION SE DEDUIT DE SON TYPE.
 *
 * ⚠️⚠️ ELLE ETAIT RECOPIEE DEPUIS LA SORTIE DU MODELE, telle quelle. Le
 * champ `category` arrivait de `/api/analyze` sans aucune normalisation, alors
 * que ses voisins (`trade_ids`, `occurrences`, `explanation`) en avaient tous
 * une : une regle ecrite pour quatre champs, appliquee a trois.
 *
 * ⚠️ ET LA CONSEQUENCE ETAIT UN PLANTAGE, pas un affichage de travers :
 * `categoryPenalties[v.category].push(...)` sur une categorie inconnue lit
 * `undefined.push`, donc leve. C'est un 500 sur la route PAYANTE, et le credit
 * est deja consomme quand il survient (incident du 2026-08-03, meme route).
 * Le cas le plus probable n'est meme pas une hallucination : l'orthographe
 * britannique « behaviour » suffit, dans un prompt majoritairement francais.
 *
 * Le modele n'a plus a se prononcer : le type suffit a dire la categorie, et
 * c'est le prompt qui les lie. Une table ici, et le type fait foi.
 */
export const CATEGORIE_DE_VIOLATION: Record<ViolationType, "strategy" | "behavior" | "execution"> = {
  wrong_pair: "strategy",
  wrong_session: "strategy",
  low_rr: "strategy",
  sl_too_wide: "strategy",
  max_trades_day: "strategy",
  max_daily_loss: "strategy",
  consecutive_losses: "strategy",
  revenge_trading: "behavior",
  overtrading: "behavior",
  lot_increase_after_loss: "behavior",
  fomo: "behavior",
  missing_sl: "execution",
  missing_tp: "execution",
  missing_setup_tag: "execution",
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
    // ⚠️ LA CATEGORIE VIENT DU TYPE, jamais de ce que l'appelant a transmis :
    // voir CATEGORIE_DE_VIOLATION. Indexer avec une cle non validee levait.
    const categorie = CATEGORIE_DE_VIOLATION[v.type];
    const points = penalty.perOccurrence * v.occurrences;
    categoryPenalties[categorie].push({
      type: v.type,
      category: categorie,
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
