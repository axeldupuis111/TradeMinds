"use client";

/**
 * WeeklyRecap — bilan de la semaine en cours vs semaine précédente.
 *
 * Calcule côté client à partir des trades (déjà filtrés par compte) :
 * P&L net, nombre de trades, winrate, profit factor — avec delta visuel
 * par rapport à la semaine précédente, + meilleur trade de la semaine.
 *
 * Semaine = lundi 00:00 → dimanche (heure locale).
 */

import { KpiCardPremium } from "@/components/dashboard/KpiCardPremium";
import ShareCardModal from "@/components/dashboard/ShareCardModal";
import { CardHeader, CardTitle } from "@/components/ui/Card";
import { useLanguage } from "@/lib/LanguageContext";
import { cn } from "@/lib/cn";
import { CalendarRange, Share2, Sparkles, TrendingDown, TrendingUp } from "lucide-react";
import { useMemo, useState } from "react";

interface RecapTrade {
  open_time: string;
  pnl: number;
  commission: number | null;
  swap: number | null;
  pair: string;
}

interface WeekStats {
  pnl: number;
  count: number;
  winrate: number | null;      // null si 0 trade
  profitFactor: number | null; // null si pas de perte (ou 0 trade)
  best: { pnl: number; pair: string } | null;
}

function netPnl(t: { pnl: number; commission: number | null; swap: number | null }) {
  return t.pnl + (t.commission || 0) + (t.swap || 0);
}

/** Lundi 00:00 (heure locale) de la semaine contenant `d`. */
function mondayOf(d: Date): Date {
  const out = new Date(d.getFullYear(), d.getMonth(), d.getDate());
  const day = out.getDay(); // 0 = dimanche
  out.setDate(out.getDate() - ((day + 6) % 7));
  return out;
}

function computeStats(trades: RecapTrade[]): WeekStats {
  let pnl = 0;
  let wins = 0;
  let grossWin = 0;
  let grossLoss = 0;
  let best: { pnl: number; pair: string } | null = null;

  for (const tr of trades) {
    const net = netPnl(tr);
    pnl += net;
    if (net > 0) {
      wins++;
      grossWin += net;
    } else {
      grossLoss += Math.abs(net);
    }
    if (!best || net > best.pnl) best = { pnl: net, pair: tr.pair };
  }

  return {
    pnl,
    count: trades.length,
    winrate: trades.length > 0 ? (wins / trades.length) * 100 : null,
    profitFactor: grossLoss > 0 ? grossWin / grossLoss : null,
    best,
  };
}

function fmtEur(n: number): string {
  const rounded = Math.round(n);
  if (rounded === 0) return "0€";
  return `${rounded > 0 ? "+" : ""}${rounded.toLocaleString()}€`;
}

/** Petit badge de delta vs semaine précédente. */
function DeltaBadge({ delta, suffix = "", invert = false }: { delta: number | null; suffix?: string; invert?: boolean }) {
  if (delta === null || Math.abs(delta) < 0.005) return null;
  const good = invert ? delta < 0 : delta > 0;
  return (
    <span
      className={cn(
        "inline-flex items-center gap-0.5 text-[10px] font-semibold tabular-nums leading-none",
        good ? "text-profit" : "text-loss"
      )}
    >
      {delta > 0 ? "↑" : "↓"}
      {Math.abs(delta) >= 100 ? Math.round(Math.abs(delta)) : Math.abs(delta).toFixed(Math.abs(delta) >= 10 ? 0 : 1)}
      {suffix}
    </span>
  );
}

/** A short, rule-based "coach's note" on the week — no AI call, instant. */
function weeklyCoachNote(cur: WeekStats, prev: WeekStats, t: (k: string) => string): string {
  if (cur.count === 0) return t("recap_note_no_trades");
  const pnl = fmtEur(cur.pnl);
  if (cur.pnl > 0 && prev.count > 0 && prev.pnl < 0) return t("recap_note_comeback").replace("{pnl}", pnl);
  if (cur.pnl > 0) return t("recap_note_positive").replace("{pnl}", pnl);
  if (cur.pnl < 0) return t("recap_note_negative").replace("{pnl}", pnl);
  return t("recap_note_flat");
}

export default function WeeklyRecap({ trades }: { trades: RecapTrade[] }) {
  const { t } = useLanguage();
  const [shareOpen, setShareOpen] = useState(false);

  const { current, previous } = useMemo(() => {
    const now = new Date();
    const thisMonday = mondayOf(now);
    const prevMonday = new Date(thisMonday);
    prevMonday.setDate(prevMonday.getDate() - 7);

    const cur: RecapTrade[] = [];
    const prev: RecapTrade[] = [];
    for (const tr of trades) {
      const d = new Date(tr.open_time);
      if (d >= thisMonday) cur.push(tr);
      else if (d >= prevMonday) prev.push(tr);
    }
    return { current: computeStats(cur), previous: computeStats(prev) };
  }, [trades]);

  // Rien à montrer : aucune activité sur les 2 semaines
  if (current.count === 0 && previous.count === 0) return null;

  const pnlPositive = current.pnl >= 0;
  const coachNote = weeklyCoachNote(current, previous, t);

  const stats: {
    key: string;
    label: string;
    value: string;
    valueClass?: string;
    delta: React.ReactNode;
  }[] = [
    {
      key: "pnl",
      label: t("recap_pnl"),
      value: fmtEur(current.pnl),
      valueClass: current.pnl > 0 ? "text-profit" : current.pnl < 0 ? "text-loss" : undefined,
      delta: <DeltaBadge delta={previous.count > 0 ? current.pnl - previous.pnl : null} suffix="€" />,
    },
    {
      key: "trades",
      label: t("recap_trades"),
      value: String(current.count),
      delta: <DeltaBadge delta={previous.count > 0 ? current.count - previous.count : null} />,
    },
    {
      key: "winrate",
      label: t("recap_winrate"),
      value: current.winrate !== null ? `${Math.round(current.winrate)}%` : "—",
      delta: (
        <DeltaBadge
          delta={current.winrate !== null && previous.winrate !== null ? current.winrate - previous.winrate : null}
          suffix="pt"
        />
      ),
    },
    {
      key: "pf",
      label: t("recap_profit_factor"),
      value: current.profitFactor !== null ? current.profitFactor.toFixed(2) : "—",
      delta: (
        <DeltaBadge
          delta={
            current.profitFactor !== null && previous.profitFactor !== null
              ? current.profitFactor - previous.profitFactor
              : null
          }
        />
      ),
    },
  ];

  return (
    <KpiCardPremium layout="full" intensity="default" accentColor={pnlPositive ? "green" : "amber"}>
      <CardHeader>
        <div className="flex items-center gap-2">
          <CalendarRange className="w-4 h-4 text-accent" strokeWidth={1.75} />
          <CardTitle>{t("recap_title")}</CardTitle>
        </div>
        <div className="flex items-center gap-3">
          <span className="text-[10px] text-foreground-muted uppercase tracking-wider">{t("recap_subtitle")}</span>
          {current.count > 0 && (
            <button
              onClick={() => setShareOpen(true)}
              className="inline-flex items-center gap-1.5 h-7 px-2.5 rounded-lg border border-border bg-surface/60 text-xs font-medium text-foreground-muted hover:text-foreground hover:border-accent/30 transition-colors"
              aria-label={t("share_modal_title")}
            >
              <Share2 className="w-3 h-3" strokeWidth={1.75} />
              {t("share_button")}
            </button>
          )}
        </div>
      </CardHeader>

      {current.count === 0 ? (
        <p className="text-sm text-foreground-muted">{t("recap_empty")}</p>
      ) : (
        <>
          {/* 2×2 quand la carte partage la ligne avec le plan de la semaine (lg). */}
          <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-2 2xl:grid-cols-4 gap-3">
            {stats.map((s) => (
              <div key={s.key} className="rounded-lg bg-surface/50 border border-border/60 px-3 py-2.5">
                <p className="text-[10px] font-semibold uppercase tracking-[0.08em] text-foreground-muted leading-none mb-1.5">
                  {s.label}
                </p>
                <div className="flex items-baseline gap-1.5 flex-wrap">
                  <span className={cn("text-lg font-bold tabular-nums leading-none text-foreground", s.valueClass)}>
                    {s.value}
                  </span>
                  {s.delta}
                </div>
              </div>
            ))}
          </div>

          {current.best && (
            <div className="flex items-center gap-2 mt-3 text-xs text-foreground-muted">
              {current.best.pnl >= 0 ? (
                <TrendingUp className="w-3.5 h-3.5 text-profit shrink-0" strokeWidth={1.75} />
              ) : (
                <TrendingDown className="w-3.5 h-3.5 text-loss shrink-0" strokeWidth={1.75} />
              )}
              <span>
                {t("recap_best_trade")}{" "}
                <span className="font-medium text-foreground">{current.best.pair}</span>{" "}
                <span className={cn("font-semibold tabular-nums", current.best.pnl >= 0 ? "text-profit" : "text-loss")}>
                  {fmtEur(current.best.pnl)}
                </span>
              </span>
            </div>
          )}

          {/* Coach's note on the week — rule-based, instant, shareable */}
          <div className="mt-3 flex items-start gap-2 rounded-lg bg-accent/5 border border-accent/15 px-3 py-2">
            <Sparkles className="w-3.5 h-3.5 text-accent shrink-0 mt-0.5" strokeWidth={1.75} />
            <p className="text-xs text-foreground leading-snug">{coachNote}</p>
          </div>
        </>
      )}

      {shareOpen && <ShareCardModal stats={{ ...current, note: coachNote }} onClose={() => setShareOpen(false)} />}
    </KpiCardPremium>
  );
}
