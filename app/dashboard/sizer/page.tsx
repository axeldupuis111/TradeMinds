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
    <div className="max-w-4xl mx-auto pb-10">
      <h1 className="text-2xl font-bold text-foreground">{t("sizer_page_title")}</h1>
      <p className="text-muted mt-1">{t("sizer_page_subtitle")}</p>

      <div className="mt-6 lg:grid lg:grid-cols-3 lg:gap-6 lg:items-start">
        <div className="lg:col-span-2">
          {loading ? <div className="skeleton h-64 rounded-xl" /> : <PositionSizer strategy={strategy} />}
        </div>

        {/* Aide / méthode */}
        <aside className="mt-4 lg:mt-0 rounded-xl border border-border bg-card p-5">
          <h2 className="text-sm font-semibold text-foreground mb-3">{t("sizer_help_title")}</h2>
          <ul className="space-y-3 text-sm text-muted leading-relaxed">
            <li className="flex gap-2"><span className="text-accent font-bold">1.</span><span>{t("sizer_help_1")}</span></li>
            <li className="flex gap-2"><span className="text-accent font-bold">2.</span><span>{t("sizer_help_2")}</span></li>
            <li className="flex gap-2"><span className="text-accent font-bold">3.</span><span>{t("sizer_help_3")}</span></li>
          </ul>
          <p className="text-xs text-muted/70 mt-4 border-t border-border pt-3">{t("sizer_help_note")}</p>
        </aside>
      </div>
    </div>
  );
}
