"use client";

import { useMemo } from "react";
import { DEFAULT_CURRENCY, money } from "@/lib/account-currency";
import { Calendar, Clock, Zap, TrendingUp, TrendingDown } from "lucide-react";
import { KpiCardPremium } from "@/components/dashboard/KpiCardPremium";
import { CardHeader, CardTitle } from "@/components/ui/Card";
import {
  BarChart,
  Bar,
  Cell,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
} from "recharts";
import {
  computeConfluenceScore,
  deriveTradeDuration,
  KILLZONE_LABELS,
} from "@/lib/strategy/derive";
import { useChartColors } from "@/lib/useChartColors";
import { useLanguage } from "@/lib/LanguageContext";
import type { ChecklistItem } from "@/lib/hooks/useStrategyTags";

// ── Types ─────────────────────────────────────────────────────────────────────

interface TradeRow {
  open_time: string;
  close_time?: string | null;
  pnl: number;
  commission: number | null;
  swap: number | null;
  ict_checklist?: Record<string, boolean> | null;
  ict_killzone?: string | null;
}

interface Props {
  /** Devise du compte filtré ; euro sur une vue multi-comptes. */
  currency?: string;
  trades: TradeRow[];
  checklistItems: ChecklistItem[];
}

function netPnl(tr: TradeRow): number {
  return tr.pnl + (tr.commission ?? 0) + (tr.swap ?? 0);
}

// ── Zone A — Conformité moyenne ───────────────────────────────────────────────

function ZoneA({ trades, checklistTotal }: { trades: TradeRow[]; checklistTotal: number }) {
  const { t } = useLanguage();
  const { avgScore, distribution } = useMemo(() => {
    const tradesWithChecklist = trades.filter((t) => t.ict_checklist != null);
    if (tradesWithChecklist.length === 0) return { avgScore: null, distribution: [] };

    const scores = tradesWithChecklist.map((t) => computeConfluenceScore(t.ict_checklist));
    const avg = scores.reduce((s, v) => s + v, 0) / scores.length;

    // Distribution: count of trades at each score 0..checklistTotal
    const dist = Array.from({ length: checklistTotal + 1 }, (_, i) => ({
      score: i,
      count: scores.filter((s) => s === i).length,
    }));

    return { avgScore: avg, distribution: dist };
  }, [trades, checklistTotal]);

  if (avgScore === null) {
    return (
      <div className="flex flex-col items-center justify-center py-8 text-center gap-2">
        <p className="text-sm text-foreground-muted">{t("da_no_checklist")}</p>
        <p className="text-xs text-foreground-muted/70">{t("da_no_checklist_hint")}</p>
      </div>
    );
  }

  const scoreColor =
    avgScore >= 5 ? "text-profit" :
    avgScore >= 3 ? "text-foreground" :
    "text-loss";

  const sentiment =
    avgScore >= 5 ? t("da_sentiment_good") :
    avgScore >= 3 ? t("da_sentiment_ok") :
    t("da_sentiment_bad");

  const maxCount = Math.max(...distribution.map((d) => d.count), 1);

  return (
    <div className="space-y-4">
      <div>
        <p className="text-[10px] font-semibold uppercase text-foreground-muted tracking-widest mb-2">
          {t("da_avg_score")}
        </p>
        <p className={`text-3xl font-black tabular-nums leading-none ${scoreColor}`}>
          {avgScore.toFixed(1)}
          <span className="text-lg font-normal text-foreground-muted ml-1">/ {checklistTotal}</span>
        </p>
        <p className="text-xs text-foreground-muted mt-1.5">{sentiment}</p>
      </div>

      {/* Mini histogram */}
      <div>
        <p className="text-[10px] text-foreground-muted/60 mb-2">{t("da_score_dist")}</p>
        <div className="flex items-end gap-1 h-12">
          {distribution.map((d) => (
            <div key={d.score} className="flex-1 flex flex-col items-center gap-0.5">
              <div
                className="w-full rounded-sm transition-all"
                style={{
                  height: d.count > 0 ? `${Math.round((d.count / maxCount) * 40) + 4}px` : "4px",
                  backgroundColor:
                    d.score >= Math.round(checklistTotal * 0.7)
                      ? `rgb(var(--profit) / 0.75)`
                      : d.score >= Math.round(checklistTotal * 0.4)
                      ? `rgb(var(--warning) / 0.75)`
                      : `rgb(var(--loss) / 0.75)`,
                  opacity: d.count === 0 ? 0.2 : 1,
                }}
              />
              <span className="text-[8px] text-foreground-muted/50 tabular-nums">{d.score}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

// ── Zone B — Performance par critère ──────────────────────────────────────────

interface CriterionStat {
  key: string;
  label: string;
  wrWith: number;
  wrWithout: number;
  delta: number;
  pnlAvgWith: number;
  countWith: number;
  countWithout: number;
}

function ZoneB({
  trades,
  checklistItems,
  currency,
}: {
  trades: TradeRow[];
  checklistItems: ChecklistItem[];
  currency: string;
}) {
  const { t, lang } = useLanguage();
  const stats = useMemo((): CriterionStat[] => {
    const tradesWithChecklist = trades.filter((t) => t.ict_checklist != null);
    if (tradesWithChecklist.length === 0) return [];

    const results: CriterionStat[] = [];

    for (const item of checklistItems) {
      const withItem = tradesWithChecklist.filter((t) => t.ict_checklist![item.key] === true);
      const withoutItem = tradesWithChecklist.filter((t) => !t.ict_checklist![item.key]);

      if (withItem.length < 5 || withoutItem.length < 5) continue;

      const wrWith = Math.round((withItem.filter((t) => netPnl(t) > 0).length / withItem.length) * 100);
      const wrWithout = Math.round((withoutItem.filter((t) => netPnl(t) > 0).length / withoutItem.length) * 100);
      const delta = wrWith - wrWithout;
      const pnlAvgWith = withItem.reduce((s, t) => s + netPnl(t), 0) / withItem.length;

      results.push({
        key: item.key,
        label: item.label[lang] ?? item.label["fr"] ?? item.key,
        wrWith,
        wrWithout,
        delta,
        pnlAvgWith,
        countWith: withItem.length,
        countWithout: withoutItem.length,
      });
    }

    return results.sort((a, b) => Math.abs(b.delta) - Math.abs(a.delta)).slice(0, 3);
  }, [trades, checklistItems, lang]);

  if (checklistItems.length === 0) return null;

  if (stats.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-8 text-center gap-2">
        <p className="text-sm text-foreground-muted">{t("da_not_enough_criteria")}</p>
        <p className="text-xs text-foreground-muted/70">{t("da_not_enough_criteria_hint")}</p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <p className="text-[10px] font-semibold uppercase text-foreground-muted tracking-widest">
        {t("da_top_criteria")}
      </p>
      {stats.map((s) => (
        <div key={s.key} className="space-y-0.5">
          <p className="text-xs text-foreground-muted">
            {t("da_when_you_check")}{" "}
            <span className="font-semibold text-foreground">{s.label}</span>
          </p>
          <div className="flex items-center gap-2 flex-wrap">
            <span className={`text-xs font-semibold ${s.delta > 0 ? "text-profit" : "text-loss"}`}>
              WR {s.wrWith}%
            </span>
            <span className="text-xs text-foreground-muted">
              {t("da_vs_without").replace("{wr}", String(s.wrWithout))}
            </span>
            <span className={`text-xs ${s.delta > 0 ? "text-profit" : "text-loss"} flex items-center gap-0.5`}>
              {s.delta > 0 ? <TrendingUp className="w-3 h-3" /> : <TrendingDown className="w-3 h-3" />}
              {s.delta > 0 ? "+" : ""}{s.delta} pts
            </span>
            <span className="text-xs text-foreground-muted">
              · {t("da_pnl_avg")}{" "}
              <span className={s.pnlAvgWith >= 0 ? "text-profit font-medium" : "text-loss font-medium"}>
                {money(s.pnlAvgWith, currency, { signed: true })}
              </span>
            </span>
          </div>
        </div>
      ))}
    </div>
  );
}

// ── Zone C — Performance par killzone ─────────────────────────────────────────

const KZ_ORDER = ["london_open", "ny_am", "ny_pm", "asia", "off_session"];

function ZoneC({ trades, currency }: { trades: TradeRow[]; currency: string }) {
  const c = useChartColors();
  const { t } = useLanguage();

  const data = useMemo(() => {
    const map: Record<string, { pnl: number; count: number; wins: number }> = {};
    for (const kz of KZ_ORDER) map[kz] = { pnl: 0, count: 0, wins: 0 };

    for (const tr of trades) {
      const kz = tr.ict_killzone;
      if (!kz || !map[kz]) continue;
      const net = netPnl(tr);
      map[kz].pnl += net;
      map[kz].count++;
      if (net > 0) map[kz].wins++;
    }

    return KZ_ORDER
      .filter((kz) => map[kz].count > 0)
      .map((kz) => ({
        kz,
        label: t(`da_kz_${kz}`) || KILLZONE_LABELS[kz] || kz,
        pnl: Number(map[kz].pnl.toFixed(2)),
        count: map[kz].count,
        winrate: Math.round((map[kz].wins / map[kz].count) * 100),
      }));
  }, [trades, t]);

  const tooltipStyle: React.CSSProperties = {
    backgroundColor: c.tooltipBg || "rgb(var(--card))",
    border: `1px solid ${c.tooltipBorder || "rgb(var(--border))"}`,
    borderRadius: 8,
    padding: "8px 12px",
    fontSize: 12,
    color: c.tooltipText || "inherit",
  };

  if (data.length === 0) {
    return (
      <p className="text-xs text-foreground-muted py-4 text-center">
        {t("da_no_killzone")}
      </p>
    );
  }

  return (
    <ResponsiveContainer width="100%" height={Math.max(120, data.length * 36)}>
      <BarChart
        layout="vertical"
        data={data}
        margin={{ top: 4, right: 48, left: 4, bottom: 4 }}
      >
        <XAxis
          type="number"
          tick={{ fontSize: 10, fill: c.axis }}
          tickLine={false}
          axisLine={{ stroke: c.axisLine }}
          tickFormatter={(v) => money(v, currency, { signed: true })}
        />
        <YAxis
          type="category"
          dataKey="label"
          tick={{ fontSize: 11, fill: c.axis }}
          tickLine={false}
          axisLine={false}
          width={90}
        />
        <Tooltip
          content={({ active, payload }) => {
            if (!active || !payload?.length) return null;
            const entry = payload[0]?.payload as (typeof data)[0];
            return (
              <div style={tooltipStyle}>
                <p style={{ fontWeight: 600, marginBottom: 4 }}>{entry.label}</p>
                <p style={{ color: entry.pnl >= 0 ? c.profit : c.loss }}>
                  {money(entry.pnl, currency, { digits: 2, signed: true })}
                </p>
                <p style={{ color: c.axis }}>
                  {entry.count} trade{entry.count > 1 ? "s" : ""} · WR {entry.winrate}%
                </p>
              </div>
            );
          }}
          cursor={{ fill: "rgb(var(--foreground) / 0.04)" }}
        />
        <Bar dataKey="pnl" radius={[0, 4, 4, 0]}>
          {data.map((entry) => (
            <Cell
              key={entry.kz}
              fill={entry.pnl >= 0 ? c.profit : c.loss}
              fillOpacity={0.75}
            />
          ))}
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  );
}

// ── Zone D — Performance par durée ────────────────────────────────────────────

const DURATION_META = {
  scalp: { icon: Zap, label: "Scalp", color: "text-accent" },
  intraday: { icon: Clock, label: "Intraday", color: "text-profit" },
  swing: { icon: Calendar, label: "Swing", color: "text-foreground-muted" },
} as const;

type DurationKey = keyof typeof DURATION_META;

function ZoneD({ trades, currency }: { trades: TradeRow[]; currency: string }) {
  const { t } = useLanguage();
  const stats = useMemo(() => {
    const map: Record<DurationKey, { count: number; wins: number; pnl: number }> = {
      scalp: { count: 0, wins: 0, pnl: 0 },
      intraday: { count: 0, wins: 0, pnl: 0 },
      swing: { count: 0, wins: 0, pnl: 0 },
    };

    for (const tr of trades) {
      if (!tr.open_time || !tr.close_time) continue;
      const { category } = deriveTradeDuration(tr.open_time, tr.close_time);
      const net = netPnl(tr);
      map[category].count++;
      map[category].pnl += net;
      if (net > 0) map[category].wins++;
    }

    return map;
  }, [trades]);

  const categories = (Object.keys(stats) as DurationKey[]).filter(
    (k) => stats[k].count > 0
  );

  // If single dominant category (>90%), return null — caller handles the sublabel
  if (categories.length === 0) return null;

  return (
    <div className="grid grid-cols-3 gap-3">
      {(["scalp", "intraday", "swing"] as DurationKey[]).map((key) => {
        const s = stats[key];
        if (s.count === 0) return null;
        const meta = DURATION_META[key];
        const Icon = meta.icon;
        const wr = Math.round((s.wins / s.count) * 100);
        const pnlAvg = s.pnl / s.count;

        return (
          <div
            key={key}
            className="flex flex-col gap-1.5 p-3 rounded-lg bg-foreground/[0.03] border border-border/50"
          >
            <div className="flex items-center gap-1.5">
              <Icon className={`w-3.5 h-3.5 ${meta.color}`} strokeWidth={1.75} />
              <span className="text-[10px] font-semibold uppercase tracking-wider text-foreground-muted">
                {meta.label}
              </span>
            </div>
            <p className="text-2xl font-black tabular-nums text-foreground leading-none">
              {s.count}
            </p>
            <p className="text-[10px] text-foreground-muted leading-relaxed">
              WR {wr}%
              <br />
              <span className={pnlAvg >= 0 ? "text-profit" : "text-loss"}>
                {money(pnlAvg, currency, { signed: true })} {t("da_avg_suffix")}
              </span>
            </p>
          </div>
        );
      })}
    </div>
  );
}

// ── Main component ─────────────────────────────────────────────────────────────

export function DisciplineAnalyticsBlock({
  trades,
  checklistItems,
  currency = DEFAULT_CURRENCY,
}: Props) {
  const { t } = useLanguage();
  // ── Derived conditions ────────────────────────────────────────────────────
  const hasEnoughTrades = trades.length >= 10;
  const tradesWithChecklist = useMemo(
    () => trades.filter((t) => t.ict_checklist != null),
    [trades]
  );
  const hasAnyChecklistFilled = tradesWithChecklist.length > 0;
  const hasChecklistItemsDefined = checklistItems.length > 0;

  // Determine if Zone D should be hidden (single dominant duration)
  const durationSublabel = useMemo((): string | null => {
    const map: Record<string, number> = { scalp: 0, intraday: 0, swing: 0 };
    let total = 0;
    for (const tr of trades) {
      if (!tr.open_time || !tr.close_time) continue;
      const { category } = deriveTradeDuration(tr.open_time, tr.close_time);
      map[category]++;
      total++;
    }
    if (total === 0) return null;
    for (const [key, count] of Object.entries(map)) {
      if (count / total > 0.9) {
        return DURATION_META[key as DurationKey]?.label ?? key;
      }
    }
    return null;
  }, [trades]);

  const checklistTotal = checklistItems.length || 7;

  // ── Empty state ───────────────────────────────────────────────────────────
  if (!hasEnoughTrades) {
    return (
      <KpiCardPremium layout="full" accentColor="cyan">
        <CardHeader>
          <CardTitle>{t("da_title")}</CardTitle>
          <p className="text-xs text-foreground-muted mt-1">
            {t("da_subtitle")}
          </p>
        </CardHeader>
        <div className="flex flex-col items-center justify-center py-10 text-center gap-2">
          <p className="text-sm text-foreground-muted">
            {t("da_empty")}
          </p>
          <p className="text-xs text-foreground-muted/70">
            {t("da_trades_needed")
              .replace("{n}", String(10 - trades.length))
              .replace("{have}", String(trades.length))}
          </p>
        </div>
      </KpiCardPremium>
    );
  }

  return (
    <KpiCardPremium layout="full" accentColor="cyan">
      <CardHeader>
        <CardTitle>{t("da_title")}</CardTitle>
        <p className="text-xs text-foreground-muted mt-1">
          {t("da_subtitle")}
          {durationSublabel && (
            <span className="ml-1 text-foreground-muted/60">
              · {t("da_all_duration").replace("{dur}", durationSublabel)}
            </span>
          )}
        </p>
      </CardHeader>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">

        {/* Zone A — Score moyen de conformité */}
        <div>
          <ZoneA trades={trades} checklistTotal={checklistTotal} />
        </div>

        {/* Zone B — Performance par critère */}
        {hasChecklistItemsDefined && hasAnyChecklistFilled && (
          <div>
            <ZoneB
              trades={trades}
              checklistItems={checklistItems}
              currency={currency}
            />
          </div>
        )}

        {/* Zone C — Performance par killzone */}
        <div>
          <p
            className="text-[10px] font-semibold uppercase text-foreground-muted tracking-widest mb-3"
          >
            {t("da_perf_killzone")}
          </p>
          <ZoneC trades={trades} currency={currency} />
        </div>

        {/* Zone D — Performance par durée */}
        {!durationSublabel && (
          <div>
            <p
              className="text-[10px] font-semibold uppercase text-foreground-muted tracking-widest mb-3"
            >
              {t("da_perf_duration")}
            </p>
            <ZoneD trades={trades} currency={currency} />
          </div>
        )}

      </div>
    </KpiCardPremium>
  );
}
