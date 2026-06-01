export const EMOTION_EMOJIS: Record<string, string> = {
  confident: "😎",
  overconfident: "🤩",
  calm: "😌",
  neutral: "😐",
  anxious: "😰",
  fomo: "🤑",
  revenge: "😡",
  frustrated: "😤",
  cupide: "🤑",
  hesitant: "🤔",
  greedy: "🤑",
};

export const EMOTION_LABELS_FR: Record<string, string> = {
  confident: "Confiant",
  overconfident: "Surconfiant",
  calm: "Calme",
  neutral: "Neutre",
  anxious: "Anxieux",
  fomo: "FOMO",
  revenge: "Revenge",
  frustrated: "Frustré",
  cupide: "Cupide",
  hesitant: "Hésitant",
  greedy: "Cupide",
};

export function getEmotionDisplay(emotion: string | null): { emoji: string; label: string } | null {
  if (!emotion) return null;
  return {
    emoji: EMOTION_EMOJIS[emotion] ?? "❓",
    label: EMOTION_LABELS_FR[emotion] ?? emotion,
  };
}
