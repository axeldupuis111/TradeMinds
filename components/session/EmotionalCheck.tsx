"use client";

import { useLanguage } from "@/lib/LanguageContext";
import { createClient } from "@/lib/supabase/client";
import { useState } from "react";

const EMOTIONS = [
  { key: "confident", emoji: "😎", risky: false },
  { key: "neutral", emoji: "😐", risky: false },
  { key: "anxious", emoji: "😰", risky: true },
  { key: "frustrated", emoji: "😤", risky: true },
  { key: "fomo", emoji: "🤑", risky: true },
  { key: "revenge", emoji: "😡", risky: true },
];

interface Props {
  sessionId: string;
  onFeedback: (feedback: { type: "warning" | "ok"; message: string }) => void;
}

export default function EmotionalCheck({ sessionId, onFeedback }: Props) {
  const { t } = useLanguage();
  const supabase = createClient();
  const [selected, setSelected] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  async function handleSelect(emotionKey: string) {
    if (saving) return;
    setSaving(true);
    setSelected(emotionKey);

    const { data: { user } } = await supabase.auth.getUser();
    if (user) {
      await supabase.from("session_emotional_checks").insert({
        user_id: user.id,
        session_id: sessionId,
        emotion: emotionKey,
      });
    }

    const em = EMOTIONS.find((e) => e.key === emotionKey);
    if (em?.risky) {
      onFeedback({ type: "warning", message: t("session_active_pause_recommended") });
    } else {
      onFeedback({ type: "ok", message: t("session_active_emotion_logged") });
    }

    setSaving(false);
    setTimeout(() => setSelected(null), 5000);
  }

  return (
    <section className="bg-card border border-border rounded-xl p-5">
      <h3 className="text-base font-semibold text-foreground mb-4">
        {t("session_active_emotional_check")}
      </h3>
      <div className="grid grid-cols-3 sm:grid-cols-6 gap-2">
        {EMOTIONS.map((em) => (
          <button
            key={em.key}
            onClick={() => handleSelect(em.key)}
            disabled={saving}
            className={`flex flex-col items-center gap-1 p-3 rounded-lg border transition-all ${
              selected === em.key
                ? "border-2 border-blue-500 bg-blue-500/10 scale-105"
                : "bg-background border-border hover:border-muted"
            } disabled:opacity-60`}
          >
            <span className="text-2xl">{em.emoji}</span>
            <span className="text-xs text-muted">{t(`emotion_${em.key}`)}</span>
          </button>
        ))}
      </div>
    </section>
  );
}
