"use client";

import { useLanguage } from "@/lib/LanguageContext";
import { usePlan } from "@/lib/PlanContext";
import { Pdf, C, type RGB } from "@/lib/pdf/kit";
import { ArrowDownRight, ArrowUpRight, Minus, Sparkles, ThumbsUp, Target, Compass, ChevronLeft, ChevronRight, FileDown } from "lucide-react";
import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import CountUp from "@/components/animations/CountUp";
import GrowBar from "@/components/animations/GrowBar";

interface Stats { trades: number; winRate: number; totalPnl: number; sessions: number; avgDisciplineScore: number | null; tradingDays: number }
interface Deltas { trades: number; winRate: number; sessions: number; avgDisciplineScore: number | null; tradingDays: number }
interface Extras { best: { date: string; pnl: number } | null; worst: { date: string; pnl: number } | null; topPair: { pair: string; count: number } | null; equity: number[]; prepRate: number | null }
interface Month { key: string; year: number; month0: number; isCurrentMonth: boolean }
interface CalDay { day: number; score: number | null; pnl: number }
interface TrendPt { label: string; score: number | null; pnl: number }
interface Records { greenDays: number; redDays: number; bestDisciplineDay: { date: string; score: number } | null; disciplinedStreak: number }
interface Review { headline: string; strength: string; improvement: string; focus: string }

function fmtMoney(n: number) { return `${n >= 0 ? "+" : ""}${n.toLocaleString("fr-FR", { maximumFractionDigits: 0 })} €`; }
function fmtDate(iso: string, lang: string) { return new Date(iso).toLocaleDateString(lang, { day: "numeric", month: "short" }); }

function scoreBg(s: number): string {
  if (s >= 85) return "bg-profit/80 text-white";
  if (s >= 70) return "bg-green-500/50 text-white";
  if (s >= 50) return "bg-yellow-500/40 text-foreground";
  return "bg-loss/50 text-white";
}
function scoreText(s: number): string {
  if (s >= 85) return "text-profit";
  if (s >= 70) return "text-green-400";
  if (s >= 50) return "text-warning";
  return "text-loss";
}

function Sparkline({ data }: { data: number[] }) {
  if (data.length < 2) return null;
  const min = Math.min(0, ...data), max = Math.max(0, ...data), range = max - min || 1;
  const w = 100, h = 36;
  const xy = data.map((v, i) => [(i / (data.length - 1)) * w, h - ((v - min) / range) * h] as const);
  const line = xy.map((p, i) => `${i ? "L" : "M"}${p[0].toFixed(1)},${p[1].toFixed(1)}`).join(" ");
  const area = `${line} L${w},${h} L0,${h} Z`;
  const color = data[data.length - 1] >= 0 ? "rgb(var(--profit))" : "rgb(var(--loss))";
  const zeroY = h - ((0 - min) / range) * h;
  return (
    <svg viewBox={`0 0 ${w} ${h}`} preserveAspectRatio="none" className="w-full h-12">
      <defs>
        <linearGradient id="rev-equity" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={color} stopOpacity="0.22" />
          <stop offset="100%" stopColor={color} stopOpacity="0" />
        </linearGradient>
      </defs>
      <line x1="0" y1={zeroY} x2={w} y2={zeroY} stroke="rgb(var(--border))" strokeWidth="0.5" strokeDasharray="2 2" />
      <path d={area} fill="url(#rev-equity)" />
      <path d={line} fill="none" stroke={color} strokeWidth="1.5" vectorEffect="non-scaling-stroke" strokeLinejoin="round" />
    </svg>
  );
}

export default function MonthlyReviewPage() {
  const { t, lang } = useLanguage();
  const { plan } = usePlan();
  const isPaid = plan === "plus" || plan === "premium";
  const [monthParam, setMonthParam] = useState<string | null>(null);
  const [loadingStats, setLoadingStats] = useState(true);
  const [aiLoading, setAiLoading] = useState(false);
  const [month, setMonth] = useState<Month | null>(null);
  const [stats, setStats] = useState<Stats | null>(null);
  const [deltas, setDeltas] = useState<Deltas | null>(null);
  const [extras, setExtras] = useState<Extras | null>(null);
  const [calendar, setCalendar] = useState<CalDay[]>([]);
  const [trend, setTrend] = useState<TrendPt[]>([]);
  const [records, setRecords] = useState<Records | null>(null);
  const [goalsSummary, setGoalsSummary] = useState<{ met: number; total: number } | null>(null);
  const [review, setReview] = useState<Review | null>(null);
  const [rawSummary, setRawSummary] = useState<string | null>(null);

  const loadStats = useCallback(async (mp: string | null) => {
    if (!isPaid) { setLoadingStats(false); return; }
    setLoadingStats(true);
    setReview(null); setRawSummary(null);
    try {
      const res = await fetch(`/api/monthly-review${mp ? `?month=${mp}` : ""}`);
      if (res.ok) {
        const d = await res.json();
        setMonth(d.month); setStats(d.stats); setDeltas(d.deltas); setExtras(d.extras);
        setCalendar(d.calendar ?? []); setTrend(d.trend ?? []); setRecords(d.records ?? null);

        // Pont Objectifs ↔ Bilan : uniquement pour le mois en cours (les objectifs
        // sont évalués sur la période courante, pas archivés par mois passé).
        if (d.month?.isCurrentMonth) {
          fetch("/api/goals").then((r) => r.json()).then((g) => {
            const list = (g.goals ?? []) as { kind: string; met?: boolean; done?: boolean }[];
            const monthly = list.filter((x) => x.kind === "metric" || x.kind === "custom");
            const met = monthly.filter((x) => x.met || x.done).length;
            setGoalsSummary({ met, total: monthly.length });
          }).catch(() => setGoalsSummary(null));
        } else {
          setGoalsSummary(null);
        }
      }
    } finally { setLoadingStats(false); }
  }, [isPaid]);

  useEffect(() => { loadStats(monthParam); }, [monthParam, loadStats]);

  function shiftMonth(delta: number) {
    if (!month) return;
    if (delta > 0 && month.isCurrentMonth) return;
    const d = new Date(month.year, month.month0 + delta, 1);
    setMonthParam(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`);
  }

  async function generate() {
    setAiLoading(true);
    try {
      const res = await fetch("/api/monthly-review", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ language: lang, month: month?.key }),
      });
      const d = await res.json();
      setReview(d.review ?? null); setRawSummary(d.rawSummary ?? null);
    } finally { setAiLoading(false); }
  }

  const [exporting, setExporting] = useState(false);

  async function exportPdf() {
    if (!stats || !month) return;
    setExporting(true);
    try {
      const locale = ({ fr: "fr-FR", en: "en-US", de: "de-DE", es: "es-ES" } as const)[lang as "fr" | "en" | "de" | "es"] ?? "en-US";
      const { jsPDF } = await import("jspdf");
      const doc = new jsPDF({ unit: "mm", format: "a4" });
      const pdf = new Pdf(doc);

      const titleCap = monthLabel.charAt(0).toUpperCase() + monthLabel.slice(1);
      const contTitle = `${t("review_title")} · ${titleCap}`;

      // Delta -> sous-texte de carte + couleur
      const deltaCard = (n?: number | null, suffix = "") => {
        if (typeof n !== "number" || n === 0) return { sub: undefined, subColor: undefined };
        return {
          sub: `${n > 0 ? "+" : ""}${n}${suffix}`,
          subColor: n > 0 ? C.green : (C.red as RGB),
        };
      };
      const scoreColor = (s: number): RGB => (s >= 70 ? C.green : s >= 50 ? C.amber : C.red);

      pdf.header({
        kicker: t("review_title"),
        title: titleCap,
        subtitle: new Date().toLocaleDateString(locale),
      });

      // ── KPIs ──
      pdf.section(t("review_title"));
      pdf.statGrid([
        { label: t("review_kpi_trades"), value: `${stats.trades}`, ...deltaCard(deltas?.trades) },
        { label: t("review_kpi_days"), value: `${stats.tradingDays}`, ...deltaCard(deltas?.tradingDays) },
        { label: t("review_kpi_winrate"), value: `${stats.winRate}%`, color: stats.winRate >= 50 ? C.green : C.amber, ...deltaCard(deltas?.winRate, " pts") },
        { label: t("review_kpi_sessions"), value: `${stats.sessions}`, ...deltaCard(deltas?.sessions) },
        { label: t("review_kpi_score"), value: stats.avgDisciplineScore != null ? `${stats.avgDisciplineScore}/100` : "—", color: stats.avgDisciplineScore != null ? scoreColor(stats.avgDisciplineScore) : C.faint, ...deltaCard(deltas?.avgDisciplineScore, " pts") },
        { label: t("review_kpi_prep"), value: extras?.prepRate != null ? `${extras.prepRate}%` : "—", color: C.teal },
      ]);

      // ── Equity du mois ──
      if (extras?.equity && extras.equity.length > 1) {
        pdf.section(t("equity_title"));
        pdf.areaChart(
          extras.equity.map((v) => ({ label: "", value: v })),
          { valueFmt: (n) => fmtMoney(n) },
        );
      }

      // ── Records ──
      if (records) {
        pdf.ensure(40, contTitle);
        pdf.section(t("review_records_title"));
        const recCards: { label: string; value: string; color?: RGB; sub?: string }[] = [
          { label: t("review_green_days"), value: `${records.greenDays}`, color: C.green },
          { label: t("review_red_days"), value: `${records.redDays}`, color: C.red },
          { label: t("review_disciplined_streak"), value: `${records.disciplinedStreak}`, color: C.teal },
        ];
        if (records.bestDisciplineDay) {
          recCards.push({
            label: t("review_best_discipline"),
            value: `${records.bestDisciplineDay.score}/100`,
            color: C.violet,
            sub: fmtDate(records.bestDisciplineDay.date, locale),
          });
        }
        pdf.statGrid(recCards, { cols: recCards.length >= 4 ? 4 : 3, height: 22 });
      }

      // ── Tendance 6 mois ──
      if (trend.some((p) => p.score != null)) {
        pdf.ensure(40, contTitle);
        pdf.section(t("review_trend_title"));
        pdf.bars(
          trend.map((p) => ({
            label: p.label,
            value: p.score != null ? `${p.score}/100` : "—",
            ratio: p.score != null ? p.score / 100 : 0,
            color: p.score != null ? scoreColor(p.score) : C.faint,
          })),
          { rowGap: 10 },
        );
        pdf.y += 4;
      }

      // ── Note du coach ──
      if (review) {
        pdf.ensure(50, contTitle);
        pdf.section(t("review_ai_title"));
        pdf.paragraph(review.headline, { accent: true });
        pdf.y += 1;
        const blocks: [string, string][] = [
          [t("review_strength"), review.strength],
          [t("review_improvement"), review.improvement],
          [t("review_focus"), review.focus],
        ];
        blocks.forEach(([label, body]) => {
          pdf.ensure(24, contTitle);
          pdf.paragraph(body, { label });
        });
      }

      pdf.footer(`${t("review_title")} · ${new Date().toLocaleDateString(locale)}`);
      doc.save(`TradeDiscipline-bilan-${month.key}.pdf`);
    } catch (err) {
      console.error("[Review PDF] error:", err);
    } finally {
      setExporting(false);
    }
  }

  const monthLabel = month ? new Date(month.year, month.month0, 1).toLocaleDateString(lang, { month: "long", year: "numeric" }) : "";
  const calByDay = new Map(calendar.map((c) => [c.day, c]));
  const daysInMonth = month ? new Date(month.year, month.month0 + 1, 0).getDate() : 0;
  const firstWeekday = month ? (new Date(month.year, month.month0, 1).getDay() + 6) % 7 : 0; // lundi=0

  return (
    <div className="max-w-4xl mx-auto pb-10">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-foreground">{t("review_title")}</h1>
          <p className="text-muted mt-1">{t("review_subtitle")}</p>
        </div>
        {isPaid && stats && !(stats.trades === 0 && stats.sessions === 0) && (
          <button onClick={exportPdf} disabled={exporting}
            className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg border border-border text-foreground text-sm hover:bg-surface transition-colors disabled:opacity-50 shrink-0">
            <FileDown className="w-4 h-4" />
            {exporting ? t("pdf_generating") : t("review_export_pdf")}
          </button>
        )}
      </div>

      {!isPaid ? (
        <div className="mt-6 rounded-xl border border-accent/30 bg-accent/5 p-6 text-center">
          <p className="text-foreground font-medium">{t("review_locked")}</p>
          <Link href="/dashboard/upgrade" className="inline-block mt-3 text-sm text-accent hover:underline">{t("upsell_banner_cta")}</Link>
        </div>
      ) : (
        <>
          {/* Navigation par mois */}
          <div className="mt-5 flex items-center justify-between">
            <button onClick={() => shiftMonth(-1)} className="p-2 rounded-lg border border-border text-muted hover:text-foreground hover:bg-surface transition-colors" aria-label={t("review_prev_month")}>
              <ChevronLeft className="w-4 h-4" />
            </button>
            <span className="text-sm font-semibold text-foreground capitalize">{monthLabel}</span>
            <button onClick={() => shiftMonth(1)} disabled={month?.isCurrentMonth}
              className="p-2 rounded-lg border border-border text-muted hover:text-foreground hover:bg-surface transition-colors disabled:opacity-30 disabled:cursor-not-allowed" aria-label={t("review_next_month")}>
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>

          {loadingStats ? (
            <div className="skeleton h-48 rounded-xl mt-4" />
          ) : stats && stats.trades === 0 && stats.sessions === 0 ? (
            <div className="mt-4 rounded-xl border border-dashed border-border p-8 text-center">
              <p className="text-muted text-sm">{t("review_empty")}</p>
            </div>
          ) : stats ? (
            <>
              <div className="mt-4 grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
                <Kpi label={t("review_kpi_trades")} value={`${stats.trades}`} delta={deltas?.trades} />
                <Kpi label={t("review_kpi_days")} value={`${stats.tradingDays}`} delta={deltas?.tradingDays} />
                <Kpi label={t("review_kpi_winrate")} value={`${stats.winRate}%`} delta={deltas?.winRate} suffix="pts" valueClass={stats.winRate >= 50 ? "text-profit" : "text-warning"} />
                <Kpi label={t("review_kpi_sessions")} value={`${stats.sessions}`} delta={deltas?.sessions} />
                <Kpi label={t("review_kpi_score")} value={stats.avgDisciplineScore != null ? `${stats.avgDisciplineScore}/100` : "—"} delta={deltas?.avgDisciplineScore ?? undefined} suffix="pts" valueClass={stats.avgDisciplineScore != null ? scoreText(stats.avgDisciplineScore) : "text-foreground"} />
                {extras?.prepRate != null && <Kpi label={t("review_kpi_prep")} value={`${extras.prepRate}%`} valueClass="text-teal-300" />}
              </div>

              {/* Pont Objectifs (mois en cours) */}
              {goalsSummary && goalsSummary.total > 0 && (
                <Link href="/dashboard/goals" className="mt-4 flex items-center gap-3 rounded-xl border border-accent/30 bg-accent/[0.04] p-4 hover:border-accent/50 transition-colors">
                  <Target className="w-5 h-5 text-accent shrink-0" />
                  <div className="flex-1">
                    <p className="text-sm font-semibold text-foreground">{t("review_goals_title")}</p>
                    <p className="text-xs text-muted">{t("review_goals_sub").replace("{met}", String(goalsSummary.met)).replace("{total}", String(goalsSummary.total))}</p>
                  </div>
                  <span className="text-xs text-accent font-medium whitespace-nowrap">{t("review_goals_link")} →</span>
                </Link>
              )}

              {/* Records du mois */}
              {records && (records.greenDays + records.redDays > 0 || records.bestDisciplineDay) && (
                <div className="mt-4">
                  <p className="text-xs text-muted mb-2">{t("review_records_title")}</p>
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                    <div className="rounded-xl border border-border bg-card p-3">
                      <p className="text-xs text-muted">{t("review_green_days")}</p>
                      <p className="text-lg font-bold text-profit mt-0.5">{records.greenDays}</p>
                    </div>
                    <div className="rounded-xl border border-border bg-card p-3">
                      <p className="text-xs text-muted">{t("review_red_days")}</p>
                      <p className="text-lg font-bold text-loss mt-0.5">{records.redDays}</p>
                    </div>
                    <div className="rounded-xl border border-border bg-card p-3">
                      <p className="text-xs text-muted">{t("review_disciplined_streak")}</p>
                      <p className="text-lg font-bold text-foreground mt-0.5">🔥 {records.disciplinedStreak}</p>
                    </div>
                    {records.bestDisciplineDay && (
                      <div className="rounded-xl border border-border bg-card p-3">
                        <p className="text-xs text-muted">{t("review_best_discipline")}</p>
                        <p className="text-lg font-bold text-foreground mt-0.5">{records.bestDisciplineDay.score}/100</p>
                        <p className="text-[10px] text-muted/70">{fmtDate(records.bestDisciplineDay.date, lang)}</p>
                      </div>
                    )}
                  </div>
                </div>
              )}

              <div className="mt-4 lg:grid lg:grid-cols-2 lg:gap-4 lg:items-start">
              {/* Tendance 6 mois (discipline) */}
              {trend.some((p) => p.score != null) && (
                <div className="rounded-xl border border-border bg-card p-4 mt-4 lg:mt-0">
                  <p className="text-xs text-muted mb-3">{t("review_trend_title")}</p>
                  <div className="flex items-end justify-between gap-2 h-24">
                    {trend.map((p, i) => (
                      <div key={p.label} className="flex-1 flex flex-col items-center gap-1">
                        <div className="w-full flex items-end justify-center h-20" title={p.score != null ? `${p.score}/100` : "—"}>
                          <div className="w-full max-w-[28px] h-full flex items-end">
                            <GrowBar vertical pct={p.score != null ? Math.max(8, p.score) : 4} durationMs={750} delayMs={i * 60}
                              className={`rounded-t ${p.score != null ? scoreBg(p.score) : "bg-surface"}`} />
                          </div>
                        </div>
                        <span className="text-[10px] text-muted">{p.label.slice(5)}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Calendrier de discipline du mois */}
              {month && (
                <div className="rounded-xl border border-border bg-card p-4 mt-4 lg:mt-0">
                  <p className="text-xs text-muted mb-2">{t("review_calendar_title")}</p>
                  <div className="grid grid-cols-7 gap-1">
                    {[0, 1, 2, 3, 4, 5, 6].map((wd) => (
                      <span key={wd} className="text-[9px] text-muted/60 text-center">{t(`review_wd_${wd}`)}</span>
                    ))}
                    {Array.from({ length: firstWeekday }).map((_, i) => <span key={`e${i}`} />)}
                    {Array.from({ length: daysInMonth }).map((_, i) => {
                      const day = i + 1;
                      const c = calByDay.get(day);
                      const cls = !c ? "bg-surface/40 text-muted/40"
                        : c.score != null ? scoreBg(c.score)
                        : c.pnl > 0 ? "bg-profit/20 text-foreground" : c.pnl < 0 ? "bg-loss/20 text-foreground" : "bg-surface text-muted";
                      return (
                        <span key={day} className={`aspect-square rounded flex items-center justify-center text-[10px] font-medium ${cls}`}
                          title={c ? `${c.score != null ? `${c.score}/100 · ` : ""}${fmtMoney(c.pnl)}` : ""}>
                          {day}
                        </span>
                      );
                    })}
                  </div>
                  <div className="flex items-center gap-3 mt-3 text-[10px] text-muted">
                    <span className="flex items-center gap-1"><span className="w-2.5 h-2.5 rounded bg-loss/50" />{"<50"}</span>
                    <span className="flex items-center gap-1"><span className="w-2.5 h-2.5 rounded bg-yellow-500/40" />50-69</span>
                    <span className="flex items-center gap-1"><span className="w-2.5 h-2.5 rounded bg-green-500/50" />70-84</span>
                    <span className="flex items-center gap-1"><span className="w-2.5 h-2.5 rounded bg-profit/80" />85+</span>
                  </div>
                </div>
              )}
              </div>

              {/* Équité + faits marquants */}
              {extras && extras.equity.length >= 2 && (
                <div className="mt-4 rounded-xl border border-border bg-card p-4">
                  <div className="flex items-baseline justify-between mb-1">
                    <p className="text-xs text-muted">{t("review_equity_title")}</p>
                    {(() => { const last = extras.equity[extras.equity.length - 1]; return (
                      <span className={`text-sm font-bold tabular-nums ${last >= 0 ? "text-profit" : "text-loss"}`}>{fmtMoney(last)}</span>
                    ); })()}
                  </div>
                  <Sparkline data={extras.equity} />
                </div>
              )}
              {extras && (extras.best || extras.topPair) && (
                <div className="mt-3 grid grid-cols-1 sm:grid-cols-3 gap-3">
                  {extras.best && <Highlight label={t("review_best_day")} value={fmtMoney(extras.best.pnl)} sub={fmtDate(extras.best.date, lang)} positive />}
                  {extras.worst && extras.worst.pnl < 0 && <Highlight label={t("review_worst_day")} value={fmtMoney(extras.worst.pnl)} sub={fmtDate(extras.worst.date, lang)} />}
                  {extras.topPair && <Highlight label={t("review_top_pair")} value={extras.topPair.pair} sub={`${extras.topPair.count} ${t("review_kpi_trades").toLowerCase()}`} />}
                </div>
              )}

              {/* Note du coach (IA) */}
              {review ? (
                <div className="mt-5 space-y-3">
                  <div className="rounded-xl border border-accent/30 bg-accent/5 p-5"><p className="text-base font-semibold text-foreground">{review.headline}</p></div>
                  <ReviewCard icon={<ThumbsUp className="w-4 h-4 text-profit" />} title={t("review_strength")} body={review.strength} />
                  <ReviewCard icon={<Target className="w-4 h-4 text-warning" />} title={t("review_improvement")} body={review.improvement} />
                  <ReviewCard icon={<Compass className="w-4 h-4 text-accent" />} title={t("review_focus")} body={review.focus} accent />
                  <button onClick={generate} disabled={aiLoading} className="text-sm text-muted hover:text-accent transition-colors disabled:opacity-50 underline underline-offset-2">{aiLoading ? t("review_generating") : t("review_regenerate")}</button>
                </div>
              ) : rawSummary ? (
                <div className="mt-5 rounded-xl border border-border bg-card p-5"><p className="text-sm text-muted leading-relaxed whitespace-pre-line">{rawSummary.replace(/\*\*/g, "")}</p></div>
              ) : (
                <button onClick={generate} disabled={aiLoading} className="mt-5 inline-flex items-center gap-2 px-5 py-2.5 rounded-lg bg-accent text-white text-sm font-medium hover:bg-blue-600 transition-colors disabled:opacity-50">
                  <Sparkles className="w-4 h-4" />{aiLoading ? t("review_generating") : t("review_generate")}
                </button>
              )}
            </>
          ) : null}
        </>
      )}
    </div>
  );
}

function Kpi({ label, value, delta, suffix, valueClass = "text-foreground" }: { label: string; value: string; delta?: number; suffix?: string; valueClass?: string }) {
  const showDelta = typeof delta === "number" && delta !== 0;
  const positive = (delta ?? 0) > 0;
  // Extrait le nombre de tête pour l'animer, en gardant le reste comme suffixe ("%", "/100").
  const m = value.match(/^(-?\d+(?:[.,]\d+)?)(.*)$/);
  return (
    <div className="rounded-xl border border-border bg-card p-4">
      <p className="text-xs text-muted">{label}</p>
      <div className="flex items-baseline gap-2 mt-1">
        <p className={`text-xl font-bold ${valueClass}`}>
          {m ? <CountUp end={Number(m[1].replace(",", "."))} suffix={m[2]} duration={1} /> : value}
        </p>
        {showDelta ? (
          <span className={`inline-flex items-center text-xs font-medium ${positive ? "text-profit" : "text-loss"}`}>
            {positive ? <ArrowUpRight className="w-3 h-3" /> : <ArrowDownRight className="w-3 h-3" />}{Math.abs(delta as number)}{suffix ? ` ${suffix}` : ""}
          </span>
        ) : (typeof delta === "number" && <Minus className="w-3 h-3 text-muted/40" />)}
      </div>
    </div>
  );
}

function Highlight({ label, value, sub, positive }: { label: string; value: string; sub: string; positive?: boolean }) {
  return (
    <div className="rounded-xl border border-border bg-card p-4">
      <p className="text-xs text-muted">{label}</p>
      <p className={`text-base font-bold mt-1 ${positive ? "text-profit" : "text-foreground"}`}>{value}</p>
      <p className="text-xs text-muted/70">{sub}</p>
    </div>
  );
}

function ReviewCard({ icon, title, body, accent }: { icon: React.ReactNode; title: string; body: string; accent?: boolean }) {
  return (
    <div className={`rounded-xl border p-4 ${accent ? "border-accent/30 bg-accent/[0.03]" : "border-border bg-card"}`}>
      <div className="flex items-center gap-2 mb-1.5">{icon}<h3 className="text-xs font-semibold text-foreground uppercase tracking-wider">{title}</h3></div>
      <p className="text-sm text-muted leading-relaxed">{body}</p>
    </div>
  );
}
