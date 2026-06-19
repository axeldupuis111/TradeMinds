"use client";

import { useLanguage } from "@/lib/LanguageContext";
import Link from "next/link";
import { useEffect, useState } from "react";

interface Entry {
  rank: number;
  username: string;
  score: number;
  sessions: number;
  isMe: boolean;
}

export default function LeaderboardPage() {
  const { t } = useLanguage();
  const [entries, setEntries] = useState<Entry[]>([]);
  const [me, setMe] = useState<Entry | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      try {
        const res = await fetch("/api/leaderboard");
        const data = await res.json();
        setEntries(data.entries ?? []);
        setMe(data.me ?? null);
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  function medal(rank: number): string {
    return rank === 1 ? "🥇" : rank === 2 ? "🥈" : rank === 3 ? "🥉" : `${rank}`;
  }

  return (
    <div className="max-w-2xl mx-auto">
      <h1 className="text-2xl font-bold text-foreground">{t("leaderboard_title")}</h1>
      <p className="text-muted mt-1">{t("leaderboard_subtitle")}</p>

      {loading ? (
        <div className="skeleton h-40 rounded-xl mt-6" />
      ) : entries.length === 0 ? (
        <div className="mt-6 rounded-xl border border-border bg-card p-8 text-center">
          <p className="text-muted text-sm">{t("leaderboard_empty")}</p>
          <Link href="/dashboard/settings" className="inline-block mt-3 text-sm text-accent hover:underline">
            {t("leaderboard_join")}
          </Link>
        </div>
      ) : (
        <>
          {me && (
            <div className="mt-6 rounded-xl border border-accent/30 bg-accent/5 p-4 flex items-center gap-4">
              <span className="text-lg font-bold text-accent w-10 text-center">{medal(me.rank)}</span>
              <span className="flex-1 text-foreground font-medium">{t("leaderboard_you")}</span>
              <span className="text-sm text-muted">{me.sessions} {t("leaderboard_sessions")}</span>
              <span className="text-lg font-bold text-profit w-12 text-right">{me.score}</span>
            </div>
          )}

          <div className="mt-4 rounded-xl border border-border overflow-hidden divide-y divide-border">
            {entries.map((e) => (
              <div
                key={e.rank}
                className={`flex items-center gap-4 px-4 py-3 ${e.isMe ? "bg-accent/5" : "bg-card"}`}
              >
                <span className="text-base font-bold text-foreground w-10 text-center">{medal(e.rank)}</span>
                <span className="flex-1 text-foreground truncate">@{e.username}</span>
                <span className="text-xs text-muted">{e.sessions} {t("leaderboard_sessions")}</span>
                <span className="text-base font-bold text-profit w-12 text-right">{e.score}</span>
              </div>
            ))}
          </div>
          <p className="text-xs text-muted/60 mt-3 text-center">{t("leaderboard_disclaimer")}</p>
        </>
      )}
    </div>
  );
}
