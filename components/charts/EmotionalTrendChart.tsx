"use client";

import { Card, CardTitle } from "@/components/ui/Card";
import { DEFAULT_CURRENCY, money } from "@/lib/account-currency";
import { useChartColors } from "@/lib/useChartColors";
import { useLanguage } from "@/lib/LanguageContext";
import { createClient } from "@/lib/supabase/client";
import { useEffect, useState } from "react";
import { Brain } from "lucide-react";
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

export default function EmotionalTrendChart({
  currency = DEFAULT_CURRENCY,
}: {
  /** Devise du compte filtré ; euro sur une vue multi-comptes. */
  currency?: string;
} = {}) {
  const { t } = useLanguage();
  const c = useChartColors();
  const supabase = createClient();
  const [data, setData] = useState<DataPoint[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function load() {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) { setLoading(false); return; }

      const since = new Date(Date.now() - 90 * 24 * 60 * 60 * 1000).toISOString();

      const [{ data: sessions }, { data: trades }] = await Promise.all([
        supabase
          .from("sessions")
          .select("created_at, emotion_before")
          .eq("user_id", user.id)
          .gte("created_at", since)
          .order("created_at", { ascending: true }),
        supabase
          .from("trades")
          .select("open_time, pnl, commission, swap, emotion")
          .eq("user_id", user.id)
          .gte("open_time", since),
      ]);

      const pnlByDay: Record<string, number> = {};
      for (const tr of trades || []) {
        const day = (tr.open_time || "").split("T")[0];
        if (!day) continue;
        pnlByDay[day] = (pnlByDay[day] || 0) + (tr.pnl || 0) + (tr.commission || 0) + (tr.swap || 0);
      }

      // Pass 1 — sessions (emotion_before)
      const emotionByDay: Record<string, string> = {};
      for (const s of sessions || []) {
        if (!s.emotion_before) continue;
        const day = s.created_at.split("T")[0];
        emotionByDay[day] = s.emotion_before;
      }
      // Pass 2 — trades.emotion (priority: last trade of day wins)
      for (const tr of trades || []) {
        if (!tr.emotion) continue;
        const day = (tr.open_time || "").split("T")[0];
        if (!day) continue;
        emotionByDay[day] = tr.emotion;
      }

      const allDays = new Set([...Object.keys(pnlByDay), ...Object.keys(emotionByDay)]);
      const allPoints: DataPoint[] = Array.from(allDays)
        .sort()
        .map((date) => ({
          date,
          emotionScore: emotionByDay[date] != null ? (EMOTION_SCORE[emotionByDay[date]] ?? 3) : null,
          emotionKey: emotionByDay[date] || null,
          pnl: pnlByDay[date] ?? null,
        }));

      // Trim to trade date range — sessions before first trade or after last trade are excluded.
      // This removes visual "empty space" caused by emotion-only sessions outside the trading window.
      const tradeDates   = Object.keys(pnlByDay).sort();
      const firstTradeDay = tradeDates[0] ?? null;
      const lastTradeDay  = tradeDates[tradeDates.length - 1] ?? null;
      const points = firstTradeDay && lastTradeDay
        ? allPoints.filter((p) => p.date >= firstTradeDay && p.date <= lastTradeDay)
        : allPoints;

      setData(points);
      setLoading(false);
    }
    load();
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  if (loading) {
    return (
      <Card padding="md">
        <div className="skeleton h-4 w-40 mb-2" />
        <div className="skeleton h-48 w-full rounded-lg" />
      </Card>
    );
  }

  const tradesWithEmotion = data.filter((d) => d.emotionScore != null).length;
  const hasEmotions = tradesWithEmotion > 0;
  const EMOTION_THRESHOLD = 8;

  if (!hasEmotions || tradesWithEmotion < EMOTION_THRESHOLD) {
    const remaining = EMOTION_THRESHOLD - tradesWithEmotion;
    return (
      <Card padding="md">
        <div className="mb-4">
          <CardTitle>{t("emotional_trend_title")}</CardTitle>
          <p className="text-xs text-foreground-muted mt-1">{t("emotional_trend_subtitle")}</p>
        </div>
        <div className="flex flex-col items-center justify-center py-12 px-6 text-center">
          <Brain className="w-12 h-12 text-foreground-muted opacity-30 mb-4" />
          <p className="text-sm font-medium text-foreground mb-2">
            {t("emotional_empty_title")}
          </p>
          <p className="text-xs text-foreground-muted max-w-md">
            {t("emotional_empty_desc").replace("{n}", String(remaining))}
          </p>
          <p className="text-xs text-foreground-muted mt-1">
            {t("emotional_progress").replace("{done}", String(tradesWithEmotion)).replace("{total}", String(EMOTION_THRESHOLD))}
          </p>
        </div>
      </Card>
    );
  }

  const tooltipStyle: React.CSSProperties = {
    backgroundColor: c.tooltipBg    || "rgb(var(--card))",
    border:          `1px solid ${c.tooltipBorder || "rgb(var(--border))"}`,
    borderRadius:    8,
    padding:         "8px 12px",
    fontSize:        12,
  };

  return (
    <Card padding="md">
      <div className="mb-4">
        <CardTitle>{t("emotional_trend_title")}</CardTitle>
        <p className="text-xs text-foreground-muted mt-1">{t("emotional_trend_subtitle")}</p>
      </div>
      <ResponsiveContainer width="100%" height={200}>
        <LineChart data={data} margin={{ top: 5, right: 10, left: -20, bottom: 5 }}>
          <CartesianGrid strokeDasharray="3 3" stroke={c.grid} vertical={false} strokeOpacity={0.5} />
          <XAxis
            dataKey="date"
            tick={{ fontSize: 10, fill: c.axis }}
            tickLine={false}
            axisLine={{ stroke: c.axisLine }}
            tickFormatter={(v: string) => v.slice(5)}
          />
          <YAxis
            yAxisId="emotion"
            domain={[0, 5]}
            tick={{ fontSize: 10, fill: c.axis }}
            tickLine={false}
            axisLine={{ stroke: c.axisLine }}
            tickFormatter={(v: number) => ["", "\u{1F621}", "\u{1F624}", "", "\u{1F610}", "\u{1F60E}"][v] || ""}
          />
          <YAxis
            yAxisId="pnl"
            orientation="right"
            tick={{ fontSize: 10, fill: c.axis }}
            tickLine={false}
            axisLine={{ stroke: c.axisLine }}
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
                <div style={tooltipStyle}>
                  <p style={{ fontWeight: 600, marginBottom: 4, color: c.tooltipText || "inherit" }}>
                    {new Date(label as string).toLocaleDateString(undefined, { day: "numeric", month: "short" })}
                  </p>
                  {emotionEntry?.value != null && (
                    <p style={{ color: c.accent }}>{emoji} Emotion: {String(emotionEntry.value)}/5</p>
                  )}
                  {pnlEntry?.value != null && (
                    <p style={{ color: Number(pnlEntry.value) >= 0 ? c.profit : c.loss }}>
                      P&L: {money(Number(pnlEntry.value), currency, { digits: 2, signed: true })}
                    </p>
                  )}
                </div>
              );
            }}
          />
          {/* Emotion trend line — accent color */}
          <Line
            yAxisId="emotion"
            type="monotone"
            dataKey="emotionScore"
            stroke={c.accent || "rgb(var(--accent))"}
            strokeWidth={2}
            dot={{ r: 3, fill: c.accent || "rgb(var(--accent))", strokeWidth: 0 }}
            connectNulls
          />
          {/* P&L trend line — profit color, dashed */}
          <Line
            yAxisId="pnl"
            type="monotone"
            dataKey="pnl"
            stroke={c.profit || "rgb(var(--profit))"}
            strokeWidth={1.5}
            strokeDasharray="5 5"
            dot={false}
            connectNulls
          />
        </LineChart>
      </ResponsiveContainer>

      {/* Legend — using token colors via inline style */}
      <div className="flex items-center gap-4 mt-2 text-xs text-foreground-muted">
        <span className="flex items-center gap-1.5">
          <span
            className="inline-block w-3 h-0.5 rounded"
            style={{ backgroundColor: c.accent || "rgb(var(--accent))" }}
          />
          Emotion
        </span>
        <span className="flex items-center gap-1.5">
          <span
            className="inline-block w-3 rounded"
            style={{
              height: 1,
              backgroundColor: c.profit || "rgb(var(--profit))",
              borderTop: `1px dashed ${c.profit || "rgb(var(--profit))"}`,
            }}
          />
          P&L
        </span>
      </div>
    </Card>
  );
}
