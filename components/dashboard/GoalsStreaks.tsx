"use client";

import ConfettiBurst from "@/components/animations/ConfettiBurst";
import { useLanguage } from "@/lib/LanguageContext";
import { createClient } from "@/lib/supabase/client";
import { useEffect, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { Flame, Trophy, Gem, Target, Star, Lock, PartyPopper, Crown, type LucideIcon } from "lucide-react";
import { KpiCardPremium } from "@/components/dashboard/KpiCardPremium";
import { computeDisciplineStreaks } from "@/lib/discipline-streak";

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

const BADGE_DEFS: { key: string; labelKey: string; icon: LucideIcon; condition: string; check: (ctx: BadgeContext) => boolean }[] = [
  { key: "discipline_3",  labelKey: "badge_discipline_3",  icon: Flame,  condition: "badge_cond_discipline_3",               check: (c) => c.streak >= 3 },
  { key: "discipline_10", labelKey: "badge_discipline_10", icon: Trophy, condition: "badge_cond_discipline_10",              check: (c) => c.streak >= 10 },
  { key: "discipline_30", labelKey: "badge_discipline_30", icon: Gem,    condition: "badge_cond_discipline_30",              check: (c) => c.streak >= 30 },
  { key: "winrate_60",    labelKey: "badge_winrate_60",    icon: Target, condition: "badge_cond_winrate_60",                    check: (c) => c.totalTrades >= 50 && c.winrate >= 60 },
  { key: "score_80_month",labelKey: "badge_score_80",      icon: Star,   condition: "badge_cond_score_80", check: (c) => c.avgScore >= 80 && c.reviewCount >= 4 },
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
  const [record, setRecord] = useState(0);
  const [isRecord, setIsRecord] = useState(false);
  const [achievements, setAchievements] = useState<Achievement[]>([]);
  const [weeklyProgress, setWeeklyProgress] = useState({ current: 0, target: 0, met: true });
  const [loading, setLoading] = useState(true);
  // Badge fraîchement débloqué dans cette session → confettis + bannière
  const [celebrating, setCelebrating] = useState<string | null>(null);
  const [showConfetti, setShowConfetti] = useState(false);

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

    const reviewList = (reviews || []) as Review[];

    // Discipline streak — consecutive distinct TRADING DAYS (most recent first)
    // with no revenge/FOMO trade. Days with no trades are skipped, so weekends
    // and trading breaks never reset the streak (markets are closed anyway).
    const dayHasEmotionalTrade = new Map<string, boolean>();
    for (const tr of trades || []) {
      if (!tr.open_time) continue;
      const day = tr.open_time.split("T")[0];
      const bad = tr.emotion === "revenge" || tr.emotion === "fomo";
      dayHasEmotionalTrade.set(day, (dayHasEmotionalTrade.get(day) ?? false) || bad);
    }
    const streaks = computeDisciplineStreaks(
      Array.from(dayHasEmotionalTrade.entries()).map(([day, emotional]) => ({ day, emotional })),
    );
    const streakCount = streaks.current;
    setStreak(streaks.current);
    setRecord(streaks.record);
    setIsRecord(streaks.isRecord);

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
    const freshlyUnlocked: string[] = [];
    for (const badge of BADGE_DEFS) {
      if (!existing.has(badge.key) && badge.check(ctx)) {
        await supabase.from("achievements").insert({
          user_id: user.id,
          key: badge.key,
          unlocked_at: new Date().toISOString(),
        });
        existing.add(badge.key);
        freshlyUnlocked.push(badge.key);
      }
    }

    // Célébration : confettis + bannière pour le badge tout juste débloqué
    if (freshlyUnlocked.length > 0) {
      setCelebrating(freshlyUnlocked[freshlyUnlocked.length - 1]);
      setShowConfetti(true);
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
  const latestUnlocked = achievements.length > 0
    ? achievements.reduce((a, b) => a.unlocked_at > b.unlocked_at ? a : b).key
    : null;

  // Prochain palier de streak (3 → 10 → 30) pour la barre de progression
  const nextMilestone = streak < 3 ? 3 : streak < 10 ? 10 : streak < 30 ? 30 : null;
  const prevMilestone = streak < 3 ? 0 : streak < 10 ? 3 : streak < 30 ? 10 : 30;
  const milestonePct = nextMilestone
    ? Math.min(100, ((streak - prevMilestone) / (nextMilestone - prevMilestone)) * 100)
    : 100;
  const celebratedBadge = celebrating ? BADGE_DEFS.find((b) => b.key === celebrating) : null;

  return (
    <KpiCardPremium layout="full" intensity="default" accentColor="amber">
      {showConfetti && <ConfettiBurst onDone={() => setShowConfetti(false)} />}

      {/* Bannière badge débloqué */}
      <AnimatePresence>
        {celebratedBadge && (
          <motion.div
            initial={{ opacity: 0, y: -8, scale: 0.97 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -8 }}
            className="flex items-center gap-3 px-4 py-3 mb-4 rounded-xl border border-accent/40 bg-accent/10"
          >
            <PartyPopper className="w-5 h-5 text-accent shrink-0" strokeWidth={1.75} />
            <p className="text-sm text-foreground flex-1">
              <span className="font-bold text-accent">{t("badge_unlocked")}</span>{" "}
              {t(celebratedBadge.labelKey)}
            </p>
            <button
              onClick={() => setCelebrating(null)}
              className="text-foreground-muted hover:text-foreground transition-colors text-xs"
              aria-label="Fermer"
            >
              ✕
            </button>
          </motion.div>
        )}
      </AnimatePresence>

      <h2 className="text-sm font-semibold text-foreground mb-4">{t("goals_title")}</h2>

      {/* Streak + progression vers le prochain palier */}
      <div className="flex items-center gap-3 mb-2">
        {streak > 0 && <Flame className="w-7 h-7 text-warning shrink-0" strokeWidth={1.75} />}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <p className="text-foreground font-bold text-lg">
              {streak > 0 ? `${streak} ${t("goals_streak_days")}` : `0 ${t("goals_streak_days")}`}
            </p>
            {isRecord && streak >= 3 && (
              <span className="inline-flex items-center gap-1 text-[11px] font-semibold px-2 py-0.5 rounded-full bg-warning/15 text-warning">
                <Crown className="w-3 h-3" strokeWidth={2} />
                {t("goals_new_record")}
              </span>
            )}
          </div>
          <p className="text-muted text-xs">{t("goals_streak_desc")}</p>
        </div>
        {record > 0 && (
          <div className="text-right shrink-0">
            <p className="text-foreground font-bold text-lg tabular-nums">{record}</p>
            <p className="text-muted text-[11px] uppercase tracking-wider">{t("goals_record")}</p>
          </div>
        )}
      </div>
      {nextMilestone && (
        <div className="mb-4">
          <div className="flex items-center justify-between mb-1">
            <span className="text-[11px] text-foreground-muted">
              {t("goals_next_badge").replace("{n}", String(nextMilestone - streak))}
            </span>
            <span className="text-[11px] text-foreground-muted tabular-nums">{streak}/{nextMilestone}</span>
          </div>
          <div className="h-1.5 bg-border rounded-full overflow-hidden">
            <div
              className="h-full rounded-full bg-gradient-to-r from-accent to-warning transition-all duration-700"
              style={{ width: `${Math.max(3, milestonePct)}%` }}
            />
          </div>
        </div>
      )}

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
        <p className="text-sm text-muted mb-3">{t("goals_badges")}</p>
        <div className="flex flex-wrap gap-3">
          {BADGE_DEFS.map((badge) => {
            const unlocked = unlockedKeys.has(badge.key);
            const isLatest = unlocked && badge.key === latestUnlocked;
            return (
              <div
                key={badge.key}
                title={t(badge.condition)}
                className={`flex flex-col items-center gap-1.5 p-3 rounded-xl border transition-all ${
                  unlocked
                    ? isLatest
                      ? "bg-accent/10 border-accent/50 text-accent shadow-[0_0_12px_rgb(var(--accent)_/_0.3)]"
                      : "bg-accent/10 border-accent/30 text-accent"
                    : "bg-background border-border text-muted opacity-40"
                }`}
              >
                <div className="relative">
                  <badge.icon className="w-6 h-6" strokeWidth={1.75} />
                  {!unlocked && (
                    <Lock className="absolute -top-1 -right-1 w-3 h-3" strokeWidth={2} />
                  )}
                </div>
                <span className="text-sm text-center leading-tight max-w-[80px]">{t(badge.labelKey)}</span>
              </div>
            );
          })}
        </div>
      </div>
    </KpiCardPremium>
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
