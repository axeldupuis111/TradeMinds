"use client";

import { useLanguage } from "@/lib/LanguageContext";
import { createClient } from "@/lib/supabase/client";
import { useEffect, useState } from "react";
import TradeDetailPanel, { type TradeDetail } from "./TradeDetailPanel";

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
  tags: string[];
  emotion: string | null;
  setup_quality: number | null;
  notes: string | null;
  screenshot_path: string | null;
  challenge_id: string | null;
  prop_challenges?: { firm: string; account_number: string | null } | null;
}

interface Filters {
  pair: string;
  direction: string;
  result: string;
  dateFrom: string;
  dateTo: string;
}

interface Props {
  refreshKey: number;
}

const PAGE_SIZE = 20;

function normalizeDirection(dir: string): "long" | "short" {
  const d = dir.toLowerCase();
  if (d === "long" || d === "buy") return "long";
  return "short";
}

export default function TradeList({ refreshKey }: Props) {
  const { t } = useLanguage();
  const supabase = createClient();
  const [trades, setTrades] = useState<Trade[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(0);
  const [loading, setLoading] = useState(true);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [bulkDeleting, setBulkDeleting] = useState(false);
  const [selectedTrade, setSelectedTrade] = useState<TradeDetail | null>(null);
  const [allPairs, setAllPairs] = useState<string[]>([]);
  const [filters, setFilters] = useState<Filters>({
    pair: "",
    direction: "",
    result: "",
    dateFrom: "",
    dateTo: "",
  });
  const [globalStats, setGlobalStats] = useState({
    count: 0,
    wins: 0,
    totalPnl: 0,
    best: 0,
    worst: 0,
  });

  useEffect(() => {
    loadAllPairs();
  }, [refreshKey]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    setPage(0);
  }, [filters]);

  useEffect(() => {
    loadTrades();
    loadGlobalStats();
  }, [page, refreshKey, filters]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    setSelectedIds(new Set());
  }, [page, refreshKey]);

  async function loadAllPairs() {
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) return;
    const { data } = await supabase
      .from("trades")
      .select("pair")
      .eq("user_id", user.id);
    if (data) {
      const unique = Array.from(new Set(data.map((r) => r.pair as string))).sort();
      setAllPairs(unique);
    }
  }

  async function loadTrades() {
    setLoading(true);
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) return;

    const from = page * PAGE_SIZE;
    const to = from + PAGE_SIZE - 1;

    let query = supabase
      .from("trades")
      .select("*, tags, emotion, setup_quality, notes, screenshot_path, prop_challenges(firm, account_number)", { count: "exact" })
      .eq("user_id", user.id)
      .order("open_time", { ascending: false })
      .order("id", { ascending: false });

    if (filters.pair) query = query.eq("pair", filters.pair);
    if (filters.direction) query = query.eq("direction", filters.direction);
    if (filters.dateFrom) query = query.gte("open_time", filters.dateFrom);
    if (filters.dateTo) query = query.lte("open_time", filters.dateTo + "T23:59:59");

    const { data, count } = await query.range(from, to);

    let rows = (data || []) as Trade[];

    // Deduplicate by (open_time, pair, entry_price) — handles double-import bugs
    const seen = new Set<string>();
    rows = rows.filter((tr) => {
      const key = `${tr.open_time}|${tr.pair}|${tr.entry_price}`;
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });

    // Client-side result filter (win/loss) applied after dedup
    if (filters.result === "win") {
      rows = rows.filter((tr) => tr.pnl + (tr.commission || 0) + (tr.swap || 0) > 0);
    } else if (filters.result === "loss") {
      rows = rows.filter((tr) => tr.pnl + (tr.commission || 0) + (tr.swap || 0) <= 0);
    }

    setTrades(rows);
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
      (tr) => (tr.pnl as number) + ((tr.commission as number) || 0) + ((tr.swap as number) || 0)
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
    if (!confirm(t("trades_confirm_delete"))) return;
    setDeletingId(id);

    const trade = trades.find((tr) => tr.id === id);
    if (trade?.screenshot_path) {
      await supabase.storage.from("trade-screenshots").remove([trade.screenshot_path]);
    }

    await supabase.from("trades").delete().eq("id", id);
    setDeletingId(null);
    setSelectedIds((prev) => { const next = new Set(prev); next.delete(id); return next; });
    loadTrades();
    loadGlobalStats();
  }

  async function handleBulkDelete() {
    const ids = Array.from(selectedIds);
    if (ids.length === 0) return;
    const msg = t("trades_confirm_delete_mass").replace("{count}", String(ids.length));
    if (!confirm(msg)) return;

    setBulkDeleting(true);

    const pathsToDelete = trades
      .filter((tr) => ids.includes(tr.id) && tr.screenshot_path)
      .map((tr) => tr.screenshot_path as string);
    if (pathsToDelete.length > 0) {
      await supabase.storage.from("trade-screenshots").remove(pathsToDelete);
    }

    await supabase.from("trades").delete().in("id", ids);
    setBulkDeleting(false);
    setSelectedIds(new Set());
    loadTrades();
    loadGlobalStats();
  }

  function toggleSelect(id: string) {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function toggleSelectAll() {
    if (trades.every((tr) => selectedIds.has(tr.id))) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(trades.map((tr) => tr.id)));
    }
  }

  function resetFilters() {
    setFilters({ pair: "", direction: "", result: "", dateFrom: "", dateTo: "" });
  }

  const hasActiveFilters = filters.pair || filters.direction || filters.result || filters.dateFrom || filters.dateTo;
  const allSelected = trades.length > 0 && trades.every((tr) => selectedIds.has(tr.id));
  const someSelected = selectedIds.size > 0;

  const { count: statsCount, wins, totalPnl, best, worst } = globalStats;
  const winrate = statsCount > 0 ? ((wins / statsCount) * 100).toFixed(1) : "—";
  const totalPages = Math.ceil(total / PAGE_SIZE);

  const stats = [
    { label: t("trades_total"), value: String(statsCount) },
    { label: t("trades_winrate"), value: winrate === "—" ? "—" : `${winrate}%` },
    {
      label: t("trades_pnl_total"),
      value: `${totalPnl >= 0 ? "+" : ""}${totalPnl.toFixed(2)}`,
      color: totalPnl >= 0 ? "text-profit" : "text-loss",
    },
    {
      label: t("trades_best"),
      value: `+${best.toFixed(2)}`,
      color: "text-profit",
    },
    {
      label: t("trades_worst"),
      value: worst.toFixed(2),
      color: "text-loss",
    },
  ];

  return (
    <section>
      <h2 className="text-lg font-semibold text-foreground">{t("trades_list_title")}</h2>
      <div className="h-px bg-border mt-2 mb-4" />

      {/* Stats */}
      <div className="grid grid-cols-2 sm:grid-cols-5 gap-3 mb-2">
        {stats.map((s) => (
          <div key={s.label} className="bg-card border border-border rounded-lg p-3">
            <p className="text-xs text-muted">{s.label}</p>
            <p className={`text-lg font-bold mt-0.5 ${s.color || "text-foreground"}`}>{s.value}</p>
          </div>
        ))}
      </div>

      {/* Filter context note */}
      <p className="text-[11px] text-muted mb-4">
        {hasActiveFilters
          ? t("trades_filtered_by").replace("{count}", String(total))
          : t("trades_all_accounts").replace("{count}", String(statsCount))}
      </p>

      {/* Filter bar */}
      <div className="bg-card border border-border rounded-lg p-3 mb-4">
        <div className="flex flex-wrap gap-3 items-end">
          {/* Pair */}
          <div className="flex flex-col gap-1 min-w-[140px]">
            <label className="text-xs text-muted">{t("trades_filter_label_pair")}</label>
            <select
              value={filters.pair}
              onChange={(e) => setFilters((f) => ({ ...f, pair: e.target.value }))}
              className="bg-surface border border-border rounded-lg px-2 py-1.5 text-sm text-foreground focus:outline-none focus:border-accent"
            >
              <option value="">{t("trades_filter_all_pairs")}</option>
              {allPairs.map((p) => (
                <option key={p} value={p}>{p}</option>
              ))}
            </select>
          </div>

          {/* Direction */}
          <div className="flex flex-col gap-1 min-w-[120px]">
            <label className="text-xs text-muted">{t("trades_filter_label_dir")}</label>
            <select
              value={filters.direction}
              onChange={(e) => setFilters((f) => ({ ...f, direction: e.target.value }))}
              className="bg-surface border border-border rounded-lg px-2 py-1.5 text-sm text-foreground focus:outline-none focus:border-accent"
            >
              <option value="">{t("trades_filter_all")}</option>
              <option value="long">LONG</option>
              <option value="short">SHORT</option>
            </select>
          </div>

          {/* Result */}
          <div className="flex flex-col gap-1 min-w-[120px]">
            <label className="text-xs text-muted">{t("trades_filter_label_result")}</label>
            <select
              value={filters.result}
              onChange={(e) => setFilters((f) => ({ ...f, result: e.target.value }))}
              className="bg-surface border border-border rounded-lg px-2 py-1.5 text-sm text-foreground focus:outline-none focus:border-accent"
            >
              <option value="">{t("trades_filter_all")}</option>
              <option value="win">{t("trades_filter_winners")}</option>
              <option value="loss">{t("trades_filter_losers")}</option>
            </select>
          </div>

          {/* Date from */}
          <div className="flex flex-col gap-1 min-w-[130px]">
            <label className="text-xs text-muted">{t("trades_filter_date_from")}</label>
            <input
              type="date"
              value={filters.dateFrom}
              onChange={(e) => setFilters((f) => ({ ...f, dateFrom: e.target.value }))}
              className="bg-surface border border-border rounded-lg px-2 py-1.5 text-sm text-foreground focus:outline-none focus:border-accent"
            />
          </div>

          {/* Date to */}
          <div className="flex flex-col gap-1 min-w-[130px]">
            <label className="text-xs text-muted">{t("trades_filter_date_to")}</label>
            <input
              type="date"
              value={filters.dateTo}
              onChange={(e) => setFilters((f) => ({ ...f, dateTo: e.target.value }))}
              className="bg-surface border border-border rounded-lg px-2 py-1.5 text-sm text-foreground focus:outline-none focus:border-accent"
            />
          </div>

          {/* Reset */}
          {hasActiveFilters && (
            <button
              onClick={resetFilters}
              className="px-3 py-1.5 text-sm text-muted border border-border rounded-lg hover:text-foreground hover:bg-surface transition-colors self-end"
            >
              {t("trades_filter_reset")}
            </button>
          )}
        </div>
      </div>

      {/* Bulk action bar */}
      {someSelected && (
        <div className="flex items-center gap-3 mb-3 p-3 bg-surface border border-border rounded-lg">
          <span className="text-sm text-foreground font-medium">
            {selectedIds.size} {t("trades_selected")}
          </span>
          <button
            onClick={handleBulkDelete}
            disabled={bulkDeleting}
            className="px-3 py-1.5 text-sm bg-loss/10 text-loss border border-loss/30 rounded-lg font-medium hover:bg-loss/20 transition-colors disabled:opacity-50"
          >
            {bulkDeleting ? "..." : t("trades_delete_selection")}
          </button>
          <button
            onClick={() => setSelectedIds(new Set())}
            className="px-3 py-1.5 text-sm text-muted hover:text-foreground transition-colors"
          >
            {t("trades_deselect_all")}
          </button>
        </div>
      )}

      {/* Table */}
      {loading ? (
        <p className="text-muted py-4">{t("trades_loading")}</p>
      ) : trades.length === 0 ? (
        <p className="text-muted py-4">{t("trades_empty")}</p>
      ) : (
        <>
          <div className="overflow-x-auto rounded-lg border border-border">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-surface text-muted text-left">
                  <th className="px-3 py-2 w-8">
                    <input
                      type="checkbox"
                      checked={allSelected}
                      onChange={toggleSelectAll}
                      className="accent-accent w-4 h-4 cursor-pointer"
                    />
                  </th>
                  <th className="px-3 py-2 font-medium">{t("trades_col_date")}</th>
                  <th className="px-3 py-2 font-medium">{t("trades_col_account")}</th>
                  <th className="px-3 py-2 font-medium">{t("trades_col_pair")}</th>
                  <th className="px-3 py-2 font-medium">{t("trades_col_dir")}</th>
                  <th className="px-3 py-2 font-medium">{t("trades_col_lot")}</th>
                  <th className="px-3 py-2 font-medium">{t("trades_col_entry")}</th>
                  <th className="px-3 py-2 font-medium">{t("trades_col_exit")}</th>
                  <th className="px-3 py-2 font-medium">{t("trades_col_sl")}</th>
                  <th className="px-3 py-2 font-medium">{t("trades_col_tp")}</th>
                  <th className="px-3 py-2 font-medium">{t("trades_col_pnl")}</th>
                  <th className="px-3 py-2 font-medium"></th>
                </tr>
              </thead>
              <tbody>
                {trades.map((tr, i) => {
                  const dir = normalizeDirection(tr.direction);
                  return (
                    <tr
                      key={tr.id}
                      onClick={() => setSelectedTrade(tr as TradeDetail)}
                      className={`cursor-pointer hover:bg-accent/5 transition-colors ${i % 2 === 0 ? "bg-card" : "bg-surface"} ${selectedIds.has(tr.id) ? "!bg-accent/5" : ""}`}
                    >
                      <td className="px-3 py-2" onClick={(e) => e.stopPropagation()}>
                        <input
                          type="checkbox"
                          checked={selectedIds.has(tr.id)}
                          onChange={() => toggleSelect(tr.id)}
                          className="accent-accent w-4 h-4 cursor-pointer"
                        />
                      </td>
                      <td className="px-3 py-2 text-foreground whitespace-nowrap">
                        {tr.open_time ? new Date(tr.open_time).toLocaleDateString() : "—"}
                      </td>
                      <td className="px-3 py-2 text-muted text-xs whitespace-nowrap">
                        {tr.prop_challenges
                          ? `${tr.prop_challenges.firm}${tr.prop_challenges.account_number ? ` #${tr.prop_challenges.account_number}` : ""}`
                          : "—"}
                      </td>
                      <td className="px-3 py-2 text-foreground font-medium">{tr.pair}</td>
                      <td className="px-3 py-2">
                        <span className={`px-2 py-0.5 rounded text-xs font-medium ${dir === "long" ? "bg-profit/10 text-profit" : "bg-loss/10 text-loss"}`}>
                          {dir === "long" ? "LONG" : "SHORT"}
                        </span>
                      </td>
                      <td className="px-3 py-2 text-foreground">{tr.lot_size}</td>
                      <td className="px-3 py-2 text-foreground">{tr.entry_price}</td>
                      <td className="px-3 py-2 text-foreground">{tr.exit_price}</td>
                      <td className="px-3 py-2 text-muted">{tr.sl ?? "—"}</td>
                      <td className="px-3 py-2 text-muted">{tr.tp ?? "—"}</td>
                      {(() => {
                        const net = tr.pnl + (tr.commission || 0) + (tr.swap || 0);
                        return (
                          <td className={`px-3 py-2 font-medium ${net >= 0 ? "text-profit" : "text-loss"}`}>
                            {net >= 0 ? "+" : ""}{net.toFixed(2)}
                          </td>
                        );
                      })()}
                      <td className="px-3 py-2" onClick={(e) => e.stopPropagation()}>
                        <button
                          onClick={() => handleDelete(tr.id)}
                          disabled={deletingId === tr.id}
                          className="text-muted hover:text-loss transition-colors disabled:opacity-50"
                          title={t("trades_delete")}
                        >
                          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                          </svg>
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {/* Pagination */}
          {totalPages > 1 && (
            <div className="flex items-center justify-between mt-4">
              <p className="text-sm text-muted">
                {t("trades_page")} {page + 1} / {totalPages} — {total} trades
              </p>
              <div className="flex gap-2">
                <button
                  onClick={() => setPage((p) => Math.max(0, p - 1))}
                  disabled={page === 0}
                  className="px-3 py-1 text-sm bg-surface border border-border rounded-lg text-foreground disabled:opacity-30 hover:bg-border transition-colors"
                >
                  {t("trades_prev")}
                </button>
                <button
                  onClick={() => setPage((p) => Math.min(totalPages - 1, p + 1))}
                  disabled={page >= totalPages - 1}
                  className="px-3 py-1 text-sm bg-surface border border-border rounded-lg text-foreground disabled:opacity-30 hover:bg-border transition-colors"
                >
                  {t("trades_next")}
                </button>
              </div>
            </div>
          )}
        </>
      )}

      {selectedTrade && (
        <TradeDetailPanel
          trade={selectedTrade}
          onClose={() => setSelectedTrade(null)}
          onSaved={() => { loadTrades(); loadGlobalStats(); }}
        />
      )}
    </section>
  );
}
