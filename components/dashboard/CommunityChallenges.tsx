"use client";

import { useEffect, useState } from "react";
import { useLanguage } from "@/lib/LanguageContext";
import { getCommunityChallenge } from "@/lib/community-challenges";
import { generateBadgeCertificate, type CertLang } from "@/lib/badge-certificate";
import { Users, Trophy, Flame, Timer, Snowflake, FileDown, Crown } from "lucide-react";

/**
 * Défis communautaires HEBDO : 3 défis tirés au sort chaque lundi (tirage
 * déterministe côté lib), un compte à rebours, et la rétrospective de la
 * semaine passée (podium + mon bilan + certificat si je suis champion).
 */

interface BoardEntry { name: string; progress: number; isMe: boolean }
interface ChallengeState {
  key: string;
  target: number;
  joined: boolean;
  participantCount: number;
  myProgress: number;
  completed: boolean;
  leaderboard: BoardEntry[];
}
interface LastWeekResult {
  key: string;
  podium: { name: string; rank: number; isMe: boolean }[];
  finishers: number;
  me: { completed: boolean; rank: number | null; progress: number; awardedAt: string } | null;
}
interface ApiPayload {
  weekKey: string;
  endsAt: string;
  challenges: ChallengeState[];
  lastWeek: { weekKey: string; results: LastWeekResult[] } | null;
}

const RANK_EMOJI: Record<number, string> = { 1: "👑", 2: "🥈", 3: "🥉" };

function countdown(endsAt: string): { d: number; h: number } {
  const ms = Math.max(0, new Date(endsAt).getTime() - Date.now());
  const totalH = Math.floor(ms / 3_600_000);
  return { d: Math.floor(totalH / 24), h: totalH % 24 };
}

export default function CommunityChallenges() {
  const { t, lang } = useLanguage();
  const [data, setData] = useState<ApiPayload | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState<string | null>(null);

  async function load() {
    try {
      const r = await fetch("/api/community-challenges");
      setData(await r.json());
    } catch {
      setData(null);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { load(); }, []);

  async function toggle(key: string, joined: boolean) {
    setBusy(key);
    try {
      await fetch("/api/community-challenges", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ challengeKey: key, action: joined ? "leave" : "join" }),
      });
      await load();
    } finally {
      setBusy(null);
    }
  }

  // Titres/descriptions : clés i18n portées par chaque défi du pool.
  const meta = (key: string) => getCommunityChallenge(key);

  if (loading) {
    return <div className="rounded-xl border border-border bg-card p-5"><div className="skeleton h-24 w-full rounded-lg" /></div>;
  }
  if (!data || data.challenges.length === 0) return null;

  const { d, h } = countdown(data.endsAt);
  const myWins = (data.lastWeek?.results ?? []).filter((r) => r.me?.rank === 1);
  const myFinished = (data.lastWeek?.results ?? []).filter((r) => r.me?.completed).length;

  return (
    <div>
      <div className="flex flex-wrap items-center gap-2 mb-3">
        <Trophy className="w-4 h-4 text-accent" strokeWidth={1.75} />
        <h2 className="text-base font-bold text-foreground">{t("cc_section_title")}</h2>
        <span className="inline-flex items-center gap-1 rounded-full border border-border bg-surface px-2 py-0.5 text-[11px] text-foreground-muted">
          <Timer className="w-3 h-3" strokeWidth={2} />
          {t("cc_ends_in").replace("{d}", String(d)).replace("{h}", String(h))}
        </span>
        <span className="text-[11px] text-muted">{t("cc_new_every_monday")}</span>
      </div>

      {/* Récompenses en jeu — mêmes mécaniques que les badges. */}
      <p className="mb-3 text-[11px] text-muted flex flex-wrap items-center gap-x-3 gap-y-1">
        <span className="inline-flex items-center gap-1"><Snowflake className="w-3 h-3 text-sky-400" strokeWidth={2} />{t("cc_reward_finisher")}</span>
        <span className="inline-flex items-center gap-1"><Crown className="w-3 h-3 text-amber-400" strokeWidth={2} />{t("cc_reward_podium")}</span>
        <span className="inline-flex items-center gap-1"><FileDown className="w-3 h-3 text-accent" strokeWidth={2} />{t("cc_reward_winner")}</span>
      </p>

      {/* Rétrospective de la semaine passée */}
      {data.lastWeek && (
        <div className="mb-4 rounded-xl border border-border bg-card p-4">
          <h3 className="text-xs font-bold text-foreground-muted uppercase tracking-wide mb-2">
            {t("cc_last_week_title")}
          </h3>
          <div className="space-y-1.5">
            {data.lastWeek.results.map((r) => {
              const m = meta(r.key);
              return (
                <div key={r.key} className="flex flex-wrap items-center gap-x-2 gap-y-0.5 text-xs">
                  <span className="font-semibold text-foreground">{m ? t(m.titleKey) : r.key}</span>
                  {r.podium.length > 0 ? (
                    <span className="text-foreground-muted">
                      {r.podium.map((p) => (
                        <span key={p.rank + p.name} className={`mr-2 ${p.isMe ? "text-accent font-semibold" : ""}`}>
                          {RANK_EMOJI[p.rank] ?? `#${p.rank}`} {p.isMe ? t("cc_you") : `@${p.name}`}
                        </span>
                      ))}
                    </span>
                  ) : (
                    <span className="text-muted">{t("cc_no_podium")}</span>
                  )}
                  {r.me?.completed && (
                    <span className="inline-flex items-center gap-1 text-sky-400">
                      <Snowflake className="w-3 h-3" strokeWidth={2} />{t("cc_me_finished")}
                    </span>
                  )}
                </div>
              );
            })}
          </div>
          {(myWins.length > 0 || myFinished > 0) && (
            <div className="mt-3 flex flex-wrap items-center gap-2">
              {myFinished > 0 && (
                <span className="text-[11px] text-sky-400">
                  {t("cc_gels_earned").replace("{n}", String(myFinished))}
                </span>
              )}
              {myWins.map((r) => (
                <button
                  key={r.key}
                  onClick={() => generateBadgeCertificate({
                    badgeKey: "challenge_week",
                    username: r.podium.find((p) => p.isMe)?.name || "trader",
                    awardedAt: r.me?.awardedAt || new Date().toISOString(),
                    meta: { week: data.lastWeek!.weekKey },
                    lang: lang as CertLang,
                  })}
                  className="inline-flex items-center gap-1.5 rounded-lg bg-accent/10 border border-accent/30 px-2.5 py-1 text-[11px] font-semibold text-accent hover:bg-accent/20 transition-colors"
                >
                  <FileDown className="w-3.5 h-3.5" strokeWidth={2} />
                  {t("cc_cert_download")}
                </button>
              ))}
            </div>
          )}
        </div>
      )}

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {data.challenges.map((c) => {
          const m = meta(c.key);
          const pct = Math.min(100, Math.round((c.myProgress / c.target) * 100));
          const done = c.completed;
          return (
            <div key={c.key} className={`rounded-xl border bg-card p-5 ${done ? "border-profit/40" : "border-border"}`}>
              <div className="flex items-start justify-between gap-3">
                <div>
                  <h3 className="text-sm font-bold text-foreground">{m ? t(m.titleKey) : c.key}</h3>
                  <p className="text-xs text-foreground-muted mt-0.5">{m ? t(m.descKey) : ""}</p>
                </div>
                <button
                  onClick={() => toggle(c.key, c.joined)}
                  disabled={busy === c.key}
                  className={`shrink-0 px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors disabled:opacity-50 ${
                    c.joined
                      ? "border border-border text-muted hover:text-foreground"
                      : "bg-accent text-white hover:bg-accent-hover"
                  }`}
                >
                  {c.joined ? t("cc_leave") : t("cc_join")}
                </button>
              </div>

              {/* Your progress */}
              <div className="mt-4">
                <div className="flex items-center justify-between text-[11px] mb-1">
                  <span className="text-muted">{t("cc_progress")}</span>
                  <span className={done ? "text-profit font-semibold" : "text-foreground"}>
                    {c.myProgress}/{c.target} {done ? "🎉" : ""}
                  </span>
                </div>
                <div className="h-2 rounded-full bg-surface overflow-hidden">
                  <div className={`h-full rounded-full transition-all ${done ? "bg-profit" : "bg-accent"}`} style={{ width: `${Math.max(3, pct)}%` }} />
                </div>
                {done && (
                  <p className="mt-1.5 text-[11px] text-profit inline-flex items-center gap-1">
                    <Snowflake className="w-3 h-3" strokeWidth={2} />{t("cc_completed_note")}
                  </p>
                )}
              </div>

              {/* Participants + mini leaderboard */}
              <div className="mt-3 flex items-center gap-1.5 text-[11px] text-muted">
                <Users className="w-3.5 h-3.5" /> {t("cc_participants").replace("{n}", String(c.participantCount))}
              </div>

              {c.leaderboard.length > 0 ? (
                <ol className="mt-2 space-y-1">
                  {c.leaderboard.slice(0, 5).map((e, i) => (
                    <li
                      key={i}
                      className={`flex items-center gap-2 rounded-md px-2 py-1 text-xs ${e.isMe ? "bg-accent/10 text-accent font-semibold" : "text-foreground-muted"}`}
                    >
                      <span className="w-4 text-center text-[10px] text-muted">{i + 1}</span>
                      <span className="flex-1 truncate">{e.isMe ? t("cc_you") : `@${e.name}`}</span>
                      <span className="flex items-center gap-1"><Flame className="w-3 h-3 text-orange-400" />{e.progress}</span>
                    </li>
                  ))}
                </ol>
              ) : (
                <p className="mt-2 text-xs text-muted">{t("cc_be_first")}</p>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
