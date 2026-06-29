"use client";

import { useLanguage } from "@/lib/LanguageContext";
import { ArrowUp, ArrowDown, Minus, Lock } from "lucide-react";
import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";
import CountUp from "@/components/animations/CountUp";
import GrowBar from "@/components/animations/GrowBar";
import ConfettiBurst from "@/components/animations/ConfettiBurst";

type Mode = "discipline" | "sessions" | "streak";

interface Entry {
  rank: number; username: string; score: number; sessions: number; streak: number;
  value: number; isMe: boolean; delta: number | null;
}
interface Self {
  score: number; sessions: number; streak: number;
  optedIn: boolean; hasUsername: boolean; ranked: boolean; rank: number | null; percentile: number | null;
}

const MODES: Mode[] = ["discipline", "sessions", "streak"];
const PERIODS = [7, 30, 90] as const;

function scoreColor(s: number): string {
  if (s >= 85) return "text-profit";
  if (s >= 70) return "text-green-400";
  if (s >= 50) return "text-warning";
  return "text-loss";
}
function tierOf(s: number): { key: string; emoji: string; cls: string } {
  if (s >= 85) return { key: "diamond", emoji: "💎", cls: "bg-cyan-500/10 text-cyan-300 border-cyan-400/30" };
  if (s >= 70) return { key: "gold", emoji: "🥇", cls: "bg-yellow-500/10 text-yellow-300 border-yellow-400/30" };
  if (s >= 50) return { key: "silver", emoji: "🥈", cls: "bg-slate-400/10 text-slate-300 border-slate-300/30" };
  return { key: "bronze", emoji: "🥉", cls: "bg-orange-700/10 text-orange-300 border-orange-500/30" };
}
// Progression vers le palier supérieur (bronze<50, argent<70, or<85, diamant 85+).
function tierProgress(s: number): { floor: number; next: number | null; nextKey: string | null; pct: number; bar: string } {
  if (s >= 85) return { floor: 85, next: null, nextKey: null, pct: 100, bar: "from-cyan-400 to-cyan-300" };
  if (s >= 70) return { floor: 70, next: 85, nextKey: "diamond", pct: ((s - 70) / 15) * 100, bar: "from-yellow-400 to-cyan-300" };
  if (s >= 50) return { floor: 50, next: 70, nextKey: "gold", pct: ((s - 50) / 20) * 100, bar: "from-slate-300 to-yellow-300" };
  return { floor: 0, next: 50, nextKey: "silver", pct: (s / 50) * 100, bar: "from-orange-400 to-slate-300" };
}

// Catalogue de badges évalués à partir des stats perso.
function badgesFor(s: Self): { key: string; emoji: string; earned: boolean }[] {
  return [
    { key: "first_session", emoji: "✅", earned: s.sessions >= 1 },
    { key: "regular", emoji: "📅", earned: s.sessions >= 20 },
    { key: "streak_7", emoji: "🔥", earned: s.streak >= 7 },
    { key: "streak_30", emoji: "⚡", earned: s.streak >= 30 },
    { key: "discipline_gold", emoji: "🏅", earned: s.score >= 85 && s.sessions >= 3 },
    { key: "top10", emoji: "🎯", earned: s.ranked && s.percentile != null && s.percentile <= 10 },
    { key: "podium", emoji: "🏆", earned: s.ranked && s.rank != null && s.rank <= 3 },
  ];
}

function Avatar({ name, isMe }: { name: string; isMe: boolean }) {
  return (
    <span className={`flex items-center justify-center w-8 h-8 rounded-full text-xs font-bold shrink-0 ${isMe ? "bg-accent text-white" : "bg-surface text-muted"}`}>
      {name.slice(0, 2).toUpperCase()}
    </span>
  );
}
function Delta({ d }: { d: number | null }) {
  if (d === null) return <span className="text-[10px] font-semibold text-accent">NEW</span>;
  if (d > 0) return <span className="inline-flex items-center text-[11px] text-profit"><ArrowUp className="w-3 h-3" />{d}</span>;
  if (d < 0) return <span className="inline-flex items-center text-[11px] text-loss"><ArrowDown className="w-3 h-3" />{Math.abs(d)}</span>;
  return <Minus className="w-3 h-3 text-muted/40" />;
}

export default function LeaderboardPage() {
  const { t } = useLanguage();
  const [entries, setEntries] = useState<Entry[]>([]);
  const [self, setSelf] = useState<Self | null>(null);
  const [total, setTotal] = useState(0);
  const [days, setDays] = useState<7 | 30 | 90>(30);
  const [mode, setMode] = useState<Mode>("discipline");
  const [loading, setLoading] = useState(true);
  const [showConfetti, setShowConfetti] = useState(false);
  const celebrated = useRef(false);

  const load = useCallback(async (d: number, m: Mode) => {
    setLoading(true);
    try {
      const res = await fetch(`/api/leaderboard?days=${d}&mode=${m}`);
      const data = await res.json();
      setEntries(data.entries ?? []); setSelf(data.self ?? null); setTotal(data.total ?? 0);
    } finally { setLoading(false); }
  }, []);
  useEffect(() => { load(days, mode); }, [days, mode, load]);

  function displayValue(score: number, sessions: number, streak: number): string {
    if (mode === "sessions") return `${sessions}`;
    if (mode === "streak") return `🔥 ${streak}`;
    return `${score}`;
  }

  const top3 = entries.slice(0, 3);
  const rest = entries.slice(3);
  const meInTop = entries.some((x) => x.isMe);
  const meEntry = entries.find((x) => x.isMe) ?? null;

  // Petite célébration la première fois qu'on se voit sur le podium.
  useEffect(() => {
    if (!celebrated.current && meEntry && meEntry.rank <= 3) {
      celebrated.current = true;
      setShowConfetti(true);
    }
  }, [meEntry]);

  return (
    <div className="max-w-5xl mx-auto pb-10">
      {showConfetti && <ConfettiBurst onDone={() => setShowConfetti(false)} />}
      <h1 className="text-2xl font-bold text-foreground">{t("leaderboard_title")}</h1>
      <p className="text-muted mt-1">{t("leaderboard_subtitle")}</p>

      <div className="mt-5 lg:grid lg:grid-cols-3 lg:gap-6 lg:items-start">
      {/* Rail : tes stats + badges + invite (droite sur grand écran, haut sur mobile) */}
      <aside className="space-y-4 lg:col-span-1 lg:order-2">
      {/* Tes stats (toujours visible) */}
      {self && (() => {
        const tier = tierOf(self.score);
        return (
          <div className="rounded-xl border border-border bg-card p-4">
            <div className="flex items-center gap-4">
              <span className={`flex flex-col items-center justify-center w-16 h-16 rounded-xl border ${tier.cls} shrink-0`}>
                <span className="text-2xl leading-none">{tier.emoji}</span>
                <span className="text-[10px] font-semibold uppercase tracking-wider mt-1">{t(`leaderboard_tier_${tier.key}`)}</span>
              </span>
              <div className="flex-1 grid grid-cols-3 gap-2 text-center">
                <div><p className={`text-xl font-bold ${scoreColor(self.score)}`}><CountUp end={self.score} duration={1} /></p><p className="text-[11px] text-muted">{t("leaderboard_stat_score")}</p></div>
                <div><p className="text-xl font-bold text-foreground"><CountUp end={self.sessions} duration={1} /></p><p className="text-[11px] text-muted">{t("leaderboard_stat_sessions")}</p></div>
                <div><p className="text-xl font-bold text-orange-400">🔥 <CountUp end={self.streak} duration={1} /></p><p className="text-[11px] text-muted">{t("leaderboard_stat_streak")}</p></div>
              </div>
            </div>
            {/* Progression vers le palier supérieur */}
            {(() => {
              const tp = tierProgress(self.score);
              return (
                <div className="mt-3">
                  <div className="flex items-center justify-between text-[11px] mb-1">
                    <span className="text-muted">{t(`leaderboard_tier_${tier.key}`)}</span>
                    {tp.nextKey ? (
                      <span className="text-muted">{t("leaderboard_to_next").replace("{n}", String(tp.next! - self.score)).replace("{tier}", t(`leaderboard_tier_${tp.nextKey}`))}</span>
                    ) : (
                      <span className="text-cyan-300 font-semibold">{t("leaderboard_tier_max")}</span>
                    )}
                  </div>
                  <div className="h-1.5 rounded-full bg-surface overflow-hidden">
                    <GrowBar pct={Math.max(2, Math.min(100, tp.pct))} durationMs={800} className={`rounded-full bg-gradient-to-r ${tp.bar}`} />
                  </div>
                </div>
              );
            })()}
            {self.ranked ? (
              <p className="text-xs text-muted mt-3 text-center">
                {t("leaderboard_your_rank").replace("{rank}", String(self.rank)).replace("{total}", String(total))}
                {self.percentile != null && ` · ${t("leaderboard_percentile").replace("{p}", String(self.percentile))}`}
              </p>
            ) : (
              <p className="text-xs text-muted mt-3 text-center">{t("leaderboard_not_ranked").replace("{n}", "3")}</p>
            )}
          </div>
        );
      })()}

      {/* Badges */}
      {self && (() => {
        const badges = badgesFor(self);
        const earnedCount = badges.filter((b) => b.earned).length;
        return (
          <div>
            <div className="flex items-center justify-between mb-2">
              <p className="text-xs text-muted">{t("leaderboard_badges_title")}</p>
              <span className="text-[11px] font-semibold text-accent tabular-nums">{earnedCount}/{badges.length}</span>
            </div>
            <div className="grid grid-cols-4 sm:grid-cols-7 gap-2">
              {badges.map((b) => (
                <div key={b.key} title={t(`badge_${b.key}`)}
                  className={`aspect-square rounded-xl border flex flex-col items-center justify-center gap-1 p-1 transition-transform hover:scale-105 ${b.earned ? "border-accent/30 bg-accent/[0.05] shadow-[0_0_12px_-3px_rgb(var(--accent)/0.5)]" : "border-border bg-surface/40 opacity-50"}`}>
                  <span className="text-lg leading-none">{b.earned ? b.emoji : <Lock className="w-3.5 h-3.5 text-muted" />}</span>
                  <span className="text-[8px] text-muted text-center leading-tight line-clamp-2">{t(`badge_${b.key}`)}</span>
                </div>
              ))}
            </div>
          </div>
        );
      })()}

      {/* Invite à rejoindre si pas opt-in / pas de pseudo */}
      {self && (!self.optedIn || !self.hasUsername) && (
        <Link href="/dashboard/settings#leaderboard" className="flex items-center gap-3 rounded-xl border border-accent/30 bg-accent/[0.04] p-4 hover:border-accent/50 transition-colors">
          <span className="text-2xl">🏁</span>
          <div className="flex-1">
            <p className="text-sm font-semibold text-foreground">{t("leaderboard_join_title")}</p>
            <p className="text-xs text-muted">{!self.hasUsername ? t("leaderboard_need_username") : t("leaderboard_join_desc")}</p>
          </div>
          <span className="text-xs text-accent font-medium whitespace-nowrap">{t("leaderboard_join")} →</span>
        </Link>
      )}
      </aside>

      {/* Colonne principale : modes + période + classement */}
      <main className="lg:col-span-2 lg:order-1 mt-4 lg:mt-0">
      {/* Modes + période */}
      <div className="flex rounded-lg border border-border overflow-hidden text-sm">
        {MODES.map((m) => (
          <button key={m} onClick={() => setMode(m)} className={`flex-1 px-3 py-1.5 transition-colors ${mode === m ? "bg-accent text-white" : "bg-surface text-muted hover:text-foreground"}`}>
            {t(`leaderboard_mode_${m}`)}
          </button>
        ))}
      </div>
      <div className="mt-2 flex justify-end gap-2 text-xs">
        {PERIODS.map((d) => (
          <button key={d} onClick={() => setDays(d)} className={`px-2.5 py-1 rounded-md transition-colors ${days === d ? "bg-accent/15 text-accent font-semibold" : "text-muted hover:text-foreground"}`}>
            {t("leaderboard_days").replace("{n}", String(d))}
          </button>
        ))}
      </div>

      {loading ? (
        <div className="skeleton h-40 rounded-xl mt-4" />
      ) : entries.length === 0 ? (
        <div className="mt-4 rounded-xl border border-dashed border-border p-8 text-center">
          <p className="text-muted text-sm">{t("leaderboard_be_first")}</p>
        </div>
      ) : (
        <>
          <p className="text-xs text-muted mt-4">{(total === 1 ? t("leaderboard_participants_one") : t("leaderboard_participants")).replace("{n}", String(total))}</p>

          {/* Podium */}
          {top3.length >= 1 && (
            <div className="mt-3 grid grid-cols-3 gap-3 items-end">
              {[top3[1], top3[0], top3[2]].map((e, i) => {
                if (!e) return <div key={i} />;
                const pcts = [71, 100, 57];
                const medals = ["🥈", "🥇", "🥉"];
                return (
                  <div key={e.rank} className="flex flex-col items-center">
                    <Avatar name={e.username} isMe={e.isMe} />
                    <span className="text-xs text-foreground mt-1 truncate max-w-full">{e.isMe ? t("leaderboard_you") : `@${e.username}`}</span>
                    <span className={`text-lg font-bold ${scoreColor(e.score)}`}>{displayValue(e.score, e.sessions, e.streak)}</span>
                    <div className="w-full h-28 flex items-end mt-1">
                      <GrowBar vertical pct={pcts[i]} durationMs={700} delayMs={i * 110}
                        className={`rounded-t-lg flex items-start justify-center pt-2 ${i === 1 ? "bg-accent/20 shadow-[0_0_22px_-5px_rgb(var(--accent)/0.7)]" : "bg-surface"}`}>
                        <span className="text-2xl">{medals[i]}</span>
                      </GrowBar>
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          {rest.length > 0 && (
            <div className="mt-4 rounded-xl border border-border overflow-hidden divide-y divide-border">
              {rest.map((e) => <Row key={e.rank} e={e} t={t} value={displayValue(e.score, e.sessions, e.streak)} />)}
            </div>
          )}

          {meEntry && !meInTop && (
            <div className="mt-4">
              <p className="text-xs text-muted mb-1">{t("leaderboard_your_position")}</p>
              <div className="rounded-xl border border-accent/30 overflow-hidden"><Row e={meEntry} t={t} value={displayValue(meEntry.score, meEntry.sessions, meEntry.streak)} /></div>
            </div>
          )}

          <p className="text-xs text-muted/60 mt-4 text-center">{t("leaderboard_min_note").replace("{n}", "3")}</p>
        </>
      )}
      </main>
      </div>
    </div>
  );
}

function Row({ e, t, value }: { e: Entry; t: (k: string) => string; value: string }) {
  return (
    <div className={`flex items-center gap-3 px-4 py-3 ${e.isMe ? "bg-accent/5" : "bg-card"}`}>
      <span className="text-sm font-bold text-muted w-7 text-center tabular-nums">{e.rank}</span>
      <span className="w-7 flex justify-center"><Delta d={e.delta} /></span>
      <Avatar name={e.username} isMe={e.isMe} />
      <span className="flex-1 text-foreground truncate">{e.isMe ? t("leaderboard_you") : `@${e.username}`}</span>
      <span className="text-base font-bold w-12 text-right text-foreground">{value}</span>
    </div>
  );
}
