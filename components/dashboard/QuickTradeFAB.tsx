"use client";

import ManualTradeModal from "@/components/trades/ManualTradeModal";
import { useLanguage } from "@/lib/LanguageContext";
import { createClient } from "@/lib/supabase/client";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";

export default function QuickTradeFAB() {
  const { t } = useLanguage();
  const pathname = usePathname();
  const supabase = createClient();
  const [open, setOpen] = useState(false);
  const [strategyId, setStrategyId] = useState<string | null>(null);
  const [pairs, setPairs] = useState<string[]>([]);

  useEffect(() => {
    async function loadStrategy() {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;
      const { data } = await supabase
        .from("strategies")
        .select("id, pairs")
        .eq("user_id", user.id)
        .limit(1)
        .maybeSingle();
      if (data) {
        setStrategyId(data.id);
        setPairs(data.pairs || []);
      }
    }
    loadStrategy();
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // Hide on pages where trade entry is already available
  const hideOn = ["/dashboard/trades", "/dashboard/session"];
  if (hideOn.some((p) => pathname === p || pathname.startsWith(p + "/"))) return null;

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        title={t("manual_title")}
        className="fixed bottom-20 lg:bottom-6 right-6 z-40 w-14 h-14 rounded-full bg-accent text-white shadow-lg hover:bg-blue-600 transition-all hover:scale-105 flex items-center justify-center"
      >
        <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
        </svg>
      </button>

      {open && (
        <ManualTradeModal
          pairs={pairs}
          strategyId={strategyId}
          onClose={() => setOpen(false)}
          onSaved={() => setOpen(false)}
        />
      )}
    </>
  );
}
