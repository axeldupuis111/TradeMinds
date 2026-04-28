"use client";

import ChecklistPreTrade from "@/components/trades/ChecklistPreTrade";
import CsvImport from "@/components/trades/CsvImport";
import ManualTradeModal from "@/components/trades/ManualTradeModal";
import TradeList from "@/components/trades/TradeList";
import { useLanguage } from "@/lib/LanguageContext";
import { createClient } from "@/lib/supabase/client";
import { useEffect, useState } from "react";

interface Strategy {
  id: string;
  name: string;
  setup_rules: string[];
  pairs: string[];
}

export default function TradesPage() {
  const { t } = useLanguage();
  const supabase = createClient();
  const [refreshKey, setRefreshKey] = useState(0);
  const [showModal, setShowModal] = useState(false);
  const [strategies, setStrategies] = useState<Strategy[]>([]);
  const [selectedStrategy, setSelectedStrategy] = useState<Strategy | null>(null);
  const [initialChecklist, setInitialChecklist] = useState<Record<string, boolean> | undefined>(undefined);

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
        setStrategies(data);
        setSelectedStrategy(data[0]);
      }
    }
    loadStrategies();
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  function refresh() {
    setRefreshKey((k) => k + 1);
  }

  function openModalWithChecklist(checklist: Record<string, boolean>) {
    setInitialChecklist(checklist);
    setShowModal(true);
  }

  const strategyId = selectedStrategy?.id ?? null;
  const strategyPairs = selectedStrategy?.pairs ?? [];

  return (
    <div className="space-y-8">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground">{t("trades_title")}</h1>
          <p className="text-muted mt-1">{t("trades_subtitle")}</p>
        </div>
        <button
          onClick={() => { setInitialChecklist(undefined); setShowModal(true); }}
          className="px-4 py-2 bg-accent text-white rounded-lg text-sm font-medium hover:bg-blue-600 transition-colors"
        >
          {t("trades_add")}
        </button>
      </div>

      {/* Strategy-linked pre-trade checklist */}
      <ChecklistPreTrade
        onAddTrade={openModalWithChecklist}
        strategies={strategies}
        selectedStrategy={selectedStrategy}
        onStrategyChange={(id) => setSelectedStrategy(strategies.find((s) => s.id === id) ?? null)}
      />

      <CsvImport strategyId={strategyId} onImported={refresh} />

      <TradeList refreshKey={refreshKey} />

      {showModal && (
        <ManualTradeModal
          pairs={strategyPairs}
          strategyId={strategyId}
          onClose={() => setShowModal(false)}
          onSaved={refresh}
          initialChecklist={initialChecklist}
        />
      )}
    </div>
  );
}
