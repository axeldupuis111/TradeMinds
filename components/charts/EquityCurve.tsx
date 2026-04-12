"use client";

import { useLanguage } from "@/lib/LanguageContext";
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
}

export default function EquityCurve({ data, initialBalance }: Props) {
  const { t } = useLanguage();

  if (data.length === 0) {
    return (
      <div className="bg-card border border-border rounded-xl p-6">
        <h2 className="text-sm font-semibold text-foreground mb-4">
          {t("equity_title")}
        </h2>
        <p className="text-muted text-sm">{t("equity_empty")}</p>
      </div>
    );
  }

  const minBalance = Math.min(...data.map((d) => d.balance));
  const maxBalance = Math.max(...data.map((d) => d.balance));
  const padding = (maxBalance - minBalance) * 0.1 || initialBalance * 0.02;
  const yMin = Math.floor(minBalance - padding);
  const yMax = Math.ceil(maxBalance + padding);

  // Determine if current balance is above or below initial
  const lastBalance = data[data.length - 1]?.balance ?? initialBalance;
  const isAbove = lastBalance >= initialBalance;

  return (
    <div className="bg-card border border-border rounded-xl p-6">
      <h2 className="text-sm font-semibold text-foreground mb-4">
        {t("equity_title")}
      </h2>
      <div style={{ width: "100%", height: 300 }}>
        <ResponsiveContainer>
          <AreaChart data={data} margin={{ top: 5, right: 10, left: 10, bottom: 5 }}>
            <defs>
              <linearGradient id="gradProfit" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="#22c55e" stopOpacity={0.2} />
                <stop offset="100%" stopColor="#22c55e" stopOpacity={0} />
              </linearGradient>
              <linearGradient id="gradLoss" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="#ef4444" stopOpacity={0.2} />
                <stop offset="100%" stopColor="#ef4444" stopOpacity={0} />
              </linearGradient>
            </defs>
            <CartesianGrid strokeDasharray="3 3" stroke="#1e1e1e" />
            <XAxis
              dataKey="date"
              tick={{ fill: "#666", fontSize: 11 }}
              tickLine={false}
              axisLine={{ stroke: "#1e1e1e" }}
            />
            <YAxis
              domain={[yMin, yMax]}
              tick={{ fill: "#666", fontSize: 11 }}
              tickLine={false}
              axisLine={{ stroke: "#1e1e1e" }}
              tickFormatter={(v: number) => `${v.toLocaleString()}€`}
              width={80}
            />
            <Tooltip
              contentStyle={{
                backgroundColor: "#141414",
                border: "1px solid #2a2a2a",
                borderRadius: "8px",
                fontSize: 13,
              }}
              labelStyle={{ color: "#888" }}
              formatter={(value: unknown) => [`${Number(value).toLocaleString("fr-FR", { maximumFractionDigits: 2 })}€`, t("equity_balance")]}
              labelFormatter={(label: unknown) => String(label)}
            />
            <ReferenceLine
              y={initialBalance}
              stroke="#444"
              strokeDasharray="4 4"
              strokeWidth={1}
            />
            <Area
              type="monotone"
              dataKey="balance"
              stroke={isAbove ? "#22c55e" : "#ef4444"}
              strokeWidth={2}
              fill={isAbove ? "url(#gradProfit)" : "url(#gradLoss)"}
              dot={false}
              activeDot={{ r: 4, stroke: isAbove ? "#22c55e" : "#ef4444", strokeWidth: 2, fill: "#141414" }}
            />
          </AreaChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
