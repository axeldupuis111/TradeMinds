"use client";

import { AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from "recharts";
import { useLanguage } from "@/lib/LanguageContext";
import RiskDisclosure from "@/components/legal/RiskDisclosure";
import { Gem } from "lucide-react";
import { useMemo } from "react";
import { pourcent } from "@/lib/nombres";

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

/**
 * ⚠️⚠️ TOUTE CETTE PAGE ÉTAIT EN ANGLAIS, en dur, sur un produit traduit en
 * quatre langues — et l'avertissement de risque en bas, lui, sortait en
 * français. Deux langues sur la page qu'un trader partage publiquement,
 * c'est-à-dire la vitrine du produit.
 *
 * ⚠️ LA LANGUE EST CELLE DU VISITEUR, pas celle du profil : quelqu'un qui
 * découvre TradeDiscipline par ce lien doit le lire dans sa langue, sinon le
 * bouton « crée ton profil » juste en dessous ne veut rien dire pour lui.
 */
const BADGES: Record<string, { cle: string; emoji: string }> = {
  discipline_3: { cle: "pubprofile_badge_discipline_3", emoji: "\u{1F525}" },
  discipline_10: { cle: "pubprofile_badge_discipline_10", emoji: "\u{1F3C6}" },
  discipline_30: { cle: "pubprofile_badge_discipline_30", emoji: "\u{1F48E}" },
  winrate_60: { cle: "pubprofile_badge_winrate_60", emoji: "\u{1F3AF}" },
  score_80: { cle: "pubprofile_badge_score_80", emoji: "\u{2B50}" },
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
  serie,
  tradesComplets = true,
  disciplineComplete = true,
}: {
  username: string;
  /** Membre fondateur : l'un des 100 premiers abonnés, statut à vie. */
  founding?: boolean;
  trades: Trade[];
  /** Derniers bilans, du plus récent au plus ancien. Bornés pour la courbe. */
  reviews: Review[];
  /** Total réel des bilans, compté en base : `reviews` est tronqué. `null` si illisible. */
  sessionCount: number | null;
  /**
   * ⚠️⚠️ Vrai quand le journal a ete lu EN ENTIER. Faux, la page affichait
   * « 0 trade, 0 % de reussite » a des inconnus : un compte vide annonce sur la
   * surface que le trader partage, sans rien signaler.
   */
  tradesComplets?: boolean;
  /** Idem pour les bilans, d'ou sortent le score moyen et la courbe. */
  disciplineComplete?: boolean;
  achievements: Achievement[];
  /**
   * La série de discipline, calculée par `lib/discipline-streak-source.ts`.
   *
   * ⚠️ ELLE ARRIVE TOUTE FAITE, et c'est le point : cette vue comptait ses
   * propres bilans sans violation et annonçait « 0 jour » quand le tableau
   * de bord en affichait 75, pour le même compte, le même jour.
   */
  /** `null` quand la serie n'a pas pu etre lue : ce n'est pas zero. */
  serie: number | null;
}) {
  const { t, lang } = useLanguage();
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

    return { count, winrate, avgScore, disciplineSeries };
  }, [trades, reviews]);

  return (
    <div className="min-h-screen bg-background text-foreground force-dark">
      <main id="main-content" tabIndex={-1} className="max-w-4xl mx-auto px-6 py-10">
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
                    title={t("pubprofile_founding")}
                  >
                    <Gem className="w-3 h-3" strokeWidth={2} aria-hidden />
                    Founding member
                  </span>
                )}
              </div>
              <p className="text-xs text-muted">{t("pubprofile_subtitle")}</p>
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
            <p className="text-xs text-muted">{t("pubprofile_total_trades")}</p>
            <p className="text-2xl font-bold mt-1 text-foreground">
              {tradesComplets ? stats.count : "—"}
            </p>
          </div>
          <div className="bg-card border border-border rounded-xl p-5">
            <p className="text-xs text-muted">{t("pubprofile_winrate")}</p>
            <p className="text-2xl font-bold mt-1 text-foreground">
              {/*
                ⚠️ LA LANGUE EST PASSÉE, elle n'est pas devinée. Cette page est
                rendue sur le SERVEUR (c'est la seule qu'un inconnu voit et qu'un
                moteur indexe) et `langueCourante()` n'y a pas de document à lire :
                le taux sortait « 45,9 % », à la française, sous un document déclaré
                `lang="en"`. Le repli de `lib/nombres` a été corrigé aussi, mais un
                repli juste la plupart du temps reste faux le reste du temps.
              */}
              {tradesComplets ? pourcent(stats.winrate, 1, lang) : "—"}
            </p>
          </div>
          <div className="bg-card border border-border rounded-xl p-5">
            <p className="text-xs text-muted">{t("pubprofile_sessions")}</p>
            <p className="text-2xl font-bold mt-1 text-foreground">
              {sessionCount === null ? "—" : sessionCount}
            </p>
          </div>
          <div className="bg-card border border-border rounded-xl p-5">
            <p className="text-xs text-muted">{t("pubprofile_discipline")}</p>
            <p className={`text-2xl font-bold mt-1 ${stats.avgScore >= 90 ? "text-profit" : stats.avgScore >= 75 ? "text-green-400" : stats.avgScore >= 60 ? "text-yellow-400" : stats.avgScore >= 40 ? "text-orange-400" : "text-loss"}`}>
              {disciplineComplete ? `${stats.avgScore.toFixed(0)}/100` : "—"}
            </p>
          </div>
        </div>

        {/* Streak */}
        <div className="bg-card border border-border rounded-xl p-5 mb-8 flex items-center gap-4">
          {/* ⚠️ Trois états, pas deux : en série, à zéro, ou illisible. Un
              flocon sur une lecture ratée dirait « il a laissé filer », ce qui
              est une affirmation, et elle serait fausse. */}
          <span className="text-4xl">
            {serie === null ? "\u{2753}" : serie > 0 ? "\u{1F525}" : "\u{2744}\u{FE0F}"}
          </span>
          <div>
            <p className="text-xl font-bold text-foreground">
              {serie === null ? "—" : t("pubprofile_streak", { n: serie })}
            </p>
            <p className="text-xs text-muted">{t("pubprofile_streak_sub")}</p>
          </div>
        </div>

        {/* Discipline dans le temps. Remplace l'ancienne courbe d'equity :
            même poids visuel, mais la métrique est celle que le produit
            revendique, et elle ne publie aucune performance de compte. */}
        {stats.disciplineSeries.length > 0 && (
          <div className="bg-card border border-border rounded-xl p-5 mb-8">
            <h2 className="text-foreground font-semibold mb-4">{t("pubprofile_chart_title")}</h2>
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
                  formatter={(v) => [`${Number(v).toFixed(0)}/100`, t("pubprofile_discipline")]}
                />
                <Area type="monotone" dataKey="value" stroke="rgb(var(--accent))" fill="url(#gradient)" strokeWidth={2} />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        )}

        {/* Badges */}
        {achievements.length > 0 && (
          <div className="bg-card border border-border rounded-xl p-5 mb-8">
            <h2 className="text-foreground font-semibold mb-4">{t("pubprofile_achievements")}</h2>
            <div className="flex flex-wrap gap-2">
              {achievements.map((a) => {
                const def = BADGES[a.key];
                if (!def) return null;
                return (
                  <div key={a.key} className="flex items-center gap-2 px-3 py-2 rounded-full bg-accent/10 border border-accent/30 text-accent text-xs">
                    <span>{def.emoji}</span>
                    <span>{t(def.cle)}</span>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* Footer */}
        <div className="text-center mt-12 pb-8">
          <a href="/" className="inline-block px-6 py-2.5 bg-accent text-on-accent rounded-lg font-medium hover:bg-accent-hover transition-colors text-sm">
            {t("pubprofile_cta")}
          </a>
          <p className="text-xs text-muted mt-3">{t("pubprofile_cta_sub")}</p>
        </div>
      </main>
      <RiskDisclosure />
    </div>
  );
}
