"use client";

/**
 * StrategyCompareBlock — « Quelle stratégie te rapporte ? »
 *
 * Compare les stratégies de l'utilisateur côte à côte sur les trades
 * actuellement filtrés : trades, P&L, winrate, profit factor, score de
 * checklist moyen. Les trades sans stratégie forment un bucket à part.
 * Masqué s'il n'y a pas au moins deux buckets avec des trades.
 */

import { useLanguage } from "@/lib/LanguageContext";
import { createClient } from "@/lib/supabase/client";
import { cn } from "@/lib/cn";
import { Target } from "lucide-react";
import { useEffect, useMemo, useState } from "react";

interface StrategyTrade {
  pnl: number;
  commission: number | null;
  swap: number | null;
  strategy_id?: string | null;
  ict_confluence_score?: number | null;
}

interface Bucket {
  id: string | null;
  name: string;
  count: number;
  pnl: number;
  winrate: number;
  profitFactor: number | null;
  avgChecklist: number | null;
}

function netPnl(t: StrategyTrade): number {
  return t.pnl + (t.commission || 0) + (t.swap || 0);
}

export default function StrategyCompareBlock({ trades }: { trades: StrategyTrade[] }) {
  const { t } = useLanguage();
  const [names, setNames] = useState<Record<string, string>>({});

  useEffect(() => {
    const supabase = createClient();
    let cancelled = false;
    async function load() {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user || cancelled) return;
      const { data } = await supabase.from("strategies").select("id, name").eq("user_id", user.id);
      if (!cancelled && data) {
        const map: Record<string, string> = {};
        for (const s of data) map[s.id] = s.name?.trim() || t("stratcmp_unnamed");
        setNames(map);
      }
    }
    load();
    return () => { cancelled = true; };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const buckets = useMemo<Bucket[]>(() => {
    const map: Record<string, { trades: StrategyTrade[]; id: string | null }> = {};
    for (const tr of trades) {
      const key = tr.strategy_id ?? "__none__";
      map[key] ??= { trades: [], id: tr.strategy_id ?? null };
      map[key].trades.push(tr);
    }

    return Object.values(map)
      .map(({ id, trades: list }) => {
        let pnl = 0, wins = 0, grossWin = 0, grossLoss = 0, checklistSum = 0, checklistN = 0;
        for (const tr of list) {
          const net = netPnl(tr);
          pnl += net;
          if (net > 0) { wins++; grossWin += net; } else { grossLoss += Math.abs(net); }
          if (tr.ict_confluence_score != null) { checklistSum += tr.ict_confluence_score; checklistN++; }
        }
        return {
          id,
          name: id === null ? t("stratcmp_none") : (names[id] ?? "…"),
          count: list.length,
          pnl,
          winrate: (wins / list.length) * 100,
          profitFactor: grossLoss > 0 ? grossWin / grossLoss : null,
          avgChecklist: checklistN > 0 ? checklistSum / checklistN : null,
        };
      })
      .sort((a, b) => b.pnl - a.pnl);
  }, [trades, names, t]);

  // Comparaison sans objet avec moins de deux stratégies actives
  if (buckets.length < 2) return null;

  return (
    <div className="bg-card border border-border rounded-xl p-5">
      <div className="flex items-center gap-2 mb-4">
        <Target className="w-4 h-4 text-accent" strokeWidth={1.75} />
        <h3 className="text-sm font-semibold text-foreground">{t("stratcmp_title")}</h3>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="text-[10px] uppercase tracking-wider text-foreground-muted">
              <th className="text-left font-semibold pb-2 pr-3">{t("stratcmp_strategy")}</th>
              <th className="text-right font-semibold pb-2 px-3">{t("compare_trades")}</th>
              <th className="text-right font-semibold pb-2 px-3">P&L</th>
              <th className="text-right font-semibold pb-2 px-3">{t("compare_winrate")}</th>
              <th className="text-right font-semibold pb-2 px-3">PF</th>
              <th className="text-right font-semibold pb-2 pl-3">{t("stratcmp_checklist")}</th>
            </tr>
          </thead>
          <tbody>
            {buckets.map((b, rank) => (
              <tr key={b.id ?? "none"} className="border-t border-border/60">
                <td className="py-2.5 pr-3 font-medium text-foreground text-xs">
                  {rank === 0 && b.pnl > 0 && <span aria-hidden>🏆 </span>}
                  {b.name}
                </td>
                <td className="py-2.5 px-3 text-right tabular-nums text-foreground-muted">{b.count}</td>
                <td className={cn("py-2.5 px-3 text-right tabular-nums font-semibold", b.pnl > 0 ? "text-profit" : b.pnl < 0 ? "text-loss" : "text-foreground-muted")}>
                  {b.pnl >= 0 ? "+" : ""}{Math.round(b.pnl)}€
                </td>
                <td className="py-2.5 px-3 text-right tabular-nums text-foreground">{Math.round(b.winrate)}%</td>
                <td className="py-2.5 px-3 text-right tabular-nums text-foreground">
                  {b.profitFactor !== null ? b.profitFactor.toFixed(2) : "—"}
                </td>
                <td className="py-2.5 pl-3 text-right tabular-nums text-foreground-muted">
                  {b.avgChecklist !== null ? `${b.avgChecklist.toFixed(1)}/7` : "—"}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
