"use client";

import CsvImport from "@/components/trades/CsvImport";
import ManualTradeModal from "@/components/trades/ManualTradeModal";
import TradeList from "@/components/trades/TradeList";
import { createClient } from "@/lib/supabase/client";
import { useEffect, useState } from "react";

export default function TradesPage() {
  const supabase = createClient();
  const [refreshKey, setRefreshKey] = useState(0);
  const [showModal, setShowModal] = useState(false);
  const [strategyId, setStrategyId] = useState<string | null>(null);
  const [strategyPairs, setStrategyPairs] = useState<string[]>([]);

  useEffect(() => {
    async function loadStrategy() {
      const {
        data: { user },
      } = await supabase.auth.getUser();
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

  return (
    <div className="space-y-8">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Mes Trades</h1>
          <p className="text-muted mt-1">Importe, ajoute et consulte tes trades.</p>
        </div>
        <button
          onClick={() => setShowModal(true)}
          className="px-4 py-2 bg-accent text-white rounded-lg text-sm font-medium hover:bg-blue-600 transition-colors"
        >
          + Ajouter un trade
        </button>
      </div>

      <CsvImport strategyId={strategyId} onImported={refresh} />

      <TradeList refreshKey={refreshKey} />

      {showModal && (
        <ManualTradeModal
          pairs={strategyPairs}
          strategyId={strategyId}
          onClose={() => setShowModal(false)}
          onSaved={refresh}
        />
      )}
    </div>
  );
}
