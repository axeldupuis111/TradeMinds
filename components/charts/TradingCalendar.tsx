"use client";

import { KpiCardPremium } from "@/components/dashboard/KpiCardPremium";
import { useLanguage } from "@/lib/LanguageContext";
import { useTheme } from "@/lib/ThemeContext";
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
  const { theme } = useTheme();
  const isDark = theme !== "light";
  const [currentDate, setCurrentDate] = useState(() => new Date());
  const [selectedDay, setSelectedDay] = useState<string | null>(null);
  const [hoveredDay, setHoveredDay] = useState<string | null>(null);

  const year = currentDate.getFullYear();
  const month = currentDate.getMonth();

  // Today reference — pour le highlight de la cellule du jour actuel
  const todayRef = new Date();
  const todayYear = todayRef.getFullYear();
  const todayMonth = todayRef.getMonth();
  const todayDay = todayRef.getDate();

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
    <KpiCardPremium layout="full" intensity="default" accentColor="violet">
      {/* Header */}
      <div className="flex items-center justify-between mb-1">
        <div className="flex items-center gap-3">
          <button onClick={prevMonth} className="p-1.5 rounded-lg hover:bg-border text-muted hover:text-foreground transition-colors">
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            </svg>
          </button>
          <h2 className="text-lg font-semibold text-foreground capitalize">
            {monthNames[month]} {year}
          </h2>
          <button onClick={nextMonth} className="p-1.5 rounded-lg hover:bg-border text-muted hover:text-foreground transition-colors">
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
      <div className="grid grid-cols-7 gap-px" onMouseLeave={() => setHoveredDay(null)}>
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
          // Highlight du jour actuel (uniquement si on affiche le bon mois)
          const isToday = isCurrentMonth
            && dayNum === todayDay
            && year === todayYear
            && month === todayMonth;

          const bgColor = !isCurrentMonth
            ? "bg-background/50"
            : hasTrades
              ? isPositive
                ? "bg-profit/10"
                : "bg-loss/10"
              : "bg-surface";

          // Border + glow : selected > today > default
          const borderClass = isSelected
            ? "border-accent ring-1 ring-accent"
            : isToday
              ? "border-accent"
              : "border-border";
          // Halo cyan diffus sur la cellule du jour actuel (désactivé si déjà selected)
          const todayCellStyle = isToday && !isSelected
            ? { boxShadow: "0 0 0 1px rgba(0,212,216,0.55), 0 0 16px -4px rgba(0,212,216,0.40)" }
            : undefined;

          return (
            <button
              key={i}
              onClick={() => {
                if (isCurrentMonth && hasTrades) {
                  setSelectedDay(isSelected ? null : dayNum.toString());
                }
              }}
              className={`relative p-1.5 sm:p-2 min-h-[56px] sm:min-h-[72px] rounded-lg border transition-all duration-200 text-left ${bgColor} ${borderClass} ${isCurrentMonth && hasTrades ? "cursor-pointer hover:border-muted" : "cursor-default"}`}
              style={todayCellStyle}
              onMouseEnter={() => { if (isCurrentMonth && hasTrades) setHoveredDay(dayNum.toString()); }}
              onMouseLeave={() => setHoveredDay(null)}
            >
              <span
                className={`text-xs sm:text-sm font-medium ${
                  !isCurrentMonth
                    ? "text-muted/40"
                    : hasTrades
                      ? isPositive
                        ? "text-profit"
                        : "text-loss"
                      : isToday
                        ? "text-accent font-semibold"
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

      {/* Hover preview panel — in-flow, pas de problème overflow-hidden */}
      {hoveredDay && !selectedDay && dayMap[hoveredDay] && (() => {
        const hd = dayMap[hoveredDay];
        const topPairs = Array.from(new Set(hd.trades.map(tr => tr.pair))).slice(0, 2);
        const hDate = new Date(year, month, parseInt(hoveredDay))
          .toLocaleDateString(undefined, { weekday: "long", day: "numeric", month: "long" });
        return (
          <div
            className="mt-3 flex items-center justify-between gap-3 px-3 py-2 rounded-lg border bg-background animate-in fade-in duration-100"
            style={isDark
              ? { borderColor: "rgba(167,139,250,.25)", boxShadow: "0 0 16px -6px rgba(167,139,250,.28)" }
              : { borderColor: "rgba(124,58,237,.18)" }
            }
          >
            <div className="min-w-0">
              <p className="text-xs text-foreground font-medium capitalize truncate">{hDate}</p>
              <div className="flex items-center gap-1.5 mt-0.5 flex-wrap">
                <span className="text-[10px] text-muted">{hd.count} trade{hd.count > 1 ? "s" : ""}</span>
                {topPairs.map(pair => (
                  <span key={pair} className="text-[9px] px-1 py-0.5 rounded bg-surface border border-border text-foreground-muted">{pair}</span>
                ))}
              </div>
            </div>
            <span className={`text-sm font-bold tabular-nums shrink-0 ${hd.pnl >= 0 ? "text-profit" : "text-loss"}`}>
              {hd.pnl >= 0 ? "+" : ""}{hd.pnl.toFixed(2)} €
            </span>
          </div>
        );
      })()}

      {/* Day detail panel */}
      {selectedDayData && selectedDay && (
        <div className="mt-4 p-4 bg-background border border-border rounded-lg animate-in fade-in duration-200">
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
              <div key={i} className="flex items-center justify-between py-1 border-b border-border last:border-0">
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
    </KpiCardPremium>
  );
}
