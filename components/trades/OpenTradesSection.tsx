"use client";

import { useLanguage } from "@/lib/LanguageContext";
import { createClient } from "@/lib/supabase/client";
import { useEffect, useState } from "react";

interface OpenTrade {
  id: string;
  pair: string;
  direction: "long" | "short" | "buy" | "sell";
  lot_size: number;
  entry_price: number;
  sl: number | null;
  tp: number | null;
  open_time: string;
  notes: string | null;
}

interface Props {
  refreshKey: number;
  onCloseTrade: (tradeId: string) => void;
}

function normalizeDirection(dir: string): "long" | "short" {
  const d = dir.toLowerCase();
  if (d === "long" || d === "buy") return "long";
  return "short";
}

function formatDuration(openTime: string, now: number, t: (key: string) => string) {
  const opened = new Date(openTime).getTime();
  const diffMs = now - opened;
  const totalMin = Math.max(0, Math.floor(diffMs / 60000));
  const days = Math.floor(totalMin / 1440);
  const hours = Math.floor((totalMin % 1440) / 60);
  const minutes = totalMin % 60;

  if (days >= 1) {
    return t("open_trades_duration_days").replace("{d}", String(days));
  }
  if (hours >= 1) {
    return t("open_trades_duration_hm")
      .replace("{h}", String(hours))
      .replace("{m}", String(minutes));
  }
  return t("open_trades_duration_min").replace("{m}", String(totalMin));
}

function formatOpenLabel(openTime: string, t: (key: string) => string) {
  const opened = new Date(openTime);
  const today = new Date();
  const yesterday = new Date();
  yesterday.setDate(today.getDate() - 1);

  const sameDay = opened.toDateString() === today.toDateString();
  const isYesterday = opened.toDateString() === yesterday.toDateString();

  const time = opened.toLocaleTimeString(undefined, { hour: "2-digit", minute: "2-digit" });

  if (sameDay) return `${t("open_trades_today")} ${time}`;
  if (isYesterday) return `${t("open_trades_yesterday")} ${time}`;
  return opened.toLocaleDateString(undefined, { day: "numeric", month: "short" }) + ` ${time}`;
}

export default function OpenTradesSection({ refreshKey, onCloseTrade }: Props) {
  const { t } = useLanguage();
  const supabase = createClient();
  const [trades, setTrades] = useState<OpenTrade[]>([]);
  const [loading, setLoading] = useState(true);
  const [now, setNow] = useState(Date.now());

  async function load() {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) { setLoading(false); return; }

    const { data } = await supabase
      .from("trades")
      .select("id, pair, direction, lot_size, entry_price, sl, tp, open_time, notes")
      .eq("user_id", user.id)
      .eq("status", "open")
      .order("open_time", { ascending: false });

    setTrades((data || []) as OpenTrade[]);
    setLoading(false);
  }

  useEffect(() => {
    load();
  }, [refreshKey]); // eslint-disable-line react-hooks/exhaustive-deps

  // Realtime subscription
  useEffect(() => {
    let active = true;
    let channel: ReturnType<typeof supabase.channel> | null = null;

    (async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user || !active) return;

      channel = supabase
        .channel("open_trades_section")
        .on(
          "postgres_changes",
          { event: "*", schema: "public", table: "trades", filter: `user_id=eq.${user.id}` },
          () => { load(); }
        )
        .subscribe();
    })();

    return () => {
      active = false;
      if (channel) supabase.removeChannel(channel);
    };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // Tick every 60s to refresh durations
  useEffect(() => {
    const interval = setInterval(() => setNow(Date.now()), 60000);
    return () => clearInterval(interval);
  }, []);

  if (loading) return null;
  if (trades.length === 0) return null;

  const count = trades.length;
  const countLabel = count === 1
    ? t("open_trades_count_one")
    : t("open_trades_count_many").replace("{n}", String(count));

  return (
    <section className="mb-6">
      {/* Header */}
      <div className="flex items-center gap-3 mb-3">
        <span className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-profit/10 border border-profit/30 text-profit text-xs font-semibold uppercase tracking-wide">
          <span className="w-1.5 h-1.5 rounded-full bg-profit animate-pulse" />
          {t("open_trades_badge")}
        </span>
        <h2 className="text-lg font-semibold text-foreground">
          {t("open_trades_title")}
        </h2>
        <span className="text-sm text-muted">&middot; {countLabel}</span>
      </div>

      {/* Cards */}
      <div className="space-y-2">
        {trades.map((tr) => {
          const dir = normalizeDirection(tr.direction);
          const durationLabel = formatDuration(tr.open_time, now, t);
          const openedLabel = formatOpenLabel(tr.open_time, t);

          return (
            <div
              key={tr.id}
              className="bg-profit/5 border border-profit/30 rounded-lg p-4 flex flex-col sm:flex-row sm:items-center gap-3"
            >
              {/* Main info */}
              <div className="flex-1 min-w-0">
                <div className="flex flex-wrap items-center gap-2 mb-1.5">
                  <span className="font-semibold text-foreground">{tr.pair}</span>
                  <span className={`px-1.5 py-0.5 rounded text-[10px] font-medium ${
                    dir === "long" ? "bg-profit/10 text-profit" : "bg-loss/10 text-loss"
                  }`}>
                    {dir === "long" ? "LONG" : "SHORT"}
                  </span>
                  <span className="text-sm text-muted">
                    {tr.lot_size} lot @ {tr.entry_price}
                  </span>
                </div>
                <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted">
                  <span>SL : <span className="text-foreground">{tr.sl ?? "—"}</span></span>
                  <span>TP : <span className="text-foreground">{tr.tp ?? "—"}</span></span>
                  <span className="text-muted">&middot;</span>
                  <span>{t("open_trades_opened_since").replace("{duration}", durationLabel)}</span>
                  <span className="text-muted">&middot;</span>
                  <span>{openedLabel}</span>
                </div>
              </div>

              {/* Close button */}
              <button
                onClick={() => onCloseTrade(tr.id)}
                className="shrink-0 px-4 py-2 bg-accent text-on-accent rounded-lg text-sm font-medium hover:bg-accent-hover transition-colors"
              >
                {t("open_trades_close_button")}
              </button>
            </div>
          );
        })}
      </div>
    </section>
  );
}
