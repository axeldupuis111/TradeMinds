"use client";

import UpgradeBanner from "@/components/UpgradeBanner";
import { buildAnalyticsPdf, type AnalyticsTrade } from "@/lib/analytics-pdf";
import { Button } from "@/components/ui/Button";
import { useLanguage } from "@/lib/LanguageContext";
import { usePlan } from "@/lib/PlanContext";
import { setDemoWatermark } from "@/lib/pdf/kit";
import { createClient } from "@/lib/supabase/client";
import { FileDown } from "lucide-react";
import { useState } from "react";

interface ExportPdfButtonProps {
  /** Trades déjà filtrés par la page (période + compte + filtres avancés). */
  trades: AnalyticsTrade[];
  /** Libellé lisible de la période sélectionnée (ex. "30 derniers jours"). */
  periodLabel: string;
  /** Libellé lisible du compte sélectionné (ex. "Tous les comptes"). */
  accountLabel: string;
}

export default function ExportPdfButton({ trades, periodLabel, accountLabel }: ExportPdfButtonProps) {
  const { t, lang } = useLanguage();
  const pdfLocale = ({ fr: "fr-FR", en: "en-US", de: "de-DE", es: "es-ES" } as const)[lang] ?? "en-US";
  const { plan, demoMode, loading: planLoading } = usePlan();
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
    const selection = (trades || []).filter((tr) => tr.open_time).slice().sort((a, b) => a.open_time.localeCompare(b.open_time));
    if (selection.length === 0) {
      alert(t("pdf_no_data"));
      return;
    }

    setGenerating(true);
    try {
      // Dernier bilan (score / infractions / recommandations) — optionnel, non bloquant.
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

    // Un PDF quitte l'app : s'il contient des donnees de demo, il doit le dire.
    setDemoWatermark(demoMode ? t("demo_pdf_watermark") : null);
      const doc = await buildAnalyticsPdf({
        trades: selection,
        periodLabel,
        accountLabel,
        locale: pdfLocale,
        t,
        review: lastReview,
      });

      // NFD sépare les accents en marques combinantes, retirées ensuite comme
      // tout caractère non alphanumérique.
      const slug = (s: string) =>
        s
          .normalize("NFD")
          .replace(/[^a-zA-Z0-9]+/g, "-")
          .replace(/^-+|-+$/g, "")
          .toLowerCase() || "rapport";
      doc.save(`TradeDiscipline-analytics-${slug(periodLabel)}-${slug(accountLabel)}-${new Date().toISOString().split("T")[0]}.pdf`);
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
