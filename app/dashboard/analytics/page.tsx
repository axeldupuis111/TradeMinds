"use client";

import ExportPdfButton from "@/components/analytics/ExportPdfButton";
import { useChartColors } from "@/lib/useChartColors";
import { useLanguage } from "@/lib/LanguageContext";
import { createClient } from "@/lib/supabase/client";
import { useEffect, useMemo, useState } from "react";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  CartesianGrid,
  Cell,
  LabelList,
  ComposedChart,
  Area,
  Line,
  ReferenceLine,
} from "recharts";

interface TradeRow {
  open_time: string;
  pnl: number;
  commission: number | null;
  swap: number | null;
  pair: string;
  direction: string;
  emotion: string | null;
  setup_quality: number | null;
  challenge_id: string | null;
}

interface ViolationTrade {
  trade_date: string;
  pair: string;
}

interface SessionReview {
  created_at: string;
  analysis: {
    violations: ViolationTrade[];
  };
}

interface Account {
  id: string;
  firm: string;
  account_number: string | null;
  account_size: number;
}

const PROFIT_COLOR = "#22c55e";
const LOSS_COLOR = "#ef4444";

const TOOLTIP_STYLE: React.CSSProperties = {
  background: "#1a1a1a",
  border: "1px solid #333",
  borderRadius: 8,
  padding: 12,
  color: "#e5e5e5",
  fontSize: 13,
};

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

type Period = "today" | "week" | "month" | "30d" | "90d" | "all";

export default function AnalyticsPage() {
  const { t } = useLanguage();
  const c = useChartColors();
  const supabase = createClient();
  const [trades, setTrades] = useState<TradeRow[]>([]);
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [reviews, setReviews] = useState<SessionReview[]>([]);
  const [loading, setLoading] = useState(true);
  const [period, setPeriod] = useState<Period>("all");
  const [accountFilter, setAccountFilter] = useState<string>("all");

  useEffect(() => {
    async function load() {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const [{ data: tradeData }, { data: accountData }, { data: reviewData }] = await Promise.all([
        supabase
          .from("trades")
          .select("open_time, pnl, commission, swap, pair, direction, emotion, setup_quality, challenge_id")
          .eq("user_id", user.id)
          .order("open_time", { ascending: true }),
        supabase
          .from("prop_challenges")
          .select("id, firm, account_number, account_size")
          .eq("user_id", user.id)
          .eq("status", "active"),
        supabase
          .from("session_reviews")
          .select("created_at, analysis")
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

  const filtered = useMemo(() => {
    let result = trades;

    if (accountFilter !== "all") {
      result = result.filter((tr) => tr.challenge_id === accountFilter);
    }

    if (period !== "all") {
      const now = new Date();
      let cutoff: Date;
      if (period === "today") {
        cutoff = new Date(now.getFullYear(), now.getMonth(), now.getDate());
      } else if (period === "week") {
        const day = now.getDay();
        const diff = now.getDate() - day + (day === 0 ? -6 : 1);
        cutoff = new Date(now.getFullYear(), now.getMonth(), diff);
      } else if (period === "month") {
        cutoff = new Date(now.getFullYear(), now.getMonth(), 1);
      } else {
        const days = period === "30d" ? 30 : 90;
        cutoff = new Date();
        cutoff.setDate(cutoff.getDate() - days);
      }
      result = result.filter((tr) => tr.open_time && new Date(tr.open_time) >= cutoff);
    }

    return result;
  }, [trades, period, accountFilter]);

  // KPI aggregates
  const { totalPnl, wins, winrate, best, worst } = useMemo(() => {
    const pnls = filtered.map(netPnl);
    const w = filtered.filter((tr) => netPnl(tr) > 0).length;
    return {
      totalPnl: pnls.reduce((s, v) => s + v, 0),
      wins: w,
      winrate: filtered.length > 0 ? (w / filtered.length) * 100 : 0,
      best: pnls.length > 0 ? Math.max(...pnls) : 0,
      worst: pnls.length > 0 ? Math.min(...pnls) : 0,
    };
  }, [filtered]); // eslint-disable-line react-hooks/exhaustive-deps

  // Profit factor
  const profitFactor = useMemo(() => {
    const gains = filtered.filter((tr) => netPnl(tr) > 0).reduce((s, tr) => s + netPnl(tr), 0);
    const losses = filtered.filter((tr) => netPnl(tr) < 0).reduce((s, tr) => s + Math.abs(netPnl(tr)), 0);
    if (filtered.length === 0) return null;
    if (losses === 0) return gains > 0 ? Infinity : null;
    return gains / losses;
  }, [filtered]); // eslint-disable-line react-hooks/exhaustive-deps

  // Performance by day of week — all 7 days with winrate
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

  // Performance by hour — all 24 hours
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

  // Performance by pair — with winrate
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

  // Performance by emotion
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

  // Performance by setup quality
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

  // P&L distribution histogram
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

  // Equity curve — daily aggregated cumulative P&L
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

  // Performance by trading session (hour-based)
  const bySessions = useMemo(() => {
    const sessions = {
      asia: { label: t("analytics_session_asia"), total: 0, count: 0, wins: 0, best: -Infinity, worst: Infinity },
      london: { label: t("analytics_session_london"), total: 0, count: 0, wins: 0, best: -Infinity, worst: Infinity },
      ny: { label: t("analytics_session_ny"), total: 0, count: 0, wins: 0, best: -Infinity, worst: Infinity },
      eod: { label: t("analytics_session_eod"), total: 0, count: 0, wins: 0, best: -Infinity, worst: Infinity },
    };
    filtered.forEach((tr) => {
      if (!tr.open_time) return;
      const hour = new Date(tr.open_time).getHours();
      const net = netPnl(tr);
      const key: keyof typeof sessions = hour < 8 ? "asia" : hour < 13 ? "london" : hour < 17 ? "ny" : "eod";
      sessions[key].total += net;
      sessions[key].count++;
      if (net > 0) sessions[key].wins++;
      if (net > sessions[key].best) sessions[key].best = net;
      if (net < sessions[key].worst) sessions[key].worst = net;
    });
    return (["asia", "london", "ny", "eod"] as const).map((key) => {
      const s = sessions[key];
      return {
        name: s.label,
        pnl: Number(s.total.toFixed(2)),
        count: s.count,
        winrate: s.count > 0 ? Math.round((s.wins / s.count) * 100) : 0,
        best: s.count > 0 ? Number(s.best.toFixed(2)) : 0,
        worst: s.count > 0 ? Number(s.worst.toFixed(2)) : 0,
      };
    });
  }, [filtered, t]); // eslint-disable-line react-hooks/exhaustive-deps

  // Insight: worst day, best hour, risky pair
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

  // Discipline vs Results
  const violatedPairs = useMemo(() => {
    const set = new Set<string>();
    reviews.forEach((r) => {
      if (r.analysis?.violations) {
        r.analysis.violations.forEach((v) => set.add(`${v.trade_date}|${v.pair}`));
      }
    });
    return set;
  }, [reviews]);

  const disciplineStats = useMemo(() => {
    if (filtered.length === 0 || violatedPairs.size === 0) return null;
    const rulesFollowed = { pnl: 0, count: 0, wins: 0 };
    const rulesBroken = { pnl: 0, count: 0, wins: 0 };
    filtered.forEach((tr) => {
      const date = tr.open_time ? tr.open_time.split("T")[0] : "";
      const key = `${date}|${tr.pair}`;
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

  const winrateByEmotion = useMemo(() => {
    const map: Record<string, { wins: number; total: number }> = {};
    filtered.forEach((tr) => {
      if (!tr.emotion) return;
      if (!map[tr.emotion]) map[tr.emotion] = { wins: 0, total: 0 };
      map[tr.emotion].total++;
      if (netPnl(tr) > 0) map[tr.emotion].wins++;
    });
    return Object.entries(map)
      .map(([em, d]) => ({
        name: `${EMOTION_EMOJIS[em] || ""} ${t(EMOTION_KEYS[em] || em)}`,
        winrate: d.total > 0 ? Number(((d.wins / d.total) * 100).toFixed(1)) : 0,
        count: d.total,
      }))
      .sort((a, b) => b.winrate - a.winrate);
  }, [filtered, t]); // eslint-disable-line react-hooks/exhaustive-deps

  // ─── Tooltip components ────────────────────────────────────────────────────

  const DayTooltip = ({ active, payload, label }: { active?: boolean; payload?: unknown[]; label?: string }) => {
    if (!active || !payload?.length) return null;
    const entry = byDayOfWeek.find((d) => d.name === label);
    if (!entry) return null;
    return (
      <div style={TOOLTIP_STYLE}>
        <p style={{ fontWeight: 600, marginBottom: 4 }}>{label}</p>
        {entry.count === 0 ? (
          <p style={{ color: "#888" }}>0 trades</p>
        ) : (
          <>
            <p style={{ color: entry.pnl >= 0 ? PROFIT_COLOR : LOSS_COLOR }}>
              {entry.pnl >= 0 ? "+" : ""}{entry.pnl.toFixed(2)}€
            </p>
            <p style={{ color: "#aaa" }}>{entry.count} trades · WR {entry.winrate}%</p>
          </>
        )}
      </div>
    );
  };

  const HourTooltip = ({ active, payload, label }: { active?: boolean; payload?: unknown[]; label?: string }) => {
    if (!active || !payload?.length) return null;
    const entry = byHour.find((h) => h.name === label);
    if (!entry) return null;
    return (
      <div style={TOOLTIP_STYLE}>
        <p style={{ fontWeight: 600, marginBottom: 4 }}>{label}</p>
        {entry.count === 0 ? (
          <p style={{ color: "#888" }}>0 trades</p>
        ) : (
          <>
            <p style={{ color: entry.pnl >= 0 ? PROFIT_COLOR : LOSS_COLOR }}>
              {entry.pnl >= 0 ? "+" : ""}{entry.pnl.toFixed(2)}€
            </p>
            <p style={{ color: "#aaa" }}>{entry.count} trades</p>
          </>
        )}
      </div>
    );
  };

  const PairTooltip = ({ active, payload, label }: { active?: boolean; payload?: unknown[]; label?: string }) => {
    if (!active || !payload?.length) return null;
    const entry = byPair.find((p) => p.name === label);
    if (!entry) return null;
    return (
      <div style={TOOLTIP_STYLE}>
        <p style={{ fontWeight: 600, marginBottom: 4 }}>{label}</p>
        <p style={{ color: entry.pnl >= 0 ? PROFIT_COLOR : LOSS_COLOR }}>
          {entry.pnl >= 0 ? "+" : ""}{entry.pnl.toFixed(2)}€
        </p>
        <p style={{ color: "#aaa" }}>{entry.count} trades · WR {entry.winrate}%</p>
      </div>
    );
  };

  const EquityTooltip = ({ active, payload, label }: { active?: boolean; payload?: unknown[]; label?: string }) => {
    if (!active || !payload?.length) return null;
    const point = equityCurve.find((d) => d.date === label);
    if (!point) return null;
    return (
      <div style={TOOLTIP_STYLE}>
        <p style={{ fontWeight: 600, marginBottom: 4 }}>{label}</p>
        <p style={{ color: point.tradePnl >= 0 ? PROFIT_COLOR : LOSS_COLOR }}>
          {point.tradePnl >= 0 ? "+" : ""}{point.tradePnl.toFixed(2)}€ ({point.count} trades)
        </p>
        <p style={{ color: point.cumulative >= 0 ? PROFIT_COLOR : LOSS_COLOR }}>
          Cumulé : {point.cumulative >= 0 ? "+" : ""}{point.cumulative.toFixed(2)}€
        </p>
      </div>
    );
  };

  const SessionTooltip = ({ active, payload, label }: { active?: boolean; payload?: unknown[]; label?: string }) => {
    if (!active || !payload?.length) return null;
    const entry = bySessions.find((s) => s.name === label);
    if (!entry) return null;
    return (
      <div style={TOOLTIP_STYLE}>
        <p style={{ fontWeight: 600, marginBottom: 4 }}>{label}</p>
        {entry.count === 0 ? (
          <p style={{ color: "#888" }}>0 trades</p>
        ) : (
          <>
            <p style={{ color: entry.pnl >= 0 ? PROFIT_COLOR : LOSS_COLOR }}>
              {entry.pnl >= 0 ? "+" : ""}{entry.pnl.toFixed(2)}€
            </p>
            <p style={{ color: "#aaa" }}>{entry.count} trades · WR {entry.winrate}%</p>
            <p style={{ color: PROFIT_COLOR }}>Best: +{entry.best.toFixed(2)}€</p>
            <p style={{ color: LOSS_COLOR }}>Worst: {entry.worst.toFixed(2)}€</p>
          </>
        )}
      </div>
    );
  };

  const HistogramTooltip = ({ active, payload, label }: { active?: boolean; payload?: Array<{ value: number }>; label?: string }) => {
    if (!active || !payload?.length) return null;
    return (
      <div style={TOOLTIP_STYLE}>
        <p style={{ fontWeight: 600, marginBottom: 4 }}>{label}€</p>
        <p style={{ color: "#aaa" }}>{payload[0].value} trades</p>
      </div>
    );
  };

  const GenericTooltip = ({ active, payload, label }: { active?: boolean; payload?: Array<{ value: number }>; label?: string }) => {
    if (!active || !payload?.length) return null;
    return (
      <div style={TOOLTIP_STYLE}>
        <p style={{ fontWeight: 600, marginBottom: 4 }}>{label}</p>
        <p style={{ color: payload[0].value >= 0 ? PROFIT_COLOR : LOSS_COLOR }}>
          {payload[0].value >= 0 ? "+" : ""}{payload[0].value.toFixed(2)}€
        </p>
      </div>
    );
  };

  const WinrateTooltip = ({ active, payload, label }: { active?: boolean; payload?: Array<{ value: number }>; label?: string }) => {
    if (!active || !payload?.length) return null;
    return (
      <div style={TOOLTIP_STYLE}>
        <p style={{ fontWeight: 600, marginBottom: 4 }}>{label}</p>
        <p style={{ color: "#3b82f6" }}>{payload[0].value}% WR</p>
      </div>
    );
  };

  const selectClass = "px-3 py-2 bg-surface border border-border rounded-lg text-foreground text-sm focus:outline-none focus:ring-1 focus:ring-accent focus:border-accent";

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

  return (
    <div>
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mb-6">
        <div>
          <h1 className="text-2xl font-bold text-foreground">{t("analytics_title")}</h1>
          <p className="text-muted text-sm mt-1">{t("analytics_subtitle")}</p>
        </div>
        <div className="flex gap-2 flex-wrap">
          <select value={period} onChange={(e) => setPeriod(e.target.value as Period)} className={selectClass}>
            <option value="today">{t("analytics_period_today")}</option>
            <option value="week">{t("analytics_period_week")}</option>
            <option value="month">{t("analytics_period_month")}</option>
            <option value="30d">{t("analytics_period_last30")}</option>
            <option value="90d">{t("analytics_period_last90")}</option>
            <option value="all">{t("analytics_all")}</option>
          </select>
          {accounts.length > 0 && (
            <select value={accountFilter} onChange={(e) => setAccountFilter(e.target.value)} className={selectClass}>
              <option value="all">{t("analytics_all_accounts")}</option>
              {accounts.map((a) => (
                <option key={a.id} value={a.id}>
                  {a.firm} — {a.account_number || `${a.account_size.toLocaleString()}€`}
                </option>
              ))}
            </select>
          )}
          <ExportPdfButton />
        </div>
      </div>

      {filtered.length === 0 ? (
        <p className="text-muted py-10 text-center">{t("analytics_no_data")}</p>
      ) : (
        <>
          {/* KPI Summary row */}
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3 mb-6">
            {[
              { label: t("analytics_kpi_pnl"), value: `${totalPnl >= 0 ? "+" : ""}${totalPnl.toFixed(2)}€`, color: totalPnl >= 0 ? "text-profit" : "text-loss" },
              { label: t("analytics_kpi_winrate"), value: `${winrate.toFixed(1)}%`, color: winrate >= 50 ? "text-profit" : "text-loss" },
              { label: t("analytics_kpi_trades"), value: String(filtered.length), color: "text-foreground" },
              { label: t("analytics_kpi_best"), value: `+${best.toFixed(2)}€`, color: "text-profit" },
              { label: t("analytics_kpi_worst"), value: `${worst.toFixed(2)}€`, color: "text-loss" },
            ].map((kpi, i) => (
              <div key={i} className="bg-card border border-border rounded-xl p-4 card-shadow">
                <p className="text-xs text-muted mb-1">{kpi.label}</p>
                <p className={`text-xl font-bold tabular-nums ${kpi.color}`}>{kpi.value}</p>
              </div>
            ))}
            {/* Summary card — Synthèse */}
            <div className="bg-card border border-border rounded-xl p-4 card-shadow">
              <p className="text-xs text-muted mb-1">{t("analytics_kpi_title")}</p>
              <p className={`text-base font-bold ${totalPnl >= 0 ? "text-profit" : "text-loss"}`}>
                {totalPnl >= 0 ? t("analytics_kpi_profitable") : t("analytics_kpi_in_loss")}
              </p>
              {profitFactor !== null && (
                <p className="text-xs text-muted mt-1">
                  PF : {isFinite(profitFactor) ? profitFactor.toFixed(2) : "∞"}
                </p>
              )}
            </div>
          </div>

          {/* Insight cards */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-6">
            {worstDay && (
              <div className="bg-loss/5 border border-loss/20 rounded-xl p-4">
                <p className="text-xs text-loss/70 mb-1">{t("analytics_insight_worst_day")}</p>
                <p className="text-sm font-semibold text-foreground">{worstDay.name} ({worstDay.count} trades)</p>
                <p className="text-xs text-loss tabular-nums">{worstDay.pnl.toFixed(2)}€ · WR {worstDay.winrate}%</p>
              </div>
            )}
            {bestHour && (
              <div className="bg-profit/5 border border-profit/20 rounded-xl p-4">
                <p className="text-xs text-profit/70 mb-1">{t("analytics_insight_best_hour")}</p>
                <p className="text-sm font-semibold text-foreground">{bestHour.name} ({bestHour.count} trades)</p>
                <p className="text-xs text-profit tabular-nums">+{bestHour.pnl.toFixed(2)}€ · WR {bestHour.winrate}%</p>
              </div>
            )}
            {riskyPairInfo.type !== "insufficient" && (
              <div className={`${riskyPairInfo.type === "good" ? "bg-profit/5 border-profit/20" : "bg-warning/5 border-warning/20"} border rounded-xl p-4`}>
                <p className="text-xs text-warning/70 mb-1">{t("analytics_insight_risk_pair")}</p>
                {riskyPairInfo.type === "good" ? (
                  <p className="text-sm font-semibold text-profit">{t("analytics_no_risk_pair")}</p>
                ) : (
                  <>
                    <p className="text-sm font-semibold text-foreground">{riskyPairInfo.pair} · WR {riskyPairInfo.winrate}%</p>
                    <p className="text-xs text-loss tabular-nums">{riskyPairInfo.pnl.toFixed(2)}€</p>
                  </>
                )}
              </div>
            )}
            {byEmotion.length > 0 && (
              <div className="bg-accent/5 border border-accent/20 rounded-xl p-4">
                <p className="text-xs text-accent/70 mb-1">{t("analytics_insight_emotion")}</p>
                {(() => {
                  const riskyEmotion = [...byEmotion].sort((a, b) => a.pnl - b.pnl)[0];
                  return (
                    <>
                      <p className="text-sm font-semibold text-foreground">{riskyEmotion.name}</p>
                      <p className="text-xs text-loss tabular-nums">{riskyEmotion.pnl.toFixed(2)}€</p>
                    </>
                  );
                })()}
              </div>
            )}
          </div>

          {/* Equity Curve — full width */}
          {equityCurve.length > 1 && (
            <div className="bg-card border border-border rounded-xl p-5 mb-4">
              <h3 className="text-foreground font-semibold">{t("analytics_equity_title")}</h3>
              <p className="text-xs text-muted mb-4">{t("analytics_equity_subtitle")}</p>
              <ResponsiveContainer width="100%" height={300}>
                <ComposedChart data={equityCurve} margin={{ top: 5, right: 10, left: 0, bottom: 5 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke={c.grid} />
                  <XAxis dataKey="date" tick={{ fill: c.axis, fontSize: 10 }} axisLine={{ stroke: c.axisLine }} interval={Math.floor(equityCurve.length / 8)} />
                  <YAxis tick={{ fill: c.axis, fontSize: 12 }} axisLine={{ stroke: c.axisLine }} />
                  <ReferenceLine y={0} stroke="#333" strokeDasharray="4 4" />
                  <Tooltip content={<EquityTooltip />} />
                  <Area type="monotone" dataKey="pos" fill="rgba(34,197,94,0.1)" stroke="none" baseValue={0} />
                  <Area type="monotone" dataKey="neg" fill="rgba(239,68,68,0.1)" stroke="none" baseValue={0} />
                  <Line type="monotone" dataKey="cumulative" stroke="#3b82f6" dot={false} strokeWidth={2} />
                </ComposedChart>
              </ResponsiveContainer>
            </div>
          )}

          {/* Charts grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Performance by day — all 7 days, greyed when no trades */}
            <div className="bg-card border border-border rounded-xl p-5">
              <h3 className="text-foreground font-semibold mb-4">{t("analytics_by_day")}</h3>
              <ResponsiveContainer width="100%" height={280}>
                <BarChart data={byDayOfWeek} margin={{ top: 5, right: 10, left: 0, bottom: 5 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke={c.grid} />
                  <XAxis dataKey="name" tick={{ fill: c.axis, fontSize: 12 }} axisLine={{ stroke: c.axisLine }} />
                  <YAxis tick={{ fill: c.axis, fontSize: 12 }} axisLine={{ stroke: c.axisLine }} />
                  <Tooltip content={<DayTooltip />} />
                  <Bar dataKey="pnl" radius={[4, 4, 0, 0]}>
                    {byDayOfWeek.map((entry, idx) => (
                      <Cell
                        key={idx}
                        fill={entry.count === 0 ? "#555" : entry.pnl >= 0 ? PROFIT_COLOR : LOSS_COLOR}
                        opacity={entry.count === 0 ? 0.3 : 1}
                      />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>

            {/* Performance by hour — all 24 hours */}
            <div className="bg-card border border-border rounded-xl p-5">
              <h3 className="text-foreground font-semibold mb-4">{t("analytics_by_hour")}</h3>
              <ResponsiveContainer width="100%" height={280}>
                <BarChart data={byHour} margin={{ top: 5, right: 10, left: 0, bottom: 5 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke={c.grid} />
                  <XAxis dataKey="name" tick={{ fill: c.axis, fontSize: 10 }} axisLine={{ stroke: c.axisLine }} interval={1} />
                  <YAxis tick={{ fill: c.axis, fontSize: 12 }} axisLine={{ stroke: c.axisLine }} />
                  <Tooltip content={<HourTooltip />} />
                  <Bar dataKey="pnl" radius={[4, 4, 0, 0]}>
                    {byHour.map((entry, idx) => (
                      <Cell
                        key={idx}
                        fill={entry.count === 0 ? "#555" : entry.pnl >= 0 ? PROFIT_COLOR : LOSS_COLOR}
                        opacity={entry.count === 0 ? 0.3 : 1}
                      />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>

            {/* Performance by pair — with value labels */}
            {byPair.length > 0 && (
              <div className="bg-card border border-border rounded-xl p-5">
                <h3 className="text-foreground font-semibold mb-4">{t("analytics_by_pair")}</h3>
                <ResponsiveContainer width="100%" height={280}>
                  <BarChart data={byPair} margin={{ top: 20, right: 10, left: 0, bottom: 5 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke={c.grid} />
                    <XAxis dataKey="name" tick={{ fill: c.axis, fontSize: 12 }} axisLine={{ stroke: c.axisLine }} />
                    <YAxis tick={{ fill: c.axis, fontSize: 12 }} axisLine={{ stroke: c.axisLine }} />
                    <Tooltip content={<PairTooltip />} />
                    <Bar dataKey="pnl" radius={[4, 4, 0, 0]}>
                      {byPair.map((entry, idx) => (
                        <Cell key={idx} fill={entry.pnl >= 0 ? PROFIT_COLOR : LOSS_COLOR} />
                      ))}
                      <LabelList
                        dataKey="pnl"
                        position="top"
                        formatter={(v: unknown) => {
                          const n = Number(v);
                          return `${n >= 0 ? "+" : ""}${n.toFixed(0)}€`;
                        }}
                        style={{ fill: "#aaa", fontSize: 10 }}
                      />
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </div>
            )}

            {/* Performance by session */}
            <div className="bg-card border border-border rounded-xl p-5">
              <h3 className="text-foreground font-semibold mb-4">{t("analytics_by_session")}</h3>
              <ResponsiveContainer width="100%" height={280}>
                <BarChart data={bySessions} margin={{ top: 5, right: 10, left: 0, bottom: 5 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke={c.grid} />
                  <XAxis dataKey="name" tick={{ fill: c.axis, fontSize: 12 }} axisLine={{ stroke: c.axisLine }} />
                  <YAxis tick={{ fill: c.axis, fontSize: 12 }} axisLine={{ stroke: c.axisLine }} />
                  <Tooltip content={<SessionTooltip />} />
                  <Bar dataKey="pnl" radius={[4, 4, 0, 0]}>
                    {bySessions.map((entry, idx) => (
                      <Cell
                        key={idx}
                        fill={entry.count === 0 ? "#555" : entry.pnl >= 0 ? PROFIT_COLOR : LOSS_COLOR}
                        opacity={entry.count === 0 ? 0.3 : 1}
                      />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>

            {/* Performance by emotion */}
            {byEmotion.length > 0 && (
              <div className="bg-card border border-border rounded-xl p-5">
                <h3 className="text-foreground font-semibold mb-4">{t("analytics_by_emotion")}</h3>
                <ResponsiveContainer width="100%" height={280}>
                  <BarChart data={byEmotion} margin={{ top: 5, right: 10, left: 0, bottom: 5 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke={c.grid} />
                    <XAxis dataKey="name" tick={{ fill: c.axis, fontSize: 12 }} axisLine={{ stroke: c.axisLine }} />
                    <YAxis tick={{ fill: c.axis, fontSize: 12 }} axisLine={{ stroke: c.axisLine }} />
                    <Tooltip content={<GenericTooltip />} />
                    <Bar dataKey="pnl" radius={[4, 4, 0, 0]}>
                      {byEmotion.map((entry, idx) => (
                        <Cell key={idx} fill={entry.pnl >= 0 ? PROFIT_COLOR : LOSS_COLOR} />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </div>
            )}

            {/* P&L Distribution Histogram */}
            {pnlDistribution.length > 0 && (
              <div className="bg-card border border-border rounded-xl p-5">
                <h3 className="text-foreground font-semibold">{t("analytics_distribution")}</h3>
                <p className="text-xs text-muted mb-4">{t("analytics_distribution_subtitle")}</p>
                <ResponsiveContainer width="100%" height={280}>
                  <BarChart data={pnlDistribution} margin={{ top: 5, right: 10, left: 0, bottom: 5 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke={c.grid} />
                    <XAxis dataKey="name" tick={{ fill: c.axis, fontSize: 12 }} axisLine={{ stroke: c.axisLine }} />
                    <YAxis tick={{ fill: c.axis, fontSize: 12 }} axisLine={{ stroke: c.axisLine }} />
                    <Tooltip content={<HistogramTooltip />} />
                    <Bar dataKey="count" radius={[4, 4, 0, 0]}>
                      {pnlDistribution.map((entry, idx) => (
                        <Cell key={idx} fill={entry.avg >= 0 ? PROFIT_COLOR : LOSS_COLOR} />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </div>
            )}

            {/* Performance by setup quality */}
            {byQuality.length > 0 && (
              <div className="bg-card border border-border rounded-xl p-5">
                <h3 className="text-foreground font-semibold mb-4">{t("analytics_by_quality")}</h3>
                <ResponsiveContainer width="100%" height={280}>
                  <BarChart data={byQuality} margin={{ top: 5, right: 10, left: 0, bottom: 5 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke={c.grid} />
                    <XAxis dataKey="name" tick={{ fill: c.axis, fontSize: 12 }} axisLine={{ stroke: c.axisLine }} />
                    <YAxis tick={{ fill: c.axis, fontSize: 12 }} axisLine={{ stroke: c.axisLine }} />
                    <Tooltip content={<GenericTooltip />} />
                    <Bar dataKey="pnl" radius={[4, 4, 0, 0]}>
                      {byQuality.map((entry, idx) => (
                        <Cell key={idx} fill={entry.pnl >= 0 ? PROFIT_COLOR : LOSS_COLOR} />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </div>
            )}
          </div>

          {/* Discipline vs Results section */}
          {(disciplineStats || winrateByEmotion.length > 0) && (
            <div className="mt-8">
              <h2 className="text-xl font-bold text-foreground mb-4">{t("discipline_title")}</h2>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {disciplineStats && (
                  <>
                    <div className="bg-card border border-border rounded-xl p-5">
                      <p className="text-sm text-muted mb-1">{t("discipline_followed")}</p>
                      <p className={`text-2xl font-bold ${disciplineStats.rulesFollowed.pnl >= 0 ? "text-profit" : "text-loss"}`}>
                        {disciplineStats.rulesFollowed.pnl >= 0 ? "+" : ""}{disciplineStats.rulesFollowed.pnl.toFixed(2)} &euro;
                      </p>
                      <p className="text-xs text-muted mt-1">
                        {disciplineStats.rulesFollowed.count} trades &mdash; {disciplineStats.rulesFollowed.count > 0 ? ((disciplineStats.rulesFollowed.wins / disciplineStats.rulesFollowed.count) * 100).toFixed(0) : 0}% WR
                      </p>
                    </div>
                    <div className="bg-card border border-border rounded-xl p-5">
                      <p className="text-sm text-muted mb-1">{t("discipline_broken")}</p>
                      <p className={`text-2xl font-bold ${disciplineStats.rulesBroken.pnl >= 0 ? "text-profit" : "text-loss"}`}>
                        {disciplineStats.rulesBroken.pnl >= 0 ? "+" : ""}{disciplineStats.rulesBroken.pnl.toFixed(2)} &euro;
                      </p>
                      <p className="text-xs text-muted mt-1">
                        {disciplineStats.rulesBroken.count} trades &mdash; {disciplineStats.rulesBroken.count > 0 ? ((disciplineStats.rulesBroken.wins / disciplineStats.rulesBroken.count) * 100).toFixed(0) : 0}% WR
                      </p>
                    </div>
                    {disciplineStats.rulesBroken.pnl < 0 && (
                      <div className="bg-loss/10 border border-loss/30 rounded-xl p-5">
                        <p className="text-sm text-loss/70 mb-1">{t("discipline_cost")}</p>
                        <p className="text-3xl font-bold text-loss">
                          {Math.abs(disciplineStats.rulesBroken.pnl).toFixed(2)} &euro;
                        </p>
                        <p className="text-xs text-loss/70 mt-1">{t("discipline_cost_desc")}</p>
                      </div>
                    )}
                  </>
                )}
              </div>

              {winrateByEmotion.length > 0 && (
                <div className="bg-card border border-border rounded-xl p-5 mt-4">
                  <h3 className="text-foreground font-semibold mb-4">{t("discipline_winrate_emotion")}</h3>
                  <ResponsiveContainer width="100%" height={280}>
                    <BarChart data={winrateByEmotion} margin={{ top: 5, right: 10, left: 0, bottom: 5 }}>
                      <CartesianGrid strokeDasharray="3 3" stroke={c.grid} />
                      <XAxis dataKey="name" tick={{ fill: c.axis, fontSize: 12 }} axisLine={{ stroke: c.axisLine }} />
                      <YAxis tick={{ fill: c.axis, fontSize: 12 }} axisLine={{ stroke: c.axisLine }} domain={[0, 100]} />
                      <Tooltip content={<WinrateTooltip />} />
                      <Bar dataKey="winrate" radius={[4, 4, 0, 0]}>
                        {winrateByEmotion.map((entry, idx) => (
                          <Cell key={idx} fill={entry.winrate >= 50 ? PROFIT_COLOR : LOSS_COLOR} />
                        ))}
                      </Bar>
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              )}
            </div>
          )}
        </>
      )}
    </div>
  );
}
