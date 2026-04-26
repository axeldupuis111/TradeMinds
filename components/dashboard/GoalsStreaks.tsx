"use client";

import { useLanguage } from "@/lib/LanguageContext";
import { createClient } from "@/lib/supabase/client";
import { useEffect, useState } from "react";

interface Achievement {
  id: string;
  key: string;
  unlocked_at: string;
}

interface Review {
  created_at: string;
  discipline_score: number;
  analysis: {
    violations: unknown[];
  };
}

const BADGE_DEFS: { key: string; labelKey: string; emoji: string; check: (ctx: BadgeContext) => boolean }[] = [
  { key: "discipline_3", labelKey: "badge_discipline_3", emoji: "\u{1F525}", check: (c) => c.streak >= 3 },
  { key: "discipline_10", labelKey: "badge_discipline_10", emoji: "\u{1F3C6}", check: (c) => c.streak >= 10 },
  { key: "discipline_30", labelKey: "badge_discipline_30", emoji: "\u{1F48E}", check: (c) => c.streak >= 30 },
  { key: "winrate_60", labelKey: "badge_winrate_60", emoji: "\u{1F3AF}", check: (c) => c.totalTrades >= 50 && c.winrate >= 60 },
  { key: "score_80_month", labelKey: "badge_score_80", emoji: "\u{2B50}", check: (c) => c.avgScore >= 80 && c.reviewCount >= 4 },
];

interface BadgeContext {
  streak: number;
  totalTrades: number;
  winrate: number;
  avgScore: number;
  reviewCount: number;
}

export default function GoalsStreaks() {
  const { t } = useLanguage();
  const supabase = createClient();
  const [streak, setStreak] = useState(0);
  const [achievements, setAchievements] = useState<Achievement[]>([]);
  const [weeklyProgress, setWeeklyProgress] = useState({ current: 0, target: 0, met: true });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    load();
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  async function load() {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) { setLoading(false); return; }

    const [{ data: reviews }, { data: achData }, { data: trades }] = await Promise.all([
      supabase
        .from("session_reviews")
        .select("created_at, discipline_score, analysis")
        .eq("user_id", user.id)
        .order("created_at", { ascending: false })
        .limit(60),
      supabase
        .from("achievements")
        .select("id, key, unlocked_at")
        .eq("user_id", user.id),
      supabase
        .from("trades")
        .select("pnl, commission, swap, emotion, open_time")
        .eq("user_id", user.id),
    ]);

    setAchievements(achData || []);

    // Calculate streak (consecutive reviews with 0 violations)
    const reviewList = (reviews || []) as Review[];
    let streakCount = 0;
    const seenDays = new Set<string>();
    for (const r of reviewList) {
      const day = r.created_at.split("T")[0];
      if (seenDays.has(day)) continue;
      seenDays.add(day);
      if (!r.analysis?.violations || r.analysis.violations.length === 0) {
        streakCount++;
      } else {
        break;
      }
    }
    setStreak(streakCount);

    // Weekly goal: count revenge trades this week
    const monday = getMonday(new Date()).toISOString().split("T")[0];
    const weekTrades = (trades || []).filter((t) => t.open_time && t.open_time >= monday);
    const revengeCount = weekTrades.filter((t) => t.emotion === "revenge").length;
    setWeeklyProgress({ current: revengeCount, target: 0, met: revengeCount === 0 });

    // Check and award new badges
    const allTrades = trades || [];
    const netPnls = allTrades.map((t) => t.pnl + (t.commission || 0) + (t.swap || 0));
    const wins = netPnls.filter((p) => p > 0).length;
    const winrate = allTrades.length > 0 ? (wins / allTrades.length) * 100 : 0;
    const recentScores = reviewList.slice(0, 4).map((r) => r.discipline_score);
    const avgScore = recentScores.length > 0 ? recentScores.reduce((a, b) => a + b, 0) / recentScores.length : 0;

    const ctx: BadgeContext = {
      streak: streakCount,
      totalTrades: allTrades.length,
      winrate,
      avgScore,
      reviewCount: recentScores.length,
    };

    const existing = new Set((achData || []).map((a) => a.key));
    for (const badge of BADGE_DEFS) {
      if (!existing.has(badge.key) && badge.check(ctx)) {
        await supabase.from("achievements").insert({
          user_id: user.id,
          key: badge.key,
          unlocked_at: new Date().toISOString(),
        });
        existing.add(badge.key);
      }
    }

    // Reload achievements if new ones were awarded
    if (existing.size > (achData || []).length) {
      const { data: updated } = await supabase
        .from("achievements")
        .select("id, key, unlocked_at")
        .eq("user_id", user.id);
      setAchievements(updated || []);
    }

    setLoading(false);
  }

  if (loading) {
    return <div className="skeleton h-40 rounded-xl" />;
  }

  const unlockedKeys = new Set(achievements.map((a) => a.key));

  return (
    <section className="bg-card border border-border rounded-xl p-5">
      <h2 className="text-sm font-semibold text-foreground mb-4">{t("goals_title")}</h2>

      {/* Streak */}
      <div className="flex items-center gap-3 mb-4">
        {streak > 0 && <span className="text-3xl">🔥</span>}
        <div>
          <p className="text-foreground font-bold text-lg">
            {streak > 0 ? `${streak} ${t("goals_streak_days")}` : "—"}
          </p>
          <p className="text-muted text-xs">{t("goals_streak_desc")}</p>
        </div>
      </div>

      {/* Weekly goal */}
      <div className="mb-4 p-3 rounded-lg bg-background border border-border">
        <div className="flex items-center justify-between mb-2">
          <p className="text-sm text-foreground font-medium">{t("goals_weekly")}</p>
          <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${weeklyProgress.met ? "bg-profit/10 text-profit" : "bg-loss/10 text-loss"}`}>
            {weeklyProgress.met ? t("goals_on_track") : `${weeklyProgress.current} ${weeklyProgress.current === 1 ? t("goals_violation_one") : t("goals_violations")}`}
          </span>
        </div>
        <p className="text-xs text-muted">{t("goals_weekly_desc")}</p>
        <div className="h-1.5 bg-border rounded-full mt-2 overflow-hidden">
          <div
            className={`h-full rounded-full transition-all ${weeklyProgress.met ? "bg-profit" : "bg-loss"}`}
            style={{ width: weeklyProgress.met ? "100%" : `${Math.max(10, 100 - weeklyProgress.current * 25)}%` }}
          />
        </div>
      </div>

      {/* Badges */}
      <div>
        <p className="text-sm text-muted mb-2">{t("goals_badges")}</p>
        <div className="flex flex-wrap gap-2">
          {BADGE_DEFS.map((badge) => {
            const unlocked = unlockedKeys.has(badge.key);
            return (
              <div
                key={badge.key}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs border ${
                  unlocked
                    ? "bg-accent/10 border-accent/30 text-accent"
                    : "bg-background border-border text-muted opacity-50"
                }`}
                title={t(badge.labelKey)}
              >
                <span>{badge.emoji}</span>
                <span>{t(badge.labelKey)}</span>
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
}

function getMonday(d: Date): Date {
  const day = d.getDay();
  const diff = d.getDate() - day + (day === 0 ? -6 : 1);
  const monday = new Date(d);
  monday.setDate(diff);
  monday.setHours(0, 0, 0, 0);
  return monday;
}
