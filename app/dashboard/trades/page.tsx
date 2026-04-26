"use client";

import ChecklistPreTrade from "@/components/trades/ChecklistPreTrade";
import CsvImport from "@/components/trades/CsvImport";
import ManualTradeModal from "@/components/trades/ManualTradeModal";
import TradeList from "@/components/trades/TradeList";
import { useLanguage } from "@/lib/LanguageContext";
import { createClient } from "@/lib/supabase/client";
import { useEffect, useState } from "react";

export default function TradesPage() {
  const { t } = useLanguage();
  const supabase = createClient();
  const [refreshKey, setRefreshKey] = useState(0);
  const [showModal, setShowModal] = useState(false);
  const [strategyId, setStrategyId] = useState<string | null>(null);
  const [strategyPairs, setStrategyPairs] = useState<string[]>([]);
  const [initialChecklist, setInitialChecklist] = useState<Record<string, boolean> | undefined>(undefined);

  useEffect(() => {
    async function loadStrategy() {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const { data } = await supabase
        .from("strategies")
        .select("id, pairs")
        .eq("user_id", user.id)
        .limit(1)
        .single();

      if (data) {
        setStrategyId(data.id);
        setStrategyPairs(data.pairs || []);
      }
    }
    loadStrategy();
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  function refresh() {
    setRefreshKey((k) => k + 1);
  }

  function openModalWithChecklist(checklist: Record<string, boolean>) {
    setInitialChecklist(checklist);
    setShowModal(true);
  }

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

      {/* ICT Pre-trade checklist */}
      <ChecklistPreTrade onAddTrade={openModalWithChecklist} />

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
