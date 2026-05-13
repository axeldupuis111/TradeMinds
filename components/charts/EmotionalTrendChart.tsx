"use client";

import { useLanguage } from "@/lib/LanguageContext";
import { createClient } from "@/lib/supabase/client";
import { useEffect, useState } from "react";
import {
  CartesianGrid,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

const EMOTION_SCORE: Record<string, number> = {
  confident: 5,
  neutral: 4,
  anxious: 2,
  frustrated: 1,
  fomo: 1,
  revenge: 0,
};

const EMOTION_EMOJI: Record<string, string> = {
  confident: "\u{1F60E}",
  neutral: "\u{1F610}",
  anxious: "\u{1F630}",
  frustrated: "\u{1F624}",
  fomo: "\u{1F911}",
  revenge: "\u{1F621}",
};

interface DataPoint {
  date: string;
  emotionScore: number | null;
  emotionKey: string | null;
  pnl: number | null;
}

export default function EmotionalTrendChart() {
  const { t } = useLanguage();
  const supabase = createClient();
  const [data, setData] = useState<DataPoint[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function load() {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) { setLoading(false); return; }

      const thirtyDaysAgo = new Date();
      thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
      const since = thirtyDaysAgo.toISOString().split("T")[0];

      const [{ data: sessions }, { data: trades }] = await Promise.all([
        supabase
          .from("sessions")
          .select("created_at, emotion_before")
          .eq("user_id", user.id)
          .gte("created_at", since)
          .order("created_at", { ascending: true }),
        supabase
          .from("trades")
          .select("open_time, pnl, commission, swap")
          .eq("user_id", user.id)
          .gte("open_time", since),
      ]);

      const pnlByDay: Record<string, number> = {};
      for (const tr of trades || []) {
        const day = (tr.open_time || "").split("T")[0];
        if (!day) continue;
        pnlByDay[day] = (pnlByDay[day] || 0) + (tr.pnl || 0) + (tr.commission || 0) + (tr.swap || 0);
      }

      const emotionByDay: Record<string, string> = {};
      for (const s of sessions || []) {
        if (!s.emotion_before) continue;
        const day = s.created_at.split("T")[0];
        emotionByDay[day] = s.emotion_before;
      }

      const allDays = new Set([...Object.keys(pnlByDay), ...Object.keys(emotionByDay)]);
      const points: DataPoint[] = Array.from(allDays)
        .sort()
        .map((date) => ({
          date,
          emotionScore: emotionByDay[date] != null ? (EMOTION_SCORE[emotionByDay[date]] ?? 3) : null,
          emotionKey: emotionByDay[date] || null,
          pnl: pnlByDay[date] ?? null,
        }));

      setData(points);
      setLoading(false);
    }
    load();
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  if (loading) {
    return (
      <div className="bg-card border border-border rounded-xl p-5">
        <div className="skeleton h-4 w-40 mb-2" />
        <div className="skeleton h-48 w-full rounded-lg" />
      </div>
    );
  }

  const hasEmotions = data.some((d) => d.emotionScore != null);
  if (!hasEmotions) {
    return (
      <div className="bg-card border border-border rounded-xl p-5">
        <h3 className="text-sm font-semibold text-foreground mb-1">{t("emotional_trend_title")}</h3>
        <p className="text-xs text-muted">{t("emotional_trend_no_data")}</p>
      </div>
    );
  }

  return (
    <div className="bg-card border border-border rounded-xl p-5">
      <h3 className="text-sm font-semibold text-foreground mb-1">{t("emotional_trend_title")}</h3>
      <p className="text-xs text-muted mb-4">{t("emotional_trend_subtitle")}</p>
      <ResponsiveContainer width="100%" height={200}>
        <LineChart data={data} margin={{ top: 5, right: 10, left: -20, bottom: 5 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border)" />
          <XAxis
            dataKey="date"
            tick={{ fontSize: 10, fill: "var(--color-muted)" }}
            tickFormatter={(v: string) => v.slice(5)}
          />
          <YAxis
            yAxisId="emotion"
            domain={[0, 5]}
            tick={{ fontSize: 10, fill: "var(--color-muted)" }}
            tickFormatter={(v: number) => ["", "\u{1F621}", "\u{1F624}", "", "\u{1F610}", "\u{1F60E}"][v] || ""}
          />
          <YAxis
            yAxisId="pnl"
            orientation="right"
            tick={{ fontSize: 10, fill: "var(--color-muted)" }}
            tickFormatter={(v: number) => `${v >= 0 ? "+" : ""}${v.toFixed(0)}`}
          />
          <Tooltip
            content={({ active, payload, label }) => {
              if (!active || !payload?.length) return null;
              const emotionEntry = payload.find((p) => p.dataKey === "emotionScore");
              const pnlEntry = payload.find((p) => p.dataKey === "pnl");
              const point = data.find((d) => d.date === label);
              const emoji = point?.emotionKey ? EMOTION_EMOJI[point.emotionKey] || "" : "";
              return (
                <div style={{ backgroundColor: "var(--color-card)", border: "1px solid var(--color-border)", borderRadius: 8, padding: "8px 12px", fontSize: 12 }}>
                  <p style={{ fontWeight: 600, marginBottom: 4 }}>{new Date(label as string).toLocaleDateString(undefined, { day: "numeric", month: "short" })}</p>
                  {emotionEntry?.value != null && <p>{emoji} Emotion: {String(emotionEntry.value)}/5</p>}
                  {pnlEntry?.value != null && <p style={{ color: Number(pnlEntry.value) >= 0 ? "#22c55e" : "#ef4444" }}>P&L: {Number(pnlEntry.value) >= 0 ? "+" : ""}{Number(pnlEntry.value).toFixed(2)}€</p>}
                </div>
              );
            }}
          />
          <Line
            yAxisId="emotion"
            type="monotone"
            dataKey="emotionScore"
            stroke="#3b82f6"
            strokeWidth={2}
            dot={{ r: 3 }}
            connectNulls
          />
          <Line
            yAxisId="pnl"
            type="monotone"
            dataKey="pnl"
            stroke="#22c55e"
            strokeWidth={1.5}
            strokeDasharray="5 5"
            dot={false}
            connectNulls
          />
        </LineChart>
      </ResponsiveContainer>
      <div className="flex items-center gap-4 mt-2 text-xs text-muted">
        <span className="flex items-center gap-1">
          <span className="w-3 h-0.5 bg-blue-500 inline-block" /> Emotion
        </span>
        <span className="flex items-center gap-1">
          <span className="w-3 h-0.5 bg-green-500 inline-block border-dashed" /> P&L
        </span>
      </div>
    </div>
  );
}
