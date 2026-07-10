"use client";

import { DemoDataBanner } from "@/components/dashboard/DemoData";
import CloseTradeModal from "@/components/trades/CloseTradeModal";
import CsvImport from "@/components/trades/CsvImport";
import ManualTradeModal from "@/components/trades/ManualTradeModal";
import OpenTradesSection from "@/components/trades/OpenTradesSection";
import QuickAnnotateModal from "@/components/trades/QuickAnnotateModal";
import TaxExportButton from "@/components/trades/TaxExportButton";
import TradeList from "@/components/trades/TradeList";
import { createClient } from "@/lib/supabase/client";
import { useLanguage } from "@/lib/LanguageContext";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import { Plus, Sparkles, Upload, X } from "lucide-react";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useState } from "react";

interface Strategy {
  id: string;
  name: string;
  setup_rules: string[];
  pairs: string[];
}

interface Recap {
  count: number;
  wr: number;
  pnl: number;
}

export default function TradesPage() {
  const supabase = createClient();
  const router = useRouter();
  const { t } = useLanguage();
  const prefersReducedMotion = useReducedMotion();
  const [refreshKey, setRefreshKey] = useState(0);
  const [showModal, setShowModal] = useState(false);
  const [closingTradeId, setClosingTradeId] = useState<string | null>(null);
  const [selectedStrategy, setSelectedStrategy] = useState<Strategy | null>(null);
  const [showMtBanner, setShowMtBanner] = useState(false);
  const [isImportOpen, setIsImportOpen] = useState(false);
  const [recap, setRecap] = useState<Recap | null>(null);
  const [unannotatedCount, setUnannotatedCount] = useState(0);
  const [showAnnotate, setShowAnnotate] = useState(false);

  const loadRecap = useCallback(async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    const [{ data, count }, { count: noEmotion }] = await Promise.all([
      supabase
        .from("trades")
        .select("pnl, commission, swap", { count: "exact" })
        .eq("user_id", user.id)
        .eq("status", "closed"),
      supabase
        .from("trades")
        .select("id", { count: "exact", head: true })
        .eq("user_id", user.id)
        .eq("status", "closed")
        .is("emotion", null),
    ]);

    setUnannotatedCount(noEmotion || 0);

    if (!data) return;

    const netPnls = data.map((t) => (t.pnl as number) + ((t.commission as number) || 0) + ((t.swap as number) || 0));
    const wins = netPnls.filter((p) => p > 0).length;
    const totalPnl = netPnls.reduce((a, b) => a + b, 0);

    setRecap({
      count: count || 0,
      wr: count ? (wins / count) * 100 : 0,
      pnl: totalPnl,
    });
  }, [supabase]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    async function checkMtTrades() {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const { count } = await supabase
        .from("trades")
        .select("id", { count: "exact", head: true })
        .eq("user_id", user.id)
        .in("source", ["mt4", "mt5"]);

      if (count === 0) setShowMtBanner(true);
    }
    checkMtTrades();
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    async function loadStrategies() {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const { data } = await supabase
        .from("strategies")
        .select("id, name, setup_rules, pairs")
        .eq("user_id", user.id)
        .order("created_at", { ascending: true });

      if (data && data.length > 0) {
        setSelectedStrategy(data[0]);
      }
    }
    loadStrategies();
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    loadRecap();
  }, [refreshKey]); // eslint-disable-line react-hooks/exhaustive-deps

  function refresh() {
    setRefreshKey((k) => k + 1);
  }

  // Premier import = moment « aha » : si l'utilisateur n'a encore jamais
  // lancé d'analyse IA, on l'emmène directement voir son score.
  async function maybeAutorunFirstAnalysis() {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;
    const { count } = await supabase
      .from("session_reviews")
      .select("id", { count: "exact", head: true })
      .eq("user_id", user.id);
    if ((count ?? 0) === 0) {
      router.push("/dashboard/analysis?autorun=1");
    }
  }

  const strategyId = selectedStrategy?.id ?? null;
  const strategyPairs = selectedStrategy?.pairs ?? [];

  return (
    <div className="space-y-6">
      {/* Mode démo : rappel visible tant que des trades fictifs existent */}
      <DemoDataBanner key={`demo-${refreshKey}`} />

      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-foreground">{t("trades_title")}</h1>
          {recap && (
            <p className="text-sm text-muted mt-1">
              {recap.count} trades · WR {recap.wr.toFixed(1)}% · P&amp;L{" "}
              <span className={recap.pnl >= 0 ? "text-profit" : "text-loss"}>
                {recap.pnl >= 0 ? "+" : ""}{recap.pnl.toFixed(2)}€
              </span>
            </p>
          )}
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          {unannotatedCount > 0 && (
            <button
              onClick={() => setShowAnnotate(true)}
              className="px-3 py-2 rounded-md border border-accent/30 bg-accent/5 text-sm text-accent hover:bg-accent/10 hover:border-accent/50 transition-colors flex items-center gap-2"
            >
              <Sparkles className="w-4 h-4" />
              {t("annotate_button").replace("{count}", String(unannotatedCount))}
            </button>
          )}
          <TaxExportButton />
          <button
            onClick={() => setIsImportOpen((o) => !o)}
            className="px-3 py-2 rounded-md border border-border text-sm text-muted hover:text-foreground hover:bg-card transition-colors flex items-center gap-2"
          >
            <Upload className="w-4 h-4" />
            {t("trades_import_csv")}
          </button>
          <button
            onClick={() => setShowModal(true)}
            className="px-3 py-2 rounded-md bg-accent text-white text-sm font-medium hover:opacity-90 transition-opacity flex items-center gap-2"
          >
            <Plus className="w-4 h-4" />
            {t("trades_add_trade")}
          </button>
        </div>
      </div>

      {showMtBanner && (
        <div className="p-4 rounded-xl border border-accent/20 bg-accent/5 flex items-center justify-between gap-4 flex-wrap">
          <div className="space-y-1">
            <p className="text-sm font-medium text-foreground">
              {t("trades_mt_sync_title")}
            </p>
            <p className="text-xs text-muted">
              {t("trades_mt_sync_desc")}
            </p>
          </div>
          <a
            href="/dashboard/settings#metatrader"
            className="px-4 py-2 rounded-lg bg-accent text-white text-sm font-medium hover:bg-accent-hover transition-colors whitespace-nowrap flex-shrink-0"
          >
            {t("trades_mt_sync_cta")}
          </a>
        </div>
      )}

      {/* Import CSV collapsible */}
      <AnimatePresence initial={false}>
        {isImportOpen && (
          <motion.div
            initial={prefersReducedMotion ? false : { height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={prefersReducedMotion ? { opacity: 0 } : { height: 0, opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="overflow-hidden"
          >
            <div className="relative border border-border rounded-xl p-4 bg-card">
              <button
                onClick={() => setIsImportOpen(false)}
                className="absolute top-3 right-3 z-10 p-1.5 rounded text-muted hover:text-foreground hover:bg-surface transition-colors"
                aria-label={t("trades_close_import")}
              >
                <X className="w-4 h-4" />
              </button>
              <CsvImport
                strategyId={strategyId}
                onImported={() => {
                  setIsImportOpen(false);
                  refresh();
                  void maybeAutorunFirstAnalysis();
                }}
              />
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      <OpenTradesSection
        refreshKey={refreshKey}
        onCloseTrade={(tradeId) => setClosingTradeId(tradeId)}
      />

      <TradeList
        refreshKey={refreshKey}
        onTradeUpdated={loadRecap}
      />

      {showModal && (
        <ManualTradeModal
          pairs={strategyPairs}
          strategyId={strategyId}
          onClose={() => setShowModal(false)}
          onSaved={() => { refresh(); loadRecap(); }}
        />
      )}

      {closingTradeId && (
        <CloseTradeModal
          tradeId={closingTradeId}
          onClose={() => setClosingTradeId(null)}
          onSaved={() => { refresh(); setClosingTradeId(null); loadRecap(); }}
        />
      )}

      {showAnnotate && (
        <QuickAnnotateModal
          onClose={() => setShowAnnotate(false)}
          onSaved={() => { refresh(); loadRecap(); }}
        />
      )}
    </div>
  );
}
