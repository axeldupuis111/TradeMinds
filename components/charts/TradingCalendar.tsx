"use client";

import { KpiCardPremium } from "@/components/dashboard/KpiCardPremium";
import { useLanguage } from "@/lib/LanguageContext";
import { useTheme } from "@/lib/ThemeContext";
import { useMemo, useState } from "react";

// ─── Types ────────────────────────────────────────────────────────────────────

interface CalendarTrade {
  open_time: string;
  close_time?: string | null;
  pair: string;
  direction: string;
  pnl: number;
  commission: number | null;
  swap: number | null;
  challenge_id: string | null;
  lot_size?: number | null;
  entry_price?: number | null;
  exit_price?: number | null;
}

interface Props {
  trades: CalendarTrade[];
  selectedAccountId: string | null;
}

interface DayTrade {
  pair: string;
  direction: string;
  pnl: number;       // net (commission + swap already included)
  fees: number;      // commission + swap combined (for display)
  open_time: string;
  close_time: string | null;
  lot_size: number | null;
  entry_price: number | null;
  exit_price: number | null;
}

interface DayData {
  pnl: number;
  count: number;
  trades: DayTrade[];
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function netPnl(t: { pnl: number; commission: number | null; swap: number | null }) {
  return t.pnl + (t.commission || 0) + (t.swap || 0);
}

/** Adapts decimal precision to instrument magnitude */
function fmtPrice(p: number): string {
  if (p >= 10000) return p.toFixed(0);
  if (p >= 100)   return p.toFixed(2);
  if (p >= 1)     return p.toFixed(4);
  return p.toFixed(5);
}

/** ISO timestamp → HH:MM string, or null if invalid/missing */
function fmtTime(iso: string | null | undefined): string | null {
  if (!iso) return null;
  try {
    return new Date(iso).toLocaleTimeString(undefined, { hour: "2-digit", minute: "2-digit" });
  } catch {
    return null;
  }
}

// ─── Component ────────────────────────────────────────────────────────────────

export default function TradingCalendar({ trades, selectedAccountId }: Props) {
  const { t } = useLanguage();
  const { theme } = useTheme();
  const isDark = theme !== "light";
  const [currentDate, setCurrentDate] = useState(() => new Date());
  /** Day locked by click — panel stays visible when mouse leaves */
  const [pinnedDay, setPinnedDay] = useState<string | null>(null);
  /** Day currently under the cursor */
  const [hoveredDay, setHoveredDay] = useState<string | null>(null);

  const year = currentDate.getFullYear();
  const month = currentDate.getMonth();

  const todayRef = new Date();
  const todayYear = todayRef.getFullYear();
  const todayMonth = todayRef.getMonth();
  const todayDay = todayRef.getDate();

  // ── Filter by account ──────────────────────────────────────────────────────
  const filtered = useMemo(() => {
    if (!selectedAccountId) return trades;
    return trades.filter((tr) => tr.challenge_id === selectedAccountId);
  }, [trades, selectedAccountId]);

  // ── Group trades by day ────────────────────────────────────────────────────
  const dayMap = useMemo(() => {
    const map: Record<string, DayData> = {};
    for (const tr of filtered) {
      if (!tr.open_time) continue;
      const d = new Date(tr.open_time);
      if (d.getFullYear() !== year || d.getMonth() !== month) continue;
      const key = d.getDate().toString();
      if (!map[key]) map[key] = { pnl: 0, count: 0, trades: [] };
      const net = netPnl(tr);
      const fees = (tr.commission ?? 0) + (tr.swap ?? 0);
      map[key].pnl += net;
      map[key].count += 1;
      map[key].trades.push({
        pair: tr.pair,
        direction: tr.direction,
        pnl: net,
        fees,
        open_time: tr.open_time,
        close_time: tr.close_time ?? null,
        lot_size: tr.lot_size ?? null,
        entry_price: tr.entry_price ?? null,
        exit_price: tr.exit_price ?? null,
      });
    }
    return map;
  }, [filtered, year, month]);

  // ── Month stats ────────────────────────────────────────────────────────────
  const tradingDays = Object.keys(dayMap).length;
  const monthPnl = Object.values(dayMap).reduce((sum, d) => sum + d.pnl, 0);

  // ── Calendar grid geometry ─────────────────────────────────────────────────
  const firstDay = new Date(year, month, 1);
  const lastDay = new Date(year, month + 1, 0);
  const daysInMonth = lastDay.getDate();
  let startOffset = firstDay.getDay() - 1;
  if (startOffset < 0) startOffset = 6;
  const totalCells = Math.ceil((daysInMonth + startOffset) / 7) * 7;
  const prevMonthLast = new Date(year, month, 0).getDate();

  function prevMonth() {
    setCurrentDate(new Date(year, month - 1, 1));
    setPinnedDay(null);
  }
  function nextMonth() {
    setCurrentDate(new Date(year, month + 1, 1));
    setPinnedDay(null);
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

  // ── Unified display: pinned wins over hovered ──────────────────────────────
  const displayDay = pinnedDay ?? hoveredDay;
  const displayDayData = displayDay ? dayMap[displayDay] : null;

  return (
    <KpiCardPremium layout="full" intensity="default" accentColor="violet">

      {/* ── Header ─────────────────────────────────────────────────────── */}
      <div className="flex items-center justify-between mb-1">
        <div className="flex items-center gap-3">
          <button
            onClick={prevMonth}
            className="p-1.5 rounded-lg hover:bg-border text-muted hover:text-foreground transition-colors"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            </svg>
          </button>
          <h2 className="text-lg font-semibold text-foreground capitalize">
            {monthNames[month]} {year}
          </h2>
          <button
            onClick={nextMonth}
            className="p-1.5 rounded-lg hover:bg-border text-muted hover:text-foreground transition-colors"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
            </svg>
          </button>
        </div>
      </div>

      {/* ── Month stats ─────────────────────────────────────────────────── */}
      <div className="flex items-center justify-between mb-4">
        <span className="text-sm text-muted">
          {tradingDays} {t("cal_trading_days")}
        </span>
        <span className={`text-sm font-semibold ${monthPnl >= 0 ? "text-profit" : "text-loss"}`}>
          {monthPnl >= 0 ? "+" : ""}{monthPnl.toFixed(2)} €
        </span>
      </div>

      {/* ── Day names ───────────────────────────────────────────────────── */}
      <div className="grid grid-cols-7 gap-px mb-px">
        {dayNames.map((name) => (
          <div key={name} className="text-center text-xs font-medium text-muted py-2">
            {name}
          </div>
        ))}
      </div>

      {/* ── Calendar grid ───────────────────────────────────────────────── */}
      <div className="grid grid-cols-7 gap-px" onMouseLeave={() => setHoveredDay(null)}>
        {Array.from({ length: totalCells }, (_, i) => {
          const dayNum = i - startOffset + 1;
          const isCurrentMonth = dayNum >= 1 && dayNum <= daysInMonth;
          const displayNum = !isCurrentMonth
            ? dayNum < 1 ? prevMonthLast + dayNum : dayNum - daysInMonth
            : dayNum;

          const data = isCurrentMonth ? dayMap[dayNum.toString()] : undefined;
          const hasTrades = !!data && data.count > 0;
          const isPositive = hasTrades && data.pnl >= 0;
          const dayKey = dayNum.toString();
          const isPinned = pinnedDay === dayKey && isCurrentMonth;
          const isToday = isCurrentMonth
            && dayNum === todayDay
            && year === todayYear
            && month === todayMonth;

          const bgColor = !isCurrentMonth
            ? "bg-background/50"
            : hasTrades
              ? isPositive ? "bg-profit/10" : "bg-loss/10"
              : "bg-surface";

          // Border: pinned (ring) > today (accent) > default
          // When both pinned+today: ring class layers on top of today glow
          const borderClass = isPinned
            ? "border-accent ring-1 ring-accent/60"
            : isToday
              ? "border-accent"
              : "border-border";

          // Today always gets the cyan glow, even when also pinned
          const cellStyle = isToday
            ? { boxShadow: "0 0 0 1px rgba(0,212,216,0.55), 0 0 16px -4px rgba(0,212,216,0.40)" }
            : undefined;

          const interactiveClass = isCurrentMonth && hasTrades
            ? "cursor-pointer hover:border-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/40"
            : "cursor-default";

          return (
            <button
              key={i}
              tabIndex={isCurrentMonth && hasTrades ? 0 : -1}
              onClick={() => {
                if (!isCurrentMonth) return;
                if (hasTrades) {
                  setPinnedDay(isPinned ? null : dayKey); // toggle pin
                } else {
                  setPinnedDay(null); // empty cell click → depin
                }
              }}
              onKeyDown={(e) => {
                if ((e.key === "Enter" || e.key === " ") && isCurrentMonth && hasTrades) {
                  e.preventDefault();
                  setPinnedDay(isPinned ? null : dayKey);
                }
              }}
              className={`relative p-1.5 sm:p-2 min-h-[56px] sm:min-h-[72px] rounded-lg border transition-all duration-200 text-left ${bgColor} ${borderClass} ${interactiveClass}`}
              style={cellStyle}
              onMouseEnter={() => { if (isCurrentMonth && hasTrades) setHoveredDay(dayKey); }}
              onMouseLeave={() => setHoveredDay(null)}
            >
              <span
                className={`text-xs sm:text-sm font-medium ${
                  !isCurrentMonth
                    ? "text-muted/40"
                    : hasTrades
                      ? isPositive ? "text-profit" : "text-loss"
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

              {/* Pin dot — subtle indicator on pinned cell.
                  Today already has its cyan anneau, so dot only on non-today cells. */}
              {isPinned && !isToday && (
                <span
                  className="absolute top-1 right-1 w-1.5 h-1.5 rounded-full bg-accent"
                  aria-hidden="true"
                />
              )}
            </button>
          );
        })}
      </div>

      {/* ── Unified detail panel ─────────────────────────────────────────── */}
      {/* hover = compact summary  |  pinned = full trade list               */}
      {displayDayData && displayDay && (() => {
        const isPinnedPanel = pinnedDay !== null;
        const panelDate = new Date(year, month, parseInt(displayDay))
          .toLocaleDateString(undefined, { weekday: "long", day: "numeric", month: "long" });
        const topPairs = Array.from(
          new Set(displayDayData.trades.map((tr) => tr.pair))
        ).slice(0, 2);

        return (
          <div
            className="mt-3 rounded-lg border bg-background animate-in fade-in duration-150"
            style={isDark
              ? { borderColor: "rgba(167,139,250,.25)", boxShadow: "0 0 16px -6px rgba(167,139,250,.28)" }
              : { borderColor: "rgba(124,58,237,.18)" }
            }
          >
            {/* Panel header — always visible */}
            <div className="flex items-center justify-between gap-3 px-3 py-2.5">
              <div className="min-w-0">
                <div className="flex items-center gap-1.5">
                  {/* Dot = pinned indicator */}
                  {isPinnedPanel && (
                    <span className="shrink-0 w-1.5 h-1.5 rounded-full bg-accent" aria-hidden="true" />
                  )}
                  <p className="text-xs text-foreground font-medium capitalize truncate">
                    {panelDate}
                  </p>
                </div>
                {/* Hover mode: pairs chips below the date */}
                {!isPinnedPanel && (
                  <div className="flex items-center gap-1 mt-0.5 flex-wrap">
                    <span className="text-[10px] text-muted">
                      {displayDayData.count} trade{displayDayData.count > 1 ? "s" : ""}
                    </span>
                    {topPairs.map((pair) => (
                      <span
                        key={pair}
                        className="text-[9px] px-1 py-0.5 rounded bg-surface border border-border text-foreground-muted"
                      >
                        {pair}
                      </span>
                    ))}
                  </div>
                )}
                {/* Pinned mode: count on second line */}
                {isPinnedPanel && (
                  <span className="text-[10px] text-muted block mt-0.5">
                    {displayDayData.count} trade{displayDayData.count > 1 ? "s" : ""}
                  </span>
                )}
              </div>
              <span className={`text-sm font-bold tabular-nums shrink-0 ${displayDayData.pnl >= 0 ? "text-profit" : "text-loss"}`}>
                {displayDayData.pnl >= 0 ? "+" : ""}{displayDayData.pnl.toFixed(2)} €
              </span>
            </div>

            {/* Detailed trade rows — only when pinned */}
            {isPinnedPanel && (
              <div className="border-t border-border/50 divide-y divide-border/40">
                {displayDayData.trades.map((tr, idx) => {
                  const isLong = tr.direction === "long" || tr.direction === "buy";
                  const openTime = fmtTime(tr.open_time);
                  const closeTime = fmtTime(tr.close_time);
                  const hasPrice = tr.entry_price != null && tr.exit_price != null;
                  const hasLot = tr.lot_size != null && tr.lot_size > 0;
                  const hasFees = tr.fees !== 0;
                  const hasTime = openTime != null;

                  return (
                    <div key={idx} className="px-3 py-2.5">

                      {/* Row 1: pair · direction badge · lot */}
                      <div className="flex items-center gap-1.5 mb-1">
                        <span className="text-sm font-semibold text-foreground">{tr.pair}</span>
                        <span className={`px-1.5 py-0.5 rounded text-[10px] font-medium ${isLong ? "bg-profit/10 text-profit" : "bg-loss/10 text-loss"}`}>
                          {isLong ? "LONG" : "SHORT"}
                        </span>
                        {hasLot && (
                          <span className="text-[10px] text-muted tabular-nums">
                            Lot {tr.lot_size}
                          </span>
                        )}
                      </div>

                      {/* Row 2: entry → exit prices + open/close times (if available) */}
                      {(hasPrice || hasTime) && (
                        <p className="text-[11px] tabular-nums mb-1 leading-snug">
                          {hasPrice && (
                            <>
                              <span className="text-foreground-subtle">E </span>
                              <span className="text-foreground">{fmtPrice(tr.entry_price!)}</span>
                              <span className="text-foreground-subtle mx-1">→</span>
                              <span className="text-foreground-subtle">S </span>
                              <span className="text-foreground">{fmtPrice(tr.exit_price!)}</span>
                            </>
                          )}
                          {hasTime && (
                            <span className="text-foreground-subtle ml-1.5">
                              {hasPrice ? "· " : ""}
                              {openTime}{closeTime ? ` → ${closeTime}` : ""}
                            </span>
                          )}
                        </p>
                      )}

                      {/* Row 3: fees (if non-zero) + net P&L */}
                      <div className="flex items-center gap-2">
                        {hasFees && (
                          <span className="text-[10px] text-foreground-subtle tabular-nums">
                            Frais {tr.fees >= 0 ? "+" : ""}{tr.fees.toFixed(2)}€
                          </span>
                        )}
                        <span className={`text-xs font-semibold tabular-nums ml-auto ${tr.pnl >= 0 ? "text-profit" : "text-loss"}`}>
                          {tr.pnl >= 0 ? "+" : ""}{tr.pnl.toFixed(2)} €
                        </span>
                      </div>

                    </div>
                  );
                })}
              </div>
            )}
          </div>
        );
      })()}

    </KpiCardPremium>
  );
}
