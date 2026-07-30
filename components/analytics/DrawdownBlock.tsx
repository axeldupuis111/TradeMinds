"use client";

/**
 * DrawdownBlock — courbe underwater + stats de drawdown.
 *
 * Reçoit la courbe d'equity cumulée (P&L cumulé par jour) et calcule la
 * distance sous le plus haut atteint (drawdown), la perte max depuis un pic,
 * le drawdown actuel et la plus longue période passée sous le pic.
 * Métrique clé pour les comptes prop firm à limite de drawdown.
 */

import { KpiCardPremium } from "@/components/dashboard/KpiCardPremium";
import { DEFAULT_CURRENCY, money } from "@/lib/account-currency";
import { CardTitle } from "@/components/ui/Card";
import { useLanguage } from "@/lib/LanguageContext";
import { useChartColors } from "@/lib/useChartColors";

import { cn } from "@/lib/cn";
import { useMemo } from "react";
import {
  Area,
  AreaChart,
  CartesianGrid,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

interface EquityPoint {
  date: string;
  cumulative: number;
}

interface DdPoint {
  date: string;
  dd: number;
}

interface TooltipPayloadItem {
  payload?: DdPoint;
}

export default function DrawdownBlock({ data, currency = DEFAULT_CURRENCY }: { data: EquityPoint[]; currency?: string }) {
  const { t, lang } = useLanguage();
  const c = useChartColors();

  const { points, maxDd, maxDdDate, currentDd, longestDays } = useMemo(() => {
    let peak = 0;
    const pts: DdPoint[] = data.map((d) => {
      peak = Math.max(peak, d.cumulative);
      return { date: d.date, dd: Number((d.cumulative - peak).toFixed(2)) };
    });

    let max = 0;
    let maxDate = "";
    for (const p of pts) {
      if (p.dd < max) {
        max = p.dd;
        maxDate = p.date;
      }
    }

    // Plus longue période consécutive sous le pic (en jours calendaires)
    let longest = 0;
    let runStart: string | null = null;
    const closeRun = (endDate: string) => {
      if (!runStart) return;
      const span = Math.round(
        (new Date(endDate).getTime() - new Date(runStart).getTime()) / 86400000
      ) + 1;
      if (span > longest) longest = span;
      runStart = null;
    };
    for (let i = 0; i < pts.length; i++) {
      if (pts[i].dd < 0) {
        if (!runStart) runStart = pts[i].date;
        if (i === pts.length - 1) closeRun(pts[i].date);
      } else {
        if (runStart) closeRun(pts[Math.max(0, i - 1)].date);
      }
    }

    return {
      points: pts,
      maxDd: max,
      maxDdDate: maxDate,
      currentDd: pts.length > 0 ? pts[pts.length - 1].dd : 0,
      longestDays: longest,
    };
  }, [data]);

  // Aucun drawdown sur la période : pas de bloc (rien à analyser)
  if (points.length < 2 || maxDd === 0) return null;

  const atHigh = currentDd === 0;

  function DdTooltip({ active, payload, label }: { active?: boolean; payload?: TooltipPayloadItem[]; label?: string }) {
    if (!active || !payload || payload.length === 0) return null;
    const dd = payload[0]?.payload?.dd ?? 0;
    return (
      <div className="bg-card border border-border rounded-lg px-3 py-2 text-xs shadow-lg">
        <p className="text-foreground-muted mb-0.5">{label}</p>
        <p className={cn("font-semibold tabular-nums", dd < 0 ? "text-loss" : "text-profit")}>
          {dd < 0 ? money(dd, currency, { digits: 2 }) : t("dd_at_high")}
        </p>
      </div>
    );
  }

  const stats = [
    {
      key: "max",
      label: t("dd_max"),
      value: money(maxDd, currency),
      sub: maxDdDate
        ? new Date(maxDdDate).toLocaleDateString(lang, { day: "numeric", month: "short", year: "numeric" })
        : null,
      valueClass: "text-loss",
    },
    {
      key: "current",
      label: t("dd_current"),
      value: atHigh ? t("dd_at_high") : money(currentDd, currency),
      sub: null,
      valueClass: atHigh ? "text-profit" : "text-warning",
    },
    {
      key: "longest",
      label: t("dd_longest"),
      value: `${longestDays} ${t("dd_days")}`,
      sub: null,
      valueClass: "text-foreground",
    },
  ];

  return (
    <KpiCardPremium layout="full" accentColor="loss">
      <div className="mb-4">
        <CardTitle>{t("dd_title")}</CardTitle>
        <p className="text-xs text-foreground-muted mt-1">{t("dd_subtitle")}</p>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-3 gap-3 mb-4">
        {stats.map((s) => (
          <div key={s.key} className="rounded-lg bg-surface/50 border border-border/60 px-3 py-2.5">
            <p className="text-[10px] font-semibold uppercase tracking-[0.08em] text-foreground-muted leading-none mb-1.5">
              {s.label}
            </p>
            <p className={cn("text-lg font-bold tabular-nums leading-none", s.valueClass)}>{s.value}</p>
            {s.sub && <p className="text-[10px] text-foreground-muted mt-1">{s.sub}</p>}
          </div>
        ))}
      </div>

      {/* Underwater chart */}
      <ResponsiveContainer width="100%" height={200}>
        <AreaChart data={points} margin={{ top: 5, right: 10, left: 0, bottom: 5 }}>
          <CartesianGrid strokeDasharray="3 3" stroke={c.grid} vertical={false} strokeOpacity={0.5} />
          <XAxis
            dataKey="date"
            tick={{ fill: c.axis, fontSize: 10 }}
            tickLine={false}
            axisLine={{ stroke: c.axisLine }}
            interval={Math.floor(points.length / 8)}
          />
          <YAxis
            tick={{ fill: c.axis, fontSize: 12 }}
            tickLine={false}
            axisLine={{ stroke: c.axisLine }}
            tickFormatter={(v: unknown) => (typeof v === "number" ? money(v, currency) : String(v))}
            width={80}
          />
          <ReferenceLine y={0} stroke={c.referenceLine} strokeDasharray="4 4" />
          <Tooltip content={<DdTooltip />} />
          <Area
            type="monotone"
            dataKey="dd"
            stroke={c.loss || "rgb(var(--loss))"}
            strokeWidth={1.5}
            fill={c.loss || "rgb(var(--loss))"}
            fillOpacity={0.16}
            baseValue={0}
          />
        </AreaChart>
      </ResponsiveContainer>
    </KpiCardPremium>
  );
}
