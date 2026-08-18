"use client";

import CloseTradeModal from "@/components/trades/CloseTradeModal";
import CsvImport from "@/components/trades/CsvImport";
import ManualTradeModal from "@/components/trades/ManualTradeModal";
import OpenTradesSection from "@/components/trades/OpenTradesSection";
import QuickAnnotateModal from "@/components/trades/QuickAnnotateModal";
import TaxExportButton from "@/components/trades/TaxExportButton";
import TradeList from "@/components/trades/TradeList";
import { buildCurrencyMap, money, sumByCurrency } from "@/lib/account-currency";
import { useActiveAccount } from "@/lib/ActiveAccountContext";
import { createClient } from "@/lib/supabase/client";
import { useLanguage } from "@/lib/LanguageContext";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import { Plus, Sparkles, Upload, X } from "lucide-react";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useMemo, useState } from "react";

interface Strategy {
  id: string;
  name: string;
  setup_rules: string[];
  pairs: string[];
}

interface Recap {
  count: number;
  wr: number;
  /**
   * P&L net et compte de chaque trade. La ventilation par devise se fait au
   * rendu, là où la table des comptes est disponible.
   */
  trades: { pnl: number; challengeId: string | null }[];
}

export default function TradesPage() {
  const supabase = createClient();
  const router = useRouter();
  const { t } = useLanguage();
  const prefersReducedMotion = useReducedMotion();
  const [refreshKey, setRefreshKey] = useState(0);
  const [showModal, setShowModal] = useState(false);
  const [closingTradeId, setClosingTradeId] = useState<string | null>(null);
  const [selectedStrategy, setSelectedStrategy] = useState<Strategy | null>(null);
  const [showMtBanner, setShowMtBanner] = useState(false);
  const [isImportOpen, setIsImportOpen] = useState(false);
  const [recap, setRecap] = useState<Recap | null>(null);
  const [unannotatedCount, setUnannotatedCount] = useState(0);
  const [showAnnotate, setShowAnnotate] = useState(false);
  const { accounts } = useActiveAccount();

  const currencyMap = useMemo(() => buildCurrencyMap(accounts), [accounts]);

  /**
   * Un total PAR DEVISE, jamais un total unique.
   *
   * ⚠️ La version précédente additionnait tout puis cherchait une devise
   * commune, avec repli sur l'euro. Vu en production le 2026-08-19 : 81 trades
   * sans compte rattaché s'affichaient « -6 619,77 € », et le premier trade
   * Tradovate, rattaché à un compte en dollars, a fait basculer l'ensemble à
   * « -6 494,77 $ ». Le libellé était faux, et la somme elle-même n'avait pas
   * de sens : on n'additionne pas des euros et des dollars.
   *
   * Ventiler ne perd aucune information et n'invente aucune devise. Les trades
   * sans compte tombent dans la devise par défaut via `tradeCurrency`, comme
   * chaque ligne de la liste en dessous : l'en-tête et le tableau racontent
   * enfin la même chose.
   */
  /**
   * Rafraîchissement à la demande depuis « Mes Trades ».
   *
   * Le cron horaire reste la voie normale. Ce bouton existe parce qu'un trader
   * qui vient de clôturer ouvre cette page, pas les réglages, et n'avait aucun
   * moyen visible de forcer un passage : il pouvait attendre jusqu'à une heure
   * sans comprendre pourquoi son trade manquait.
   *
   * Le délai d'attente est tenu côté serveur, pas ici : une garde côté client
   * ne protégerait ni le débit Tradovate ni nos serveurs.
   */
  const [syncing, setSyncing] = useState(false);
  const [syncMsg, setSyncMsg] = useState<string | null>(null);

  const syncNow = useCallback(async () => {
    setSyncing(true);
    setSyncMsg(null);
    try {
      const res = await fetch("/api/broker/sync-now", { method: "POST" });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setSyncMsg(t("trades_sync_error"));
      } else if (data.retryInSeconds > 0) {
        setSyncMsg(t("trades_sync_wait").replace("{n}", String(data.retryInSeconds)));
      } else if (data.synced > 0) {
        setSyncMsg(t("trades_sync_imported").replace("{n}", String(data.synced)));
        setRefreshKey((k) => k + 1);
        await loadRecap();
      } else {
        setSyncMsg(t("trades_sync_done"));
      }
    } catch {
      setSyncMsg(t("trades_sync_error"));
    } finally {
      setSyncing(false);
    }
  }, [t]); // eslint-disable-line react-hooks/exhaustive-deps

  const pnlByCurrency = useMemo(
    () => (recap ? sumByCurrency(recap.trades, currencyMap) : []),
    [recap, currencyMap],
  );

  const loadRecap = useCallback(async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    const [{ data, count }, { count: noEmotion }] = await Promise.all([
      supabase
        .from("trades")
        .select("pnl, commission, swap, challenge_id", { count: "exact" })
        .eq("user_id", user.id)
        .eq("status", "closed"),
      supabase
        .from("trades")
        .select("id", { count: "exact", head: true })
        .eq("user_id", user.id)
        .eq("status", "closed")
        .is("emotion", null),
    ]);

    setUnannotatedCount(noEmotion || 0);

    if (!data) return;

    const netPnls = data.map((t) => (t.pnl as number) + ((t.commission as number) || 0) + ((t.swap as number) || 0));
    const wins = netPnls.filter((p) => p > 0).length;

    setRecap({
      count: count || 0,
      wr: count ? (wins / count) * 100 : 0,
      trades: data.map((t, i) => ({
        pnl: netPnls[i],
        challengeId: (t.challenge_id as string | null) ?? null,
      })),
    });
  }, [supabase]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    async function checkMtTrades() {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const { count } = await supabase
        .from("trades")
        .select("id", { count: "exact", head: true })
        .eq("user_id", user.id)
        .in("source", ["mt4", "mt5"]);

      if (count === 0) setShowMtBanner(true);
    }
    checkMtTrades();
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    async function loadStrategies() {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const { data } = await supabase
        .from("strategies")
        .select("id, name, setup_rules, pairs")
        .eq("user_id", user.id)
        .order("created_at", { ascending: true });

      if (data && data.length > 0) {
        setSelectedStrategy(data[0]);
      }
    }
    loadStrategies();
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    loadRecap();
  }, [refreshKey]); // eslint-disable-line react-hooks/exhaustive-deps

  function refresh() {
    setRefreshKey((k) => k + 1);
  }

  // Premier import = moment « aha » : si l'utilisateur n'a encore jamais
  // lancé d'analyse IA, on l'emmène directement voir son score.
  async function maybeAutorunFirstAnalysis() {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;
    const { count } = await supabase
      .from("session_reviews")
      .select("id", { count: "exact", head: true })
      .eq("user_id", user.id);
    if ((count ?? 0) === 0) {
      router.push("/dashboard/analysis?autorun=1");
    }
  }

  const strategyId = selectedStrategy?.id ?? null;
  const strategyPairs = selectedStrategy?.pairs ?? [];

  return (
    <div className="space-y-6">
      {/* Mode démo : rappel visible tant que des trades fictifs existent */}

      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-foreground">{t("trades_title")}</h1>
          {recap && (
            <p className="text-sm text-muted mt-1">
              {recap.count} trades · WR {recap.wr.toFixed(1)}% · P&amp;L{" "}
              {pnlByCurrency.map(([cur, value], i) => (
                <span key={cur}>
                  {i > 0 && " · "}
                  <span className={value >= 0 ? "text-profit" : "text-loss"}>
                    {money(value, cur, { digits: 2, signed: true })}
                  </span>
                </span>
              ))}
            </p>
          )}
          {syncMsg && <p className="text-xs text-foreground-muted mt-1">{syncMsg}</p>}
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          <button
            onClick={syncNow}
            disabled={syncing}
            className="px-3 py-2 rounded-md border border-border bg-surface text-sm text-foreground hover:bg-border transition-colors disabled:opacity-50"
          >
            {syncing ? t("trades_sync_running") : t("trades_sync_now")}
          </button>
          {unannotatedCount > 0 && (
            <button
              onClick={() => setShowAnnotate(true)}
              className="px-3 py-2 rounded-md border border-accent/30 bg-accent/5 text-sm text-accent hover:bg-accent/10 hover:border-accent/50 transition-colors flex items-center gap-2"
            >
              <Sparkles className="w-4 h-4" />
              {t("annotate_button").replace("{count}", String(unannotatedCount))}
            </button>
          )}
          <TaxExportButton />
          <button
            onClick={() => setIsImportOpen((o) => !o)}
            className="px-3 py-2 rounded-md border border-border text-sm text-muted hover:text-foreground hover:bg-card transition-colors flex items-center gap-2"
          >
            <Upload className="w-4 h-4" />
            {t("trades_import_csv")}
          </button>
          <button
            onClick={() => setShowModal(true)}
            className="px-3 py-2 rounded-md bg-accent text-on-accent text-sm font-medium hover:opacity-90 transition-opacity flex items-center gap-2"
          >
            <Plus className="w-4 h-4" />
            {t("trades_add_trade")}
          </button>
        </div>
      </div>

      {showMtBanner && (
        <div className="p-4 rounded-xl border border-accent/20 bg-accent/5 flex items-center justify-between gap-4 flex-wrap">
          <div className="space-y-1">
            <p className="text-sm font-medium text-foreground">
              {t("trades_mt_sync_title")}
            </p>
            <p className="text-xs text-muted">
              {t("trades_mt_sync_desc")}
            </p>
          </div>
          <a
            href="/dashboard/settings#metatrader"
            className="px-4 py-2 rounded-lg bg-accent text-on-accent text-sm font-medium hover:bg-accent-hover transition-colors whitespace-nowrap flex-shrink-0"
          >
            {t("trades_mt_sync_cta")}
          </a>
        </div>
      )}

      {/* Import CSV collapsible */}
      <AnimatePresence initial={false}>
        {isImportOpen && (
          <motion.div
            initial={prefersReducedMotion ? false : { height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={prefersReducedMotion ? { opacity: 0 } : { height: 0, opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="overflow-hidden"
          >
            <div className="relative border border-border rounded-xl p-4 bg-card">
              <button
                onClick={() => setIsImportOpen(false)}
                className="absolute top-3 right-3 z-10 p-1.5 rounded text-muted hover:text-foreground hover:bg-surface transition-colors"
                aria-label={t("trades_close_import")}
              >
                <X className="w-4 h-4" />
              </button>
              <CsvImport
                strategyId={strategyId}
                onImported={() => {
                  setIsImportOpen(false);
                  refresh();
                  void maybeAutorunFirstAnalysis();
                }}
              />
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      <OpenTradesSection
        refreshKey={refreshKey}
        onCloseTrade={(tradeId) => setClosingTradeId(tradeId)}
      />

      <TradeList
        refreshKey={refreshKey}
        onTradeUpdated={loadRecap}
      />

      {showModal && (
        <ManualTradeModal
          pairs={strategyPairs}
          strategyId={strategyId}
          onClose={() => setShowModal(false)}
          onSaved={() => { refresh(); loadRecap(); }}
        />
      )}

      {closingTradeId && (
        <CloseTradeModal
          tradeId={closingTradeId}
          onClose={() => setClosingTradeId(null)}
          onSaved={() => { refresh(); setClosingTradeId(null); loadRecap(); }}
        />
      )}

      {showAnnotate && (
        <QuickAnnotateModal
          onClose={() => setShowAnnotate(false)}
          onSaved={() => { refresh(); loadRecap(); }}
        />
      )}
    </div>
  );
}
