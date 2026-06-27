"use client";

/**
 * Macro / Context — a daily AI-generated briefing on the world economy and the
 * events (scheduled announcements, central banks, geopolitics) that can move
 * markets. Premium-only; reads the shared `macro_analyses` cache through the
 * premium-gated /api/macro-analysis route. Informational context, never advice.
 */

import { useLanguage } from "@/lib/LanguageContext";
import { motion, useReducedMotion } from "framer-motion";
import { Globe2, Sparkles, Lock, AlertTriangle, History, Clock, CalendarRange, TrendingUp } from "lucide-react";
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

interface Analysis {
  analysis_date: string;
  headline: string;
  overview: string;
  themes: Section[];
  watchlist: Section[];
  outlook: Outlook | null;
  takeaway: string | null;
}

export default function MacroPage() {
  const { t, lang } = useLanguage();
  const dateLocale = ({ fr: "fr-FR", en: "en-US", de: "de-DE", es: "es-ES" } as const)[lang] ?? "en-US";
  const reducedMotion = useReducedMotion();

  const [analyses, setAnalyses] = useState<Analysis[]>([]);
  const [locked, setLocked] = useState(false);
  const [loading, setLoading] = useState(true);
  const [selectedDate, setSelectedDate] = useState<string | null>(null);

  useEffect(() => {
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
  }, [lang]);

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
          {/* Headline + date */}
          <div>
            <p className="text-xs font-semibold uppercase tracking-wider text-accent mb-1.5">
              {formatDate(selected.analysis_date)}
            </p>
            <h2 className="text-xl font-bold text-foreground leading-snug">{selected.headline}</h2>
          </div>

          {/* Overview */}
          <div className="rounded-xl border border-border bg-card p-5">
            <p className="text-sm text-foreground leading-relaxed">{selected.overview}</p>
          </div>

          {/* Expected impacts by horizon — the concrete, forward-looking part */}
          {selected.outlook && (selected.outlook.today || selected.outlook.days || selected.outlook.months) && (
            <section>
              <h3 className="text-xs font-bold uppercase tracking-wider text-foreground-muted mb-3">
                {t("macro_outlook")}
              </h3>
              <div className="space-y-2">
                {([
                  { key: "today", label: t("macro_outlook_today"), icon: Clock, body: selected.outlook.today },
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
