"use client";

import { useLanguage } from "@/lib/LanguageContext";
import { createClient } from "@/lib/supabase/client";
import { useEffect, useState } from "react";

const QUOTES: { text: string; author: string }[] = [
  { text: "The goal of a successful trader is to make the best trades. Money is secondary.", author: "Alexander Elder" },
  { text: "The market can stay irrational longer than you can stay solvent.", author: "John Maynard Keynes" },
  { text: "Risk comes from not knowing what you're doing.", author: "Warren Buffett" },
  { text: "I have two basic rules about winning in trading as well as in life: 1. If you don't bet, you can't win. 2. If you lose all your chips, you can't bet.", author: "Larry Hite" },
  { text: "Every trader has strengths and weaknesses. Some are good holders of winners, but may hold their losers a little too long.", author: "Michael Marcus" },
  { text: "Winning traders are not separated by their knowledge of the markets, but by the control of their emotions.", author: "Mark Douglas" },
  { text: "Don't focus on making money; focus on protecting what you have.", author: "Paul Tudor Jones" },
  { text: "The elements of good trading are: (1) cutting losses, (2) cutting losses, and (3) cutting losses.", author: "Ed Seykota" },
  { text: "A loss never bothers me after I take it. I forget it overnight. But being wrong and not taking the loss — that is what does damage.", author: "Jesse Livermore" },
];

type LimitType = "daily_loss" | "max_trades" | "consecutive_losses";

interface Strategy {
  max_daily_loss: number | null;
  max_trades_per_day: number | null;
  max_consecutive_losses: number | null;
}

function netPnl(t: { pnl: number; commission: number | null; swap: number | null }) {
  return t.pnl + (t.commission || 0) + (t.swap || 0);
}

export default function StopTradingGuard() {
  const { t } = useLanguage();
  const supabase = createClient();
  const [limitReached, setLimitReached] = useState<LimitType | null>(null);
  const [overlayDismissed, setOverlayDismissed] = useState(false);
  const [quote, setQuote] = useState(QUOTES[0]);

  useEffect(() => {
    check();
    // Pick a random quote
    setQuote(QUOTES[Math.floor(Math.random() * QUOTES.length)]);
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    // Check if overlay was dismissed today
    const today = new Date().toISOString().split("T")[0];
    const dismissed = localStorage.getItem("stop_overlay_dismissed");
    if (dismissed === today) setOverlayDismissed(true);
  }, []);

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

    // Check daily loss
    const todayPnl = todayTrades.reduce((s, tr) => s + netPnl(tr), 0);
    if (strategy.max_daily_loss !== null) {
      const maxLossEuro = (accountSize * strategy.max_daily_loss) / 100;
      if (todayPnl <= -maxLossEuro) {
        setLimitReached("daily_loss");
        return;
      }
    }

    // Check max trades per day
    if (strategy.max_trades_per_day !== null && todayTrades.length >= strategy.max_trades_per_day) {
      setLimitReached("max_trades");
      return;
    }

    // Check consecutive losses today
    if (strategy.max_consecutive_losses !== null) {
      let consecutiveLosses = 0;
      for (const tr of todayTrades) {
        if (netPnl(tr) < 0) consecutiveLosses++;
        else consecutiveLosses = 0;
      }
      if (consecutiveLosses >= strategy.max_consecutive_losses) {
        setLimitReached("consecutive_losses");
        return;
      }
    }
  }

  function dismiss() {
    const today = new Date().toISOString().split("T")[0];
    localStorage.setItem("stop_overlay_dismissed", today);
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
        <div className="mt-8 p-5 rounded-xl border border-[#1e1e1e] bg-[#0f0f0f]">
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
