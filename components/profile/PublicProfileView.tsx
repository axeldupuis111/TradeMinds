"use client";

import { AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from "recharts";
import RiskDisclosure from "@/components/legal/RiskDisclosure";
import { Gem } from "lucide-react";
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
  founding = false,
  trades,
  reviews,
  sessionCount,
  achievements,
}: {
  username: string;
  /** Membre fondateur : l'un des 100 premiers abonnés, statut à vie. */
  founding?: boolean;
  trades: Trade[];
  /** Derniers bilans, du plus récent au plus ancien. Bornés pour la courbe. */
  reviews: Review[];
  /** Total réel des bilans, compté en base : `reviews` est tronqué. */
  sessionCount: number;
  achievements: Achievement[];
}) {
  const stats = useMemo(() => {
    const count = trades.length;
    const netPnls = trades.map(netPnl);
    const wins = netPnls.filter((p) => p > 0).length;
    const winrate = count > 0 ? (wins / count) * 100 : 0;

    // Pas de P&L ni de courbe d'equity sur un profil PUBLIC. Deux raisons qui
    // vont dans le même sens :
    //  - les guidelines du NinjaTrader Vendor Program interdisent de publier
    //    une statistique de performance d'un compte réel, taux de rendement en
    //    tête, sans pouvoir la démontrer représentative auprès de la NFA ;
    //  - le pourcentage affiché ici était de toute façon faux : il divisait le
    //    P&L par un solde de départ fictif de 10 000, identique pour tout le
    //    monde, et n'a donc jamais été le rendement du compte de personne.
    // Ce que le profil public montre désormais est ce qu'il prétend mesurer :
    // la discipline. Le P&L reste entier côté tableau de bord privé.

    // Score de discipline dans le temps. Les avis arrivent du plus récent au
    // plus ancien (voir la requête de la page) : on les remet à l'endroit.
    const disciplineSeries = reviews
      .slice()
      .reverse()
      .map((r) => ({
        date: r.created_at?.split("T")[0] || "",
        value: r.discipline_score,
      }));

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

    return { count, winrate, avgScore, streak, disciplineSeries };
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
              <div className="flex items-center gap-2 flex-wrap">
                <h1 className="text-2xl font-bold text-foreground">@{username}</h1>
                {founding && (
                  <span
                    className="inline-flex items-center gap-1 rounded-full border border-accent/30 bg-accent/10 px-2 py-0.5 text-[11px] font-semibold text-accent"
                    title="One of the first 100 members"
                  >
                    <Gem className="w-3 h-3" strokeWidth={2} aria-hidden />
                    Founding member
                  </span>
                )}
              </div>
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
            <p className="text-xs text-muted">Sessions reviewed</p>
            <p className="text-2xl font-bold mt-1 text-foreground">{sessionCount}</p>
          </div>
          <div className="bg-card border border-border rounded-xl p-5">
            <p className="text-xs text-muted">Discipline</p>
            <p className={`text-2xl font-bold mt-1 ${stats.avgScore >= 90 ? "text-profit" : stats.avgScore >= 75 ? "text-green-400" : stats.avgScore >= 60 ? "text-yellow-400" : stats.avgScore >= 40 ? "text-orange-400" : "text-loss"}`}>
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

        {/* Discipline dans le temps. Remplace l'ancienne courbe d'equity :
            même poids visuel, mais la métrique est celle que le produit
            revendique, et elle ne publie aucune performance de compte. */}
        {stats.disciplineSeries.length > 0 && (
          <div className="bg-card border border-border rounded-xl p-5 mb-8">
            <h2 className="text-foreground font-semibold mb-4">Discipline score over time</h2>
            <ResponsiveContainer width="100%" height={280}>
              <AreaChart data={stats.disciplineSeries}>
                <defs>
                  <linearGradient id="gradient" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="rgb(var(--accent))" stopOpacity={0.3} />
                    <stop offset="95%" stopColor="rgb(var(--accent))" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="rgb(var(--border))" />
                <XAxis dataKey="date" tick={{ fill: "rgb(var(--muted))", fontSize: 11 }} axisLine={{ stroke: "rgb(var(--border))" }} />
                <YAxis domain={[0, 100]} tick={{ fill: "rgb(var(--muted))", fontSize: 11 }} axisLine={{ stroke: "rgb(var(--border))" }} tickFormatter={(v) => `${v}`} />
                <Tooltip
                  contentStyle={{ background: "rgb(var(--surface))", border: "1px solid rgb(var(--border))", borderRadius: 8 }}
                  labelStyle={{ color: "rgb(var(--muted))" }}
                  formatter={(v) => [`${Number(v).toFixed(0)}/100`, "Discipline"]}
                />
                <Area type="monotone" dataKey="value" stroke="rgb(var(--accent))" fill="url(#gradient)" strokeWidth={2} />
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
          <a href="/" className="inline-block px-6 py-2.5 bg-accent text-on-accent rounded-lg font-medium hover:bg-accent-hover transition-colors text-sm">
            Create your TradeDiscipline profile
          </a>
          <p className="text-xs text-muted mt-3">Track your trades. Master your discipline.</p>
        </div>
      </div>
      <RiskDisclosure />
    </div>
  );
}
