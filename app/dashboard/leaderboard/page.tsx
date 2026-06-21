"use client";

import { useLanguage } from "@/lib/LanguageContext";
import { ArrowUp, ArrowDown, Minus } from "lucide-react";
import Link from "next/link";
import { useCallback, useEffect, useState } from "react";

type Mode = "discipline" | "sessions" | "streak";

interface Entry {
  rank: number; username: string; score: number; sessions: number; streak: number;
  value: number; isMe: boolean; delta: number | null;
}
interface Me extends Entry { percentile: number | null }

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
  const [me, setMe] = useState<Me | null>(null);
  const [total, setTotal] = useState(0);
  const [days, setDays] = useState<7 | 30 | 90>(30);
  const [mode, setMode] = useState<Mode>("discipline");
  const [loading, setLoading] = useState(true);

  const load = useCallback(async (d: number, m: Mode) => {
    setLoading(true);
    try {
      const res = await fetch(`/api/leaderboard?days=${d}&mode=${m}`);
      const data = await res.json();
      setEntries(data.entries ?? []); setMe(data.me ?? null); setTotal(data.total ?? 0);
    } finally { setLoading(false); }
  }, []);

  useEffect(() => { load(days, mode); }, [days, mode, load]);

  // Valeur affichée selon le mode.
  function displayValue(e: Entry): string {
    if (mode === "sessions") return `${e.sessions}`;
    if (mode === "streak") return `🔥 ${e.streak}`;
    return `${e.score}`;
  }

  const top3 = entries.slice(0, 3);
  const rest = entries.slice(3);
  const meInTop = me ? entries.some((x) => x.isMe) : false;

  return (
    <div className="max-w-2xl mx-auto pb-10">
      <h1 className="text-2xl font-bold text-foreground">{t("leaderboard_title")}</h1>
      <p className="text-muted mt-1">{t("leaderboard_subtitle")}</p>

      {/* Modes */}
      <div className="mt-4 flex rounded-lg border border-border overflow-hidden text-sm">
        {MODES.map((m) => (
          <button key={m} onClick={() => setMode(m)}
            className={`flex-1 px-3 py-1.5 transition-colors ${mode === m ? "bg-accent text-white" : "bg-surface text-muted hover:text-foreground"}`}>
            {t(`leaderboard_mode_${m}`)}
          </button>
        ))}
      </div>

      {/* Période */}
      <div className="mt-2 flex justify-end gap-2 text-xs">
        {PERIODS.map((d) => (
          <button key={d} onClick={() => setDays(d)}
            className={`px-2.5 py-1 rounded-md transition-colors ${days === d ? "bg-accent/15 text-accent font-semibold" : "text-muted hover:text-foreground"}`}>
            {t("leaderboard_days").replace("{n}", String(d))}
          </button>
        ))}
      </div>

      {loading ? (
        <div className="skeleton h-48 rounded-xl mt-4" />
      ) : entries.length === 0 ? (
        <div className="mt-4 rounded-xl border border-border bg-card p-8 text-center">
          <p className="text-muted text-sm">{t("leaderboard_empty")}</p>
          <Link href="/dashboard/settings" className="inline-block mt-3 text-sm text-accent hover:underline">{t("leaderboard_join")}</Link>
        </div>
      ) : (
        <>
          <p className="text-xs text-muted mt-3">
            {t("leaderboard_participants").replace("{n}", String(total))}
            {me && ` · ${t("leaderboard_your_rank").replace("{rank}", String(me.rank)).replace("{total}", String(total))}`}
          </p>

          {/* Hero : ligue + percentile + écart */}
          {me && (() => {
            const tier = tierOf(me.score);
            const above = entries.find((e) => e.rank === me.rank - 1);
            const gap = above ? above.value - me.value : 0;
            return (
              <div className="mt-3 rounded-xl border border-border bg-card p-4 flex items-center gap-4">
                <span className={`flex flex-col items-center justify-center w-16 h-16 rounded-xl border ${tier.cls} shrink-0`}>
                  <span className="text-2xl leading-none">{tier.emoji}</span>
                  <span className="text-[10px] font-semibold uppercase tracking-wider mt-1">{t(`leaderboard_tier_${tier.key}`)}</span>
                </span>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold text-foreground">
                    {t("leaderboard_tier_label")}
                    {me.percentile != null && <span className="text-accent"> · {t("leaderboard_percentile").replace("{p}", String(me.percentile))}</span>}
                  </p>
                  <p className="text-xs text-muted mt-0.5">
                    {me.rank === 1 ? t("leaderboard_leader")
                      : t("leaderboard_gap_next").replace("{pts}", String(Math.max(0, gap))).replace("{rank}", String(me.rank - 1))}
                  </p>
                </div>
                <span className={`text-2xl font-bold ${scoreColor(me.score)}`}>{displayValue(me)}</span>
              </div>
            );
          })()}

          {/* Podium */}
          {top3.length >= 1 && (
            <div className="mt-4 grid grid-cols-3 gap-3 items-end">
              {[top3[1], top3[0], top3[2]].map((e, i) => {
                if (!e) return <div key={i} />;
                const heights = ["h-20", "h-28", "h-16"];
                const medals = ["🥈", "🥇", "🥉"];
                const isWinner = i === 1;
                return (
                  <div key={e.rank} className="flex flex-col items-center">
                    <Avatar name={e.username} isMe={e.isMe} />
                    <span className="text-xs text-foreground mt-1 truncate max-w-full">{e.isMe ? t("leaderboard_you") : `@${e.username}`}</span>
                    <span className={`text-lg font-bold ${scoreColor(e.score)}`}>{displayValue(e)}</span>
                    <div className={`${heights[i]} w-full rounded-t-lg mt-1 flex items-start justify-center pt-2 ${isWinner ? "bg-accent/20" : "bg-surface"}`}>
                      <span className="text-2xl">{medals[i]}</span>
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          {/* Reste */}
          {rest.length > 0 && (
            <div className="mt-4 rounded-xl border border-border overflow-hidden divide-y divide-border">
              {rest.map((e) => <Row key={e.rank} e={e} t={t} value={displayValue(e)} />)}
            </div>
          )}

          {/* Ta position si hors top */}
          {me && !meInTop && (
            <div className="mt-4">
              <p className="text-xs text-muted mb-1">{t("leaderboard_your_position")}</p>
              <div className="rounded-xl border border-accent/30 overflow-hidden"><Row e={me} t={t} value={displayValue(me)} /></div>
            </div>
          )}

          <p className="text-xs text-muted/60 mt-4 text-center">{t("leaderboard_min_note").replace("{n}", "3")}</p>
        </>
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
      <span className="flex-1 text-foreground truncate">{e.isMe ? t("leaderboard_you") : `@${e.username}`}</span>
      <span className="text-base font-bold w-12 text-right text-foreground">{value}</span>
    </div>
  );
}
