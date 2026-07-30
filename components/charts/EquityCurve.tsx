"use client";

import { KpiCardPremium } from "@/components/dashboard/KpiCardPremium";
import { CardTitle } from "@/components/ui/Card";
import { useChartColors } from "@/lib/useChartColors";
import { useLanguage } from "@/lib/LanguageContext";
import { useTheme } from "@/lib/ThemeContext";
import { DEFAULT_CURRENCY, money } from "@/lib/account-currency";
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  ReferenceLine,
} from "recharts";

interface DataPoint {
  date: string;
  balance: number;
}

interface Props {
  data: DataPoint[];
  initialBalance: number;
  /** Devise du compte tracé ; euro en vue « tous les comptes ». */
  currency?: string;
}

export default function EquityCurve({ data, initialBalance, currency = DEFAULT_CURRENCY }: Props) {
  const { t } = useLanguage();
  const c = useChartColors();
  const { theme } = useTheme();
  const isDark = theme !== "light";

  if (data.length === 0) {
    return (
      <KpiCardPremium layout="full" intensity="default" accentColor="cyan">
        <CardTitle className="mb-4">{t("equity_title")}</CardTitle>
        <p className="text-foreground-muted text-sm">{t("equity_empty")}</p>
      </KpiCardPremium>
    );
  }

  const minBalance = Math.min(...data.map((d) => d.balance));
  const maxBalance = Math.max(...data.map((d) => d.balance));
  const padding = (maxBalance - minBalance) * 0.1 || initialBalance * 0.02;
  const yMin = Math.floor(minBalance - padding);
  const yMax = Math.ceil(maxBalance + padding);

  const lastBalance = data[data.length - 1]?.balance ?? initialBalance;
  const isAbove = lastBalance >= initialBalance;

  // L'axe X est catégoriel et la série est trade-par-trade : plusieurs trades
  // le même jour produisent des libellés de date dupliqués. On force des ticks
  // de dates uniques, amincis à ~6 pour rester lisibles (début + fin inclus).
  const xTicks = (() => {
    const uniqueDates = Array.from(new Set(data.map((d) => d.date)));
    const maxTicks = 6;
    if (uniqueDates.length <= maxTicks) return uniqueDates;
    const step = Math.ceil(uniqueDates.length / maxTicks);
    const ticks = uniqueDates.filter((_, i) => i % step === 0);
    const last = uniqueDates[uniqueDates.length - 1];
    if (ticks[ticks.length - 1] !== last) ticks.push(last);
    return ticks;
  })();

  return (
    <KpiCardPremium layout="full" intensity="default" accentColor="cyan">
      <CardTitle className="mb-4">{t("equity_title")}</CardTitle>
      <div style={{ width: "100%", height: 300 }}>
        <ResponsiveContainer>
          <AreaChart data={data} margin={{ top: 5, right: 10, left: 10, bottom: 5 }}>
            <defs>
              {/* Dégradé d'aire — opacité 0.25 (légèrement intensifié) */}
              <linearGradient id="gradProfit" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor={c.profit} stopOpacity={0.25} />
                <stop offset="100%" stopColor={c.profit} stopOpacity={0} />
              </linearGradient>
              <linearGradient id="gradLoss" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor={c.loss} stopOpacity={0.25} />
                <stop offset="100%" stopColor={c.loss} stopOpacity={0} />
              </linearGradient>

              {/* Filtre glow sur la courbe — dark mode uniquement */}
              {isDark && (
                <filter id="equityLineGlow" x="-20%" y="-20%" width="140%" height="140%">
                  <feGaussianBlur in="SourceGraphic" stdDeviation="2.5" result="blur" />
                  <feMerge>
                    <feMergeNode in="blur" />
                    <feMergeNode in="SourceGraphic" />
                  </feMerge>
                </filter>
              )}
            </defs>

            {/* Horizontal gridlines only — cleaner, less visual noise */}
            <CartesianGrid
              strokeDasharray="3 3"
              stroke={c.grid}
              strokeOpacity={0.5}
              vertical={false}
            />
            <XAxis
              dataKey="date"
              ticks={xTicks}
              interval={0}
              tick={{ fill: c.axis, fontSize: 11 }}
              tickLine={false}
              axisLine={{ stroke: c.axisLine }}
            />
            <YAxis
              domain={[yMin, yMax]}
              tick={{ fill: c.axis, fontSize: 11 }}
              tickLine={false}
              axisLine={{ stroke: c.axisLine }}
              tickFormatter={(v: unknown) =>
                typeof v === "number" ? money(v, currency) : String(v)
              }
              width={80}
            />
            <Tooltip
              contentStyle={{
                backgroundColor: c.tooltipBg,
                border: `1px solid ${c.tooltipBorder}`,
                borderRadius: "8px",
                fontSize: 13,
              }}
              labelStyle={{ color: c.tooltipText }}
              formatter={(value: unknown) => [
                money(Number(value), currency, { digits: 2 }),
                t("equity_balance"),
              ]}
              labelFormatter={(label: unknown) => String(label)}
            />
            <ReferenceLine
              y={initialBalance}
              stroke={c.referenceLine}
              strokeDasharray="4 4"
              strokeWidth={1}
              label={{ value: t("challenge_initial_capital"), position: "right", fill: c.axis, fontSize: 10 }}
            />
            <Area
              type="monotone"
              dataKey="balance"
              stroke={isAbove ? c.profit : c.loss}
              strokeWidth={2}
              fill={isAbove ? "url(#gradProfit)" : "url(#gradLoss)"}
              dot={false}
              activeDot={{ r: 4, stroke: isAbove ? c.profit : c.loss, strokeWidth: 2, fill: c.dotFill }}
              filter={isDark ? "url(#equityLineGlow)" : undefined}
            />
          </AreaChart>
        </ResponsiveContainer>
      </div>
    </KpiCardPremium>
  );
}
