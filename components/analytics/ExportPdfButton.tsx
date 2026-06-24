"use client";

import UpgradeBanner from "@/components/UpgradeBanner";
import { Pdf, C, money, signedMoney } from "@/lib/pdf/kit";
import { Button } from "@/components/ui/Button";
import { useLanguage } from "@/lib/LanguageContext";
import { usePlan } from "@/lib/PlanContext";
import { createClient } from "@/lib/supabase/client";
import { FileDown } from "lucide-react";
import { useState } from "react";

interface ExportTrade {
  open_time: string;
  pair: string;
  direction?: string;
  pnl: number;
  commission: number | null;
  swap: number | null;
}

interface ExportPdfButtonProps {
  /** Trades déjà filtrés par la page (période + compte + filtres avancés). */
  trades: ExportTrade[];
  /** Libellé lisible de la période sélectionnée (ex. "30 derniers jours"). */
  periodLabel: string;
  /** Libellé lisible du compte sélectionné (ex. "Tous les comptes"). */
  accountLabel: string;
}

function netPnl(t: { pnl: number; commission: number | null; swap: number | null }) {
  return t.pnl + (t.commission || 0) + (t.swap || 0);
}

export default function ExportPdfButton({ trades, periodLabel, accountLabel }: ExportPdfButtonProps) {
  const { t, lang } = useLanguage();
  const pdfLocale = ({ fr: "fr-FR", en: "en-US", de: "de-DE", es: "es-ES" } as const)[lang] ?? "en-US";
  const { plan, loading: planLoading } = usePlan();
  const supabase = createClient();
  const [generating, setGenerating] = useState(false);
  const [showLocked, setShowLocked] = useState(false);

  const canExport = !planLoading && (plan === "plus" || plan === "premium");

  async function generatePdf() {
    if (!canExport) {
      setShowLocked(true);
      return;
    }

    // Données = exactement la sélection en cours de la page (période + compte).
    const monthTrades = (trades || []).filter((tr) => tr.open_time).slice().sort((a, b) => a.open_time.localeCompare(b.open_time));
    if (monthTrades.length === 0) {
      alert(t("pdf_no_data"));
      return;
    }

    setGenerating(true);
    try {
      const now = new Date();

      // Dernier bilan (infractions / recommandations) — optionnel, non bloquant.
      const { data: { user } } = await supabase.auth.getUser();
      let lastReview: { discipline_score: number | null; analysis: unknown } | null = null;
      if (user) {
        const { data } = await supabase
          .from("session_reviews")
          .select("discipline_score, analysis")
          .eq("user_id", user.id)
          .order("created_at", { ascending: false })
          .limit(1)
          .single();
        lastReview = data ?? null;
      }

      // Compute stats
      const netPnls = monthTrades.map(netPnl);
      const wins = netPnls.filter((p) => p > 0).length;
      const winrate = monthTrades.length > 0 ? (wins / monthTrades.length) * 100 : 0;
      const totalPnl = netPnls.reduce((a, b) => a + b, 0);
      const best = Math.max(...netPnls);
      const worst = Math.min(...netPnls);
      const disciplineScore = lastReview?.discipline_score ?? null;

      // Equity curve data
      let running = 0;
      const equityData = monthTrades.map((tr) => {
        running += netPnl(tr);
        return { date: tr.open_time.split("T")[0], balance: running };
      });

      // By pair
      const byPair: Record<string, { total: number; count: number }> = {};
      monthTrades.forEach((tr) => {
        if (!byPair[tr.pair]) byPair[tr.pair] = { total: 0, count: 0 };
        byPair[tr.pair].total += netPnl(tr);
        byPair[tr.pair].count++;
      });
      const pairStats = Object.entries(byPair)
        .sort((a, b) => b[1].total - a[1].total)
        .slice(0, 10);

      // By day of week
      // Localized short weekday names, Sunday-first (2024-01-07 is a Sunday).
      const DAYS = Array.from({ length: 7 }, (_, i) =>
        new Date(Date.UTC(2024, 0, 7 + i)).toLocaleDateString(pdfLocale, { weekday: "short" })
      );
      const byDay = Array.from({ length: 7 }, () => ({ total: 0, count: 0 }));
      monthTrades.forEach((tr) => {
        if (tr.open_time) {
          const d = new Date(tr.open_time).getDay();
          byDay[d].total += netPnl(tr);
          byDay[d].count++;
        }
      });

      // Violations from last review
      const rawViolations = (lastReview?.analysis as { violations?: Array<Record<string, string>> })?.violations || [];
      const violations = rawViolations.map((v) => ({
        pair: v.pair || "",
        rule_violated: v.rule_violated || v.type || "",
        trade_date: v.trade_date || "",
        explanation: v.explanation || "",
      }));
      const recommendations = (lastReview?.analysis as { recommendations?: string[] })?.recommendations || [];

      // Generate PDF
      const { jsPDF } = await import("jspdf");
      const doc = new jsPDF({ unit: "mm", format: "a4" });
      const pdf = new Pdf(doc);

      const contTitle = `${t("analytics_title")} · ${periodLabel}`;

      pdf.header({
        kicker: t("analytics_title"),
        title: periodLabel,
        subtitle: `${accountLabel} · ${now.toLocaleDateString(pdfLocale)}`,
      });

      // ── Résumé ──
      pdf.section(t("pdf_summary"));
      pdf.statGrid([
        { label: "Trades", value: String(monthTrades.length) },
        { label: "Winrate", value: `${winrate.toFixed(1)}%`, color: winrate >= 50 ? C.green : C.amber },
        { label: "P&L", value: signedMoney(totalPnl), color: totalPnl >= 0 ? C.green : C.red },
        { label: t("pdf_best_trade"), value: signedMoney(best), color: C.green },
        { label: t("pdf_worst_trade"), value: signedMoney(worst), color: C.red },
        {
          label: t("pdf_avg_discipline"),
          value: disciplineScore !== null ? `${disciplineScore}/100` : "N/A",
          color: C.teal,
        },
      ]);

      // ── Equity curve ──
      if (equityData.length > 1) {
        pdf.section(t("equity_title"));
        pdf.areaChart(
          equityData.map((e) => ({ label: e.date, value: e.balance })),
          { valueFmt: (n) => money(n, 0) },
        );
      }

      // ── Performance par paire ──
      if (pairStats.length > 0) {
        pdf.ensure(50, contTitle);
        pdf.section(t("analytics_by_pair"));
        const maxAbs = Math.max(...pairStats.map(([, s]) => Math.abs(s.total)), 1);
        pdf.bars(
          pairStats.slice(0, 8).map(([pair, s]) => ({
            label: `${pair}   ·   ${s.count}`,
            value: signedMoney(s.total),
            ratio: Math.abs(s.total) / maxAbs,
            color: s.total >= 0 ? C.green : C.red,
            valueColor: s.total >= 0 ? C.green : C.red,
          })),
        );
        pdf.y += 4;
      }

      // ── Performance par jour ──
      const dayRows = DAYS.map((d, i) => ({ d, ...byDay[i] })).filter((r) => r.count > 0);
      if (dayRows.length > 0) {
        pdf.ensure(50, contTitle);
        pdf.section(t("pdf_perf_by_day"));
        const maxDay = Math.max(...dayRows.map((r) => Math.abs(r.total)), 1);
        pdf.bars(
          dayRows.map((r) => ({
            label: `${r.d}   ·   ${r.count}`,
            value: signedMoney(r.total),
            ratio: Math.abs(r.total) / maxDay,
            color: r.total >= 0 ? C.green : C.red,
            valueColor: r.total >= 0 ? C.green : C.red,
          })),
        );
        pdf.y += 4;
      }

      // ── Infractions ──
      if (violations.length > 0) {
        pdf.ensure(40, contTitle);
        pdf.section(t("pdf_main_violations"));
        violations.slice(0, 5).forEach((v) => {
          pdf.ensure(16, contTitle);
          const label =
            v.pair && v.trade_date
              ? `${v.pair} (${v.trade_date}) — ${v.rule_violated}`
              : `${v.rule_violated}${v.explanation ? `: ${v.explanation}` : ""}`;
          pdf.bullet(label, { color: C.red });
        });
        pdf.y += 3;
      }

      // ── Recommandations IA ──
      if (recommendations.length > 0) {
        pdf.ensure(40, contTitle);
        pdf.section(t("pdf_ai_reco"));
        recommendations.slice(0, 3).forEach((r, i) => {
          pdf.ensure(18, contTitle);
          pdf.bullet(r, { index: i + 1, color: C.teal });
        });
      }

      pdf.footer(`${t("analytics_title")} · ${periodLabel} · ${accountLabel}`);
      // NFD sépare les accents en marques combinantes, retirées ensuite comme
      // tout caractère non alphanumérique.
      const slug = (s: string) =>
        s
          .normalize("NFD")
          .replace(/[^a-zA-Z0-9]+/g, "-")
          .replace(/^-+|-+$/g, "")
          .toLowerCase() || "rapport";
      doc.save(`TradeDiscipline-analytics-${slug(periodLabel)}-${slug(accountLabel)}-${now.toISOString().split("T")[0]}.pdf`);
    } catch (err) {
      console.error("PDF generation error:", err);
      alert(t("pdf_error"));
    } finally {
      setGenerating(false);
    }
  }

  return (
    <>
      <Button
        variant="secondary"
        size="md"
        icon={FileDown}
        loading={generating}
        onClick={generatePdf}
      >
        {generating ? t("pdf_generating") : t("pdf_export")}
      </Button>

      {showLocked && (
        <div className="fixed inset-0 z-50 bg-black/60 flex items-center justify-center p-6" onClick={() => setShowLocked(false)}>
          <div className="max-w-md w-full" onClick={(e) => e.stopPropagation()}>
            <UpgradeBanner message={t("pdf_locked")} />
            <button
              onClick={() => setShowLocked(false)}
              className="mt-3 w-full px-4 py-2 bg-surface border border-border text-foreground rounded-lg text-sm"
            >
              {t("analysis_close")}
            </button>
          </div>
        </div>
      )}
    </>
  );
}
