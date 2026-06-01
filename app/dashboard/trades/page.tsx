"use client";

import CloseTradeModal from "@/components/trades/CloseTradeModal";
import CsvImport from "@/components/trades/CsvImport";
import ManualTradeModal from "@/components/trades/ManualTradeModal";
import OpenTradesSection from "@/components/trades/OpenTradesSection";
import TradeList from "@/components/trades/TradeList";
import { createClient } from "@/lib/supabase/client";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import { Plus, Upload, X } from "lucide-react";
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
  const prefersReducedMotion = useReducedMotion();
  const [refreshKey, setRefreshKey] = useState(0);
  const [showModal, setShowModal] = useState(false);
  const [closingTradeId, setClosingTradeId] = useState<string | null>(null);
  const [selectedStrategy, setSelectedStrategy] = useState<Strategy | null>(null);
  const [showMtBanner, setShowMtBanner] = useState(false);
  const [isImportOpen, setIsImportOpen] = useState(false);
  const [recap, setRecap] = useState<Recap | null>(null);

  const loadRecap = useCallback(async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    const { data, count } = await supabase
      .from("trades")
      .select("pnl, commission, swap", { count: "exact" })
      .eq("user_id", user.id)
      .eq("status", "closed");

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

  const strategyId = selectedStrategy?.id ?? null;
  const strategyPairs = selectedStrategy?.pairs ?? [];

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Mes Trades</h1>
          {recap && (
            <p className="text-sm text-muted mt-1">
              {recap.count} trades · WR {recap.wr.toFixed(1)}% · P&amp;L{" "}
              <span className={recap.pnl >= 0 ? "text-profit" : "text-loss"}>
                {recap.pnl >= 0 ? "+" : ""}{recap.pnl.toFixed(2)}€
              </span>
            </p>
          )}
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={() => setIsImportOpen((o) => !o)}
            className="px-3 py-2 rounded-md border border-border text-sm text-muted hover:text-foreground hover:bg-card transition-colors flex items-center gap-2"
          >
            <Upload className="w-4 h-4" />
            Importer CSV
          </button>
          <button
            onClick={() => setShowModal(true)}
            className="px-3 py-2 rounded-md bg-accent text-white text-sm font-medium hover:opacity-90 transition-opacity flex items-center gap-2"
          >
            <Plus className="w-4 h-4" />
            Ajouter un trade
          </button>
        </div>
      </div>

      {showMtBanner && (
        <div className="p-4 rounded-xl border border-accent/20 bg-accent/5 flex items-center justify-between gap-4 flex-wrap">
          <div className="space-y-1">
            <p className="text-sm font-medium text-foreground">
              Synchronise tes trades MetaTrader automatiquement
            </p>
            <p className="text-xs text-muted">
              Connecte MetaTrader 4 ou 5 pour que tes trades remontent
              automatiquement dans ton journal, dès qu&apos;ils se ferment.
            </p>
          </div>
          <a
            href="/dashboard/settings#metatrader"
            className="px-4 py-2 rounded-lg bg-accent text-white text-sm font-medium hover:bg-blue-600 transition-colors whitespace-nowrap flex-shrink-0"
          >
            Configurer la synchronisation
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
                aria-label="Fermer l'import"
              >
                <X className="w-4 h-4" />
              </button>
              <CsvImport
                strategyId={strategyId}
                onImported={() => {
                  setIsImportOpen(false);
                  refresh();
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
    </div>
  );
}
