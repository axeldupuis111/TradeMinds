"use client";

/**
 * PeriodCompareBlock — « Est-ce que je progresse ? »
 *
 * Compare côte à côte la période en cours et la période précédente de même
 * durée (7/30/90 jours selon le filtre actif, 30 j par défaut pour
 * « Tout » / custom) : P&L net, trades, winrate, profit factor, gain moyen.
 * Calcul client-side sur les trades filtrés par compte uniquement.
 */

import { useLanguage } from "@/lib/LanguageContext";
import { DEFAULT_CURRENCY, currencySymbol, money } from "@/lib/account-currency";
import { cn } from "@/lib/cn";
import { Scale } from "lucide-react";
import { useMemo } from "react";

interface CompareTrade {
  open_time: string;
  pnl: number;
  commission: number | null;
  swap: number | null;
  challenge_id: string | null;
}

interface PeriodStats {
  count: number;
  pnl: number;
  winrate: number | null;
  profitFactor: number | null;
  avgPerTrade: number | null;
}

function netPnl(t: CompareTrade): number {
  return t.pnl + (t.commission || 0) + (t.swap || 0);
}

function computeStats(trades: CompareTrade[]): PeriodStats {
  let pnl = 0, wins = 0, grossWin = 0, grossLoss = 0;
  for (const tr of trades) {
    const net = netPnl(tr);
    pnl += net;
    if (net > 0) { wins++; grossWin += net; } else { grossLoss += Math.abs(net); }
  }
  return {
    count: trades.length,
    pnl,
    winrate: trades.length > 0 ? (wins / trades.length) * 100 : null,
    profitFactor: grossLoss > 0 ? grossWin / grossLoss : null,
    avgPerTrade: trades.length > 0 ? pnl / trades.length : null,
  };
}

function fmtEur(n: number, currency: string): string {
  const r = Math.round(n);
  return money(r, currency, { signed: r !== 0 });
}

export default function PeriodCompareBlock({
  trades,
  accountFilter,
  period,
  currency = DEFAULT_CURRENCY,
}: {
  trades: CompareTrade[];
  accountFilter: string;
  period: string;
  /** Devise du compte filtré ; euro sur une vue multi-comptes. */
  currency?: string;
}) {
  const { t } = useLanguage();

  const days = period === "7d" ? 7 : period === "90d" ? 90 : 30;

  const { current, previous } = useMemo(() => {
    const base = accountFilter !== "all"
      ? trades.filter((tr) => tr.challenge_id === accountFilter)
      : trades;

    const now = Date.now();
    const currentStart = now - days * 86400000;
    const prevStart = now - 2 * days * 86400000;

    const cur: CompareTrade[] = [];
    const prev: CompareTrade[] = [];
    for (const tr of base) {
      if (!tr.open_time) continue;
      const ts = new Date(tr.open_time).getTime();
      if (ts >= currentStart) cur.push(tr);
      else if (ts >= prevStart) prev.push(tr);
    }
    return { current: computeStats(cur), previous: computeStats(prev) };
  }, [trades, accountFilter, days]);

  // Pas de comparaison possible sans données sur les deux périodes
  if (current.count === 0 || previous.count === 0) return null;

  const rows: {
    label: string;
    cur: string;
    prev: string;
    delta: number | null;
    suffix: string;
    curClass?: string;
  }[] = [
    {
      label: t("compare_pnl"),
      cur: fmtEur(current.pnl, currency),
      prev: fmtEur(previous.pnl, currency),
      delta: current.pnl - previous.pnl,
      suffix: currencySymbol(currency).trim(),
      curClass: current.pnl > 0 ? "text-profit" : current.pnl < 0 ? "text-loss" : undefined,
    },
    {
      label: t("compare_trades"),
      cur: String(current.count),
      prev: String(previous.count),
      delta: current.count - previous.count,
      suffix: "",
    },
    {
      label: t("compare_winrate"),
      cur: current.winrate !== null ? `${Math.round(current.winrate)}%` : "—",
      prev: previous.winrate !== null ? `${Math.round(previous.winrate)}%` : "—",
      delta: current.winrate !== null && previous.winrate !== null ? current.winrate - previous.winrate : null,
      suffix: "pt",
    },
    {
      label: t("compare_profit_factor"),
      cur: current.profitFactor !== null ? current.profitFactor.toFixed(2) : "—",
      prev: previous.profitFactor !== null ? previous.profitFactor.toFixed(2) : "—",
      delta: current.profitFactor !== null && previous.profitFactor !== null
        ? current.profitFactor - previous.profitFactor
        : null,
      suffix: "",
    },
    {
      label: t("compare_avg_trade"),
      cur: current.avgPerTrade !== null ? fmtEur(current.avgPerTrade, currency) : "—",
      prev: previous.avgPerTrade !== null ? fmtEur(previous.avgPerTrade, currency) : "—",
      delta: current.avgPerTrade !== null && previous.avgPerTrade !== null
        ? current.avgPerTrade - previous.avgPerTrade
        : null,
      suffix: currencySymbol(currency).trim(),
    },
  ];

  return (
    <div className="bg-card border border-border rounded-xl p-5">
      <div className="flex items-center justify-between mb-4 flex-wrap gap-2">
        <div className="flex items-center gap-2">
          <Scale className="w-4 h-4 text-accent" strokeWidth={1.75} />
          <h3 className="text-sm font-semibold text-foreground">{t("compare_title")}</h3>
        </div>
        <span className="text-[11px] text-foreground-muted uppercase tracking-wider">
          {t("compare_subtitle").replaceAll("{days}", String(days))}
        </span>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="text-[10px] uppercase tracking-wider text-foreground-muted">
              <th className="text-left font-semibold pb-2 pr-4"></th>
              <th className="text-right font-semibold pb-2 px-3">{t("compare_previous")}</th>
              <th className="text-right font-semibold pb-2 px-3">{t("compare_current")}</th>
              <th className="text-right font-semibold pb-2 pl-3">Δ</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => {
              const good = row.delta !== null && row.delta > 0;
              const bad = row.delta !== null && row.delta < 0;
              return (
                <tr key={row.label} className="border-t border-border/60">
                  <td className="py-2.5 pr-4 text-foreground-muted text-xs">{row.label}</td>
                  <td className="py-2.5 px-3 text-right tabular-nums text-foreground-muted">{row.prev}</td>
                  <td className={cn("py-2.5 px-3 text-right tabular-nums font-semibold text-foreground", row.curClass)}>
                    {row.cur}
                  </td>
                  <td
                    className={cn(
                      "py-2.5 pl-3 text-right tabular-nums text-xs font-semibold",
                      good ? "text-profit" : bad ? "text-loss" : "text-foreground-muted"
                    )}
                  >
                    {row.delta === null || Math.abs(row.delta) < 0.005
                      ? "="
                      : `${row.delta > 0 ? "↑" : "↓"}${Math.abs(row.delta) >= 10 ? Math.round(Math.abs(row.delta)) : Math.abs(row.delta).toFixed(1)}${row.suffix}`}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
