"use client";

import UpgradeBanner from "@/components/UpgradeBanner";
import { useLanguage } from "@/lib/LanguageContext";
import { usePlan } from "@/lib/PlanContext";
import { createClient } from "@/lib/supabase/client";
import { useState } from "react";

function netPnl(t: { pnl: number; commission: number | null; swap: number | null }) {
  return t.pnl + (t.commission || 0) + (t.swap || 0);
}

const MONTHS_FR = ["Janvier", "Février", "Mars", "Avril", "Mai", "Juin", "Juillet", "Août", "Septembre", "Octobre", "Novembre", "Décembre"];

export default function ExportPdfButton() {
  const { t } = useLanguage();
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

    setGenerating(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Non connecté");

      // Load data for past month
      const now = new Date();
      const firstOfMonth = new Date(now.getFullYear(), now.getMonth(), 1).toISOString();
      const endOfMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59).toISOString();

      const [{ data: trades }, { data: lastReview }] = await Promise.all([
        supabase
          .from("trades")
          .select("open_time, pair, direction, pnl, commission, swap")
          .eq("user_id", user.id)
          .gte("open_time", firstOfMonth)
          .lte("open_time", endOfMonth)
          .order("open_time", { ascending: true }),
        supabase
          .from("session_reviews")
          .select("discipline_score, analysis")
          .eq("user_id", user.id)
          .order("created_at", { ascending: false })
          .limit(1)
          .single(),
      ]);

      const monthTrades = trades || [];
      if (monthTrades.length === 0) {
        alert(t("pdf_no_data"));
        setGenerating(false);
        return;
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
      const DAYS = ["Dim", "Lun", "Mar", "Mer", "Jeu", "Ven", "Sam"];
      const byDay = Array.from({ length: 7 }, () => ({ total: 0, count: 0 }));
      monthTrades.forEach((tr) => {
        if (tr.open_time) {
          const d = new Date(tr.open_time).getDay();
          byDay[d].total += netPnl(tr);
          byDay[d].count++;
        }
      });

      // Violations from last review
      const violations = (lastReview?.analysis as { violations?: Array<{ pair: string; rule_violated: string; trade_date: string }> })?.violations || [];
      const recommendations = (lastReview?.analysis as { recommendations?: string[] })?.recommendations || [];

      // Generate PDF
      const { jsPDF } = await import("jspdf");
      const doc = new jsPDF({ unit: "mm", format: "a4" });
      const pageWidth = doc.internal.pageSize.getWidth();
      const margin = 15;
      let y = margin;

      // Header
      doc.setFillColor(37, 99, 235);
      doc.rect(0, 0, pageWidth, 30, "F");
      doc.setTextColor(255, 255, 255);
      doc.setFontSize(20);
      doc.setFont("helvetica", "bold");
      doc.text("TradeDiscipline", margin, 15);
      doc.setFontSize(11);
      doc.setFont("helvetica", "normal");
      const monthLabel = `${MONTHS_FR[now.getMonth()]} ${now.getFullYear()}`;
      doc.text(`Rapport mensuel - ${monthLabel}`, margin, 23);
      y = 40;

      // Section 1: Summary
      doc.setTextColor(30, 30, 30);
      doc.setFontSize(14);
      doc.setFont("helvetica", "bold");
      doc.text("Resume", margin, y);
      y += 7;
      doc.setDrawColor(200, 200, 200);
      doc.line(margin, y, pageWidth - margin, y);
      y += 6;

      doc.setFontSize(10);
      doc.setFont("helvetica", "normal");
      const summaryRows = [
        [`Total trades:`, `${monthTrades.length}`],
        [`Winrate:`, `${winrate.toFixed(1)}%`],
        [`P&L total:`, `${totalPnl >= 0 ? "+" : ""}${totalPnl.toFixed(2)} EUR`],
        [`Meilleur trade:`, `+${best.toFixed(2)} EUR`],
        [`Pire trade:`, `${worst.toFixed(2)} EUR`],
        [`Score discipline moyen:`, disciplineScore !== null ? `${disciplineScore}/100` : "N/A"],
      ];
      summaryRows.forEach(([label, value]) => {
        doc.setFont("helvetica", "normal");
        doc.text(label, margin, y);
        doc.setFont("helvetica", "bold");
        doc.text(value, margin + 60, y);
        y += 6;
      });
      y += 6;

      // Section 2: Equity curve (simple ASCII-like chart using lines)
      doc.setFontSize(14);
      doc.setFont("helvetica", "bold");
      doc.text("Equity Curve", margin, y);
      y += 7;
      doc.line(margin, y, pageWidth - margin, y);
      y += 5;

      // Simple line chart
      if (equityData.length > 1) {
        const chartHeight = 40;
        const chartWidth = pageWidth - 2 * margin;
        const minBal = Math.min(0, ...equityData.map((e) => e.balance));
        const maxBal = Math.max(0, ...equityData.map((e) => e.balance));
        const range = maxBal - minBal || 1;

        const xScale = chartWidth / (equityData.length - 1);

        // Zero line
        const zeroY = y + chartHeight - ((0 - minBal) / range) * chartHeight;
        doc.setDrawColor(220, 220, 220);
        doc.line(margin, zeroY, pageWidth - margin, zeroY);

        // Line
        doc.setDrawColor(totalPnl >= 0 ? 34 : 239, totalPnl >= 0 ? 197 : 68, totalPnl >= 0 ? 94 : 68);
        doc.setLineWidth(0.5);
        for (let i = 1; i < equityData.length; i++) {
          const x1 = margin + (i - 1) * xScale;
          const x2 = margin + i * xScale;
          const y1 = y + chartHeight - ((equityData[i - 1].balance - minBal) / range) * chartHeight;
          const y2 = y + chartHeight - ((equityData[i].balance - minBal) / range) * chartHeight;
          doc.line(x1, y1, x2, y2);
        }
        doc.setLineWidth(0.2);
        y += chartHeight + 10;
      }

      // Section 3: Performance by pair
      if (y > 240) { doc.addPage(); y = margin; }
      doc.setTextColor(30, 30, 30);
      doc.setFontSize(14);
      doc.setFont("helvetica", "bold");
      doc.text("Performance par paire", margin, y);
      y += 7;
      doc.line(margin, y, pageWidth - margin, y);
      y += 5;
      doc.setFontSize(10);
      doc.setFont("helvetica", "bold");
      doc.text("Paire", margin, y);
      doc.text("Trades", margin + 60, y);
      doc.text("P&L", margin + 90, y);
      y += 5;
      doc.setFont("helvetica", "normal");
      pairStats.forEach(([pair, stats]) => {
        if (y > 270) { doc.addPage(); y = margin; }
        doc.text(pair, margin, y);
        doc.text(String(stats.count), margin + 60, y);
        doc.setTextColor(stats.total >= 0 ? 34 : 239, stats.total >= 0 ? 197 : 68, stats.total >= 0 ? 94 : 68);
        doc.text(`${stats.total >= 0 ? "+" : ""}${stats.total.toFixed(2)} EUR`, margin + 90, y);
        doc.setTextColor(30, 30, 30);
        y += 5;
      });
      y += 5;

      // Section 4: Performance by day of week
      if (y > 230) { doc.addPage(); y = margin; }
      doc.setFontSize(14);
      doc.setFont("helvetica", "bold");
      doc.text("Performance par jour", margin, y);
      y += 7;
      doc.line(margin, y, pageWidth - margin, y);
      y += 5;
      doc.setFontSize(10);
      DAYS.forEach((day, i) => {
        if (byDay[i].count === 0) return;
        doc.setFont("helvetica", "normal");
        doc.text(day, margin, y);
        doc.text(`${byDay[i].count} trades`, margin + 30, y);
        doc.setTextColor(byDay[i].total >= 0 ? 34 : 239, byDay[i].total >= 0 ? 197 : 68, byDay[i].total >= 0 ? 94 : 68);
        doc.setFont("helvetica", "bold");
        doc.text(`${byDay[i].total >= 0 ? "+" : ""}${byDay[i].total.toFixed(2)} EUR`, margin + 70, y);
        doc.setTextColor(30, 30, 30);
        y += 5;
      });
      y += 5;

      // Section 5: Violations & Recommendations
      if (violations.length > 0 || recommendations.length > 0) {
        if (y > 220) { doc.addPage(); y = margin; }
        doc.setFontSize(14);
        doc.setFont("helvetica", "bold");
        doc.text("Violations et recommandations IA", margin, y);
        y += 7;
        doc.line(margin, y, pageWidth - margin, y);
        y += 5;

        if (violations.length > 0) {
          doc.setFontSize(10);
          doc.setFont("helvetica", "bold");
          doc.text("Violations principales:", margin, y);
          y += 5;
          doc.setFont("helvetica", "normal");
          violations.slice(0, 5).forEach((v) => {
            if (y > 270) { doc.addPage(); y = margin; }
            const lines = doc.splitTextToSize(`- ${v.pair} (${v.trade_date}): ${v.rule_violated}`, pageWidth - 2 * margin);
            doc.text(lines, margin, y);
            y += lines.length * 5;
          });
          y += 3;
        }

        if (recommendations.length > 0) {
          if (y > 250) { doc.addPage(); y = margin; }
          doc.setFont("helvetica", "bold");
          doc.text("Recommandations IA:", margin, y);
          y += 5;
          doc.setFont("helvetica", "normal");
          recommendations.slice(0, 3).forEach((r, i) => {
            if (y > 270) { doc.addPage(); y = margin; }
            const lines = doc.splitTextToSize(`${i + 1}. ${r}`, pageWidth - 2 * margin);
            doc.text(lines, margin, y);
            y += lines.length * 5 + 1;
          });
        }
      }

      // Footer on every page
      const pageCount = doc.getNumberOfPages();
      for (let i = 1; i <= pageCount; i++) {
        doc.setPage(i);
        doc.setFontSize(8);
        doc.setTextColor(150, 150, 150);
        doc.setFont("helvetica", "normal");
        doc.text(
          "Genere par TradeDiscipline - TradeDiscipline.vercel.app",
          pageWidth / 2,
          doc.internal.pageSize.getHeight() - 8,
          { align: "center" }
        );
      }

      doc.save(`TradeDiscipline-rapport-${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}.pdf`);
    } catch (err) {
      console.error("PDF generation error:", err);
      alert(t("pdf_error"));
    } finally {
      setGenerating(false);
    }
  }

  return (
    <>
      <button
        onClick={generatePdf}
        disabled={generating}
        className="px-4 py-2 bg-surface border border-border text-foreground rounded-lg text-sm font-medium hover:bg-border transition-colors disabled:opacity-50 flex items-center gap-2"
      >
        {generating ? (
          <>
            <div className="w-4 h-4 border-2 border-foreground border-t-transparent rounded-full animate-spin" />
            {t("pdf_generating")}
          </>
        ) : (
          <>
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 17v-2m3 2v-4m3 4v-6m2 10H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
            </svg>
            {t("pdf_export")}
          </>
        )}
      </button>

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
