"use client";

import PositionSizer from "@/components/session/PositionSizer";
import { useLanguage } from "@/lib/LanguageContext";
import { createClient } from "@/lib/supabase/client";
import { useEffect, useState } from "react";

interface SizerStrategy {
  risk_per_trade_pct: number | null;
  max_sl_pips: number | null;
}

export default function SizerPage() {
  const { t } = useLanguage();
  const supabase = createClient();
  const [strategy, setStrategy] = useState<SizerStrategy | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) { setLoading(false); return; }
      // Stratégie principale (la plus ancienne) — pré-remplit risque % et SL max.
      const { data } = await supabase
        .from("strategies")
        .select("risk_per_trade_pct, max_sl_pips")
        .eq("user_id", user.id)
        .order("created_at", { ascending: true })
        .limit(1)
        .maybeSingle();
      setStrategy(data ?? null);
      setLoading(false);
    })();
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <div className="max-w-2xl mx-auto pb-10">
      <h1 className="text-2xl font-bold text-foreground">{t("sizer_page_title")}</h1>
      <p className="text-muted mt-1">{t("sizer_page_subtitle")}</p>
      <div className="mt-6">
        {loading ? <div className="skeleton h-64 rounded-xl" /> : <PositionSizer strategy={strategy} />}
      </div>
    </div>
  );
}
