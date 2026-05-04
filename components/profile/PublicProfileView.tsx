"use client";

import { AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from "recharts";
import { useMemo } from "react";

interface Trade {
  open_time: string;
  pnl: number;
  commission: number | null;
  swap: number | null;
}

interface Review {
  created_at: string;
  discipline_score: number;
  analysis: { violations?: unknown[] };
}

interface Achievement {
  key: string;
  unlocked_at: string;
}

const BADGE_LABELS: Record<string, { label: string; emoji: string }> = {
  discipline_3: { label: "3 days discipline", emoji: "\u{1F525}" },
  discipline_10: { label: "10 days discipline", emoji: "\u{1F3C6}" },
  discipline_30: { label: "30 days discipline", emoji: "\u{1F48E}" },
  winrate_60: { label: "Winrate > 60%", emoji: "\u{1F3AF}" },
  score_80: { label: "Score > 80 for 1 month", emoji: "\u{2B50}" },
};

function netPnl(t: Trade) {
  return t.pnl + (t.commission || 0) + (t.swap || 0);
}

export default function PublicProfileView({
  username,
  trades,
  reviews,
  achievements,
}: {
  username: string;
  trades: Trade[];
  reviews: Review[];
  achievements: Achievement[];
}) {
  const stats = useMemo(() => {
    const count = trades.length;
    const netPnls = trades.map(netPnl);
    const wins = netPnls.filter((p) => p > 0).length;
    const winrate = count > 0 ? (wins / count) * 100 : 0;
    const totalPnl = netPnls.reduce((a, b) => a + b, 0);

    // Equity curve normalized (starting at 100)
    const startBalance = 10000; // nominal starting point for % calculation
    let running = startBalance;
    const equity = trades.map((tr) => {
      running += netPnl(tr);
      return {
        date: tr.open_time?.split("T")[0] || "",
        value: ((running - startBalance) / startBalance) * 100,
      };
    });

    const pnlPct = count > 0 ? ((running - startBalance) / startBalance) * 100 : 0;

    // Avg discipline score
    const scores = reviews.map((r) => r.discipline_score);
    const avgScore = scores.length > 0 ? scores.reduce((a, b) => a + b, 0) / scores.length : 0;

    // Current streak
    let streak = 0;
    const seenDays = new Set<string>();
    for (const r of reviews) {
      const day = r.created_at.split("T")[0];
      if (seenDays.has(day)) continue;
      seenDays.add(day);
      if (!r.analysis?.violations || r.analysis.violations.length === 0) streak++;
      else break;
    }

    return { count, winrate, totalPnl, pnlPct, avgScore, streak, equity };
  }, [trades, reviews]);

  return (
    <div className="min-h-screen bg-background text-foreground">
      <div className="max-w-4xl mx-auto px-6 py-10">
        {/* Header */}
        <div className="flex items-center justify-between mb-10">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-full bg-accent/10 border border-accent/30 flex items-center justify-center">
              <span className="text-accent font-bold text-lg">{username.charAt(0).toUpperCase()}</span>
            </div>
            <div>
              <h1 className="text-2xl font-bold text-foreground">@{username}</h1>
              <p className="text-xs text-muted">TradeDiscipline Public Profile</p>
            </div>
          </div>
          <a
            href="/"
            className="text-xs text-muted hover:text-foreground transition-colors"
          >
            tradediscipline.app
          </a>
        </div>

        {/* Stats grid */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
          <div className="bg-card border border-border rounded-xl p-5">
            <p className="text-xs text-muted">Total Trades</p>
            <p className="text-2xl font-bold mt-1 text-foreground">{stats.count}</p>
          </div>
          <div className="bg-card border border-border rounded-xl p-5">
            <p className="text-xs text-muted">Winrate</p>
            <p className="text-2xl font-bold mt-1 text-foreground">{stats.winrate.toFixed(1)}%</p>
          </div>
          <div className="bg-card border border-border rounded-xl p-5">
            <p className="text-xs text-muted">P&L</p>
            <p className={`text-2xl font-bold mt-1 ${stats.pnlPct >= 0 ? "text-profit" : "text-loss"}`}>
              {stats.pnlPct >= 0 ? "+" : ""}{stats.pnlPct.toFixed(2)}%
            </p>
          </div>
          <div className="bg-card border border-border rounded-xl p-5">
            <p className="text-xs text-muted">Discipline</p>
            <p className={`text-2xl font-bold mt-1 ${stats.avgScore >= 75 ? "text-profit" : stats.avgScore >= 50 ? "text-orange-400" : "text-loss"}`}>
              {stats.avgScore.toFixed(0)}/100
            </p>
          </div>
        </div>

        {/* Streak */}
        <div className="bg-card border border-border rounded-xl p-5 mb-8 flex items-center gap-4">
          <span className="text-4xl">{stats.streak > 0 ? "\u{1F525}" : "\u{2744}\u{FE0F}"}</span>
          <div>
            <p className="text-xl font-bold text-foreground">{stats.streak} days of discipline</p>
            <p className="text-xs text-muted">Current streak without rule violations</p>
          </div>
        </div>

        {/* Equity curve */}
        {stats.equity.length > 0 && (
          <div className="bg-card border border-border rounded-xl p-5 mb-8">
            <h2 className="text-foreground font-semibold mb-4">Equity Curve (%)</h2>
            <ResponsiveContainer width="100%" height={280}>
              <AreaChart data={stats.equity}>
                <defs>
                  <linearGradient id="gradient" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#22c55e" stopOpacity={0.3} />
                    <stop offset="95%" stopColor="#22c55e" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="rgb(var(--border))" />
                <XAxis dataKey="date" tick={{ fill: "rgb(var(--muted))", fontSize: 11 }} axisLine={{ stroke: "rgb(var(--border))" }} />
                <YAxis tick={{ fill: "rgb(var(--muted))", fontSize: 11 }} axisLine={{ stroke: "rgb(var(--border))" }} tickFormatter={(v) => `${v.toFixed(0)}%`} />
                <Tooltip
                  contentStyle={{ background: "rgb(var(--surface))", border: "1px solid rgb(var(--border))", borderRadius: 8 }}
                  labelStyle={{ color: "rgb(var(--muted))" }}
                  formatter={(v) => [`${Number(v).toFixed(2)}%`, "P&L"]}
                />
                <Area type="monotone" dataKey="value" stroke="#22c55e" fill="url(#gradient)" strokeWidth={2} />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        )}

        {/* Badges */}
        {achievements.length > 0 && (
          <div className="bg-card border border-border rounded-xl p-5 mb-8">
            <h2 className="text-foreground font-semibold mb-4">Achievements</h2>
            <div className="flex flex-wrap gap-2">
              {achievements.map((a) => {
                const def = BADGE_LABELS[a.key];
                if (!def) return null;
                return (
                  <div key={a.key} className="flex items-center gap-2 px-3 py-2 rounded-full bg-accent/10 border border-accent/30 text-accent text-xs">
                    <span>{def.emoji}</span>
                    <span>{def.label}</span>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* Footer */}
        <div className="text-center mt-12 pb-8">
          <a href="/" className="inline-block px-6 py-2.5 bg-accent text-white rounded-lg font-medium hover:bg-blue-600 transition-colors text-sm">
            Create your TradeDiscipline profile
          </a>
          <p className="text-xs text-muted mt-3">Track your trades. Master your discipline.</p>
        </div>
      </div>
    </div>
  );
}
