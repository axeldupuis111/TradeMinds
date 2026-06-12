"use client";

/**
 * PatternAlerts — coach temps réel basé sur les patterns du trader.
 *
 * Les insights qui dorment dans Analytics (pire heure, paire à risque,
 * relâchement après série) deviennent des alertes contextuelles affichées
 * au moment où le trader s'apprête à trader :
 *  - heure actuelle historiquement perdante / gagnante (≥ 5 trades sur la tranche)
 *  - paire au winrate désastreux (≤ 30 % sur ≥ 4 trades)
 *  - série en cours : 3+ gains (risque de relâchement) ou 3+ pertes (revenge)
 *
 * Ne rend rien si aucun pattern n'est significatif. Recalcule l'heure
 * toutes les 5 minutes pour suivre les changements de tranche horaire.
 */

import { createClient } from "@/lib/supabase/client";
import { useLanguage } from "@/lib/LanguageContext";
import { cn } from "@/lib/cn";
import { AlertTriangle, Clock, Flame, ShieldAlert, Sparkles, TrendingUp } from "lucide-react";
import { useEffect, useMemo, useState } from "react";

interface TradeRow {
  open_time: string;
  pnl: number;
  commission: number | null;
  swap: number | null;
  pair: string;
}

interface Alert {
  id: string;
  tone: "danger" | "warning" | "positive";
  icon: React.ReactNode;
  text: string;
}

const MIN_HOUR_TRADES = 5;
const MIN_PAIR_TRADES = 4;

function netPnl(t: TradeRow): number {
  return t.pnl + (t.commission || 0) + (t.swap || 0);
}

function fmt(key: string, vars: Record<string, string | number>): string {
  let out = key;
  for (const [k, v] of Object.entries(vars)) {
    out = out.replace(`{${k}}`, String(v));
  }
  return out;
}

export default function PatternAlerts({ compact = false }: { compact?: boolean }) {
  const { t } = useLanguage();
  const [trades, setTrades] = useState<TradeRow[] | null>(null);
  // Tick toutes les 5 min : l'alerte horaire suit la tranche en cours
  const [now, setNow] = useState(() => new Date());

  useEffect(() => {
    const supabase = createClient();
    let cancelled = false;

    async function load() {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user || cancelled) return;
      const { data } = await supabase
        .from("trades")
        .select("open_time, pnl, commission, swap, pair")
        .eq("user_id", user.id)
        .eq("status", "closed")
        .order("open_time", { ascending: false })
        .limit(300);
      if (!cancelled) setTrades(data || []);
    }
    load();

    const interval = window.setInterval(() => setNow(new Date()), 5 * 60 * 1000);
    return () => {
      cancelled = true;
      window.clearInterval(interval);
    };
  }, []);

  const alerts = useMemo<Alert[]>(() => {
    if (!trades || trades.length < MIN_HOUR_TRADES) return [];
    const out: Alert[] = [];

    // ── Tranche horaire actuelle ─────────────────────────────────────────
    const hour = now.getHours();
    const hourTrades = trades.filter((tr) => new Date(tr.open_time).getHours() === hour);
    if (hourTrades.length >= MIN_HOUR_TRADES) {
      const total = hourTrades.reduce((s, tr) => s + netPnl(tr), 0);
      const wins = hourTrades.filter((tr) => netPnl(tr) > 0).length;
      const wr = Math.round((wins / hourTrades.length) * 100);
      if (total < 0) {
        out.push({
          id: "bad-hour",
          tone: "danger",
          icon: <Clock className="w-3.5 h-3.5" strokeWidth={1.75} />,
          text: fmt(t("rtcoach_bad_hour"), { hour, pnl: Math.round(total), count: hourTrades.length }),
        });
      } else if (wr >= 65) {
        out.push({
          id: "good-hour",
          tone: "positive",
          icon: <TrendingUp className="w-3.5 h-3.5" strokeWidth={1.75} />,
          text: fmt(t("rtcoach_good_hour"), { hour, wr }),
        });
      }
    }

    // ── Paire à risque ───────────────────────────────────────────────────
    const byPair: Record<string, { count: number; wins: number; total: number }> = {};
    for (const tr of trades) {
      if (!tr.pair) continue;
      byPair[tr.pair] ??= { count: 0, wins: 0, total: 0 };
      byPair[tr.pair].count++;
      const net = netPnl(tr);
      byPair[tr.pair].total += net;
      if (net > 0) byPair[tr.pair].wins++;
    }
    const risky = Object.entries(byPair)
      .filter(([, s]) => s.count >= MIN_PAIR_TRADES && s.wins / s.count <= 0.3)
      .sort((a, b) => a[1].total - b[1].total)[0];
    if (risky) {
      out.push({
        id: "risky-pair",
        tone: "warning",
        icon: <ShieldAlert className="w-3.5 h-3.5" strokeWidth={1.75} />,
        text: fmt(t("rtcoach_risky_pair"), {
          pair: risky[0],
          wr: Math.round((risky[1].wins / risky[1].count) * 100),
          count: risky[1].count,
        }),
      });
    }

    // ── Série en cours (trades triés du plus récent au plus ancien) ──────
    let streak = 0;
    let streakWin: boolean | null = null;
    for (const tr of trades) {
      const win = netPnl(tr) > 0;
      if (streakWin === null) {
        streakWin = win;
        streak = 1;
      } else if (win === streakWin) {
        streak++;
      } else {
        break;
      }
    }
    if (streak >= 3 && streakWin === true) {
      out.push({
        id: "win-streak",
        tone: "warning",
        icon: <Flame className="w-3.5 h-3.5" strokeWidth={1.75} />,
        text: fmt(t("rtcoach_win_streak"), { n: streak }),
      });
    } else if (streak >= 3 && streakWin === false) {
      out.push({
        id: "loss-streak",
        tone: "danger",
        icon: <AlertTriangle className="w-3.5 h-3.5" strokeWidth={1.75} />,
        text: fmt(t("rtcoach_loss_streak"), { n: streak }),
      });
    }

    // Max 3 alertes, les dangers d'abord
    const order = { danger: 0, warning: 1, positive: 2 };
    return out.sort((a, b) => order[a.tone] - order[b.tone]).slice(0, 3);
  }, [trades, now, t]);

  if (alerts.length === 0) return null;

  const toneClasses: Record<Alert["tone"], { row: string; icon: string }> = {
    danger:   { row: "bg-loss/5 border-loss/20",       icon: "bg-loss/15 text-loss" },
    warning:  { row: "bg-warning/5 border-warning/20", icon: "bg-warning/15 text-warning" },
    positive: { row: "bg-profit/5 border-profit/20",   icon: "bg-profit/15 text-profit" },
  };

  return (
    <div className={cn("bg-card border border-border rounded-xl", compact ? "p-4" : "p-5")}>
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <Sparkles className="w-4 h-4 text-accent" strokeWidth={1.75} />
          <h3 className="text-sm font-semibold text-foreground">{t("rtcoach_title")}</h3>
        </div>
        <span className="text-[10px] text-foreground-muted">
          {fmt(t("rtcoach_based_on"), { count: trades?.length ?? 0 })}
        </span>
      </div>
      <div className="space-y-2">
        {alerts.map((a) => (
          <div
            key={a.id}
            className={cn("flex items-start gap-2.5 px-3 py-2.5 rounded-lg border", toneClasses[a.tone].row)}
          >
            <span className={cn("flex items-center justify-center w-6 h-6 rounded-md shrink-0", toneClasses[a.tone].icon)}>
              {a.icon}
            </span>
            <p className="text-xs text-foreground leading-relaxed flex-1 min-w-0">{a.text}</p>
          </div>
        ))}
      </div>
    </div>
  );
}
