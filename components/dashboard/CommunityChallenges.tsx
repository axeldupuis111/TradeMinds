"use client";

import { useEffect, useState } from "react";
import { useLanguage } from "@/lib/LanguageContext";
import { COMMUNITY_CHALLENGES } from "@/lib/community-challenges";
import { Users, Trophy, Flame } from "lucide-react";

interface BoardEntry { name: string; progress: number; isMe: boolean }
interface ChallengeState {
  key: string;
  target: number;
  joined: boolean;
  participantCount: number;
  myProgress: number;
  leaderboard: BoardEntry[];
}

export default function CommunityChallenges() {
  const { t } = useLanguage();
  const [challenges, setChallenges] = useState<ChallengeState[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState<string | null>(null);

  async function load() {
    try {
      const r = await fetch("/api/community-challenges");
      const data = await r.json();
      setChallenges(data.challenges ?? []);
    } catch {
      setChallenges([]);
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

  // Titles/descriptions come from i18n keys defined on each challenge.
  const meta = (key: string) => COMMUNITY_CHALLENGES.find((c) => c.key === key);

  if (loading) {
    return <div className="rounded-xl border border-border bg-card p-5"><div className="skeleton h-24 w-full rounded-lg" /></div>;
  }
  if (challenges.length === 0) return null;

  return (
    <div>
      <div className="flex items-center gap-2 mb-3">
        <Trophy className="w-4 h-4 text-accent" strokeWidth={1.75} />
        <h2 className="text-base font-bold text-foreground">{t("cc_section_title")}</h2>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        {challenges.map((c) => {
          const m = meta(c.key);
          const pct = Math.min(100, Math.round((c.myProgress / c.target) * 100));
          const done = c.myProgress >= c.target;
          return (
            <div key={c.key} className="rounded-xl border border-border bg-card p-5">
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
