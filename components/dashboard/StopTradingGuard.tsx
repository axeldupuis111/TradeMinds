"use client";

import { useLanguage } from "@/lib/LanguageContext";
import { stopQuotes } from "@/lib/translations";
import { createClient } from "@/lib/supabase/client";
import { useEffect, useState } from "react";

type LimitType = "daily_loss" | "max_trades" | "consecutive_losses";

interface Strategy {
  max_daily_loss: number | null;
  max_trades_per_day: number | null;
  max_consecutive_losses: number | null;
}

interface DismissRecord {
  date: string;
  type: LimitType;
}

const STORAGE_KEY = "stop_overlay_dismissed";

function readDismiss(): DismissRecord | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    if (!raw.startsWith("{")) return null;
    const parsed: DismissRecord = JSON.parse(raw);
    if (!parsed.date || !parsed.type) return null;
    return parsed;
  } catch {
    return null;
  }
}

function writeDismiss(record: DismissRecord): void {
  if (typeof window === "undefined") return;
  localStorage.setItem(STORAGE_KEY, JSON.stringify(record));
}

function clearDismiss(): void {
  if (typeof window === "undefined") return;
  localStorage.removeItem(STORAGE_KEY);
}

function netPnl(t: { pnl: number; commission: number | null; swap: number | null }) {
  return t.pnl + (t.commission || 0) + (t.swap || 0);
}

export default function StopTradingGuard() {
  const { t, lang } = useLanguage();
  const supabase = createClient();
  const [limitReached, setLimitReached] = useState<LimitType | null>(null);
  const [overlayDismissed, setOverlayDismissed] = useState(false);
  const [quote, setQuote] = useState(stopQuotes.en[0]);

  useEffect(() => {
    let isMounted = true;
    let channel: ReturnType<typeof supabase.channel> | null = null;

    const init = async () => {
      await check();

      const { data: { user } } = await supabase.auth.getUser();
      if (!user || !isMounted) return;

      channel = supabase
        .channel(`stop-guard-${user.id}`)
        .on(
          "postgres_changes",
          { event: "*", schema: "public", table: "trades", filter: `user_id=eq.${user.id}` },
          () => { if (isMounted) check(); }
        )
        .on(
          "postgres_changes",
          { event: "*", schema: "public", table: "strategies", filter: `user_id=eq.${user.id}` },
          () => { if (isMounted) check(); }
        )
        .on(
          "postgres_changes",
          { event: "*", schema: "public", table: "prop_challenges", filter: `user_id=eq.${user.id}` },
          () => { if (isMounted) check(); }
        )
        .subscribe();
    };

    init();

    return () => {
      isMounted = false;
      if (channel) supabase.removeChannel(channel);
    };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    const quotes = stopQuotes[lang] ?? stopQuotes.en;
    if (quotes.length > 0) {
      setQuote(quotes[Math.floor(Math.random() * quotes.length)]);
    }
  }, [lang]);

  async function check() {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    const today = new Date().toISOString().split("T")[0];

    const [{ data: strat }, { data: trades }, { data: accounts }] = await Promise.all([
      supabase.from("strategies").select("max_daily_loss, max_trades_per_day, max_consecutive_losses").eq("user_id", user.id).limit(1).single(),
      supabase.from("trades").select("pnl, commission, swap, open_time").eq("user_id", user.id).gte("open_time", today).order("open_time", { ascending: true }),
      supabase.from("prop_challenges").select("account_size").eq("user_id", user.id).eq("status", "active").limit(1).single(),
    ]);

    if (!strat) return;
    const strategy: Strategy = strat;
    const todayTrades = trades || [];
    const accountSize = accounts?.account_size || 10000;

    let detectedLimit: LimitType | null = null;

    // Check daily loss
    const todayPnl = todayTrades.reduce((s, tr) => s + netPnl(tr), 0);
    if (strategy.max_daily_loss !== null) {
      const maxLossEuro = (accountSize * strategy.max_daily_loss) / 100;
      if (todayPnl <= -maxLossEuro) {
        detectedLimit = "daily_loss";
      }
    }

    // Check max trades per day
    if (!detectedLimit && strategy.max_trades_per_day !== null && todayTrades.length >= strategy.max_trades_per_day) {
      detectedLimit = "max_trades";
    }

    // Check consecutive losses today
    if (!detectedLimit && strategy.max_consecutive_losses !== null) {
      let consecutiveLosses = 0;
      for (const tr of todayTrades) {
        if (netPnl(tr) < 0) consecutiveLosses++;
        else consecutiveLosses = 0;
      }
      if (consecutiveLosses >= strategy.max_consecutive_losses) {
        detectedLimit = "consecutive_losses";
      }
    }

    if (!detectedLimit) {
      clearDismiss();
      setOverlayDismissed(false);
      setLimitReached(null);
      return;
    }

    const dismissed = readDismiss();
    if (dismissed && dismissed.date === today && dismissed.type === detectedLimit) {
      setOverlayDismissed(true);
    } else {
      setOverlayDismissed(false);
    }
    setLimitReached(detectedLimit);
  }

  function dismiss() {
    if (!limitReached) return;
    writeDismiss({
      date: new Date().toISOString().split("T")[0],
      type: limitReached,
    });
    setOverlayDismissed(true);
  }

  if (!limitReached) return null;

  const limitLabel = t(`stop_limit_${limitReached}`);

  // Persistent banner after dismiss
  if (overlayDismissed) {
    return (
      <div className="bg-loss/20 border-b border-loss/40 px-4 py-2 flex items-center justify-center gap-2 text-sm">
        <svg className="w-4 h-4 text-loss" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 9v2m0 4h.01M10.29 3.86l-8.6 14.86A1 1 0 002.56 20h18.88a1 1 0 00.87-1.28l-8.6-14.86a1 1 0 00-1.72 0z" />
        </svg>
        <span className="text-loss font-medium">{t("stop_banner")}</span>
      </div>
    );
  }

  // Full-screen overlay
  return (
    <div className="fixed inset-0 z-[100] bg-black/95 flex items-center justify-center p-6 overflow-y-auto">
      <div className="max-w-xl w-full">
        <div className="text-center">
          <h1 className="text-[120px] sm:text-[180px] font-black text-loss leading-none tracking-tight">
            STOP
          </h1>
          <h2 className="text-xl sm:text-2xl font-bold text-foreground mt-2">{t("stop_title")}</h2>
          <p className="text-muted mt-3 text-base">{limitLabel}</p>
          <p className="text-loss mt-1 font-semibold">{t("stop_instruction")}</p>
        </div>

        {/* Quote */}
        <div className="mt-8 p-5 rounded-xl border border-border bg-background">
          <p className="text-foreground italic text-sm leading-relaxed">&laquo; {quote.text} &raquo;</p>
          <p className="text-muted text-xs mt-2 text-right">&mdash; {quote.author}</p>
        </div>

        <div className="mt-8 flex justify-center">
          <button
            onClick={dismiss}
            className="px-6 py-3 bg-loss/20 border border-loss/40 text-loss rounded-lg font-medium hover:bg-loss/30 transition-colors"
          >
            {t("stop_understand")}
          </button>
        </div>
      </div>
    </div>
  );
}
