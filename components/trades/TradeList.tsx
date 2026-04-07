"use client";

import { createClient } from "@/lib/supabase/client";
import { useEffect, useState } from "react";

interface Trade {
  id: string;
  open_time: string;
  close_time: string;
  pair: string;
  direction: "long" | "short";
  lot_size: number;
  entry_price: number;
  exit_price: number;
  sl: number | null;
  tp: number | null;
  pnl: number;
  commission: number | null;
  swap: number | null;
}

interface Props {
  refreshKey: number;
}

const PAGE_SIZE = 20;

export default function TradeList({ refreshKey }: Props) {
  const supabase = createClient();
  const [trades, setTrades] = useState<Trade[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(0);
  const [loading, setLoading] = useState(true);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [globalStats, setGlobalStats] = useState({
    count: 0,
    wins: 0,
    totalPnl: 0,
    best: 0,
    worst: 0,
  });

  useEffect(() => {
    loadTrades();
    loadGlobalStats();
  }, [page, refreshKey]); // eslint-disable-line react-hooks/exhaustive-deps

  async function loadTrades() {
    setLoading(true);
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) return;

    const from = page * PAGE_SIZE;
    const to = from + PAGE_SIZE - 1;

    const { data, count } = await supabase
      .from("trades")
      .select("*", { count: "exact" })
      .eq("user_id", user.id)
      .order("open_time", { ascending: false })
      .range(from, to);

    setTrades(data || []);
    setTotal(count || 0);
    setLoading(false);
  }

  async function loadGlobalStats() {
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) return;

    const { data } = await supabase
      .from("trades")
      .select("pnl, commission, swap")
      .eq("user_id", user.id);

    if (!data || data.length === 0) {
      setGlobalStats({ count: 0, wins: 0, totalPnl: 0, best: 0, worst: 0 });
      return;
    }

    const netPnls = data.map(
      (t) => (t.pnl as number) + ((t.commission as number) || 0) + ((t.swap as number) || 0)
    );
    setGlobalStats({
      count: netPnls.length,
      wins: netPnls.filter((p) => p > 0).length,
      totalPnl: netPnls.reduce((a, b) => a + b, 0),
      best: Math.max(...netPnls),
      worst: Math.min(...netPnls),
    });
  }

  async function handleDelete(id: string) {
    if (!confirm("Supprimer ce trade ?")) return;
    setDeletingId(id);
    await supabase.from("trades").delete().eq("id", id);
    setDeletingId(null);
    loadTrades();
    loadGlobalStats();
  }

  // Stats from global data
  const { count: statsCount, wins, totalPnl, best, worst } = globalStats;
  const winrate = statsCount > 0 ? ((wins / statsCount) * 100).toFixed(1) : "—";
  const totalPages = Math.ceil(total / PAGE_SIZE);

  const stats = [
    { label: "Total trades", value: String(statsCount) },
    { label: "Winrate", value: winrate === "—" ? "—" : `${winrate}%` },
    {
      label: "P&L total",
      value: `${totalPnl >= 0 ? "+" : ""}${totalPnl.toFixed(2)}`,
      color: totalPnl >= 0 ? "text-profit" : "text-loss",
    },
    {
      label: "Meilleur trade",
      value: `+${best.toFixed(2)}`,
      color: "text-profit",
    },
    {
      label: "Pire trade",
      value: worst.toFixed(2),
      color: "text-loss",
    },
  ];

  return (
    <section>
      <h2 className="text-lg font-semibold text-foreground">Mes Trades</h2>
      <div className="h-px bg-[#1e1e1e] mt-2 mb-4" />

      {/* Stats */}
      <div className="grid grid-cols-2 sm:grid-cols-5 gap-3 mb-4">
        {stats.map((s) => (
          <div
            key={s.label}
            className="bg-card border border-border rounded-lg p-3"
          >
            <p className="text-xs text-muted">{s.label}</p>
            <p className={`text-lg font-bold mt-0.5 ${s.color || "text-foreground"}`}>
              {s.value}
            </p>
          </div>
        ))}
      </div>

      {/* Table */}
      {loading ? (
        <p className="text-muted py-4">Chargement…</p>
      ) : trades.length === 0 ? (
        <p className="text-muted py-4">Aucun trade enregistré.</p>
      ) : (
        <>
          <div className="overflow-x-auto rounded-lg border border-[#1e1e1e]">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-[#141414] text-muted text-left">
                  <th className="px-3 py-2 font-medium">Date</th>
                  <th className="px-3 py-2 font-medium">Paire</th>
                  <th className="px-3 py-2 font-medium">Dir.</th>
                  <th className="px-3 py-2 font-medium">Lot</th>
                  <th className="px-3 py-2 font-medium">Entrée</th>
                  <th className="px-3 py-2 font-medium">Sortie</th>
                  <th className="px-3 py-2 font-medium">SL</th>
                  <th className="px-3 py-2 font-medium">TP</th>
                  <th className="px-3 py-2 font-medium">P&L net</th>
                  <th className="px-3 py-2 font-medium"></th>
                </tr>
              </thead>
              <tbody>
                {trades.map((t, i) => (
                  <tr
                    key={t.id}
                    className={i % 2 === 0 ? "bg-[#0f0f0f]" : "bg-[#141414]"}
                  >
                    <td className="px-3 py-2 text-foreground whitespace-nowrap">
                      {t.open_time ? new Date(t.open_time).toLocaleDateString("fr-FR") : "—"}
                    </td>
                    <td className="px-3 py-2 text-foreground font-medium">
                      {t.pair}
                    </td>
                    <td className="px-3 py-2">
                      <span
                        className={`px-2 py-0.5 rounded text-xs font-medium ${
                          t.direction === "long"
                            ? "bg-profit/10 text-profit"
                            : "bg-loss/10 text-loss"
                        }`}
                      >
                        {t.direction.toUpperCase()}
                      </span>
                    </td>
                    <td className="px-3 py-2 text-foreground">{t.lot_size}</td>
                    <td className="px-3 py-2 text-foreground">{t.entry_price}</td>
                    <td className="px-3 py-2 text-foreground">{t.exit_price}</td>
                    <td className="px-3 py-2 text-muted">{t.sl ?? "—"}</td>
                    <td className="px-3 py-2 text-muted">{t.tp ?? "—"}</td>
                    {(() => {
                      const net = t.pnl + (t.commission || 0) + (t.swap || 0);
                      return (
                        <td
                          className={`px-3 py-2 font-medium ${
                            net >= 0 ? "text-profit" : "text-loss"
                          }`}
                        >
                          {net >= 0 ? "+" : ""}
                          {net.toFixed(2)}
                        </td>
                      );
                    })()}
                    <td className="px-3 py-2">
                      <button
                        onClick={() => handleDelete(t.id)}
                        disabled={deletingId === t.id}
                        className="text-muted hover:text-loss transition-colors disabled:opacity-50"
                        title="Supprimer"
                      >
                        <svg
                          className="w-4 h-4"
                          fill="none"
                          stroke="currentColor"
                          viewBox="0 0 24 24"
                        >
                          <path
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            strokeWidth={1.5}
                            d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"
                          />
                        </svg>
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Pagination */}
          {totalPages > 1 && (
            <div className="flex items-center justify-between mt-4">
              <p className="text-sm text-muted">
                Page {page + 1} / {totalPages} — {total} trades
              </p>
              <div className="flex gap-2">
                <button
                  onClick={() => setPage((p) => Math.max(0, p - 1))}
                  disabled={page === 0}
                  className="px-3 py-1 text-sm bg-[#1a1a1a] border border-[#2a2a2a] rounded-lg text-foreground disabled:opacity-30 hover:bg-[#2a2a2a] transition-colors"
                >
                  ← Précédent
                </button>
                <button
                  onClick={() => setPage((p) => Math.min(totalPages - 1, p + 1))}
                  disabled={page >= totalPages - 1}
                  className="px-3 py-1 text-sm bg-[#1a1a1a] border border-[#2a2a2a] rounded-lg text-foreground disabled:opacity-30 hover:bg-[#2a2a2a] transition-colors"
                >
                  Suivant →
                </button>
              </div>
            </div>
          )}
        </>
      )}
    </section>
  );
}
