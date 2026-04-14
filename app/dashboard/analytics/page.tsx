"use client";

import ExportPdfButton from "@/components/analytics/ExportPdfButton";
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

export default function AnalyticsPage() {
  const { t } = useLanguage();
  const supabase = createClient();
  const [trades, setTrades] = useState<TradeRow[]>([]);
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [reviews, setReviews] = useState<SessionReview[]>([]);
  const [loading, setLoading] = useState(true);
  const [period, setPeriod] = useState<"7d" | "30d" | "90d" | "all">("all");
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

  const filtered = useMemo(() => {
    let result = trades;

    if (accountFilter !== "all") {
      result = result.filter((tr) => tr.challenge_id === accountFilter);
    }

    if (period !== "all") {
      const days = period === "7d" ? 7 : period === "30d" ? 30 : 90;
      const cutoff = new Date();
      cutoff.setDate(cutoff.getDate() - days);
      result = result.filter((tr) => tr.open_time && new Date(tr.open_time) >= cutoff);
    }

    return result;
  }, [trades, period, accountFilter]);

  const netPnl = (tr: TradeRow) => tr.pnl + (tr.commission || 0) + (tr.swap || 0);

  // 1. Performance by day of week
  const byDayOfWeek = useMemo(() => {
    const map = Array.from({ length: 7 }, () => ({ total: 0, count: 0 }));
    filtered.forEach((tr) => {
      if (!tr.open_time) return;
      const day = new Date(tr.open_time).getDay();
      map[day].total += netPnl(tr);
      map[day].count++;
    });
    return map.map((d, i) => ({ name: t(DAY_KEYS[i]), pnl: Number(d.total.toFixed(2)), count: d.count }));
  }, [filtered, t]);

  // 2. Performance by hour
  const byHour = useMemo(() => {
    const map = Array.from({ length: 24 }, () => ({ total: 0, count: 0 }));
    filtered.forEach((tr) => {
      if (!tr.open_time) return;
      const hour = new Date(tr.open_time).getHours();
      map[hour].total += netPnl(tr);
      map[hour].count++;
    });
    return map
      .map((d, i) => ({ name: `${i}h`, pnl: Number(d.total.toFixed(2)), count: d.count }))
      .filter((d) => d.count > 0);
  }, [filtered]);

  // 3. Performance by pair
  const byPair = useMemo(() => {
    const map: Record<string, { total: number; count: number }> = {};
    filtered.forEach((tr) => {
      if (!map[tr.pair]) map[tr.pair] = { total: 0, count: 0 };
      map[tr.pair].total += netPnl(tr);
      map[tr.pair].count++;
    });
    return Object.entries(map)
      .map(([pair, d]) => ({ name: pair, pnl: Number(d.total.toFixed(2)), count: d.count }))
      .sort((a, b) => b.pnl - a.pnl);
  }, [filtered]);

  // 4. Performance by emotion
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
  }, [filtered, t]);

  // 5. Performance by setup quality
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
  }, [filtered]);

  // 6. P&L distribution histogram
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
  }, [filtered]);

  // 7. Discipline vs Results
  const violatedPairs = useMemo(() => {
    const set = new Set<string>();
    reviews.forEach((r) => {
      if (r.analysis?.violations) {
        r.analysis.violations.forEach((v) => {
          set.add(`${v.trade_date}|${v.pair}`);
        });
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
  }, [filtered, violatedPairs]);

  // Winrate by emotion (for discipline section)
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
  }, [filtered, t]);

  const CustomTooltip = ({ active, payload, label }: { active?: boolean; payload?: Array<{ value: number }>; label?: string }) => {
    if (!active || !payload?.length) return null;
    return (
      <div className="bg-[#1a1a1a] border border-[#2a2a2a] rounded-lg px-3 py-2 text-sm">
        <p className="text-foreground font-medium">{label}</p>
        <p className={payload[0].value >= 0 ? "text-profit" : "text-loss"}>
          {payload[0].value >= 0 ? "+" : ""}{payload[0].value.toFixed(2)}
        </p>
      </div>
    );
  };

  const HistogramTooltip = ({ active, payload, label }: { active?: boolean; payload?: Array<{ value: number }>; label?: string }) => {
    if (!active || !payload?.length) return null;
    return (
      <div className="bg-[#1a1a1a] border border-[#2a2a2a] rounded-lg px-3 py-2 text-sm">
        <p className="text-foreground font-medium">{label}</p>
        <p className="text-muted">{payload[0].value} trades</p>
      </div>
    );
  };

  const selectClass = "px-3 py-2 bg-[#1a1a1a] border border-[#2a2a2a] rounded-lg text-foreground text-sm focus:outline-none focus:ring-1 focus:ring-accent focus:border-accent";

  function ChartSection({ title, data, dataKey = "pnl", tooltip }: { title: string; data: Array<Record<string, unknown>>; dataKey?: string; tooltip?: React.ReactElement }) {
    if (data.length === 0) return null;
    return (
      <div className="bg-card border border-border rounded-xl p-5">
        <h3 className="text-foreground font-semibold mb-4">{title}</h3>
        <ResponsiveContainer width="100%" height={280}>
          <BarChart data={data} margin={{ top: 5, right: 10, left: 0, bottom: 5 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#1e1e1e" />
            <XAxis dataKey="name" tick={{ fill: "#6b7280", fontSize: 12 }} axisLine={{ stroke: "#1e1e1e" }} />
            <YAxis tick={{ fill: "#6b7280", fontSize: 12 }} axisLine={{ stroke: "#1e1e1e" }} />
            <Tooltip content={tooltip || <CustomTooltip />} />
            <Bar dataKey={dataKey} radius={[4, 4, 0, 0]}>
              {data.map((entry, idx) => (
                <Cell key={idx} fill={(entry[dataKey] as number) >= 0 ? PROFIT_COLOR : LOSS_COLOR} />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>
    );
  }

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
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mb-6">
        <div>
          <h1 className="text-2xl font-bold text-foreground">{t("analytics_title")}</h1>
          <p className="text-muted text-sm mt-1">{t("analytics_subtitle")}</p>
        </div>
        <div className="flex gap-2">
          <select value={period} onChange={(e) => setPeriod(e.target.value as typeof period)} className={selectClass}>
            <option value="7d">{t("analytics_7d")}</option>
            <option value="30d">{t("analytics_30d")}</option>
            <option value="90d">{t("analytics_90d")}</option>
            <option value="all">{t("analytics_all")}</option>
          </select>
          {accounts.length > 0 && (
            <select value={accountFilter} onChange={(e) => setAccountFilter(e.target.value)} className={selectClass}>
              <option value="all">{t("analytics_all_accounts")}</option>
              {accounts.map((a) => (
                <option key={a.id} value={a.id}>
                  {a.firm} — {a.account_number || `${a.account_size.toLocaleString()}\u20AC`}
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
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <ChartSection title={t("analytics_by_day")} data={byDayOfWeek} />
          <ChartSection title={t("analytics_by_hour")} data={byHour} />
          <ChartSection title={t("analytics_by_pair")} data={byPair} />
          <ChartSection title={t("analytics_by_emotion")} data={byEmotion} />
          <ChartSection title={t("analytics_by_quality")} data={byQuality} />

          {/* P&L Distribution Histogram */}
          <div className="bg-card border border-border rounded-xl p-5">
            <h3 className="text-foreground font-semibold mb-4">{t("analytics_distribution")}</h3>
            <ResponsiveContainer width="100%" height={280}>
              <BarChart data={pnlDistribution} margin={{ top: 5, right: 10, left: 0, bottom: 5 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#1e1e1e" />
                <XAxis dataKey="name" tick={{ fill: "#6b7280", fontSize: 12 }} axisLine={{ stroke: "#1e1e1e" }} />
                <YAxis tick={{ fill: "#6b7280", fontSize: 12 }} axisLine={{ stroke: "#1e1e1e" }} />
                <Tooltip content={<HistogramTooltip />} />
                <Bar dataKey="count" radius={[4, 4, 0, 0]}>
                  {pnlDistribution.map((entry, idx) => (
                    <Cell key={idx} fill={entry.avg >= 0 ? PROFIT_COLOR : LOSS_COLOR} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Discipline vs Results section */}
        {(disciplineStats || winrateByEmotion.length > 0) && (
          <div className="mt-8">
            <h2 className="text-xl font-bold text-foreground mb-4">{t("discipline_title")}</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {/* P&L rules followed vs broken */}
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
                  {/* Cost of indiscipline */}
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

            {/* Winrate by emotion chart */}
            {winrateByEmotion.length > 0 && (
              <div className="bg-card border border-border rounded-xl p-5 mt-4">
                <h3 className="text-foreground font-semibold mb-4">{t("discipline_winrate_emotion")}</h3>
                <ResponsiveContainer width="100%" height={280}>
                  <BarChart data={winrateByEmotion} margin={{ top: 5, right: 10, left: 0, bottom: 5 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#1e1e1e" />
                    <XAxis dataKey="name" tick={{ fill: "#6b7280", fontSize: 12 }} axisLine={{ stroke: "#1e1e1e" }} />
                    <YAxis tick={{ fill: "#6b7280", fontSize: 12 }} axisLine={{ stroke: "#1e1e1e" }} domain={[0, 100]} />
                    <Tooltip content={({ active, payload, label }) => {
                      if (!active || !payload?.length) return null;
                      return (
                        <div className="bg-[#1a1a1a] border border-[#2a2a2a] rounded-lg px-3 py-2 text-sm">
                          <p className="text-foreground font-medium">{label}</p>
                          <p className="text-accent">{payload[0].value}% WR</p>
                        </div>
                      );
                    }} />
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
