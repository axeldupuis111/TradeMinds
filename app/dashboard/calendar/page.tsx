"use client";

/**
 * Economic calendar — full agenda of upcoming macro announcements with a
 * pedagogical detail panel explaining each indicator (curated glossary, with
 * an AI fallback for indicators we haven't written up). Reads the shared
 * `economic_events` cache; degrades to an empty-state if the table/migration
 * isn't there yet. Filters persist across reloads (localStorage).
 */

import { useLanguage } from "@/lib/LanguageContext";
import { createClient } from "@/lib/supabase/client";
import { usePersistentState } from "@/lib/hooks/usePersistentState";
import {
  currenciesForPairs,
  impactEmoji,
  minutesUntil,
  type EconomicEvent,
  type Impact,
} from "@/lib/economic-calendar";
import { lookupGlossary, type GlossaryEntry, type GlossaryLang } from "@/lib/economic-glossary";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import { CalendarClock, CalendarDays, ChevronDown, Filter, Sparkles, X } from "lucide-react";
import { useEffect, useMemo, useState } from "react";

type EventRow = EconomicEvent & { id: string };

const FILTERABLE_IMPACTS: Impact[] = ["high", "medium", "low"];

// ─── Date range (investing.com-style selector) ──────────────────────────────
type DateMode = "upcoming" | "today" | "yesterday" | "last7" | "custom";

const DATE_PRESETS: { mode: DateMode; key: string }[] = [
  { mode: "upcoming", key: "cal_date_upcoming" },
  { mode: "today", key: "cal_date_today" },
  { mode: "yesterday", key: "cal_date_yesterday" },
  { mode: "last7", key: "cal_date_last7" },
];

const ymd = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
const parseYmd = (s: string) => { const [y, m, d] = s.split("-").map(Number); return new Date(y, (m || 1) - 1, d || 1); };
const startOfDay = (d: Date) => new Date(d.getFullYear(), d.getMonth(), d.getDate(), 0, 0, 0, 0);
const endOfDay = (d: Date) => new Date(d.getFullYear(), d.getMonth(), d.getDate(), 23, 59, 59, 999);

/** Yellow / orange / red styling by importance (mirrors EconomicCalendarCard). */
function impactStyle(impact: Impact): { row: string; badge: string } {
  switch (impact) {
    case "high":   return { row: "border-red-500/30 bg-red-500/5",       badge: "bg-red-500/15 text-red-500" };
    case "medium": return { row: "border-orange-500/30 bg-orange-500/5", badge: "bg-orange-500/15 text-orange-500" };
    default:       return { row: "border-yellow-500/25 bg-yellow-500/5", badge: "bg-yellow-500/15 text-yellow-600 dark:text-yellow-500" };
  }
}

function relativeLabel(ev: EconomicEvent, t: (k: string) => string): string {
  const mins = minutesUntil(ev.event_time);
  if (mins < -5) return t("news_passed");
  if (Math.abs(mins) <= 5) return t("news_now");
  if (mins < 60) return t("news_in_minutes").replace("{n}", String(mins));
  if (mins < 60 * 24) {
    const h = Math.floor(mins / 60);
    const m = mins % 60;
    return t("news_in_hours").replace("{h}", String(h)).replace("{m}", String(m).padStart(2, "0"));
  }
  return t("cal_in_days").replace("{n}", String(Math.round(mins / (60 * 24))));
}

/** Parse a feed numeric string like "3.2%", "-1.4", "210K", "1.2M". */
function parseNumeric(v: string | null | undefined): number | null {
  if (!v) return null;
  const m = v.replace(",", ".").match(/-?\d+(\.\d+)?/);
  if (!m) return null;
  let n = parseFloat(m[0]);
  if (/k/i.test(v)) n *= 1_000;
  if (/m/i.test(v)) n *= 1_000_000;
  if (/b/i.test(v)) n *= 1_000_000_000;
  return Number.isFinite(n) ? n : null;
}

/** ▲ / ▼ / null comparing actual against forecast. */
function surprise(ev: EconomicEvent): "up" | "down" | null {
  const a = parseNumeric(ev.actual);
  const f = parseNumeric(ev.forecast);
  if (a === null || f === null || a === f) return null;
  return a > f ? "up" : "down";
}

// ─── Detail drawer ──────────────────────────────────────────────────────────

function EventDetail({ ev, onClose }: { ev: EventRow; onClose: () => void }) {
  const { t, lang } = useLanguage();
  const glossaryLang = lang as GlossaryLang;
  const reducedMotion = useReducedMotion();

  const [entry, setEntry] = useState<GlossaryEntry | null>(null);
  const [source, setSource] = useState<"glossary" | "ai" | null>(null);
  const [loading, setLoading] = useState(true);
  const [showBeginner, setShowBeginner] = useState(false);

  useEffect(() => {
    let alive = true;
    setLoading(true);
    setShowBeginner(false);

    // Curated glossary first — instant, no network.
    const curated = lookupGlossary(ev.title, glossaryLang);
    if (curated) {
      setEntry(curated);
      setSource("glossary");
      setLoading(false);
      return;
    }

    // Fallback: cached / generated AI explanation.
    setEntry(null);
    setSource(null);
    fetch("/api/economic-calendar/explain", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ title: ev.title, currency: ev.currency, lang: glossaryLang }),
    })
      .then((r) => r.json())
      .then((data: { available?: boolean; source?: "glossary" | "ai"; whatItIs?: string; whyItMoves?: string; beginnerNote?: string }) => {
        if (!alive) return;
        if (data.available && data.whatItIs) {
          setEntry({ whatItIs: data.whatItIs, whyItMoves: data.whyItMoves || "", beginnerNote: data.beginnerNote || "" });
          setSource(data.source === "glossary" ? "glossary" : "ai");
        } else {
          setEntry(null);
          setSource(null);
        }
      })
      .catch(() => { if (alive) { setEntry(null); setSource(null); } })
      .finally(() => { if (alive) setLoading(false); });

    return () => { alive = false; };
  }, [ev.id, glossaryLang]); // eslint-disable-line react-hooks/exhaustive-deps

  const time = new Date(ev.event_time).toLocaleString(undefined, {
    weekday: "short", day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit",
  });
  const style = impactStyle(ev.impact);
  const dir = surprise(ev);

  return (
    <>
      <motion.div
        key="detail-backdrop"
        initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
        transition={{ duration: reducedMotion ? 0 : 0.2, ease: "easeOut" }}
        className="fixed inset-0 z-40 bg-black/60 backdrop-blur-sm"
        onClick={onClose}
      />
      <motion.aside
        key="detail-panel"
        initial={{ x: "100%" }} animate={{ x: 0 }} exit={{ x: "100%" }}
        transition={{ duration: reducedMotion ? 0 : 0.22, ease: "easeOut" }}
        className="fixed top-14 right-0 z-50 h-[calc(100%-3.5rem)] w-full max-w-md bg-card border-l border-border shadow-2xl flex flex-col"
        role="dialog" aria-modal="true" aria-label={ev.title}
      >
        {/* Header */}
        <div className="flex items-start justify-between gap-3 px-5 py-4 border-b border-border">
          <div className="min-w-0">
            <div className="flex items-center gap-2 mb-1">
              <span aria-hidden>{impactEmoji(ev.impact)}</span>
              <span className={`text-[10px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded ${style.badge}`}>
                {ev.currency}
              </span>
            </div>
            <h3 className="text-base font-bold text-foreground leading-snug">{ev.title}</h3>
            <p className="text-xs text-foreground-muted mt-0.5">{time} · {relativeLabel(ev, t)}</p>
          </div>
          <button onClick={onClose} className="p-1 rounded hover:bg-border/40 transition-colors shrink-0">
            <X className="w-4 h-4 text-foreground-muted" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-5 space-y-5">
          {/* Forecast / Previous / Actual */}
          {(ev.forecast || ev.previous || ev.actual) && (
            <div className="grid grid-cols-3 gap-2">
              {[
                { label: t("cal_previous"), value: ev.previous },
                { label: t("cal_forecast"), value: ev.forecast },
                { label: t("cal_actual"), value: ev.actual },
              ].map((cell) => (
                <div key={cell.label} className="rounded-lg border border-border bg-surface px-2 py-2 text-center">
                  <p className="text-[10px] uppercase tracking-wider text-foreground-muted mb-0.5">{cell.label}</p>
                  <p className="text-sm font-semibold tabular-nums text-foreground">{cell.value || "—"}</p>
                </div>
              ))}
            </div>
          )}
          {ev.actual && dir && (
            <p className={`text-xs font-medium ${dir === "up" ? "text-profit" : "text-loss"}`}>
              {dir === "up" ? "▲ " : "▼ "}{t(dir === "up" ? "cal_surprise_up" : "cal_surprise_down")}
            </p>
          )}

          {/* Explanation */}
          {loading ? (
            <div className="space-y-2">
              <div className="skeleton h-4 w-2/3 rounded" />
              <div className="skeleton h-3 w-full rounded" />
              <div className="skeleton h-3 w-5/6 rounded" />
            </div>
          ) : entry ? (
            <div className="space-y-4">
              <div>
                <p className="text-[10px] font-semibold uppercase tracking-wider text-foreground-muted mb-1">{t("cal_what_it_is")}</p>
                <p className="text-sm text-foreground leading-relaxed">{entry.whatItIs}</p>
              </div>
              {entry.whyItMoves && (
                <div>
                  <p className="text-[10px] font-semibold uppercase tracking-wider text-foreground-muted mb-1">{t("cal_why_it_moves")}</p>
                  <p className="text-sm text-foreground leading-relaxed">{entry.whyItMoves}</p>
                </div>
              )}
              {entry.beginnerNote && (
                <div className="rounded-lg border border-border bg-surface overflow-hidden">
                  <button
                    onClick={() => setShowBeginner((s) => !s)}
                    className="w-full flex items-center justify-between px-3 py-2 text-sm font-medium text-foreground hover:bg-border/20 transition-colors"
                  >
                    {t("cal_beginner")}
                    <ChevronDown className={`w-4 h-4 transition-transform ${showBeginner ? "rotate-180" : ""}`} />
                  </button>
                  {showBeginner && (
                    <p className="px-3 pb-3 text-sm text-foreground-muted leading-relaxed">{entry.beginnerNote}</p>
                  )}
                </div>
              )}
              {source === "ai" && (
                <p className="flex items-center gap-1.5 text-[11px] text-foreground-muted">
                  <Sparkles className="w-3.5 h-3.5 text-accent" /> {t("cal_explained_by_ai")}
                </p>
              )}
            </div>
          ) : (
            <p className="text-sm text-foreground-muted">{t("cal_no_explanation")}</p>
          )}
        </div>
      </motion.aside>
    </>
  );
}

// ─── Page ────────────────────────────────────────────────────────────────────

export default function CalendarPage() {
  const { t, lang } = useLanguage();
  const dateLocale = ({ fr: "fr-FR", en: "en-US", de: "de-DE", es: "es-ES" } as const)[lang] ?? "en-US";
  const supabase = createClient();
  const reducedMotion = useReducedMotion();

  const [events, setEvents] = useState<EventRow[]>([]);
  const [userCurrencies, setUserCurrencies] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState<EventRow | null>(null);
  const [showFilters, setShowFilters] = useState(false);

  // Date range (investing.com-style) — pick a day/range, including the past.
  const [dateMode, setDateMode] = useState<DateMode>("upcoming");
  const [customFrom, setCustomFrom] = useState<string>(ymd(new Date()));
  const [customTo, setCustomTo] = useState<string>(ymd(new Date()));

  // Persisted filters — remembered across reloads so the trader sets them once.
  const [currencyFilter, setCurrencyFilter] = usePersistentState<string[]>("cal_filter_currencies", []);
  const [impactFilter, setImpactFilter] = usePersistentState<Impact[]>("cal_filter_impacts", []);
  const [myCurrenciesOnly, setMyCurrenciesOnly] = usePersistentState<boolean>("cal_filter_mine", false);

  // Resolve the active [from, to] window from the selected mode. Memoized so the
  // fetch effect below only re-runs when the range actually changes.
  const { from, to } = useMemo(() => {
    const today = new Date();
    if (dateMode === "today") return { from: startOfDay(today), to: endOfDay(today) };
    if (dateMode === "yesterday") {
      const y = new Date(today); y.setDate(y.getDate() - 1);
      return { from: startOfDay(y), to: endOfDay(y) };
    }
    if (dateMode === "last7") {
      const s = new Date(today); s.setDate(s.getDate() - 7);
      return { from: startOfDay(s), to: endOfDay(today) };
    }
    if (dateMode === "custom") {
      const f = startOfDay(parseYmd(customFrom || ymd(today)));
      const tt = endOfDay(parseYmd(customTo || customFrom || ymd(today)));
      return f <= tt ? { from: f, to: tt } : { from: startOfDay(parseYmd(customTo)), to: endOfDay(parseYmd(customFrom)) };
    }
    const end = startOfDay(today); end.setDate(end.getDate() + 14); end.setHours(23, 59, 59, 999);
    return { from: startOfDay(today), to: end };
  }, [dateMode, customFrom, customTo]);

  // Trader's currencies (once) — powers the "my currencies" toggle.
  useEffect(() => {
    let alive = true;
    (async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;
      const since = new Date(); since.setDate(since.getDate() - 120);
      const { data: trades } = await supabase
        .from("trades").select("pair").eq("user_id", user.id)
        .gte("open_time", since.toISOString()).limit(500);
      if (!alive) return;
      const pairs = Array.from(new Set((trades ?? []).map((r) => (r as { pair: string }).pair).filter(Boolean)));
      setUserCurrencies(currenciesForPairs(pairs));
    })();
    return () => { alive = false; };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // Events for the active window — refetched whenever the date range changes.
  useEffect(() => {
    let alive = true;
    setLoading(true);
    (async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) { if (alive) { setEvents([]); setLoading(false); } return; }
      const { data: rows } = await supabase
        .from("economic_events")
        .select("id, event_time, currency, title, impact, forecast, previous, actual")
        .gte("event_time", from.toISOString())
        .lte("event_time", to.toISOString())
        .order("event_time", { ascending: true });
      if (!alive) return;
      setEvents((rows as EventRow[] | null) ?? []);
      setLoading(false);
    })();
    return () => { alive = false; };
  }, [from, to]); // eslint-disable-line react-hooks/exhaustive-deps

  // Currencies present in the loaded window, for the filter chips.
  const availableCurrencies = useMemo(
    () => Array.from(new Set(events.map((e) => e.currency.toUpperCase()))).sort(),
    [events],
  );

  const filtered = useMemo(() => {
    const mine = new Set(userCurrencies.map((c) => c.toUpperCase()));
    return events.filter((e) => {
      if (impactFilter.length > 0 && !impactFilter.includes(e.impact)) return false;
      if (myCurrenciesOnly && mine.size > 0 && !mine.has(e.currency.toUpperCase())) return false;
      if (currencyFilter.length > 0 && !currencyFilter.includes(e.currency.toUpperCase())) return false;
      return true;
    });
  }, [events, impactFilter, currencyFilter, myCurrenciesOnly, userCurrencies]);

  // Group by local calendar day.
  const groups = useMemo(() => {
    const map = new Map<string, EventRow[]>();
    for (const e of filtered) {
      const d = new Date(e.event_time);
      const key = `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`;
      if (!map.has(key)) map.set(key, []);
      map.get(key)!.push(e);
    }
    return Array.from(map.entries()).map(([key, evs]) => ({ key, date: new Date(evs[0].event_time), events: evs }));
  }, [filtered]);

  const hasFilters = currencyFilter.length > 0 || impactFilter.length > 0 || myCurrenciesOnly;

  const toggleImpact = (i: Impact) =>
    setImpactFilter((prev) => (prev.includes(i) ? prev.filter((x) => x !== i) : [...prev, i]));
  const toggleCurrency = (c: string) =>
    setCurrencyFilter((prev) => (prev.includes(c) ? prev.filter((x) => x !== c) : [...prev, c]));

  const datePill = (active: boolean) =>
    `px-2.5 py-1.5 rounded-md text-xs font-semibold transition-all ${active ? "bg-accent/20 text-accent" : "text-foreground-muted hover:text-foreground"}`;
  const dateInputCls =
    "px-2.5 py-1.5 bg-card border border-border rounded-lg text-foreground text-xs focus:outline-none focus:ring-1 focus:ring-accent focus:border-accent";

  return (
    <div>
      {/* Header */}
      <div className="mb-4 flex items-start gap-2">
        <CalendarClock className="w-6 h-6 text-warning shrink-0 mt-0.5" strokeWidth={1.75} />
        <div>
          <h1 className="text-2xl font-bold text-foreground">{t("cal_title")}</h1>
          <p className="text-foreground-muted text-sm mt-1">{t("cal_subtitle")}</p>
        </div>
      </div>

      {/* Filter bar — sticky (date navigation + filters) */}
      <div className="sticky top-0 z-30 -mx-6 px-6 py-3 mb-6 space-y-2.5 border-b border-border bg-background/95 backdrop-blur-md">

      {/* Date navigation — investing.com-style */}
      <div className="flex flex-wrap gap-2 items-center">
        <CalendarDays className="w-4 h-4 text-foreground-muted shrink-0" strokeWidth={1.75} />
        <div className="flex items-center gap-0.5 bg-card/60 rounded-lg p-0.5 border border-border/50">
          {DATE_PRESETS.map((p) => (
            <button key={p.mode} onClick={() => setDateMode(p.mode)} className={datePill(dateMode === p.mode)}>
              {t(p.key)}
            </button>
          ))}
          <button onClick={() => setDateMode("custom")} className={datePill(dateMode === "custom")}>
            {t("cal_date_custom")}
          </button>
        </div>
        {dateMode === "custom" && (
          <div className="flex items-center gap-1.5">
            <input type="date" value={customFrom} onChange={(e) => setCustomFrom(e.target.value)} className={dateInputCls} />
            <span className="text-foreground-muted text-xs">→</span>
            <input type="date" value={customTo} onChange={(e) => setCustomTo(e.target.value)} className={dateInputCls} />
          </div>
        )}
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-2 items-center">
        {/* Impact chips */}
        <div className="flex items-center gap-0.5 bg-card/60 rounded-lg p-0.5 border border-border/50">
          {FILTERABLE_IMPACTS.map((i) => {
            const active = impactFilter.includes(i);
            return (
              <button
                key={i}
                onClick={() => toggleImpact(i)}
                className={`px-2.5 py-1.5 rounded-md text-xs font-semibold transition-all ${active ? "bg-accent/20 text-accent" : "text-foreground-muted hover:text-foreground"}`}
              >
                {impactEmoji(i)} {t(`cal_impact_${i}`)}
              </button>
            );
          })}
        </div>

        {/* My currencies toggle */}
        {userCurrencies.length > 0 && (
          <button
            onClick={() => setMyCurrenciesOnly((v) => !v)}
            className={`px-3 py-1.5 rounded-lg text-xs font-semibold border transition-all ${myCurrenciesOnly ? "bg-accent/15 text-accent border-accent/30" : "bg-card border-border text-foreground-muted hover:text-foreground"}`}
          >
            {t("cal_my_currencies")}
          </button>
        )}

        <div className="flex-1" />

        {/* Currency filter button */}
        <button
          onClick={() => setShowFilters(true)}
          className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold border transition-all ${currencyFilter.length > 0 ? "bg-accent/15 text-accent border-accent/30" : "bg-card border-border text-foreground-muted hover:text-foreground"}`}
        >
          <Filter className="w-3.5 h-3.5" />
          {t("cal_currencies")}
          {currencyFilter.length > 0 && <span className="w-1.5 h-1.5 rounded-full bg-accent" />}
        </button>

        {hasFilters && (
          <button
            onClick={() => { setCurrencyFilter([]); setImpactFilter([]); setMyCurrenciesOnly(false); }}
            className="px-3 py-1.5 rounded-lg text-xs text-foreground-muted border border-border hover:bg-border/30 transition-colors"
          >
            {t("cal_reset")}
          </button>
        )}
      </div>

      </div>

      {/* List */}
      {loading ? (
        <div className="space-y-1.5">
          {Array.from({ length: 6 }).map((_, i) => <div key={i} className="skeleton h-12 rounded-lg" />)}
        </div>
      ) : filtered.length === 0 ? (
        <p className="text-foreground-muted py-10 text-center">{t("cal_empty")}</p>
      ) : (
        <div className="space-y-6">
          {groups.map((g) => (
            <section key={g.key}>
              <h2 className="-mx-6 px-6 py-1.5 text-xs font-bold uppercase tracking-wider text-foreground-muted">
                {g.date.toLocaleDateString(dateLocale, { weekday: "long", day: "2-digit", month: "long" })}
              </h2>
              <ul className="space-y-1.5 mt-2">
                {g.events.map((ev) => {
                  const time = new Date(ev.event_time).toLocaleTimeString(undefined, { hour: "2-digit", minute: "2-digit" });
                  const style = impactStyle(ev.impact);
                  const dir = surprise(ev);
                  return (
                    <li key={ev.id}>
                      <button
                        onClick={() => setSelected(ev)}
                        className={`w-full flex items-center gap-3 rounded-lg border px-3 py-2 text-left hover:brightness-110 transition ${style.row}`}
                      >
                        <span className="text-sm shrink-0" aria-hidden>{impactEmoji(ev.impact)}</span>
                        <span className="text-sm font-semibold tabular-nums text-foreground shrink-0 w-12">{time}</span>
                        <span className={`text-[10px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded shrink-0 ${style.badge}`}>{ev.currency}</span>
                        <span className="text-sm text-foreground flex-1 min-w-0 truncate">{ev.title}</span>
                        {ev.actual && dir && (
                          <span className={`text-xs font-semibold shrink-0 ${dir === "up" ? "text-profit" : "text-loss"}`}>
                            {dir === "up" ? "▲" : "▼"} {ev.actual}
                          </span>
                        )}
                        {!ev.actual && (
                          <span className="text-[11px] text-foreground-muted shrink-0 tabular-nums">{relativeLabel(ev, t)}</span>
                        )}
                      </button>
                    </li>
                  );
                })}
              </ul>
            </section>
          ))}
        </div>
      )}

      {/* Currency multiselect drawer */}
      <AnimatePresence>
        {showFilters && (
          <>
            <motion.div
              key="cur-backdrop"
              initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
              transition={{ duration: reducedMotion ? 0 : 0.2 }}
              className="fixed inset-0 z-40 bg-black/60 backdrop-blur-sm"
              onClick={() => setShowFilters(false)}
            />
            <motion.aside
              key="cur-panel"
              initial={{ x: "100%" }} animate={{ x: 0 }} exit={{ x: "100%" }}
              transition={{ duration: reducedMotion ? 0 : 0.22, ease: "easeOut" }}
              className="fixed top-14 right-0 z-50 h-[calc(100%-3.5rem)] w-72 bg-card border-l border-border shadow-2xl flex flex-col"
              role="dialog" aria-modal="true" aria-label={t("cal_currencies")}
            >
              <div className="flex items-center justify-between px-5 py-4 border-b border-border">
                <h3 className="text-sm font-bold text-foreground">{t("cal_currencies")}</h3>
                <button onClick={() => setShowFilters(false)} className="p-1 rounded hover:bg-border/40 transition-colors">
                  <X className="w-4 h-4 text-foreground-muted" />
                </button>
              </div>
              <div className="flex-1 overflow-y-auto p-5 space-y-1.5">
                {availableCurrencies.map((c) => (
                  <label key={c} className="flex items-center gap-2 cursor-pointer group">
                    <input
                      type="checkbox"
                      checked={currencyFilter.includes(c)}
                      onChange={() => toggleCurrency(c)}
                      className="rounded border-border accent-accent"
                    />
                    <span className="text-sm text-foreground">{c}</span>
                  </label>
                ))}
              </div>
              <div className="p-5 border-t border-border">
                <button
                  onClick={() => setCurrencyFilter([])}
                  className="w-full py-2 px-4 rounded-lg text-sm text-foreground-muted border border-border hover:bg-border/30 transition-colors"
                >
                  {t("cal_reset")}
                </button>
              </div>
            </motion.aside>
          </>
        )}
      </AnimatePresence>

      {/* Event detail drawer */}
      <AnimatePresence>
        {selected && <EventDetail ev={selected} onClose={() => setSelected(null)} />}
      </AnimatePresence>
    </div>
  );
}
