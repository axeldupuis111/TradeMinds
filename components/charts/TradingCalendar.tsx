"use client";

import { useLanguage } from "@/lib/LanguageContext";
import { useMemo, useState } from "react";

interface CalendarTrade {
  open_time: string;
  pair: string;
  direction: string;
  pnl: number;
  commission: number | null;
  swap: number | null;
  challenge_id: string | null;
}

interface Props {
  trades: CalendarTrade[];
  selectedAccountId: string | null;
}

interface DayData {
  pnl: number;
  count: number;
  trades: { pair: string; direction: string; pnl: number }[];
}

function netPnl(t: { pnl: number; commission: number | null; swap: number | null }) {
  return t.pnl + (t.commission || 0) + (t.swap || 0);
}

export default function TradingCalendar({ trades, selectedAccountId }: Props) {
  const { t } = useLanguage();
  const [currentDate, setCurrentDate] = useState(() => new Date());
  const [selectedDay, setSelectedDay] = useState<string | null>(null);

  const year = currentDate.getFullYear();
  const month = currentDate.getMonth();

  // Filter by account
  const filtered = useMemo(() => {
    if (!selectedAccountId) return trades;
    return trades.filter((tr) => tr.challenge_id === selectedAccountId);
  }, [trades, selectedAccountId]);

  // Group trades by day for the current month
  const dayMap = useMemo(() => {
    const map: Record<string, DayData> = {};
    for (const tr of filtered) {
      if (!tr.open_time) continue;
      const d = new Date(tr.open_time);
      if (d.getFullYear() !== year || d.getMonth() !== month) continue;
      const key = d.getDate().toString();
      if (!map[key]) map[key] = { pnl: 0, count: 0, trades: [] };
      const net = netPnl(tr);
      map[key].pnl += net;
      map[key].count += 1;
      map[key].trades.push({ pair: tr.pair, direction: tr.direction, pnl: net });
    }
    return map;
  }, [filtered, year, month]);

  // Month stats
  const tradingDays = Object.keys(dayMap).length;
  const monthPnl = Object.values(dayMap).reduce((sum, d) => sum + d.pnl, 0);

  // Calendar grid
  const firstDay = new Date(year, month, 1);
  const lastDay = new Date(year, month + 1, 0);
  const daysInMonth = lastDay.getDate();
  // Monday = 0, Sunday = 6
  let startOffset = firstDay.getDay() - 1;
  if (startOffset < 0) startOffset = 6;
  const totalCells = Math.ceil((daysInMonth + startOffset) / 7) * 7;

  // Previous month days
  const prevMonthLast = new Date(year, month, 0).getDate();

  function prevMonth() {
    setCurrentDate(new Date(year, month - 1, 1));
    setSelectedDay(null);
  }
  function nextMonth() {
    setCurrentDate(new Date(year, month + 1, 1));
    setSelectedDay(null);
  }

  const dayNames = [
    t("cal_mon"), t("cal_tue"), t("cal_wed"), t("cal_thu"),
    t("cal_fri"), t("cal_sat"), t("cal_sun"),
  ];

  const monthNames = [
    t("cal_jan"), t("cal_feb"), t("cal_mar"), t("cal_apr"),
    t("cal_may"), t("cal_jun"), t("cal_jul"), t("cal_aug"),
    t("cal_sep"), t("cal_oct"), t("cal_nov"), t("cal_dec"),
  ];

  const selectedDayData = selectedDay ? dayMap[selectedDay] : null;

  return (
    <div className="bg-card border border-border rounded-xl p-5">
      {/* Header */}
      <div className="flex items-center justify-between mb-1">
        <div className="flex items-center gap-3">
          <button onClick={prevMonth} className="p-1.5 rounded-lg hover:bg-[#1e1e1e] text-muted hover:text-foreground transition-colors">
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            </svg>
          </button>
          <h2 className="text-lg font-semibold text-foreground capitalize">
            {monthNames[month]} {year}
          </h2>
          <button onClick={nextMonth} className="p-1.5 rounded-lg hover:bg-[#1e1e1e] text-muted hover:text-foreground transition-colors">
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
            </svg>
          </button>
        </div>
      </div>

      {/* Month stats */}
      <div className="flex items-center justify-between mb-4">
        <span className="text-sm text-muted">
          {tradingDays} {t("cal_trading_days")}
        </span>
        <span className={`text-sm font-semibold ${monthPnl >= 0 ? "text-profit" : "text-loss"}`}>
          {monthPnl >= 0 ? "+" : ""}{monthPnl.toFixed(2)} €
        </span>
      </div>

      {/* Day names */}
      <div className="grid grid-cols-7 gap-px mb-px">
        {dayNames.map((name) => (
          <div key={name} className="text-center text-xs font-medium text-muted py-2">
            {name}
          </div>
        ))}
      </div>

      {/* Calendar grid */}
      <div className="grid grid-cols-7 gap-px">
        {Array.from({ length: totalCells }, (_, i) => {
          const dayNum = i - startOffset + 1;
          const isCurrentMonth = dayNum >= 1 && dayNum <= daysInMonth;
          const displayNum = !isCurrentMonth
            ? dayNum < 1
              ? prevMonthLast + dayNum
              : dayNum - daysInMonth
            : dayNum;

          const data = isCurrentMonth ? dayMap[dayNum.toString()] : undefined;
          const hasTrades = !!data && data.count > 0;
          const isPositive = hasTrades && data.pnl >= 0;
          const isSelected = selectedDay === dayNum.toString() && isCurrentMonth;

          const bgColor = !isCurrentMonth
            ? "bg-[#0c0c0c]"
            : hasTrades
              ? isPositive
                ? "bg-[#0a2e0a]"
                : "bg-[#2e0a0a]"
              : "bg-[#141414]";

          return (
            <button
              key={i}
              onClick={() => {
                if (isCurrentMonth && hasTrades) {
                  setSelectedDay(isSelected ? null : dayNum.toString());
                }
              }}
              className={`relative p-1.5 sm:p-2 min-h-[56px] sm:min-h-[72px] rounded-lg border transition-all duration-200 text-left ${bgColor} ${
                isSelected
                  ? "border-accent ring-1 ring-accent"
                  : "border-[#1e1e1e]"
              } ${isCurrentMonth && hasTrades ? "cursor-pointer hover:border-[#3a3a3a]" : "cursor-default"}`}
            >
              <span
                className={`text-xs sm:text-sm font-medium ${
                  !isCurrentMonth
                    ? "text-[#333]"
                    : hasTrades
                      ? isPositive
                        ? "text-profit"
                        : "text-loss"
                      : "text-muted"
                }`}
              >
                {displayNum}
              </span>

              {hasTrades && (
                <div className="mt-0.5">
                  <p className={`text-[10px] sm:text-xs font-semibold ${isPositive ? "text-profit" : "text-loss"}`}>
                    {data.pnl >= 0 ? "+" : ""}{data.pnl.toFixed(0)}€
                  </p>
                  <p className="text-[9px] sm:text-[10px] text-muted mt-0.5 flex items-center gap-0.5">
                    <svg className="w-2.5 h-2.5 inline-block flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 10h16M4 14h16M4 18h16" />
                    </svg>
                    {data.count}
                  </p>
                </div>
              )}
            </button>
          );
        })}
      </div>

      {/* Day detail panel */}
      {selectedDayData && selectedDay && (
        <div className="mt-4 p-4 bg-[#0f0f0f] border border-[#1e1e1e] rounded-lg animate-in fade-in duration-200">
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-sm font-semibold text-foreground">
              {selectedDay} {monthNames[month]} — {selectedDayData.count} trade{selectedDayData.count > 1 ? "s" : ""}
            </h3>
            <span className={`text-sm font-bold ${selectedDayData.pnl >= 0 ? "text-profit" : "text-loss"}`}>
              {selectedDayData.pnl >= 0 ? "+" : ""}{selectedDayData.pnl.toFixed(2)} €
            </span>
          </div>
          <div className="space-y-1.5">
            {selectedDayData.trades.map((tr, i) => (
              <div key={i} className="flex items-center justify-between py-1 border-b border-[#1e1e1e] last:border-0">
                <div className="flex items-center gap-2">
                  <span className="text-foreground text-sm font-medium">{tr.pair}</span>
                  <span className={`px-1.5 py-0.5 rounded text-[10px] font-medium ${tr.direction === "long" ? "bg-profit/10 text-profit" : "bg-loss/10 text-loss"}`}>
                    {tr.direction?.toUpperCase()}
                  </span>
                </div>
                <span className={`text-sm font-medium ${tr.pnl >= 0 ? "text-profit" : "text-loss"}`}>
                  {tr.pnl >= 0 ? "+" : ""}{tr.pnl.toFixed(2)} €
                </span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
