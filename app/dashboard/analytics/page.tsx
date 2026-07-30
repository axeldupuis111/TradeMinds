"use client";

import { AnalyticsInsightCards } from "@/components/analytics/AnalyticsInsightCards";
import { AnalyticsKpiCards } from "@/components/analytics/AnalyticsKpiCards";
import PeriodCompareBlock from "@/components/analytics/PeriodCompareBlock";
import StrategyCompareBlock from "@/components/analytics/StrategyCompareBlock";
import { AutoInsights } from "@/components/analytics/AutoInsights";
import { DisciplineAnalyticsBlock } from "@/components/analytics/DisciplineAnalyticsBlock";
import DrawdownBlock from "@/components/analytics/DrawdownBlock";
import { HourDayHeatmap } from "@/components/analytics/HourDayHeatmap";
import { ResilienceBlock } from "@/components/analytics/ResilienceBlock";
import EmotionalTrendChart from "@/components/charts/EmotionalTrendChart";
import ExportPdfButton from "@/components/analytics/ExportPdfButton";
import { KpiCardPremium } from "@/components/dashboard/KpiCardPremium";
import { Card, CardHeader, CardTitle } from "@/components/ui/Card";
import StaggerContainer, { StaggerItem } from "@/components/animations/StaggerContainer";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";

import { useStrategyTags } from "@/lib/hooks/useStrategyTags";
import { useChartColors } from "@/lib/useChartColors";
import {
  DEFAULT_CURRENCY,
  accountCurrency,
  buildCurrencyMap,
  commonCurrency,
  currencySymbol,
  money,
} from "@/lib/account-currency";
import { useLanguage } from "@/lib/LanguageContext";
import { createClient } from "@/lib/supabase/client";
import { cn } from "@/lib/cn";
import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { Search, ShieldCheck, ShieldAlert, Filter, X } from "lucide-react";
import {
  BarChart,
  Bar,
  Cell,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  CartesianGrid,
  LabelList,
  ComposedChart,
  Area,
  Line,
  ReferenceLine,
} from "recharts";

interface TradeRow {
  open_time: string;
  close_time?: string | null;
  pnl: number;
  commission: number | null;
  swap: number | null;
  pair: string;
  direction: string;
  emotion: string | null;
  setup_quality: number | null;
  challenge_id: string | null;
  ict_setup?: string | null;
  ict_entry_zone?: string | null;
  ict_killzone?: string | null;
  ict_checklist?: Record<string, boolean> | null;
  sl?: number | null;
  tp?: number | null;
  entry_price?: number | null;
  strategy_id?: string | null;
  ict_confluence_score?: number | null;
}

interface ViolationTrade {
  trade_date?: string;
  pair?: string;
  category?: string;
  type?: string;
  trade_ids?: number[];
}

interface SessionReview {
  created_at: string;
  discipline_score?: number;
  analysis: {
    violations: ViolationTrade[];
  };
}

interface Account {
  id: string;
  firm: string;
  account_number: string | null;
  account_size: number;
  currency: string | null;
  synced_currency: string | null;
}

const DAY_KEYS = ["analytics_sun", "analytics_mon", "analytics_tue", "analytics_wed", "analytics_thu", "analytics_fri", "analytics_sat"];
const EMOTION_KEYS: Record<string, string> = {
  confident: "emotion_confident",
  neutral: "emotion_neutral",
  anxious: "emotion_anxious",
  frustrated: "emotion_frustrated",
  fomo: "emotion_fomo",
  revenge: "emotion_revenge",
};
const EMOTION_EMOJIS: Record<string, string> = {
  confident: "\u{1F60E}",
  neutral: "\u{1F610}",
  anxious: "\u{1F630}",
  frustrated: "\u{1F624}",
  fomo: "\u{1F911}",
  revenge: "\u{1F621}",
};

type Period = "7d" | "30d" | "90d" | "all" | "custom";


/**
 * Formatter P&L sécurisé : évite "-0€" pour les valeurs proches de zéro.
 * Utilise Math.round pour traiter -0 comme 0.
 */
function formatPnl(n: number, currency: string = DEFAULT_CURRENCY): string {
  const rounded = Math.round(n);
  return money(rounded, currency, { signed: rounded !== 0 });
}

interface BarShapeProps {
  x?: number;
  y?: number;
  width?: number;
  height?: number;
  value?: number;
  payload?: Record<string, number>;
}
function RoundedBar({
  x = 0, y = 0, width = 0, height = 0, value = 0, fill, fillOpacity,
}: BarShapeProps & { fill?: string; fillOpacity?: number }) {
  if (!width || !height) return null;
  const r = Math.min(4, Math.abs(height) / 2, width / 2);

  let d: string;
  if (value >= 0) {
    d = `M${x},${y + r} Q${x},${y} ${x + r},${y} L${x + width - r},${y} Q${x + width},${y} ${x + width},${y + r} L${x + width},${y + height} L${x},${y + height} Z`;
  } else {
    const top = y + height;
    d = `M${x},${top} L${x + width},${top} L${x + width},${y - r} Q${x + width},${y} ${x + width - r},${y} L${x + r},${y} Q${x},${y} ${x},${y - r} Z`;
  }
  return <path d={d} fill={fill} fillOpacity={fillOpacity} />;
}

export default function AnalyticsPage() {
  const { t, lang } = useLanguage();
  const dateLocale = ({ fr: "fr-FR", en: "en-US", de: "de-DE", es: "es-ES" } as const)[lang] ?? "en-US";
  const c = useChartColors();
  const supabase = createClient();
  const stratTags = useStrategyTags();
  const reducedMotion = useReducedMotion();

  // ── Data state ────────────────────────────────────────────────────────────
  const [trades, setTrades] = useState<TradeRow[]>([]);
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [reviews, setReviews] = useState<SessionReview[]>([]);
  const [loading, setLoading] = useState(true);

  // ── Filter state ──────────────────────────────────────────────────────────
  const [period, setPeriod] = useState<Period>("all");
  const [customDateFrom, setCustomDateFrom] = useState<string>("");
  const [customDateTo, setCustomDateTo] = useState<string>("");
  const [accountFilter, setAccountFilter] = useState<string>("all");
  const [direction, setDirection] = useState<"all" | "long" | "short">("all");

  // Advanced filters (applied state)
  const [selectedPairs, setSelectedPairs] = useState<string[]>([]);
  const [pnlMin, setPnlMin] = useState<string>("");
  const [pnlMax, setPnlMax] = useState<string>("");
  const [winLossFilter, setWinLossFilter] = useState<"all" | "win" | "loss">("all");

  // Advanced filter panel + staging state
  const [showAdvancedFilters, setShowAdvancedFilters] = useState(false);
  const [stagingPairs, setStagingPairs] = useState<string[]>([]);
  const [stagingPnlMin, setStagingPnlMin] = useState<string>("");
  const [stagingPnlMax, setStagingPnlMax] = useState<string>("");
  const [stagingWinLoss, setStagingWinLoss] = useState<"all" | "win" | "loss">("all");

  // ESC key closes the advanced filter panel
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") setShowAdvancedFilters(false); };
    if (showAdvancedFilters) {
      document.addEventListener("keydown", onKey);
      return () => document.removeEventListener("keydown", onKey);
    }
  }, [showAdvancedFilters]);

  useEffect(() => {
    async function load() {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const [{ data: tradeData }, { data: accountData }, { data: reviewData }] = await Promise.all([
        supabase
          .from("trades")
          .select("open_time, close_time, pnl, commission, swap, pair, direction, emotion, setup_quality, challenge_id, ict_setup, ict_entry_zone, ict_killzone, ict_checklist, sl, tp, entry_price, strategy_id, ict_confluence_score")
          .eq("user_id", user.id)
          .order("open_time", { ascending: true }),
        supabase
          .from("prop_challenges")
          .select("id, firm, account_number, account_size, currency, synced_currency")
          .eq("user_id", user.id)
          .eq("status", "active"),
        supabase
          .from("session_reviews")
          .select("created_at, discipline_score, analysis")
          .eq("user_id", user.id)
          .order("created_at", { ascending: false })
          .limit(20),
      ]);

      setTrades(tradeData || []);
      setAccounts(accountData || []);
      setReviews(reviewData || []);
      setLoading(false);
    }
    load();
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const netPnl = (tr: TradeRow) => tr.pnl + (tr.commission || 0) + (tr.swap || 0);

  // ── Available pairs for filter panel ─────────────────────────────────────
  const availablePairs = useMemo(() => {
    const set = new Set(trades.map((tr) => tr.pair).filter(Boolean));
    return Array.from(set).sort();
  }, [trades]);

  // ── Has active advanced filters ───────────────────────────────────────────
  const hasAdvancedFilters = selectedPairs.length > 0 || pnlMin !== "" || pnlMax !== "" || winLossFilter !== "all";

  // ── Filtered trades ───────────────────────────────────────────────────────
  const filtered = useMemo(() => {
    let result = trades;

    // Account filter
    if (accountFilter !== "all") {
      result = result.filter((tr) => tr.challenge_id === accountFilter);
    }

    // Period filter
    if (period !== "all") {
      let start: Date | null = null;
      let end: Date | null = null;

      if (period === "7d") {
        start = new Date(); start.setDate(start.getDate() - 7);
      } else if (period === "30d") {
        start = new Date(); start.setDate(start.getDate() - 30);
      } else if (period === "90d") {
        start = new Date(); start.setDate(start.getDate() - 90);
      } else if (period === "custom") {
        if (customDateFrom) start = new Date(customDateFrom);
        if (customDateTo) {
          end = new Date(customDateTo);
          end.setHours(23, 59, 59, 999);
        }
      }
      if (start) result = result.filter((tr) => tr.open_time && new Date(tr.open_time) >= start!);
      if (end)   result = result.filter((tr) => tr.open_time && new Date(tr.open_time) <= end!);
    }

    // Direction filter
    if (direction !== "all") {
      result = result.filter((tr) => {
        const d = (tr.direction || "").toLowerCase();
        if (direction === "long")  return d === "long"  || d === "buy";
        if (direction === "short") return d === "short" || d === "sell";
        return true;
      });
    }

    // Pair filter
    if (selectedPairs.length > 0) {
      result = result.filter((tr) => selectedPairs.includes(tr.pair));
    }

    // PnL min/max
    const minVal = pnlMin !== "" ? parseFloat(pnlMin) : null;
    const maxVal = pnlMax !== "" ? parseFloat(pnlMax) : null;
    if (minVal !== null && !isNaN(minVal)) result = result.filter((tr) => netPnl(tr) >= minVal);
    if (maxVal !== null && !isNaN(maxVal)) result = result.filter((tr) => netPnl(tr) <= maxVal);

    // Win/Loss only
    if (winLossFilter === "win")  result = result.filter((tr) => netPnl(tr) > 0);
    if (winLossFilter === "loss") result = result.filter((tr) => netPnl(tr) < 0);

    return result;
  }, [trades, period, accountFilter, direction, customDateFrom, customDateTo, selectedPairs, pnlMin, pnlMax, winLossFilter]); // eslint-disable-line react-hooks/exhaustive-deps

  // ── Libellés lisibles pour l'export PDF (période + compte sélectionnés) ───
  const periodLabel = useMemo(() => {
    if (period === "7d") return t("analytics_period_7d");
    if (period === "30d") return t("analytics_period_30d");
    if (period === "90d") return t("analytics_period_90d");
    if (period === "custom") {
      const fmt = (d: string) => new Date(d).toLocaleDateString(dateLocale, { day: "2-digit", month: "2-digit", year: "2-digit" });
      if (customDateFrom && customDateTo) return `${fmt(customDateFrom)} – ${fmt(customDateTo)}`;
      if (customDateFrom) return `≥ ${fmt(customDateFrom)}`;
      if (customDateTo) return `≤ ${fmt(customDateTo)}`;
    }
    return t("analytics_all");
  }, [period, customDateFrom, customDateTo, t, dateLocale]);

  // Devise de la page : celle du compte filtré, sinon celle que partagent tous
  // les comptes. À défaut l'euro — un total mélangeant EUR et USD n'a pas de
  // devise, et lui en coller une afficherait un chiffre faux.
  const pageCurrency = useMemo(() => {
    if (accountFilter !== "all") {
      const a = accounts.find((x) => x.id === accountFilter);
      if (a) return accountCurrency(a);
    }
    const map = buildCurrencyMap(accounts);
    return commonCurrency(accounts.map((a) => a.id), map) ?? DEFAULT_CURRENCY;
  }, [accountFilter, accounts]);

  const accountLabel = useMemo(() => {
    if (accountFilter === "all") return t("analytics_all_accounts");
    const a = accounts.find((x) => x.id === accountFilter);
    if (!a) return t("analytics_all_accounts");
    return `${a.firm} · ${a.account_number || money(a.account_size, accountCurrency(a))}`;
  }, [accountFilter, accounts, t]);

  // ── Previous period (for KPI deltas) ─────────────────────────────────────
  const prevFiltered = useMemo(() => {
    if (period === "all" || period === "custom") return [];
    let result = trades;
    if (accountFilter !== "all") result = result.filter((tr) => tr.challenge_id === accountFilter);
    const days = period === "7d" ? 7 : period === "30d" ? 30 : 90;
    const end = new Date(); end.setDate(end.getDate() - days);
    const start = new Date(end); start.setDate(start.getDate() - days);
    return result.filter((tr) => tr.open_time && new Date(tr.open_time) >= start && new Date(tr.open_time) < end);
  }, [trades, period, accountFilter]);

  const prevKpis = useMemo(() => {
    if (prevFiltered.length === 0) return null;
    const pnls = prevFiltered.map(netPnl);
    const w = prevFiltered.filter((tr) => netPnl(tr) > 0).length;
    return {
      totalPnl: pnls.reduce((s, v) => s + v, 0),
      winrate: prevFiltered.length > 0 ? (w / prevFiltered.length) * 100 : 0,
      trades: prevFiltered.length,
    };
  }, [prevFiltered]); // eslint-disable-line react-hooks/exhaustive-deps

  // ── KPI aggregates ────────────────────────────────────────────────────────
  const { totalPnl, wins, winrate, best, worst, bestTrade, worstTrade } = useMemo(() => {
    const pnls = filtered.map(netPnl);
    const w = filtered.filter((tr) => netPnl(tr) > 0).length;
    let bestTr = filtered[0] ?? null;
    let worstTr = filtered[0] ?? null;
    for (const tr of filtered) {
      if (netPnl(tr) > (bestTr ? netPnl(bestTr) : -Infinity)) bestTr = tr;
      if (netPnl(tr) < (worstTr ? netPnl(worstTr) : Infinity))  worstTr = tr;
    }
    return {
      totalPnl: pnls.reduce((s, v) => s + v, 0),
      wins: w,
      winrate: filtered.length > 0 ? (w / filtered.length) * 100 : 0,
      best: pnls.length > 0 ? Math.max(...pnls) : 0,
      worst: pnls.length > 0 ? Math.min(...pnls) : 0,
      bestTrade:  bestTr  ? { pnl: netPnl(bestTr),  date: bestTr.open_time  } : null,
      worstTrade: worstTr ? { pnl: netPnl(worstTr), date: worstTr.open_time } : null,
    };
  }, [filtered]); // eslint-disable-line react-hooks/exhaustive-deps

  const profitFactor = useMemo(() => {
    const gains = filtered.filter((tr) => netPnl(tr) > 0).reduce((s, tr) => s + netPnl(tr), 0);
    const losses = filtered.filter((tr) => netPnl(tr) < 0).reduce((s, tr) => s + Math.abs(netPnl(tr)), 0);
    if (filtered.length === 0) return null;
    if (losses === 0) return gains > 0 ? Infinity : null;
    return gains / losses;
  }, [filtered]); // eslint-disable-line react-hooks/exhaustive-deps

  const { avgWin, avgLoss } = useMemo(() => {
    const winTrades  = filtered.filter((tr) => netPnl(tr) > 0);
    const lossTrades = filtered.filter((tr) => netPnl(tr) < 0);
    const avgW = winTrades.length  > 0
      ? winTrades.reduce((s, tr) => s + netPnl(tr), 0) / winTrades.length
      : 0;
    const avgL = lossTrades.length > 0
      ? Math.abs(lossTrades.reduce((s, tr) => s + netPnl(tr), 0) / lossTrades.length)
      : 0;
    return { avgWin: avgW, avgLoss: avgL };
  }, [filtered]); // eslint-disable-line react-hooks/exhaustive-deps

  // ── Chart data ────────────────────────────────────────────────────────────

  // byDayOfWeek — kept for worstDay insight (chart removed, replaced by heatmap in Vague B)
  const byDayOfWeek = useMemo(() => {
    const map = Array.from({ length: 7 }, () => ({ total: 0, count: 0, wins: 0 }));
    filtered.forEach((tr) => {
      if (!tr.open_time) return;
      const day = new Date(tr.open_time).getDay();
      const net = netPnl(tr);
      map[day].total += net;
      map[day].count++;
      if (net > 0) map[day].wins++;
    });
    return map.map((d, i) => ({
      name: t(DAY_KEYS[i]),
      pnl: Number(d.total.toFixed(2)),
      count: d.count,
      winrate: d.count > 0 ? Math.round((d.wins / d.count) * 100) : 0,
    }));
  }, [filtered, t]); // eslint-disable-line react-hooks/exhaustive-deps

  const byHour = useMemo(() => {
    const map = Array.from({ length: 24 }, () => ({ total: 0, count: 0, wins: 0 }));
    filtered.forEach((tr) => {
      if (!tr.open_time) return;
      const hour = new Date(tr.open_time).getHours();
      const net = netPnl(tr);
      map[hour].total += net;
      map[hour].count++;
      if (net > 0) map[hour].wins++;
    });
    return map.map((d, i) => ({
      name: `${i}h`,
      pnl: Number(d.total.toFixed(2)),
      count: d.count,
      winrate: d.count > 0 ? Math.round((d.wins / d.count) * 100) : 0,
    }));
  }, [filtered]); // eslint-disable-line react-hooks/exhaustive-deps

  const byPair = useMemo(() => {
    const map: Record<string, { total: number; count: number; wins: number }> = {};
    filtered.forEach((tr) => {
      if (!map[tr.pair]) map[tr.pair] = { total: 0, count: 0, wins: 0 };
      const net = netPnl(tr);
      map[tr.pair].total += net;
      map[tr.pair].count++;
      if (net > 0) map[tr.pair].wins++;
    });
    return Object.entries(map)
      .map(([pair, d]) => ({
        name: pair,
        pnl: Number(d.total.toFixed(2)),
        count: d.count,
        winrate: d.count > 0 ? Math.round((d.wins / d.count) * 100) : 0,
      }))
      .sort((a, b) => b.pnl - a.pnl);
  }, [filtered]); // eslint-disable-line react-hooks/exhaustive-deps

  const byEmotion = useMemo(() => {
    const map: Record<string, { total: number; count: number }> = {};
    filtered.forEach((tr) => {
      if (!tr.emotion) return;
      if (!map[tr.emotion]) map[tr.emotion] = { total: 0, count: 0 };
      map[tr.emotion].total += netPnl(tr);
      map[tr.emotion].count++;
    });
    return Object.entries(map)
      .map(([em, d]) => ({
        name: `${EMOTION_EMOJIS[em] || ""} ${t(EMOTION_KEYS[em] || em)}`,
        pnl: Number(d.total.toFixed(2)),
        count: d.count,
      }))
      .sort((a, b) => b.pnl - a.pnl);
  }, [filtered, t]); // eslint-disable-line react-hooks/exhaustive-deps

  const byQuality = useMemo(() => {
    const map = Array.from({ length: 5 }, () => ({ total: 0, count: 0 }));
    filtered.forEach((tr) => {
      if (!tr.setup_quality) return;
      const idx = tr.setup_quality - 1;
      map[idx].total += netPnl(tr);
      map[idx].count++;
    });
    return map
      .map((d, i) => ({ name: `${"★".repeat(i + 1)}`, pnl: Number(d.total.toFixed(2)), count: d.count }))
      .filter((d) => d.count > 0);
  }, [filtered]); // eslint-disable-line react-hooks/exhaustive-deps

  const pnlDistribution = useMemo(() => {
    const pnls = filtered.map(netPnl);
    if (pnls.length === 0) return [];
    const min = Math.min(...pnls);
    const max = Math.max(...pnls);
    const range = max - min;
    if (range === 0) return [{ name: `${min.toFixed(0)}`, count: pnls.length, avg: min }];
    const bucketCount = Math.min(15, Math.max(5, Math.ceil(Math.sqrt(pnls.length))));
    const bucketSize = range / bucketCount;
    const buckets = Array.from({ length: bucketCount }, (_, i) => ({
      min: min + i * bucketSize,
      max: min + (i + 1) * bucketSize,
      count: 0,
      total: 0,
    }));
    pnls.forEach((p) => {
      const idx = Math.min(Math.floor((p - min) / bucketSize), bucketCount - 1);
      buckets[idx].count++;
      buckets[idx].total += p;
    });
    return buckets.map((b) => ({
      name: `${b.min.toFixed(0)}`,
      count: b.count,
      avg: b.count > 0 ? b.total / b.count : 0,
    }));
  }, [filtered]); // eslint-disable-line react-hooks/exhaustive-deps

  const equityCurve = useMemo(() => {
    const byDate: Record<string, { tradePnl: number; count: number }> = {};
    filtered.forEach((tr) => {
      const date = tr.open_time ? tr.open_time.split("T")[0] : "";
      if (!byDate[date]) byDate[date] = { tradePnl: 0, count: 0 };
      byDate[date].tradePnl += netPnl(tr);
      byDate[date].count++;
    });
    let cum = 0;
    return Object.entries(byDate)
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([date, d]) => {
        cum += d.tradePnl;
        const cumRound = Number(cum.toFixed(2));
        return {
          date,
          tradePnl: Number(d.tradePnl.toFixed(2)),
          count: d.count,
          cumulative: cumRound,
          pos: cumRound >= 0 ? cumRound : 0,
          neg: cumRound < 0 ? cumRound : 0,
        };
      });
  }, [filtered]); // eslint-disable-line react-hooks/exhaustive-deps

  // ── Insight computations ──────────────────────────────────────────────────
  const worstDay = useMemo(
    () => [...byDayOfWeek].filter((d) => d.count > 0).sort((a, b) => a.pnl - b.pnl)[0] ?? null,
    [byDayOfWeek]
  );
  const bestHour = useMemo(
    () => [...byHour].filter((h) => h.count > 0).sort((a, b) => b.pnl - a.pnl)[0] ?? null,
    [byHour]
  );
  const riskyPairInfo = useMemo(() => {
    const qualified = byPair.filter((p) => p.count >= 5);
    if (qualified.length === 0) return { type: "insufficient" as const };
    const worst = [...qualified].sort((a, b) => a.winrate - b.winrate)[0];
    if (worst.winrate > 60) return { type: "good" as const };
    return { type: "risky" as const, pair: worst.name, winrate: worst.winrate, pnl: worst.pnl };
  }, [byPair]);

  // ── Discipline ────────────────────────────────────────────────────────────
  const normalizePair = (p: string) => p.replace(/[\/\s\-_.]/g, "").toUpperCase();

  const violatedPairs = useMemo(() => {
    const set = new Set<string>();
    reviews.forEach((r) => {
      if (r.analysis?.violations) {
        r.analysis.violations.forEach((v) => {
          if (!v.pair || !v.trade_date) return;
          const date = v.trade_date.includes("T") ? v.trade_date.split("T")[0] : v.trade_date;
          set.add(`${date}|${normalizePair(v.pair)}`);
        });
      }
    });
    return set;
  }, [reviews]);

  const hasAnalysis = reviews.length > 0;

  const disciplineStats = useMemo(() => {
    if (filtered.length === 0 || violatedPairs.size === 0) return null;
    const rulesFollowed = { pnl: 0, count: 0, wins: 0 };
    const rulesBroken   = { pnl: 0, count: 0, wins: 0 };
    filtered.forEach((tr) => {
      const date = tr.open_time ? tr.open_time.split("T")[0] : "";
      const key = `${date}|${normalizePair(tr.pair || "")}`;
      const net = netPnl(tr);
      const isWin = net > 0;
      if (violatedPairs.has(key)) {
        rulesBroken.pnl += net;
        rulesBroken.count++;
        if (isWin) rulesBroken.wins++;
      } else {
        rulesFollowed.pnl += net;
        rulesFollowed.count++;
        if (isWin) rulesFollowed.wins++;
      }
    });
    return { rulesFollowed, rulesBroken };
  }, [filtered, violatedPairs]); // eslint-disable-line react-hooks/exhaustive-deps


  // ── Tooltip style ─────────────────────────────────────────────────────────
  const tooltipStyle: React.CSSProperties = {
    backgroundColor: c.tooltipBg    || "rgb(var(--card))",
    border:          `1px solid ${c.tooltipBorder || "rgb(var(--border))"}`,
    borderRadius:    8,
    padding:         12,
    color:           c.tooltipText  || "rgb(var(--foreground))",
    fontSize:        13,
  };

  // ── Tooltip components ────────────────────────────────────────────────────
  const PairTooltip = ({ active, payload, label }: { active?: boolean; payload?: unknown[]; label?: string }) => {
    if (!active || !payload?.length) return null;
    const entry = byPair.find((p) => p.name === label);
    if (!entry) return null;
    return (
      <div style={tooltipStyle}>
        <p style={{ fontWeight: 600, marginBottom: 4 }}>{entry.name}</p>
        <p style={{ color: entry.pnl >= 0 ? c.profit : c.loss }}>
          {formatPnl(entry.pnl, pageCurrency)}
        </p>
        <p style={{ color: c.axis }}>{entry.count} trades · WR {entry.winrate}%</p>
      </div>
    );
  };

  const EquityTooltip = ({ active, payload, label }: { active?: boolean; payload?: unknown[]; label?: string }) => {
    if (!active || !payload?.length) return null;
    const point = equityCurve.find((d) => d.date === label);
    if (!point) return null;
    return (
      <div style={tooltipStyle}>
        <p style={{ fontWeight: 600, marginBottom: 4 }}>{label}</p>
        <p style={{ color: point.tradePnl >= 0 ? c.profit : c.loss }}>
          {money(point.tradePnl, pageCurrency, { digits: 2, signed: true })} ({point.count} trades)
        </p>
        <p style={{ color: point.cumulative >= 0 ? c.profit : c.loss }}>
          Cumulé : {money(point.cumulative, pageCurrency, { digits: 2, signed: true })}
        </p>
      </div>
    );
  };

  const HistogramTooltip = ({ active, payload, label }: { active?: boolean; payload?: Array<{ value: number }>; label?: string }) => {
    if (!active || !payload?.length) return null;
    return (
      <div style={tooltipStyle}>
        <p style={{ fontWeight: 600, marginBottom: 4 }}>{money(Number(label), pageCurrency)}</p>
        <p style={{ color: c.axis }}>{payload[0].value} trades</p>
      </div>
    );
  };

  const GenericTooltip = ({ active, payload, label }: { active?: boolean; payload?: Array<{ value: number }>; label?: string }) => {
    if (!active || !payload?.length) return null;
    return (
      <div style={tooltipStyle}>
        <p style={{ fontWeight: 600, marginBottom: 4 }}>{label}</p>
        <p style={{ color: payload[0].value >= 0 ? c.profit : c.loss }}>
          {money(Number(payload[0].value), pageCurrency, { digits: 2, signed: true })}
        </p>
      </div>
    );
  };

  // ── Loading ───────────────────────────────────────────────────────────────
  if (loading) {
    return (
      <div className="space-y-4">
        <div className="skeleton h-8 w-48 rounded-lg" />
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="skeleton h-[340px] rounded-xl" />
          ))}
        </div>
      </div>
    );
  }

  const latestScore = reviews.length > 0 ? reviews[0].discipline_score : undefined;

  // ── Pill style helper ─────────────────────────────────────────────────────
  const periodPillClass = (p: Period) =>
    cn(
      "px-3 py-1.5 rounded-md text-xs font-semibold transition-all duration-150 whitespace-nowrap",
      period === p
        ? "bg-accent/20 text-accent shadow-[0_0_10px_-3px_rgb(var(--accent)/0.5)]"
        : "text-foreground-muted hover:text-foreground"
    );

  const dirPillClass = (d: "all" | "long" | "short") =>
    cn(
      "px-3 py-1.5 rounded-md text-xs font-semibold transition-all duration-150",
      direction === d
        ? "bg-accent/20 text-accent shadow-[0_0_10px_-3px_rgb(var(--accent)/0.5)]"
        : "text-foreground-muted hover:text-foreground"
    );

  return (
    <div className="mx-auto max-w-[1440px]">
      {/* ── Header ────────────────────────────────────────────────────────── */}
      <div className="mb-4">
        <h1 className="text-2xl font-bold text-foreground">{t("analytics_title")}</h1>
        <p className="text-foreground-muted text-sm mt-1">{t("analytics_subtitle")}</p>
        {filtered.length > 0 && (() => {
          const dates = filtered.map((tr) => tr.open_time?.split("T")[0]).filter(Boolean).sort() as string[];
          const first = dates[0];
          const last  = dates[dates.length - 1];
          const diffDays = Math.round((new Date(last).getTime() - new Date(first).getTime()) / 86_400_000);
          const duration = diffDays > 60
            ? `${Math.round(diffDays / 30)} ${t("analytics_unit_months")}`
            : diffDays > 14
              ? `${Math.round(diffDays / 7)} ${t("analytics_unit_weeks")}`
              : `${diffDays} ${t("analytics_unit_days")}`;
          const fmt = (d: string) =>
            new Date(d).toLocaleDateString(dateLocale, { day: "2-digit", month: "2-digit", year: "2-digit" });
          return (
            <p className="text-xs text-foreground-muted mt-1">
              {t("analytics_daterange")
                .replace("{count}", String(filtered.length))
                .replace("{from}", fmt(first))
                .replace("{to}", fmt(last))
                .replace("{dur}", duration)}
            </p>
          );
        })()}
      </div>

      {/* ── Filter bar — sticky ───────────────────────────────────────────── */}
      <div className="sticky top-0 z-30 -mx-6 px-6 py-3 mb-6 flex flex-wrap gap-2 items-center border-b border-border bg-background/95 backdrop-blur-md">

        {/* Period pills */}
        <div className="flex items-center gap-0.5 bg-card/60 rounded-lg p-0.5 border border-border/50">
          {(["7d", "30d", "90d", "all"] as Period[]).map((p) => (
            <button key={p} onClick={() => setPeriod(p)} className={periodPillClass(p)}>
              {p === "7d" ? t("analytics_period_7d") : p === "30d" ? t("analytics_period_30d") : p === "90d" ? t("analytics_period_90d") : t("analytics_all")}
            </button>
          ))}
          <button onClick={() => setPeriod("custom")} className={periodPillClass("custom")}>
            Custom
          </button>
        </div>

        {/* Custom date range */}
        {period === "custom" && (
          <div className="flex items-center gap-1.5">
            <input
              type="date"
              value={customDateFrom}
              onChange={(e) => setCustomDateFrom(e.target.value)}
              className="px-3 py-1.5 bg-card border border-border rounded-lg text-foreground text-xs focus:outline-none focus:ring-1 focus:ring-accent focus:border-accent transition-colors"
            />
            <span className="text-foreground-muted text-xs">→</span>
            <input
              type="date"
              value={customDateTo}
              onChange={(e) => setCustomDateTo(e.target.value)}
              className="px-3 py-1.5 bg-card border border-border rounded-lg text-foreground text-xs focus:outline-none focus:ring-1 focus:ring-accent focus:border-accent transition-colors"
            />
          </div>
        )}

        {/* Account selector */}
        {accounts.length > 0 && (
          <select
            value={accountFilter}
            onChange={(e) => setAccountFilter(e.target.value)}
            className="px-3 py-1.5 bg-card border border-border rounded-lg text-foreground text-xs focus:outline-none focus:ring-1 focus:ring-accent focus:border-accent"
          >
            <option value="all">{t("analytics_all_accounts")}</option>
            {accounts.map((a) => (
              <option key={a.id} value={a.id}>
                {a.firm} · {a.account_number || money(a.account_size, accountCurrency(a))}
              </option>
            ))}
          </select>
        )}

        {/* Direction pills */}
        <div className="flex items-center gap-0.5 bg-card/60 rounded-lg p-0.5 border border-border/50">
          <button onClick={() => setDirection("all")}   className={dirPillClass("all")}>{t("analytics_all")}</button>
          <button onClick={() => setDirection("long")}  className={dirPillClass("long")}>Long</button>
          <button onClick={() => setDirection("short")} className={dirPillClass("short")}>Short</button>
        </div>

        <div className="flex-1" />

        {/* Advanced filters button */}
        <button
          onClick={() => {
            setStagingPairs(selectedPairs);
            setStagingPnlMin(pnlMin);
            setStagingPnlMax(pnlMax);
            setStagingWinLoss(winLossFilter);
            setShowAdvancedFilters(true);
          }}
          className={cn(
            "flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold border transition-all duration-150",
            hasAdvancedFilters
              ? "bg-accent/15 text-accent border-accent/30"
              : "bg-card border-border text-foreground-muted hover:text-foreground hover:border-border/80"
          )}
        >
          <Filter className="w-3.5 h-3.5" />
          {t("analytics_advanced_filters")}
          {hasAdvancedFilters && <span className="w-1.5 h-1.5 rounded-full bg-accent" />}
        </button>

        <ExportPdfButton trades={filtered} periodLabel={periodLabel} accountLabel={accountLabel} />
      </div>

      {/* ── Advanced Filters Panel ────────────────────────────────────────── */}
      <AnimatePresence>
      {showAdvancedFilters && (
        <>
          <motion.div
            key="adv-backdrop"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: reducedMotion ? 0 : 0.2, ease: "easeOut" }}
            className="fixed inset-0 z-40 bg-black/60 backdrop-blur-sm"
            onClick={() => setShowAdvancedFilters(false)}
          />
          <motion.aside
            key="adv-panel"
            initial={{ x: "100%" }}
            animate={{ x: 0 }}
            exit={{ x: "100%" }}
            transition={{ duration: reducedMotion ? 0 : 0.22, ease: "easeOut" }}
            className="fixed top-0 right-0 z-50 h-full w-80 bg-card border-l border-border shadow-2xl flex flex-col"
            role="dialog"
            aria-modal="true"
            aria-label={t("analytics_advanced_filters")}
          >
            <div className="flex items-center justify-between px-5 py-4 border-b border-border">
              <h3 className="text-sm font-bold text-foreground">{t("analytics_advanced_filters")}</h3>
              <button
                onClick={() => setShowAdvancedFilters(false)}
                className="p-1 rounded hover:bg-border/40 transition-colors"
              >
                <X className="w-4 h-4 text-foreground-muted" />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto p-5 space-y-6">
              {/* Paires */}
              {availablePairs.length > 0 && (
                <div>
                  <p className="text-[10px] font-semibold uppercase tracking-wider text-foreground-muted mb-2">{t("analytics_filter_pairs")}</p>
                  <div className="space-y-1.5 max-h-52 overflow-y-auto pr-1">
                    {availablePairs.map((pair) => (
                      <label key={pair} className="flex items-center gap-2 cursor-pointer group">
                        <input
                          type="checkbox"
                          checked={stagingPairs.includes(pair)}
                          onChange={(e) =>
                            setStagingPairs((prev) =>
                              e.target.checked ? [...prev, pair] : prev.filter((p) => p !== pair)
                            )
                          }
                          className="rounded border-border accent-accent"
                        />
                        <span className="text-sm text-foreground group-hover:text-foreground-muted transition-colors">{pair}</span>
                      </label>
                    ))}
                  </div>
                </div>
              )}

              {/* Min/Max P&L */}
              <div>
                <p className="text-[10px] font-semibold uppercase tracking-wider text-foreground-muted mb-2">P&L ({currencySymbol(pageCurrency).trim()})</p>
                <div className="flex items-center gap-2">
                  <input
                    type="number"
                    placeholder="Min"
                    value={stagingPnlMin}
                    onChange={(e) => setStagingPnlMin(e.target.value)}
                    className="flex-1 px-3 py-1.5 bg-surface border border-border rounded-lg text-sm text-foreground placeholder-foreground-muted/50 focus:outline-none focus:ring-1 focus:ring-accent"
                  />
                  <span className="text-foreground-muted text-xs shrink-0">→</span>
                  <input
                    type="number"
                    placeholder="Max"
                    value={stagingPnlMax}
                    onChange={(e) => setStagingPnlMax(e.target.value)}
                    className="flex-1 px-3 py-1.5 bg-surface border border-border rounded-lg text-sm text-foreground placeholder-foreground-muted/50 focus:outline-none focus:ring-1 focus:ring-accent"
                  />
                </div>
              </div>

              {/* Win/Loss filter */}
              <div>
                <p className="text-[10px] font-semibold uppercase tracking-wider text-foreground-muted mb-2">{t("analytics_filter_result")}</p>
                <div className="flex items-center gap-0.5 bg-surface rounded-lg p-0.5 border border-border/50">
                  {(["all", "win", "loss"] as const).map((wl) => (
                    <button
                      key={wl}
                      onClick={() => setStagingWinLoss(wl)}
                      className={cn(
                        "flex-1 py-1.5 rounded-md text-xs font-semibold transition-all duration-150",
                        stagingWinLoss === wl
                          ? "bg-accent/20 text-accent"
                          : "text-foreground-muted hover:text-foreground"
                      )}
                    >
                      {wl === "all" ? t("analytics_all") : wl === "win" ? "Win" : "Loss"}
                    </button>
                  ))}
                </div>
              </div>
            </div>

            <div className="p-5 border-t border-border flex gap-3">
              <button
                onClick={() => {
                  setStagingPairs([]);
                  setStagingPnlMin("");
                  setStagingPnlMax("");
                  setStagingWinLoss("all");
                  setSelectedPairs([]);
                  setPnlMin("");
                  setPnlMax("");
                  setWinLossFilter("all");
                }}
                className="flex-1 py-2 px-4 rounded-lg text-sm text-foreground-muted border border-border hover:bg-border/30 transition-colors"
              >
                {t("analytics_reset")}
              </button>
              <button
                onClick={() => {
                  setSelectedPairs(stagingPairs);
                  setPnlMin(stagingPnlMin);
                  setPnlMax(stagingPnlMax);
                  setWinLossFilter(stagingWinLoss);
                  setShowAdvancedFilters(false);
                }}
                className="flex-1 py-2 px-4 rounded-lg text-sm font-semibold bg-accent text-white hover:bg-accent-hover transition-colors"
              >
                {t("analytics_apply")}
              </button>
            </div>
          </motion.aside>
        </>
      )}
      </AnimatePresence>

      {/* ── Empty state ───────────────────────────────────────────────────── */}
      {filtered.length === 0 ? (
        <p className="text-foreground-muted py-10 text-center">{t("analytics_no_data")}</p>
      ) : (
        <StaggerContainer staggerDelay={0.08} className="space-y-4">

          {/* ── KPI cards ─────────────────────────────────────────────── */}
          <StaggerItem>
            <AnalyticsKpiCards
              totalPnl={totalPnl}
              winrate={winrate}
              wins={wins}
              tradesCount={filtered.length}
              best={best}
              worst={worst}
              bestTrade={bestTrade}
              worstTrade={worstTrade}
              profitFactor={profitFactor}
              disciplineScore={latestScore}
              prevKpis={prevKpis}
              avgWin={avgWin}
              avgLoss={avgLoss}
              currency={pageCurrency}
            />
          </StaggerItem>

          {/* ── Insight cards ─────────────────────────────────────────── */}
          <StaggerItem>
            <AnalyticsInsightCards
              worstDay={worstDay}
              bestHour={bestHour}
              riskyPairInfo={riskyPairInfo}
              byEmotion={byEmotion}
              currency={pageCurrency}
            />
          </StaggerItem>

          {/* ── Comparaison de périodes — est-ce que je progresse ? ───── */}
          <StaggerItem>
            <PeriodCompareBlock trades={trades} accountFilter={accountFilter} period={period} currency={pageCurrency} />
          </StaggerItem>

          {/* ── Performance par stratégie ─────────────────────────────── */}
          <StaggerItem>
            <StrategyCompareBlock trades={filtered} currency={pageCurrency} />
          </StaggerItem>

          {/* ── Equity Curve — full width ─────────────────────────────── */}
          {equityCurve.length > 1 && (
            <StaggerItem>
              <KpiCardPremium layout="full" accentColor="cyan" intensity="hero">
                <div className="mb-4">
                  <CardTitle>{t("analytics_equity_title")}</CardTitle>
                  <p className="text-xs text-foreground-muted mt-1">{t("analytics_equity_subtitle")}</p>
                </div>
                <ResponsiveContainer width="100%" height={300}>
                  <ComposedChart data={equityCurve} margin={{ top: 5, right: 10, left: 0, bottom: 5 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke={c.grid} vertical={false} strokeOpacity={0.5} />
                    <XAxis
                      dataKey="date"
                      tick={{ fill: c.axis, fontSize: 10 }}
                      tickLine={false}
                      axisLine={{ stroke: c.axisLine }}
                      interval={Math.floor(equityCurve.length / 8)}
                    />
                    <YAxis
                      tick={{ fill: c.axis, fontSize: 12 }}
                      tickLine={false}
                      axisLine={{ stroke: c.axisLine }}
                      tickFormatter={(v: unknown) => (typeof v === "number" ? money(v, pageCurrency) : String(v))}
                      width={80}
                    />
                    <ReferenceLine y={0} stroke={c.grid} strokeDasharray="4 4" />
                    <Tooltip content={<EquityTooltip />} />
                    <Area type="monotone" dataKey="pos" fill={c.profit || "rgb(var(--profit))"} fillOpacity={0.1} stroke="none" baseValue={0} />
                    <Area type="monotone" dataKey="neg" fill={c.loss || "rgb(var(--loss))"} fillOpacity={0.1} stroke="none" baseValue={0} />
                    <Line type="monotone" dataKey="cumulative" stroke={c.accent || "rgb(var(--accent))"} dot={false} strokeWidth={2} />
                  </ComposedChart>
                </ResponsiveContainer>
              </KpiCardPremium>
            </StaggerItem>
          )}

          {/* ── Drawdown / underwater ─────────────────────────────────── */}
          {equityCurve.length > 1 && (
            <StaggerItem>
              <DrawdownBlock data={equityCurve} currency={pageCurrency} />
            </StaggerItem>
          )}

          {/* ── Heatmap jour×heure + Insights automatiques ────────────── */}
          <StaggerItem>
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">

              {/* Heatmap — 2/3 width */}
              <KpiCardPremium layout="full" accentColor="violet" className="lg:col-span-2">
                <CardHeader>
                  <CardTitle>{t("analytics_patterns")}</CardTitle>
                </CardHeader>
                <HourDayHeatmap trades={filtered} currency={pageCurrency} />
              </KpiCardPremium>

              {/* Auto-insights — 1/3 width */}
              <KpiCardPremium layout="full" accentColor="cyan">
                <CardHeader>
                  <CardTitle>{t("analytics_what_we_notice")}</CardTitle>
                </CardHeader>
                <AutoInsights trades={filtered} />
              </KpiCardPremium>

            </div>
          </StaggerItem>

          {/* ── Résilience ────────────────────────────────────────────── */}
          <StaggerItem>
            <ResilienceBlock trades={filtered} currency={pageCurrency} />
          </StaggerItem>

          {/* ── Performance par paire — pleine largeur ─────────────────── */}
          {byPair.length > 0 && (
            <StaggerItem>
              <KpiCardPremium layout="full" accentColor="violet">
                <CardHeader>
                  <CardTitle>{t("analytics_by_pair")}</CardTitle>
                </CardHeader>
                {(() => {
                  const maxAbsPnL = Math.max(...byPair.map((p) => Math.abs(p.pnl)), 1);
                  const minDisplay = maxAbsPnL * 0.02;
                  const transformedByPair = byPair.map((p) => ({
                    ...p,
                    pnlReal: p.pnl,
                    pnlDisplay: Math.abs(p.pnl) < minDisplay
                      ? Math.sign(p.pnl || 1) * minDisplay
                      : p.pnl,
                  }));
                  return (
                <ResponsiveContainer width="100%" height={Math.max(220, byPair.length * 44)}>
                  <BarChart
                    layout="vertical"
                    data={transformedByPair}
                    margin={{ top: 5, right: 80, left: 0, bottom: 5 }}
                    barSize={28}
                  >
                    <CartesianGrid strokeDasharray="3 3" stroke={c.grid} horizontal={false} strokeOpacity={0.4} />
                    <XAxis
                      type="number"
                      tick={{ fill: c.axis, fontSize: 12 }}
                      tickLine={false}
                      axisLine={{ stroke: c.axisLine }}
                      tickFormatter={(v: unknown) => (typeof v === "number" ? money(v, pageCurrency) : String(v))}
                    />
                    <YAxis
                      type="category"
                      dataKey="name"
                      width={90}
                      tick={{ fill: c.axis, fontSize: 12 }}
                      tickLine={false}
                      axisLine={false}
                    />
                    <Tooltip content={<PairTooltip />} cursor={{ fill: "rgb(var(--foreground) / 0.04)" }} />
                    <Bar dataKey="pnlDisplay" activeBar={false} radius={[0, 3, 3, 0]}>
                      {transformedByPair.map((entry, index) => (
                        <Cell
                          key={`cell-${index}`}
                          fill={(entry.pnlReal ?? 0) >= 0 ? c.profit : c.loss}
                          fillOpacity={0.72}
                        />
                      ))}
                      <LabelList
                        dataKey="pnlReal"
                        position="right"
                        formatter={(v: unknown) => formatPnl(Number(v), pageCurrency)}
                        style={{ fill: c.axis || "rgb(var(--foreground-muted))", fontSize: 11 }}
                      />
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
                  );
                })()}
              </KpiCardPremium>
            </StaggerItem>
          )}

          {/* ── Autres charts (émotion, distribution, qualité) ─────────── */}
          <StaggerItem>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">

              {/* P&L Distribution Histogram */}
              {pnlDistribution.length > 0 && (
                <KpiCardPremium layout="full" accentColor="cyan">
                  <div className="mb-4">
                    <CardTitle>{t("analytics_distribution")}</CardTitle>
                    <p className="text-xs text-foreground-muted mt-1">{t("analytics_distribution_subtitle")}</p>
                  </div>
                  <ResponsiveContainer width="100%" height={280}>
                    <BarChart data={pnlDistribution} margin={{ top: 5, right: 10, left: 0, bottom: 5 }}>
                      <CartesianGrid strokeDasharray="3 3" stroke={c.grid} vertical={false} strokeOpacity={0.4} />
                      <XAxis dataKey="name" tick={{ fill: c.axis, fontSize: 12 }} tickLine={false} axisLine={{ stroke: c.axisLine }} />
                      <YAxis tick={{ fill: c.axis, fontSize: 12 }} tickLine={false} axisLine={{ stroke: c.axisLine }} />
                      <Tooltip content={<HistogramTooltip />} cursor={{ fill: "rgb(var(--foreground) / 0.04)" }} />
                      <Bar
                        dataKey="count"
                        shape={(props: unknown) => {
                          const { x, y, width, height, value, payload } = props as BarShapeProps;
                          return <RoundedBar x={x} y={y} width={width} height={height} value={value} fill={(payload?.avg ?? 0) >= 0 ? c.profit : c.loss} fillOpacity={0.72} />;
                        }}
                        activeBar={false}
                      />
                    </BarChart>
                  </ResponsiveContainer>
                </KpiCardPremium>
              )}

              {/* Performance by setup quality */}
              {byQuality.length > 0 && (
                <KpiCardPremium layout="full" accentColor="cyan">
                  <CardHeader>
                    <CardTitle>{t("analytics_by_quality")}</CardTitle>
                  </CardHeader>
                  <ResponsiveContainer width="100%" height={280}>
                    <BarChart data={byQuality} margin={{ top: 5, right: 10, left: 0, bottom: 5 }}>
                      <CartesianGrid strokeDasharray="3 3" stroke={c.grid} vertical={false} strokeOpacity={0.4} />
                      <XAxis dataKey="name" tick={{ fill: c.axis, fontSize: 12 }} tickLine={false} axisLine={{ stroke: c.axisLine }} />
                      <YAxis tick={{ fill: c.axis, fontSize: 12 }} tickLine={false} axisLine={{ stroke: c.axisLine }} tickFormatter={(v: unknown) => (typeof v === "number" ? money(v, pageCurrency) : String(v))} width={80} />
                      <Tooltip content={<GenericTooltip />} cursor={{ fill: "rgb(var(--foreground) / 0.04)" }} />
                      <Bar
                        dataKey="pnl"
                        shape={(props: unknown) => {
                          const { x, y, width, height, value } = props as BarShapeProps;
                          return <RoundedBar x={x} y={y} width={width} height={height} value={value} fill={(value ?? 0) >= 0 ? c.profit : c.loss} fillOpacity={0.72} />;
                        }}
                        activeBar={false}
                      />
                    </BarChart>
                  </ResponsiveContainer>
                </KpiCardPremium>
              )}

            </div>
          </StaggerItem>

          {/* ── Analytics par discipline ──────────────────────────────── */}
          <StaggerItem>
            <div className="mt-4">
              <DisciplineAnalyticsBlock
                trades={filtered}
                checklistItems={stratTags.checklist}
                currency={pageCurrency}
              />
            </div>
          </StaggerItem>

          {/* ── Discipline vs Results ─────────────────────────────────── */}
          {(disciplineStats || !hasAnalysis) && (
            <StaggerItem>
              <div className="mt-4">
                <h2 className="text-xl font-bold text-foreground mb-4">{t("discipline_title")}</h2>

                {!hasAnalysis && !disciplineStats && (
                  <Card variant="accent" padding="md" className="mb-4">
                    <div className="flex items-center gap-3">
                      <Search className="w-5 h-5 text-accent shrink-0" strokeWidth={1.75} />
                      <div className="flex-1">
                        <p className="text-sm text-foreground font-medium">{t("discipline_no_analysis")}</p>
                        <p className="text-xs text-foreground-muted mt-0.5">{t("discipline_no_analysis_desc")}</p>
                      </div>
                      <Link
                        href="/dashboard/analysis"
                        className="shrink-0 inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold bg-accent text-white hover:bg-accent-hover transition-colors"
                      >
                        {t("discipline_run_analysis")} →
                      </Link>
                    </div>
                  </Card>
                )}

                {disciplineStats && (
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 mb-4">

                    <KpiCardPremium layout="full" accentColor="green">
                      <div className="flex items-start gap-2.5">
                        <ShieldCheck className="w-5 h-5 text-profit mt-0.5 shrink-0" strokeWidth={1.75} />
                        <div>
                          <p className="text-sm text-foreground-muted mb-1">{t("discipline_followed")}</p>
                          <p className={cn("text-2xl font-bold", disciplineStats.rulesFollowed.pnl >= 0 ? "text-profit" : "text-loss")}>
                            {money(disciplineStats.rulesFollowed.pnl, pageCurrency, { digits: 2, signed: true })}
                          </p>
                          <p className="text-xs text-foreground-muted mt-1">
                            {disciplineStats.rulesFollowed.count} trades &mdash;{" "}
                            {disciplineStats.rulesFollowed.count > 0
                              ? ((disciplineStats.rulesFollowed.wins / disciplineStats.rulesFollowed.count) * 100).toFixed(0)
                              : 0}% WR
                          </p>
                        </div>
                      </div>
                    </KpiCardPremium>

                    <KpiCardPremium layout="full" accentColor="amber">
                      <div className="flex items-start gap-2.5">
                        <ShieldAlert className="w-5 h-5 text-warning mt-0.5 shrink-0" strokeWidth={1.75} />
                        <div>
                          <p className="text-sm text-foreground-muted mb-1">{t("discipline_broken")}</p>
                          <p className={cn("text-2xl font-bold", disciplineStats.rulesBroken.pnl >= 0 ? "text-profit" : "text-loss")}>
                            {money(disciplineStats.rulesBroken.pnl, pageCurrency, { digits: 2, signed: true })}
                          </p>
                          <p className="text-xs text-foreground-muted mt-1">
                            {disciplineStats.rulesBroken.count} trades &mdash;{" "}
                            {disciplineStats.rulesBroken.count > 0
                              ? ((disciplineStats.rulesBroken.wins / disciplineStats.rulesBroken.count) * 100).toFixed(0)
                              : 0}% WR
                          </p>
                        </div>
                      </div>
                    </KpiCardPremium>

                    {disciplineStats.rulesBroken.pnl < 0 && (
                      <KpiCardPremium layout="full" accentColor="loss">
                        <div className="flex items-start gap-2.5">
                          <ShieldAlert className="w-5 h-5 text-loss mt-0.5 shrink-0" strokeWidth={1.75} />
                          <div>
                            <p className="text-sm text-loss/80 mb-1">{t("discipline_cost")}</p>
                            <p className="text-3xl font-bold text-loss">
                              {money(Math.abs(disciplineStats.rulesBroken.pnl), pageCurrency, { digits: 2 })}
                            </p>
                            <p className="text-xs text-loss/70 mt-1">{t("discipline_cost_desc")}</p>
                          </div>
                        </div>
                      </KpiCardPremium>
                    )}

                  </div>
                )}

              </div>
            </StaggerItem>
          )}

          {/* ── Emotional Trend Chart ──────────────────────────────────── */}
          <StaggerItem>
            <KpiCardPremium layout="full" accentColor="cyan">
              <EmotionalTrendChart currency={pageCurrency} />
            </KpiCardPremium>
          </StaggerItem>

        </StaggerContainer>
      )}
    </div>
  );
}
