import { getEmotionCategory } from "./ict-constants";

export interface TradeForScore {
  ict_setup?: string | null;
  ict_killzone?: string | null;
  ict_checklist?: Record<string, boolean> | null;
  emotion?: string | null;
  sl?: number | null;
  tp?: number | null;
  entry_price?: number | null;
  direction?: string | null;
}

export interface DisciplineSubScores {
  checklist: number;
  killzones: number;
  riskReward: number;
  emotions: number;
  setupTagged: number;
}

export interface DisciplineResult {
  score: number;
  subScores: DisciplineSubScores;
  taggedCount: number;
  insufficient: boolean;
}

const CHECKLIST_KEYS = [
  "bias_identified",
  "liquidity_taken",
  "poi_identified",
  "killzone_active",
  "structure_confirmed",
  "rr_minimum",
  "risk_managed",
];

function computeRR(trade: TradeForScore): number | null {
  const { entry_price, sl, tp, direction } = trade;
  if (!entry_price || !sl || !tp) return null;
  const risk = Math.abs(entry_price - sl);
  const reward = Math.abs(tp - entry_price);
  if (risk === 0) return null;
  // For long: tp > entry > sl; for short: tp < entry < sl
  if (direction === "long") {
    if (tp <= entry_price || sl >= entry_price) return null;
  } else {
    if (tp >= entry_price || sl <= entry_price) return null;
  }
  return reward / risk;
}

export function computeDisciplineScore(trades: TradeForScore[]): DisciplineResult {
  const tagged = trades.filter(
    (t) => t.ict_setup || t.ict_killzone || t.ict_checklist || t.emotion
  );

  if (tagged.length < 5) {
    return { score: 0, subScores: { checklist: 0, killzones: 0, riskReward: 0, emotions: 0, setupTagged: 0 }, taggedCount: tagged.length, insufficient: true };
  }

  // 1. Checklist score: avg of items checked per trade
  let totalChecked = 0;
  let checkedTrades = 0;
  for (const t of tagged) {
    if (t.ict_checklist && typeof t.ict_checklist === "object") {
      const checked = CHECKLIST_KEYS.filter((k) => t.ict_checklist![k]).length;
      totalChecked += checked;
      checkedTrades++;
    }
  }
  const checklistScore = checkedTrades > 0 ? (totalChecked / checkedTrades / 7) * 100 : 0;

  // 2. Killzone score: % trades during active killzone
  const withKillzone = tagged.filter((t) => t.ict_killzone);
  const inKillzone = withKillzone.filter((t) => t.ict_killzone !== "off_session").length;
  const killzoneScore = withKillzone.length > 0 ? (inKillzone / withKillzone.length) * 100 : 0;

  // 3. RR score: % of trades with RR >= 1:2
  const withRR = tagged.filter((t) => {
    const rr = computeRR(t);
    return rr !== null;
  });
  const goodRR = withRR.filter((t) => (computeRR(t) ?? 0) >= 2).length;
  const rrScore = withRR.length > 0 ? (goodRR / withRR.length) * 100 : 0;

  // 4. Emotion score: % with positive emotion (confident, calm, neutral)
  const withEmotion = tagged.filter((t) => t.emotion);
  const positiveEmotions = withEmotion.filter((t) => {
    const cat = getEmotionCategory(t.emotion!);
    return cat === "positive" || cat === "neutral";
  }).length;
  const emotionScore = withEmotion.length > 0 ? (positiveEmotions / withEmotion.length) * 100 : 0;

  // 5. Setup tagged score: % trades with a setup identified
  const setupTagged = tagged.filter((t) => t.ict_setup && t.ict_setup !== "").length;
  const setupScore = (setupTagged / tagged.length) * 100;

  const score = Math.round(
    checklistScore * 0.35 +
    killzoneScore * 0.20 +
    rrScore * 0.15 +
    emotionScore * 0.15 +
    setupScore * 0.15
  );

  return {
    score: Math.min(100, Math.max(0, score)),
    subScores: {
      checklist: Math.round(checklistScore),
      killzones: Math.round(killzoneScore),
      riskReward: Math.round(rrScore),
      emotions: Math.round(emotionScore),
      setupTagged: Math.round(setupScore),
    },
    taggedCount: tagged.length,
    insufficient: false,
  };
}
