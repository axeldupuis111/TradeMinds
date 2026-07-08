"use client";

import { useLanguage } from "@/lib/LanguageContext";
import { Activity, ArrowUp, ArrowDown, Award, BadgeCheck, Crown, Minus, Lock, Share2, Trophy, Users, UserPlus, Gauge, CalendarDays, Flame, Rocket } from "lucide-react";
import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";
import CountUp from "@/components/animations/CountUp";
import GrowBar from "@/components/animations/GrowBar";
import ConfettiBurst from "@/components/animations/ConfettiBurst";
import CommunityChallenges from "@/components/dashboard/CommunityChallenges";
import ShareRankModal from "@/components/leaderboard/ShareRankModal";

type Mode = "discipline" | "sessions" | "streak";
type Tab = "board" | "challenges";
type Period = 7 | 30 | 90 | "season";

type FeedItem =
  | { type: "day_record"; user: string; score: number }
  | { type: "streak"; user: string; days: number }
  | { type: "join"; user: string; challengeKey: string; at: string };

interface Entry {
  rank: number; username: string; score: number; sessions: number; streak: number;
  value: number; isMe: boolean; premium: boolean; delta: number | null;
}

// Badge de statut des membres Premium (avantage du plan, visible par tous).
function PremiumBadge({ label }: { label: string }) {
  return <BadgeCheck className="w-3.5 h-3.5 text-yellow-400 shrink-0" strokeWidth={2} aria-label={label} role="img" />;
}
interface AllTime {
  totalSessions: number; goldDays: number; comeback: boolean;
  earlyBird: number; weekendSessions: number; bestStreak: number;
}
interface Self {
  score: number; sessions: number; streak: number;
  optedIn: boolean; hasUsername: boolean; ranked: boolean; rank: number | null; percentile: number | null;
  allTime?: AllTime;
}

const MODES: { id: Mode; icon: typeof Gauge }[] = [
  { id: "discipline", icon: Gauge },
  { id: "sessions", icon: CalendarDays },
  { id: "streak", icon: Flame },
];
const PERIODS: Period[] = [7, 30, 90, "season"];

// Jours restants avant la fin du mois (fin de la saison en cours).
function seasonDaysLeft(): number {
  const now = new Date();
  const lastDay = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate();
  return lastDay - now.getDate();
}

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

// Catalogue de badges évalués à partir des stats perso, avec progression
// (current/target) pour ceux qui se débloquent par paliers chiffrés.
// Les badges de série/volume utilisent les stats TOUS TEMPS quand l'API les
// fournit : un badge est un acquis, il ne doit pas disparaître en changeant
// de période d'affichage.
type Badge = { key: string; emoji: string; earned: boolean; progress: { current: number; target: number } | null };
function badgesFor(s: Self): Badge[] {
  const at = s.allTime;
  const sessions = Math.max(s.sessions, at?.totalSessions ?? 0);
  const streak = Math.max(s.streak, at?.bestStreak ?? 0);
  return [
    { key: "first_session", emoji: "✅", earned: sessions >= 1, progress: { current: sessions, target: 1 } },
    { key: "regular", emoji: "📅", earned: sessions >= 20, progress: { current: sessions, target: 20 } },
    { key: "streak_7", emoji: "🔥", earned: streak >= 7, progress: { current: streak, target: 7 } },
    { key: "streak_30", emoji: "⚡", earned: streak >= 30, progress: { current: streak, target: 30 } },
    { key: "streak_90", emoji: "🌋", earned: streak >= 90, progress: { current: streak, target: 90 } },
    { key: "discipline_gold", emoji: "🏅", earned: s.score >= 85 && s.sessions >= 3, progress: { current: s.score, target: 85 } },
    { key: "gold_days", emoji: "✨", earned: (at?.goldDays ?? 0) >= 10, progress: { current: at?.goldDays ?? 0, target: 10 } },
    { key: "marathon", emoji: "🏃", earned: sessions >= 100, progress: { current: sessions, target: 100 } },
    { key: "comeback", emoji: "💪", earned: at?.comeback ?? false, progress: null },
    { key: "early_bird", emoji: "🌅", earned: (at?.earlyBird ?? 0) >= 10, progress: { current: at?.earlyBird ?? 0, target: 10 } },
    { key: "weekend", emoji: "🛡️", earned: (at?.weekendSessions ?? 0) >= 8, progress: { current: at?.weekendSessions ?? 0, target: 8 } },
    { key: "top10", emoji: "🎯", earned: s.ranked && s.percentile != null && s.percentile <= 10, progress: null },
    { key: "podium", emoji: "🏆", earned: s.ranked && s.rank != null && s.rank <= 3, progress: null },
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
  const { t, lang } = useLanguage();
  const [entries, setEntries] = useState<Entry[]>([]);
  const [around, setAround] = useState<Entry[]>([]);
  const [self, setSelf] = useState<Self | null>(null);
  const [feed, setFeed] = useState<FeedItem[]>([]);
  const [total, setTotal] = useState(0);
  const [days, setDays] = useState<Period>(30);
  const [mode, setMode] = useState<Mode>("discipline");
  const [tab, setTab] = useState<Tab>("board");
  const [loading, setLoading] = useState(true);
  const [showConfetti, setShowConfetti] = useState(false);
  const [selectedBadge, setSelectedBadge] = useState<string | null>(null);
  const [showShare, setShowShare] = useState(false);
  const [inviteCopied, setInviteCopied] = useState(false);
  const celebrated = useRef(false);

  const load = useCallback(async (d: Period, m: Mode) => {
    setLoading(true);
    try {
      const res = await fetch(`/api/leaderboard?days=${d}&mode=${m}`);
      const data = await res.json();
      setEntries(data.entries ?? []); setAround(data.around ?? []); setSelf(data.self ?? null); setTotal(data.total ?? 0);
      setFeed(data.feed ?? []);
    } catch {
      // Network/parse failure → degrade to an empty board rather than leaving an
      // unhandled rejection and stale data.
      setEntries([]); setAround([]); setSelf(null); setTotal(0); setFeed([]);
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
  const meEntry = entries.find((x) => x.isMe) ?? around.find((x) => x.isMe) ?? null;

  // Plus forte ascension de la période (chip de mise en avant au-dessus de la liste).
  const topMover = entries
    .filter((e) => e.delta != null && e.delta >= 2 && !e.isMe)
    .sort((a, b) => (b.delta as number) - (a.delta as number))[0] ?? null;

  // Records de la communauté sur la période (calculés depuis les entrées déjà
  // chargées : vivent dès 2-3 participants).
  const records = entries.length > 0 ? {
    score: [...entries].sort((a, b) => b.score - a.score || b.sessions - a.sessions)[0],
    streak: [...entries].sort((a, b) => b.streak - a.streak || b.score - a.score)[0],
    sessions: [...entries].sort((a, b) => b.sessions - a.sessions || b.score - a.score)[0],
  } : null;

  // Agrégats communauté pour la carte « Toi vs la communauté ».
  const community = entries.length > 0 ? (() => {
    const sessionsSorted = entries.map((e) => e.sessions).sort((a, b) => a - b);
    return {
      avgScore: Math.round(entries.reduce((s, e) => s + e.score, 0) / entries.length),
      bestStreak: Math.max(...entries.map((e) => e.streak)),
      medianSessions: sessionsSorted[Math.floor(sessionsSorted.length / 2)],
    };
  })() : null;

  const seasonMonth = new Date().toLocaleDateString(
    lang === "fr" ? "fr-FR" : lang === "de" ? "de-DE" : lang === "es" ? "es-ES" : "en-US",
    { month: "long" },
  );

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

      {/* Onglets : classement / défis communautaires */}
      <div className="mt-5 inline-flex items-center gap-1 rounded-xl border border-border bg-card p-1">
        <button onClick={() => setTab("board")}
          className={`inline-flex items-center gap-2 px-3.5 py-2 rounded-lg text-sm font-semibold transition-colors ${tab === "board" ? "bg-accent/10 text-accent" : "text-muted hover:text-foreground"}`}>
          <Trophy className="w-4 h-4" /> {t("leaderboard_tab_board")}
        </button>
        <button onClick={() => setTab("challenges")}
          className={`inline-flex items-center gap-2 px-3.5 py-2 rounded-lg text-sm font-semibold transition-colors ${tab === "challenges" ? "bg-accent/10 text-accent" : "text-muted hover:text-foreground"}`}>
          <Users className="w-4 h-4" /> {t("leaderboard_tab_challenges")}
        </button>
      </div>

      {/* ═══════════ Onglet Défis communautaires ═══════════ */}
      {tab === "challenges" && (
        <div className="mt-4">
          <CommunityChallenges />
        </div>
      )}

      {/* ═══════════ Onglet Classement ═══════════ */}
      {tab === "board" && (
      <div className="mt-4 lg:grid lg:grid-cols-3 lg:gap-6 lg:items-start">
      {/* Rail : tes stats + badges + invite (droite sur grand écran, haut sur mobile) */}
      <aside className="space-y-4 lg:col-span-1 lg:order-2">
      {/* Tes stats (toujours visible) */}
      {self && (() => {
        const tier = tierOf(self.score);
        return (
          <div className="relative rounded-xl border border-border bg-card p-4">
            {self.sessions > 0 && (
              <button onClick={() => setShowShare(true)}
                className="absolute top-2.5 right-2.5 inline-flex items-center gap-1 text-[11px] font-medium text-muted hover:text-accent transition-colors p-1"
                aria-label={t("leaderboard_share_btn")} title={t("leaderboard_share_btn")}>
                <Share2 className="w-3.5 h-3.5" strokeWidth={1.75} />
              </button>
            )}
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
            {self.ranked ? (() => {
              const above = meEntry && meEntry.rank > 1
                ? (entries.find((e) => e.rank === meEntry.rank - 1) ?? around.find((e) => e.rank === meEntry.rank - 1) ?? null)
                : null;
              const gap = above ? above.value - (meEntry?.value ?? 0) : 0;
              return (
                <div className="mt-3 text-center space-y-1">
                  <p className="text-xs text-muted">
                    {t("leaderboard_your_rank").replace("{rank}", String(self.rank)).replace("{total}", String(total))}
                    {self.percentile != null && ` · ${t("leaderboard_percentile").replace("{p}", String(self.percentile))}`}
                  </p>
                  {above && gap > 0 ? (
                    <p className="text-xs text-accent font-medium">{t("leaderboard_gap_next").replace("{pts}", String(gap)).replace("{rank}", String(above.rank))}</p>
                  ) : self.rank === 1 ? (
                    <p className="text-xs text-warning font-medium">{t("leaderboard_leader")}</p>
                  ) : null}
                </div>
              );
            })() : (
              <p className="text-xs text-muted mt-3 text-center">{t("leaderboard_not_ranked").replace("{n}", "3")}</p>
            )}
          </div>
        );
      })()}

      {/* Toi vs la communauté */}
      {self && community && (
        <div className="rounded-xl border border-border bg-card p-4">
          <p className="text-xs font-semibold text-muted uppercase tracking-wider mb-3">{t("leaderboard_vs_title")}</p>
          <div className="space-y-3">
            {([
              { label: t("leaderboard_stat_score"), me: self.score, them: community.avgScore, themLabel: t("leaderboard_vs_avg"), max: 100 },
              { label: t("leaderboard_stat_streak"), me: self.streak, them: community.bestStreak, themLabel: t("leaderboard_vs_best"), max: Math.max(self.streak, community.bestStreak, 1) },
              { label: t("leaderboard_stat_sessions"), me: self.sessions, them: community.medianSessions, themLabel: t("leaderboard_vs_median"), max: Math.max(self.sessions, community.medianSessions, 1) },
            ]).map((row, i) => (
              <div key={i}>
                <p className="text-[11px] text-muted mb-1">{row.label}</p>
                {[
                  { name: t("leaderboard_vs_you"), val: row.me, strong: row.me >= row.them },
                  { name: row.themLabel, val: row.them, strong: false },
                ].map((b, j) => (
                  <div key={j} className="flex items-center gap-2 mt-0.5">
                    <span className="text-[10px] text-muted w-16 truncate">{b.name}</span>
                    <div className="flex-1 h-1.5 rounded-full bg-surface overflow-hidden">
                      <GrowBar pct={Math.max(3, Math.min(100, (b.val / row.max) * 100))} durationMs={700} delayMs={i * 90}
                        className={`rounded-full ${j === 0 ? "bg-accent" : "bg-muted/40"}`} />
                    </div>
                    <span className={`text-[11px] tabular-nums w-8 text-right ${b.strong && j === 0 ? "text-profit font-semibold" : "text-foreground"}`}>{b.val}</span>
                  </div>
                ))}
              </div>
            ))}
          </div>
        </div>
      )}

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
            <div className="grid grid-cols-4 sm:grid-cols-7 lg:grid-cols-4 gap-2">
              {badges.map((b) => (
                <button key={b.key} onClick={() => setSelectedBadge((cur) => (cur === b.key ? null : b.key))}
                  className={`aspect-square rounded-xl border flex flex-col items-center justify-center gap-1 p-1 transition-transform hover:scale-105 ${selectedBadge === b.key ? "ring-1 ring-accent" : ""} ${b.earned ? "border-accent/30 bg-accent/[0.05] shadow-[0_0_12px_-3px_rgb(var(--accent)/0.5)]" : "border-border bg-surface/40 opacity-50"}`}>
                  <span className="text-lg leading-none">{b.earned ? b.emoji : <Lock className="w-3.5 h-3.5 text-muted" />}</span>
                  <span className="text-[8px] text-muted text-center leading-tight line-clamp-2">{t(`badge_${b.key}`)}</span>
                </button>
              ))}
            </div>
            {/* Détail du badge sélectionné : critère + progression */}
            {selectedBadge && (() => {
              const b = badges.find((x) => x.key === selectedBadge);
              if (!b) return null;
              return (
                <div className="mt-2 rounded-xl border border-border bg-surface/40 p-3">
                  <div className="flex items-center gap-2.5">
                    <span className="text-xl leading-none shrink-0">{b.earned ? b.emoji : "🔒"}</span>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-semibold text-foreground">{t(`badge_${b.key}`)}</p>
                      <p className="text-xs text-muted">{t(`badge_${b.key}_hint`)}</p>
                    </div>
                    {b.earned && <span className="text-[11px] font-semibold text-profit shrink-0">✓ {t("leaderboard_badge_earned")}</span>}
                  </div>
                  {!b.earned && b.progress && (
                    <div className="mt-2.5">
                      <div className="flex items-center justify-between text-[11px] text-muted mb-1">
                        <span>{t("leaderboard_badge_progress")}</span>
                        <span className="tabular-nums">{Math.min(b.progress.current, b.progress.target)}/{b.progress.target}</span>
                      </div>
                      <div className="h-1.5 rounded-full bg-surface overflow-hidden">
                        <GrowBar pct={Math.min(100, Math.round((b.progress.current / b.progress.target) * 100))} durationMs={700} className="rounded-full bg-accent" />
                      </div>
                    </div>
                  )}
                </div>
              );
            })()}
          </div>
        );
      })()}

      {/* Fil d'activité : ce qui se passe dans la communauté en ce moment */}
      {feed.length > 0 && (
        <div className="rounded-xl border border-border bg-card p-4">
          <div className="flex items-center gap-2 mb-2.5">
            <Activity className="w-3.5 h-3.5 text-accent" strokeWidth={1.75} />
            <p className="text-xs font-semibold text-muted uppercase tracking-wider">{t("leaderboard_feed_title")}</p>
          </div>
          <ul className="space-y-2">
            {feed.map((f, i) => (
              <li key={i} className="text-xs text-foreground-muted leading-relaxed">
                {f.type === "day_record" && (
                  <>🎯 {t("leaderboard_feed_day_record").replace("{user}", `@${f.user}`).replace("{score}", String(f.score))}</>
                )}
                {f.type === "streak" && (
                  <>🔥 {t("leaderboard_feed_streak").replace("{user}", `@${f.user}`).replace("{n}", String(f.days))}</>
                )}
                {f.type === "join" && (
                  <>🤝 {t("leaderboard_feed_join").replace("{user}", `@${f.user}`).replace("{challenge}", t(`challenge_c_${f.challengeKey.replace(/-/g, "_")}_title`))}</>
                )}
              </li>
            ))}
          </ul>
        </div>
      )}

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

      {/* Invite un ami : le classement est meilleur à plusieurs */}
      <div className="rounded-xl border border-border bg-card p-4">
        <div className="flex items-center gap-2.5">
          <UserPlus className="w-4 h-4 text-accent shrink-0" strokeWidth={1.75} />
          <div className="flex-1 min-w-0">
            <p className="text-sm font-semibold text-foreground">{t("leaderboard_invite_title")}</p>
            <p className="text-xs text-muted">{t("leaderboard_invite_desc")}</p>
          </div>
        </div>
        <button
          onClick={() => {
            navigator.clipboard.writeText("https://tradediscipline.app");
            setInviteCopied(true);
            setTimeout(() => setInviteCopied(false), 2000);
          }}
          className="mt-3 w-full py-2 rounded-lg border border-accent/30 bg-accent/5 text-accent text-xs font-medium hover:bg-accent/10 transition-colors"
        >
          {inviteCopied ? `✓ ${t("leaderboard_invite_copied")}` : t("leaderboard_invite_copy")}
        </button>
      </div>
      </aside>

      {/* Colonne principale : modes + période + classement */}
      <main className="lg:col-span-2 lg:order-1 mt-4 lg:mt-0">
      {/* Modes (avec icônes) + période sur la même ligne */}
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="inline-flex items-center gap-1 rounded-xl border border-border bg-card p-1">
          {MODES.map((m) => (
            <button key={m.id} onClick={() => setMode(m.id)}
              className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${mode === m.id ? "bg-accent/10 text-accent" : "text-muted hover:text-foreground"}`}>
              <m.icon className="w-3.5 h-3.5" /> {t(`leaderboard_mode_${m.id}`)}
            </button>
          ))}
        </div>
        <div className="flex gap-1 text-xs">
          {PERIODS.map((d) => (
            <button key={d} onClick={() => setDays(d)} className={`px-2.5 py-1.5 rounded-lg transition-colors ${days === d ? "bg-accent/15 text-accent font-semibold" : "text-muted hover:text-foreground"}`}>
              {d === "season" ? `🏆 ${t("leaderboard_period_season")}` : t("leaderboard_days").replace("{n}", String(d))}
            </button>
          ))}
        </div>
      </div>

      {/* Bandeau saison : le classement du mois repart de zéro le 1er */}
      {days === "season" && (
        <div className="mt-3 flex flex-wrap items-center justify-between gap-2 rounded-xl border border-warning/30 bg-warning/[0.06] px-4 py-2.5">
          <p className="text-sm font-semibold text-foreground capitalize">
            🏆 {t("leaderboard_season_title").replace("{month}", seasonMonth)}
          </p>
          <p className="text-xs text-muted">
            {t("leaderboard_season_left").replace("{n}", String(seasonDaysLeft()))} · {t("leaderboard_season_reset")}
          </p>
        </div>
      )}

      {loading ? (
        <div className="skeleton h-40 rounded-xl mt-4" />
      ) : entries.length === 0 ? (
        <div className="mt-4 rounded-xl border border-dashed border-border p-8 text-center">
          <p className="text-muted text-sm">{t("leaderboard_be_first")}</p>
        </div>
      ) : (
        <>
          {/* Records de la communauté (période courante) */}
          {records && (
            <div className="mt-4">
              <div className="flex items-center gap-2 mb-2">
                <Award className="w-3.5 h-3.5 text-accent" strokeWidth={1.75} />
                <p className="text-xs font-semibold text-muted uppercase tracking-wider">{t("leaderboard_records_title")}</p>
              </div>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                {([
                  { emoji: "🎯", label: t("leaderboard_record_score"), user: records.score, val: String(records.score.score) },
                  { emoji: "🔥", label: t("leaderboard_record_streak"), user: records.streak, val: `${records.streak.streak} j` },
                  { emoji: "📅", label: t("leaderboard_record_sessions"), user: records.sessions, val: String(records.sessions.sessions) },
                  ...(topMover ? [{ emoji: "🚀", label: t("leaderboard_record_mover"), user: topMover, val: `+${topMover.delta}` }] : []),
                ]).map((r, i) => (
                  <div key={i} className={`rounded-xl border p-3 ${r.user.isMe ? "border-accent/40 bg-accent/[0.06]" : "border-border bg-card"}`}>
                    <p className="text-[10px] text-muted uppercase tracking-wide">{r.emoji} {r.label}</p>
                    <p className="text-lg font-bold text-foreground mt-0.5 tabular-nums">{r.val}</p>
                    <p className="text-[11px] text-muted truncate">{r.user.isMe ? t("leaderboard_you") : `@${r.user.username}`}</p>
                  </div>
                ))}
              </div>
            </div>
          )}

          <div className="mt-4 flex flex-wrap items-center justify-between gap-2">
            <p className="text-xs text-muted">{(total === 1 ? t("leaderboard_participants_one") : t("leaderboard_participants")).replace("{n}", String(total))}</p>
            {/* Plus forte ascension de la période */}
            {topMover && (
              <span className="inline-flex items-center gap-1.5 text-[11px] font-medium text-profit bg-profit/10 rounded-full px-2.5 py-1">
                <Rocket className="w-3 h-3" />
                {t("leaderboard_top_mover").replace("{user}", topMover.username).replace("{n}", String(topMover.delta))}
              </span>
            )}
          </div>

          {/* Podium */}
          {top3.length >= 1 && (
            <div className="mt-3 grid grid-cols-3 gap-3 items-end">
              {[top3[1], top3[0], top3[2]].map((e, i) => {
                if (!e) return <div key={i} />;
                const pcts = [71, 100, 57];
                const medals = ["🥈", "🥇", "🥉"];
                // Marches teintées or / argent / bronze (le vainqueur rayonne).
                const barCls = [
                  "bg-slate-400/15 shadow-[0_0_14px_-6px_rgb(148_163_184/0.6)]",
                  "bg-yellow-500/15 shadow-[0_0_26px_-5px_rgb(234_179_8/0.75)]",
                  "bg-orange-700/15 shadow-[0_0_14px_-6px_rgb(194_120_60/0.6)]",
                ][i];
                return (
                  <div key={e.rank} className="flex flex-col items-center">
                    {i === 1 && <Crown className="w-5 h-5 text-yellow-400 mb-1 animate-bounce [animation-iteration-count:3]" strokeWidth={2} />}
                    <span className={e.isMe ? "rounded-full ring-2 ring-accent ring-offset-2 ring-offset-background" : ""}>
                      <Avatar name={e.username} isMe={e.isMe} />
                    </span>
                    <span className="flex items-center gap-1 max-w-full mt-1">
                      <span className="text-xs text-foreground truncate font-medium">{e.isMe ? t("leaderboard_you") : `@${e.username}`}</span>
                      {e.premium && <PremiumBadge label={t("plan_premium")} />}
                    </span>
                    <span className={`text-lg font-bold ${scoreColor(e.score)}`}>{displayValue(e.score, e.sessions, e.streak)}</span>
                    <span className="text-[10px] text-muted tabular-nums">📅 {e.sessions} · 🔥 {e.streak}</span>
                    <div className="w-full h-28 flex items-end mt-1">
                      <GrowBar vertical pct={pcts[i]} durationMs={700} delayMs={i * 110}
                        className={`rounded-t-lg flex items-start justify-center pt-2 ${barCls}`}>
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

          {/* Ta position avec contexte (voisin devant + toi + voisin derrière),
              même quand tu es hors du top affiché. */}
          {meEntry && !meInTop && around.length > 0 && (
            <div className="mt-4">
              <p className="text-xs text-muted mb-1">{t("leaderboard_your_position")}</p>
              <div className="rounded-xl border border-accent/30 overflow-hidden divide-y divide-border">
                {around.map((e) => <Row key={e.rank} e={e} t={t} value={displayValue(e.score, e.sessions, e.streak)} />)}
              </div>
            </div>
          )}

          <p className="text-xs text-muted/60 mt-4 text-center">{t("leaderboard_min_note").replace("{n}", "3")}</p>
        </>
      )}
      </main>
      </div>
      )}

      {/* Carte de rang exportable en PNG */}
      {showShare && self && (
        <ShareRankModal
          stats={{
            score: self.score, sessions: self.sessions, streak: self.streak,
            rank: self.rank, total, percentile: self.percentile,
            // La carte de partage affiche une période en jours : pour la saison,
            // c'est le nombre de jours écoulés depuis le 1ᵉʳ du mois.
            tierKey: tierOf(self.score).key, tierEmoji: tierOf(self.score).emoji,
            days: days === "season" ? new Date().getDate() : days,
          }}
          onClose={() => setShowShare(false)}
        />
      )}
    </div>
  );
}

function Row({ e, t, value }: { e: Entry; t: (k: string) => string; value: string }) {
  return (
    <div className={`flex items-center gap-3 px-4 py-3 ${e.isMe ? "bg-accent/5" : "bg-card"}`}>
      <span className="text-sm font-bold text-muted w-7 text-center tabular-nums">{e.rank}</span>
      <span className="w-7 flex justify-center"><Delta d={e.delta} /></span>
      <Avatar name={e.username} isMe={e.isMe} />
      <span className="flex-1 min-w-0 flex items-center gap-1.5">
        <span className="text-foreground truncate">{e.isMe ? t("leaderboard_you") : `@${e.username}`}</span>
        {e.premium && <PremiumBadge label={t("plan_premium")} />}
      </span>
      <span className="hidden sm:inline text-[11px] text-muted tabular-nums whitespace-nowrap">📅 {e.sessions} · 🔥 {e.streak}</span>
      <span className="text-base font-bold w-12 text-right text-foreground shrink-0">{value}</span>
    </div>
  );
}
