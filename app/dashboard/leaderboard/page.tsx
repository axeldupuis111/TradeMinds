"use client";

import { useLanguage } from "@/lib/LanguageContext";
import Link from "next/link";
import { useCallback, useEffect, useState } from "react";

interface Entry {
  rank: number;
  username: string;
  score: number;
  sessions: number;
  isMe: boolean;
}

function scoreColor(s: number): string {
  if (s >= 85) return "text-profit";
  if (s >= 70) return "text-green-400";
  if (s >= 50) return "text-warning";
  return "text-loss";
}

// Ligue de discipline selon le score moyen.
function tierOf(s: number): { key: string; emoji: string; cls: string } {
  if (s >= 85) return { key: "diamond", emoji: "💎", cls: "bg-cyan-500/10 text-cyan-300 border-cyan-400/30" };
  if (s >= 70) return { key: "gold", emoji: "🥇", cls: "bg-yellow-500/10 text-yellow-300 border-yellow-400/30" };
  if (s >= 50) return { key: "silver", emoji: "🥈", cls: "bg-slate-400/10 text-slate-300 border-slate-300/30" };
  return { key: "bronze", emoji: "🥉", cls: "bg-orange-700/10 text-orange-300 border-orange-500/30" };
}

function Avatar({ name, isMe }: { name: string; isMe: boolean }) {
  const initials = name.slice(0, 2).toUpperCase();
  return (
    <span
      className={`flex items-center justify-center w-8 h-8 rounded-full text-xs font-bold shrink-0 ${
        isMe ? "bg-accent text-white" : "bg-surface text-muted"
      }`}
    >
      {initials}
    </span>
  );
}

export default function LeaderboardPage() {
  const { t } = useLanguage();
  const [entries, setEntries] = useState<Entry[]>([]);
  const [me, setMe] = useState<Entry | null>(null);
  const [total, setTotal] = useState(0);
  const [days, setDays] = useState<30 | 90>(30);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async (d: 30 | 90) => {
    setLoading(true);
    try {
      const res = await fetch(`/api/leaderboard?days=${d}`);
      const data = await res.json();
      setEntries(data.entries ?? []);
      setMe(data.me ?? null);
      setTotal(data.total ?? 0);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(days); }, [days, load]);

  const top3 = entries.slice(0, 3);
  const rest = entries.slice(3);
  const meInTop = me ? entries.some((e) => e.isMe) : false;

  return (
    <div className="max-w-2xl mx-auto">
      <div className="flex items-start justify-between gap-3 flex-wrap">
        <div>
          <h1 className="text-2xl font-bold text-foreground">{t("leaderboard_title")}</h1>
          <p className="text-muted mt-1">{t("leaderboard_subtitle")}</p>
        </div>
        {/* Sélecteur de période */}
        <div className="flex rounded-lg border border-border overflow-hidden text-sm">
          {([30, 90] as const).map((d) => (
            <button
              key={d}
              onClick={() => setDays(d)}
              className={`px-3 py-1.5 transition-colors ${days === d ? "bg-accent text-white" : "bg-surface text-muted hover:text-foreground"}`}
            >
              {t("leaderboard_days").replace("{n}", String(d))}
            </button>
          ))}
        </div>
      </div>

      {loading ? (
        <div className="skeleton h-48 rounded-xl mt-6" />
      ) : entries.length === 0 ? (
        <div className="mt-6 rounded-xl border border-border bg-card p-8 text-center">
          <p className="text-muted text-sm">{t("leaderboard_empty")}</p>
          <Link href="/dashboard/settings" className="inline-block mt-3 text-sm text-accent hover:underline">
            {t("leaderboard_join")}
          </Link>
        </div>
      ) : (
        <>
          <p className="text-xs text-muted mt-4">
            {t("leaderboard_participants").replace("{n}", String(total))}
            {me && ` · ${t("leaderboard_your_rank").replace("{rank}", String(me.rank)).replace("{total}", String(total))}`}
          </p>

          {/* Carte hero : ta ligue + écart pour le rang au-dessus */}
          {me && (() => {
            const tier = tierOf(me.score);
            const above = entries.find((e) => e.rank === me.rank - 1);
            const gap = above ? above.score - me.score : 0;
            return (
              <div className="mt-3 rounded-xl border border-border bg-card p-4 flex items-center gap-4">
                <span className={`flex flex-col items-center justify-center w-16 h-16 rounded-xl border ${tier.cls} shrink-0`}>
                  <span className="text-2xl leading-none">{tier.emoji}</span>
                  <span className="text-[10px] font-semibold uppercase tracking-wider mt-1">{t(`leaderboard_tier_${tier.key}`)}</span>
                </span>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold text-foreground">{t("leaderboard_tier_label")}</p>
                  <p className="text-xs text-muted mt-0.5">
                    {me.rank === 1
                      ? t("leaderboard_leader")
                      : t("leaderboard_gap_next").replace("{pts}", String(Math.max(0, gap))).replace("{rank}", String(me.rank - 1))}
                  </p>
                </div>
                <span className={`text-2xl font-bold ${scoreColor(me.score)}`}>{me.score}</span>
              </div>
            );
          })()}

          {/* Podium top 3 */}
          {top3.length >= 1 && (
            <div className="mt-4 grid grid-cols-3 gap-3 items-end">
              {/* ordre visuel : 2 - 1 - 3 */}
              {[top3[1], top3[0], top3[2]].map((e, i) => {
                if (!e) return <div key={i} />;
                const heights = ["h-20", "h-28", "h-16"];
                const medals = ["🥈", "🥇", "🥉"];
                const order = [1, 0, 2][i]; // position dans top3
                return (
                  <div key={e.rank} className="flex flex-col items-center">
                    <Avatar name={e.username} isMe={e.isMe} />
                    <span className="text-xs text-foreground mt-1 truncate max-w-full">
                      {e.isMe ? t("leaderboard_you") : `@${e.username}`}
                    </span>
                    <span className={`text-lg font-bold ${scoreColor(e.score)}`}>{e.score}</span>
                    <div className={`${heights[i]} w-full rounded-t-lg mt-1 flex items-start justify-center pt-2 ${
                      order === 0 ? "bg-accent/20" : "bg-surface"
                    }`}>
                      <span className="text-2xl">{medals[i]}</span>
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          {/* Reste du classement */}
          {rest.length > 0 && (
            <div className="mt-4 rounded-xl border border-border overflow-hidden divide-y divide-border">
              {rest.map((e) => (
                <Row key={e.rank} e={e} t={t} />
              ))}
            </div>
          )}

          {/* Ta position si hors top 50 */}
          {me && !meInTop && (
            <div className="mt-4">
              <p className="text-xs text-muted mb-1">{t("leaderboard_your_position")}</p>
              <div className="rounded-xl border border-accent/30 overflow-hidden">
                <Row e={me} t={t} />
              </div>
            </div>
          )}

          <p className="text-xs text-muted/60 mt-4 text-center">{t("leaderboard_disclaimer")}</p>
        </>
      )}
    </div>
  );
}

function Row({ e, t }: { e: Entry; t: (k: string) => string }) {
  return (
    <div className={`flex items-center gap-3 px-4 py-3 ${e.isMe ? "bg-accent/5" : "bg-card"}`}>
      <span className="text-sm font-bold text-muted w-7 text-center tabular-nums">{e.rank}</span>
      <Avatar name={e.username} isMe={e.isMe} />
      <span className="flex-1 text-foreground truncate">{e.isMe ? t("leaderboard_you") : `@${e.username}`}</span>
      <span className="text-xs text-muted">{e.sessions} {t("leaderboard_sessions")}</span>
      <span className={`text-base font-bold w-10 text-right ${scoreColor(e.score)}`}>{e.score}</span>
    </div>
  );
}
