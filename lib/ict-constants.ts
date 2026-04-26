import type { Lang } from "./translations";

type LabelMap = Record<Lang, string>;

export const ICT_SETUPS: { value: string; label: LabelMap }[] = [
  { value: "unicorn_model", label: { fr: "Unicorn Model", en: "Unicorn Model", de: "Unicorn Model", es: "Unicorn Model" } },
  { value: "judas_swing", label: { fr: "Judas Swing", en: "Judas Swing", de: "Judas Swing", es: "Judas Swing" } },
  { value: "turtle_soup", label: { fr: "Turtle Soup", en: "Turtle Soup", de: "Turtle Soup", es: "Turtle Soup" } },
  { value: "silver_bullet", label: { fr: "Silver Bullet", en: "Silver Bullet", de: "Silver Bullet", es: "Silver Bullet" } },
  { value: "ote_entry", label: { fr: "OTE Entry", en: "OTE Entry", de: "OTE Entry", es: "OTE Entry" } },
  { value: "fvg_entry", label: { fr: "FVG Entry", en: "FVG Entry", de: "FVG Entry", es: "FVG Entry" } },
  { value: "ob_rejection", label: { fr: "OB Rejection", en: "OB Rejection", de: "OB Rejection", es: "OB Rejection" } },
  { value: "breaker_block", label: { fr: "Breaker Block", en: "Breaker Block", de: "Breaker Block", es: "Breaker Block" } },
  { value: "mitigation_block", label: { fr: "Mitigation Block", en: "Mitigation Block", de: "Mitigation Block", es: "Mitigation Block" } },
  { value: "liquidity_sweep_entry", label: { fr: "Liquidity Sweep Entry", en: "Liquidity Sweep Entry", de: "Liquidity Sweep Entry", es: "Liquidity Sweep Entry" } },
  { value: "market_structure_shift", label: { fr: "Market Structure Shift (MSS)", en: "Market Structure Shift (MSS)", de: "Market Structure Shift (MSS)", es: "Market Structure Shift (MSS)" } },
  { value: "change_of_character", label: { fr: "Change of Character (ChoCh)", en: "Change of Character (ChoCh)", de: "Change of Character (ChoCh)", es: "Change of Character (ChoCh)" } },
  { value: "other", label: { fr: "Autre", en: "Other", de: "Andere", es: "Otro" } },
];

export const ICT_ENTRY_ZONES: { value: string; label: LabelMap }[] = [
  { value: "order_block", label: { fr: "Order Block (OB)", en: "Order Block (OB)", de: "Order Block (OB)", es: "Order Block (OB)" } },
  { value: "fvg", label: { fr: "Fair Value Gap (FVG)", en: "Fair Value Gap (FVG)", de: "Fair Value Gap (FVG)", es: "Fair Value Gap (FVG)" } },
  { value: "breaker", label: { fr: "Breaker Block", en: "Breaker Block", de: "Breaker Block", es: "Breaker Block" } },
  { value: "mitigation", label: { fr: "Mitigation Block", en: "Mitigation Block", de: "Mitigation Block", es: "Mitigation Block" } },
  { value: "ote_zone", label: { fr: "Zone OTE (0.618-0.786)", en: "OTE Zone (0.618-0.786)", de: "OTE Zone (0.618-0.786)", es: "Zona OTE (0.618-0.786)" } },
  { value: "premium_zone", label: { fr: "Zone Premium", en: "Premium Zone", de: "Premium Zone", es: "Zona Premium" } },
  { value: "discount_zone", label: { fr: "Zone Discount", en: "Discount Zone", de: "Discount Zone", es: "Zona Discount" } },
  { value: "equilibrium", label: { fr: "Equilibrium (50%)", en: "Equilibrium (50%)", de: "Equilibrium (50%)", es: "Equilibrio (50%)" } },
  { value: "none", label: { fr: "Aucune zone ICT", en: "No ICT zone", de: "Keine ICT Zone", es: "Sin zona ICT" } },
];

export const ICT_LIQUIDITY_TARGETS: { value: string; label: LabelMap }[] = [
  { value: "bsl", label: { fr: "Buy Side Liquidity (BSL)", en: "Buy Side Liquidity (BSL)", de: "Buy Side Liquidity (BSL)", es: "Buy Side Liquidity (BSL)" } },
  { value: "ssl", label: { fr: "Sell Side Liquidity (SSL)", en: "Sell Side Liquidity (SSL)", de: "Sell Side Liquidity (SSL)", es: "Sell Side Liquidity (SSL)" } },
  { value: "equal_highs", label: { fr: "Equal Highs (EQH)", en: "Equal Highs (EQH)", de: "Equal Highs (EQH)", es: "Equal Highs (EQH)" } },
  { value: "equal_lows", label: { fr: "Equal Lows (EQL)", en: "Equal Lows (EQL)", de: "Equal Lows (EQL)", es: "Equal Lows (EQL)" } },
  { value: "old_high", label: { fr: "Ancien High", en: "Old High", de: "Altes Hoch", es: "Máximo anterior" } },
  { value: "old_low", label: { fr: "Ancien Low", en: "Old Low", de: "Altes Tief", es: "Mínimo anterior" } },
  { value: "none", label: { fr: "Non identifiée", en: "Not identified", de: "Nicht identifiziert", es: "No identificada" } },
];

export const ICT_KILLZONES: { value: string; label: LabelMap }[] = [
  { value: "asia", label: { fr: "Asia (00h-08h)", en: "Asia (00:00-08:00)", de: "Asien (00:00-08:00)", es: "Asia (00:00-08:00)" } },
  { value: "london_open", label: { fr: "London Open (08h-12h)", en: "London Open (08:00-12:00)", de: "London Open (08:00-12:00)", es: "London Open (08:00-12:00)" } },
  { value: "ny_am", label: { fr: "New York AM (13h-16h)", en: "New York AM (13:00-16:00)", de: "New York AM (13:00-16:00)", es: "New York AM (13:00-16:00)" } },
  { value: "ny_pm", label: { fr: "New York PM (16h-20h)", en: "New York PM (16:00-20:00)", de: "New York PM (16:00-20:00)", es: "New York PM (16:00-20:00)" } },
  { value: "london_close", label: { fr: "London Close (16h-17h)", en: "London Close (16:00-17:00)", de: "London Close (16:00-17:00)", es: "London Close (16:00-17:00)" } },
  { value: "off_session", label: { fr: "Hors session", en: "Off session", de: "Außerhalb der Sitzung", es: "Fuera de sesión" } },
];

export const ICT_TIMEFRAMES: { value: string; label: string }[] = [
  { value: "M1", label: "M1" },
  { value: "M5", label: "M5" },
  { value: "M15", label: "M15" },
  { value: "M30", label: "M30" },
  { value: "H1", label: "H1" },
  { value: "H4", label: "H4" },
  { value: "D1", label: "D1" },
];

export const ICT_EMOTIONS: { value: string; label: LabelMap; category: "positive" | "negative" | "warning" | "neutral" }[] = [
  { value: "confident", label: { fr: "Confiant", en: "Confident", de: "Selbstbewusst", es: "Confiado" }, category: "positive" },
  { value: "calm", label: { fr: "Calme", en: "Calm", de: "Ruhig", es: "Tranquilo" }, category: "positive" },
  { value: "fomo", label: { fr: "FOMO", en: "FOMO", de: "FOMO", es: "FOMO" }, category: "negative" },
  { value: "revenge", label: { fr: "Revenge trading", en: "Revenge trading", de: "Rachhandel", es: "Trading de venganza" }, category: "negative" },
  { value: "anxious", label: { fr: "Anxieux", en: "Anxious", de: "Ängstlich", es: "Ansioso" }, category: "warning" },
  { value: "frustrated", label: { fr: "Frustré", en: "Frustrated", de: "Frustriert", es: "Frustrado" }, category: "warning" },
  { value: "greedy", label: { fr: "Cupide", en: "Greedy", de: "Gierig", es: "Codicioso" }, category: "negative" },
  { value: "hesitant", label: { fr: "Hésitant", en: "Hesitant", de: "Zögerlich", es: "Indeciso" }, category: "warning" },
  { value: "overconfident", label: { fr: "Surconfiant", en: "Overconfident", de: "Übermütig", es: "Exceso de confianza" }, category: "negative" },
  { value: "neutral", label: { fr: "Neutre", en: "Neutral", de: "Neutral", es: "Neutral" }, category: "neutral" },
];

export const EMOTION_COLORS: Record<string, string> = {
  positive: "#22c55e",
  negative: "#ef4444",
  warning: "#f59e0b",
  neutral: "#6b7280",
};

export const ICT_CHECKLIST_ITEMS: { key: string; label: LabelMap }[] = [
  { key: "bias_identified", label: { fr: "Bias H4/Daily identifié", en: "H4/Daily bias identified", de: "H4/Daily Bias identifiziert", es: "Sesgo H4/Daily identificado" } },
  { key: "liquidity_taken", label: { fr: "Liquidité prise (sweep confirmé)", en: "Liquidity taken (sweep confirmed)", de: "Liquidität genommen (Sweep bestätigt)", es: "Liquidez tomada (barrido confirmado)" } },
  { key: "poi_identified", label: { fr: "POI identifié (OB/FVG/Breaker)", en: "POI identified (OB/FVG/Breaker)", de: "POI identifiziert (OB/FVG/Breaker)", es: "POI identificado (OB/FVG/Breaker)" } },
  { key: "killzone_active", label: { fr: "Killzone active", en: "Killzone active", de: "Killzone aktiv", es: "Killzone activa" } },
  { key: "structure_confirmed", label: { fr: "Structure confirmée (MSS/ChoCh)", en: "Structure confirmed (MSS/ChoCh)", de: "Struktur bestätigt (MSS/ChoCh)", es: "Estructura confirmada (MSS/ChoCh)" } },
  { key: "rr_minimum", label: { fr: "RR minimum 1:2 respecté", en: "Minimum 1:2 RR respected", de: "Minimum 1:2 RR eingehalten", es: "RR mínimo 1:2 respetado" } },
  { key: "risk_managed", label: { fr: "Risque max respecté (1-2% du capital)", en: "Max risk respected (1-2% of capital)", de: "Max Risiko eingehalten (1-2% des Kapitals)", es: "Riesgo máximo respetado (1-2% del capital)" } },
];

export function detectKillzone(openTime: string): string {
  if (!openTime) return "";
  const date = new Date(openTime);
  const hour = date.getUTCHours() + 2; // UTC+2
  const h = ((hour % 24) + 24) % 24;
  if (h >= 0 && h < 8) return "asia";
  if (h >= 8 && h < 12) return "london_open";
  if (h >= 13 && h < 16) return "ny_am";
  if (h >= 16 && h < 20) return "ny_pm";
  return "off_session";
}

export function getEmotionCategory(emotionValue: string): keyof typeof EMOTION_COLORS {
  const e = ICT_EMOTIONS.find((x) => x.value === emotionValue);
  return (e?.category as keyof typeof EMOTION_COLORS) ?? "neutral";
}

export function getEmotionColor(emotionValue: string): string {
  const cat = getEmotionCategory(emotionValue);
  return EMOTION_COLORS[cat];
}
