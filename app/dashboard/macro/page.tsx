"use client";

/**
 * Macro / Context — a daily AI-generated briefing on the world economy and the
 * events (scheduled announcements, central banks, geopolitics) that can move
 * markets. Premium-only; reads the shared `macro_analyses` cache through the
 * premium-gated /api/macro-analysis route. Informational context, never advice.
 *
 * Reading model: the page leads with a 20-second scannable synthesis (tldr
 * bullets + risk sentiment + per-asset dynamics + today's expected impacts);
 * the full prose analysis is collapsed behind "read the full analysis".
 * Briefings generated before the synthesis fields existed fall back to the
 * full layout, always expanded.
 */

import { useLanguage } from "@/lib/LanguageContext";
import { usePlan } from "@/lib/PlanContext";
import { DEMO_MACRO } from "@/lib/demo-fixtures";
import { motion, useReducedMotion } from "framer-motion";
import {
  Globe2, Sparkles, Lock, AlertTriangle, History, Clock, CalendarRange,
  TrendingUp, TrendingDown, MoveRight, Activity, ChevronDown, Zap,
} from "lucide-react";
import Link from "next/link";
import { useEffect, useMemo, useState } from "react";

interface Section {
  title: string;
  body: string;
}

interface Outlook {
  today?: string;
  days?: string;
  months?: string;
}

interface AssetImpact {
  asset: string;
  direction: string;
  note: string;
}

interface Analysis {
  analysis_date: string;
  headline: string;
  overview: string;
  tldr?: string[];
  sentiment?: string | null;
  assets?: AssetImpact[];
  themes: Section[];
  watchlist: Section[];
  outlook: Outlook | null;
  takeaway: string | null;
}

// Visual mapping for the enum codes stored in DB (labels come from i18n).
const DIRECTIONS: Record<string, { icon: typeof TrendingUp; cls: string }> = {
  up:       { icon: TrendingUp,   cls: "text-profit" },
  down:     { icon: TrendingDown, cls: "text-loss" },
  flat:     { icon: MoveRight,    cls: "text-foreground-muted" },
  volatile: { icon: Activity,     cls: "text-warning" },
};

const SENTIMENTS: Record<string, { key: string; cls: string }> = {
  risk_on:  { key: "macro_sentiment_risk_on",  cls: "border-profit/30 bg-profit/10 text-profit" },
  risk_off: { key: "macro_sentiment_risk_off", cls: "border-loss/30 bg-loss/10 text-loss" },
  neutral:  { key: "macro_sentiment_neutral",  cls: "border-border bg-surface text-foreground-muted" },
  mixed:    { key: "macro_sentiment_mixed",    cls: "border-warning/30 bg-warning/10 text-warning" },
};

const ASSET_LABEL_KEYS: Record<string, string> = {
  equities: "macro_asset_equities",
  dollar:   "macro_asset_dollar",
  rates:    "macro_asset_rates",
  gold:     "macro_asset_gold",
  oil:      "macro_asset_oil",
  crypto:   "macro_asset_crypto",
};

export default function MacroPage() {
  const { t, lang } = useLanguage();
  const { demoMode } = usePlan();
  const dateLocale = ({ fr: "fr-FR", en: "en-US", de: "de-DE", es: "es-ES" } as const)[lang] ?? "en-US";
  const reducedMotion = useReducedMotion();

  const [analyses, setAnalyses] = useState<Analysis[]>([]);
  const [locked, setLocked] = useState(false);
  const [loading, setLoading] = useState(true);
  const [selectedDate, setSelectedDate] = useState<string | null>(null);
  const [expanded, setExpanded] = useState(false);

  useEffect(() => {
    // Mode démo : briefing fictif servi depuis le code. Aucun appel réseau,
    // aucun contenu réel, et la rubrique reste visible malgré le gate premium
    // puisque tout l'intérêt de la démo est de montrer ce que le plan apporte.
    if (demoMode) {
      const fx = DEMO_MACRO[lang] ?? DEMO_MACRO.en;
      const today = new Date().toISOString().slice(0, 10);
      setLocked(false);
      setAnalyses([{ analysis_date: today, ...fx }]);
      setSelectedDate(today);
      setLoading(false);
      return;
    }

    let alive = true;
    setLoading(true);
    fetch(`/api/macro-analysis?lang=${lang}`)
      .then((r) => r.json())
      .then((data: { locked?: boolean; analyses?: Analysis[] }) => {
        if (!alive) return;
        setLocked(!!data.locked);
        setAnalyses(data.analyses ?? []);
        setSelectedDate((data.analyses ?? [])[0]?.analysis_date ?? null);
      })
      .catch(() => { if (alive) { setAnalyses([]); } })
      .finally(() => { if (alive) setLoading(false); });
    return () => { alive = false; };
  }, [lang, demoMode]);

  // Each briefing starts folded on its synthesis.
  useEffect(() => { setExpanded(false); }, [selectedDate]);

  const selected = useMemo(
    () => analyses.find((a) => a.analysis_date === selectedDate) ?? analyses[0] ?? null,
    [analyses, selectedDate],
  );

  const formatDate = (d: string) =>
    new Date(`${d}T00:00:00`).toLocaleDateString(dateLocale, {
      weekday: "long", day: "2-digit", month: "long", year: "numeric",
    });

  // ── Header ────────────────────────────────────────────────────────────────
  const header = (
    <div className="mb-5 flex items-start gap-2">
      <Globe2 className="w-6 h-6 text-accent shrink-0 mt-0.5" strokeWidth={1.75} />
      <div>
        <h1 className="text-2xl font-bold text-foreground">{t("macro_title")}</h1>
        <p className="text-foreground-muted text-sm mt-1">{t("macro_subtitle")}</p>
        {/* Non masquable, et volontairement au-dessus du contenu : quelqu'un qui
            prendrait ce briefing pour une vraie analyse pourrait trader dessus. */}
        {demoMode && (
          <p className="mt-3 text-xs font-semibold text-warning border border-warning/30 bg-warning/10 rounded-lg px-3 py-2">
            {t("macro_demo_warning")}
          </p>
        )}
      </div>
    </div>
  );

  if (loading) {
    return (
      <div>
        {header}
        <div className="space-y-3">
          <div className="skeleton h-6 w-2/3 rounded" />
          <div className="skeleton h-24 w-full rounded-xl" />
          <div className="skeleton h-32 w-full rounded-xl" />
        </div>
      </div>
    );
  }

  // ── Premium gate ────────────────────────────────────────────────────────────
  if (locked) {
    return (
      <div>
        {header}
        <div className="max-w-lg mx-auto mt-10 rounded-2xl border border-gold/30 bg-gold/5 p-8 text-center">
          <div className="w-12 h-12 mx-auto mb-4 rounded-xl bg-gold/15 flex items-center justify-center">
            <Lock className="w-6 h-6 text-gold" strokeWidth={1.75} />
          </div>
          <h2 className="text-lg font-bold text-foreground mb-2">{t("macro_locked_title")}</h2>
          <p className="text-sm text-foreground-muted mb-6">{t("macro_locked_desc")}</p>
          <Link
            href="/dashboard/upgrade"
            className="inline-flex items-center gap-2 px-5 py-2.5 rounded-lg bg-gradient-to-r from-gold to-amber-500 text-black font-semibold text-sm hover:brightness-110 transition"
          >
            <Sparkles className="w-4 h-4" /> {t("macro_locked_cta")}
          </Link>
        </div>
      </div>
    );
  }

  // ── Empty (premium but no briefing yet) ─────────────────────────────────────
  if (!selected) {
    return (
      <div>
        {header}
        <p className="text-foreground-muted py-16 text-center">{t("macro_empty")}</p>
      </div>
    );
  }

  const tldr = selected.tldr ?? [];
  const assets = (selected.assets ?? []).filter((a) => ASSET_LABEL_KEYS[a.asset]);
  const sentiment = selected.sentiment ? SENTIMENTS[selected.sentiment] : undefined;
  // Older briefings have no synthesis fields → show the full analysis directly.
  const hasEssentials = tldr.length > 0;
  const showDetail = expanded || !hasEssentials;

  // ── Briefing ────────────────────────────────────────────────────────────────
  return (
    <div>
      {header}

      <div className="grid grid-cols-1 lg:grid-cols-[1fr_220px] gap-6">
        {/* Main column */}
        <motion.article
          key={selected.analysis_date}
          initial={reducedMotion ? false : { opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: reducedMotion ? 0 : 0.25, ease: "easeOut" }}
          className="min-w-0 space-y-6"
        >
          {/* Date + sentiment + headline */}
          <div>
            <div className="flex flex-wrap items-center justify-between gap-2 mb-1.5">
              <p className="text-xs font-semibold uppercase tracking-wider text-accent">
                {formatDate(selected.analysis_date)}
              </p>
              {sentiment && (
                <span className={`inline-flex items-center px-2.5 py-1 rounded-full border text-[11px] font-bold uppercase tracking-wide ${sentiment.cls}`}>
                  {t(sentiment.key)}
                </span>
              )}
            </div>
            <h2 className="text-xl font-bold text-foreground leading-snug">{selected.headline}</h2>
          </div>

          {/* The gist in 20 seconds */}
          {hasEssentials && (
            <div className="rounded-xl border border-accent/30 bg-accent/5 p-5">
              <p className="flex items-center gap-1.5 text-xs font-bold uppercase tracking-wider text-accent mb-3">
                <Zap className="w-3.5 h-3.5" strokeWidth={2} /> {t("macro_tldr")}
              </p>
              <ul className="space-y-2">
                {tldr.map((line, i) => (
                  <li key={i} className="flex gap-2.5 text-sm text-foreground leading-relaxed">
                    <span className="mt-[7px] w-1.5 h-1.5 rounded-full bg-accent shrink-0" aria-hidden />
                    <span className="min-w-0 font-medium">{line}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}

          {/* Expected dynamics per asset class */}
          {assets.length > 0 && (
            <section>
              <h3 className="text-xs font-bold uppercase tracking-wider text-foreground-muted mb-3">
                {t("macro_assets")}
              </h3>
              <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
                {assets.map((a) => {
                  const dir = DIRECTIONS[a.direction] ?? DIRECTIONS.flat;
                  return (
                    <div key={a.asset} className="rounded-xl border border-border bg-surface p-3">
                      <div className="flex items-center justify-between gap-2 mb-1">
                        <p className="text-xs font-semibold text-foreground truncate">
                          {t(ASSET_LABEL_KEYS[a.asset])}
                        </p>
                        <dir.icon className={`w-4 h-4 shrink-0 ${dir.cls}`} strokeWidth={2} />
                      </div>
                      <p className="text-xs text-foreground-muted leading-snug">{a.note}</p>
                    </div>
                  );
                })}
              </div>
            </section>
          )}

          {/* Today's expected impacts — the concrete part, always visible */}
          {selected.outlook?.today && (
            <div className="flex gap-3 rounded-xl border border-accent/25 bg-accent/[0.04] p-4">
              <Clock className="w-4 h-4 text-accent shrink-0 mt-0.5" strokeWidth={1.75} />
              <div className="min-w-0">
                <p className="text-xs font-bold uppercase tracking-wider text-accent mb-0.5">
                  {t("macro_outlook_today")}
                </p>
                <p className="text-sm text-foreground-muted leading-relaxed">{selected.outlook.today}</p>
              </div>
            </div>
          )}

          {/* Fold / unfold the full prose analysis */}
          {hasEssentials && (
            <button
              onClick={() => setExpanded((v) => !v)}
              className="flex w-full items-center justify-center gap-1.5 rounded-xl border border-border bg-card px-4 py-2.5 text-sm font-semibold text-foreground-muted hover:text-foreground hover:bg-border/30 transition"
              aria-expanded={expanded}
            >
              {expanded ? t("macro_hide_full") : t("macro_read_full")}
              <ChevronDown className={`w-4 h-4 transition-transform ${expanded ? "rotate-180" : ""}`} strokeWidth={2} />
            </button>
          )}

          {showDetail && (
            <motion.div
              initial={reducedMotion || !hasEssentials ? false : { opacity: 0, y: 6 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: reducedMotion ? 0 : 0.2, ease: "easeOut" }}
              className="space-y-6"
            >
              {/* Overview */}
              <div className="rounded-xl border border-border bg-card p-5">
                <p className="text-sm text-foreground leading-relaxed">{selected.overview}</p>
              </div>

              {/* Expected impacts on the wider horizons */}
              {selected.outlook && (selected.outlook.days || selected.outlook.months) && (
                <section>
                  <h3 className="text-xs font-bold uppercase tracking-wider text-foreground-muted mb-3">
                    {t("macro_outlook")}
                  </h3>
                  <div className="space-y-2">
                    {([
                      { key: "days", label: t("macro_outlook_days"), icon: CalendarRange, body: selected.outlook.days },
                      { key: "months", label: t("macro_outlook_months"), icon: TrendingUp, body: selected.outlook.months },
                    ] as const)
                      .filter((h) => h.body)
                      .map((h) => (
                        <div key={h.key} className="flex gap-3 rounded-xl border border-accent/25 bg-accent/[0.04] p-4">
                          <h.icon className="w-4 h-4 text-accent shrink-0 mt-0.5" strokeWidth={1.75} />
                          <div className="min-w-0">
                            <p className="text-xs font-bold uppercase tracking-wider text-accent mb-0.5">{h.label}</p>
                            <p className="text-sm text-foreground-muted leading-relaxed">{h.body}</p>
                          </div>
                        </div>
                      ))}
                  </div>
                </section>
              )}

              {/* Themes */}
              {selected.themes.length > 0 && (
                <section>
                  <h3 className="text-xs font-bold uppercase tracking-wider text-foreground-muted mb-3">
                    {t("macro_themes")}
                  </h3>
                  <div className="space-y-3">
                    {selected.themes.map((s, i) => (
                      <div key={i} className="rounded-xl border border-border bg-surface p-4">
                        <p className="text-sm font-semibold text-foreground mb-1">{s.title}</p>
                        <p className="text-sm text-foreground-muted leading-relaxed">{s.body}</p>
                      </div>
                    ))}
                  </div>
                </section>
              )}

              {/* Watchlist */}
              {selected.watchlist.length > 0 && (
                <section>
                  <h3 className="text-xs font-bold uppercase tracking-wider text-foreground-muted mb-3">
                    {t("macro_watch")}
                  </h3>
                  <ul className="space-y-2">
                    {selected.watchlist.map((s, i) => (
                      <li key={i} className="flex gap-3 rounded-xl border border-warning/25 bg-warning/5 p-4">
                        <AlertTriangle className="w-4 h-4 text-warning shrink-0 mt-0.5" strokeWidth={1.75} />
                        <div className="min-w-0">
                          <p className="text-sm font-semibold text-foreground mb-0.5">{s.title}</p>
                          <p className="text-sm text-foreground-muted leading-relaxed">{s.body}</p>
                        </div>
                      </li>
                    ))}
                  </ul>
                </section>
              )}

              {/* Takeaway */}
              {selected.takeaway && (
                <div className="rounded-xl border border-accent/30 bg-accent/5 p-5">
                  <p className="text-xs font-bold uppercase tracking-wider text-accent mb-1.5">{t("macro_takeaway")}</p>
                  <p className="text-sm text-foreground leading-relaxed">{selected.takeaway}</p>
                </div>
              )}
            </motion.div>
          )}

          {/* AI + disclaimer */}
          <div className="space-y-2 pt-1">
            <p className="flex items-center gap-1.5 text-[11px] text-foreground-muted">
              <Sparkles className="w-3.5 h-3.5 text-accent" /> {t("macro_generated_by_ai")}
            </p>
            <p className="text-[11px] text-foreground-muted/80 leading-relaxed">{t("macro_disclaimer")}</p>
          </div>
        </motion.article>

        {/* History sidebar */}
        {analyses.length > 1 && (
          <aside className="lg:sticky lg:top-4 self-start">
            <h3 className="flex items-center gap-1.5 text-xs font-bold uppercase tracking-wider text-foreground-muted mb-3">
              <History className="w-3.5 h-3.5" /> {t("macro_history")}
            </h3>
            <ul className="space-y-1">
              {analyses.map((a) => {
                const active = a.analysis_date === selected.analysis_date;
                return (
                  <li key={a.analysis_date}>
                    <button
                      onClick={() => setSelectedDate(a.analysis_date)}
                      className={`w-full text-left px-3 py-2 rounded-lg text-xs transition ${
                        active
                          ? "bg-accent/15 text-accent font-semibold"
                          : "text-foreground-muted hover:bg-border/30 hover:text-foreground"
                      }`}
                    >
                      {new Date(`${a.analysis_date}T00:00:00`).toLocaleDateString(dateLocale, {
                        day: "2-digit", month: "short", year: "numeric",
                      })}
                    </button>
                  </li>
                );
              })}
            </ul>
          </aside>
        )}
      </div>
    </div>
  );
}
