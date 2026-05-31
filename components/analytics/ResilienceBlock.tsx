"use client";

import { useMemo, useState } from "react";
import { motion, useReducedMotion } from "framer-motion";
import { Shield, RotateCcw, AlertTriangle } from "lucide-react";
import { KpiCardPremium } from "@/components/dashboard/KpiCardPremium";
import { CardHeader, CardTitle } from "@/components/ui/Card";
import {
  buildDrawdownSeries,
  getMaxDrawdown,
  buildStreaks,
  getStreakStats,
  generateResilienceInsights,
  type ResilienceInsight,
} from "@/lib/analytics/resilience";
import type { AnalyticsTrade } from "@/lib/analytics/types";
import { cn } from "@/lib/cn";

type Props = { trades: AnalyticsTrade[] };

// ─── Helpers ──────────────────────────────────────────────────────────────────

function fmtEur(n: number): string {
  const r = Math.round(Math.abs(n));
  if (r >= 1000) return `${(Math.abs(n) / 1000).toFixed(1)}k€`;
  return `${r}€`;
}

// ─── Zone 1 — Drawdown ────────────────────────────────────────────────────────

function DrawdownZone({ trades }: { trades: AnalyticsTrade[] }) {
  const series = useMemo(() => buildDrawdownSeries(trades), [trades]);
  const maxDD  = useMemo(() => getMaxDrawdown(series), [series]);

  // Current drawdown = last point in the series
  const lastPoint       = series[series.length - 1];
  const currentDrawdown = lastPoint ? lastPoint.drawdown    : 0;
  const currentDDPct    = lastPoint ? lastPoint.drawdownPct : 0;

  return (
    <div className="space-y-4">

      {/* ── Max drawdown ─────────────────────────────────────────────────── */}
      <div>
        <p
          className="text-xs font-semibold uppercase text-foreground-muted leading-none"
          style={{ letterSpacing: "0.12em" }}
        >
          Drawdown max
        </p>
        <p className="mt-2 text-3xl font-bold tabular-nums text-loss leading-none">
          -{fmtEur(maxDD.maxDrawdown)}
        </p>
        <p className="mt-1 text-xs text-foreground-muted tabular-nums">
          {Math.round(maxDD.maxDrawdownPct) === 100 ? (
            <>
              Soit&nbsp;
              <span className="text-loss font-medium">-100&nbsp;%</span>
              &nbsp;du pic
            </>
          ) : (
            <>
              Soit&nbsp;
              <span className="text-loss font-medium">
                -{maxDD.maxDrawdownPct.toFixed(1)}&nbsp;%
              </span>
              &nbsp;du pic
            </>
          )}
        </p>
        {Math.round(maxDD.maxDrawdownPct) === 100 && (
          <p className="text-xs text-loss/80 mt-0.5">
            Drawdown supérieur à ton pic maximum
          </p>
        )}
        {maxDD.recoveryTrades !== null && (
          <p className="mt-1 text-xs text-foreground-muted">
            Récupéré en&nbsp;
            <span className="text-foreground font-semibold tabular-nums">
              {maxDD.recoveryTrades}
            </span>
            &nbsp;trade{maxDD.recoveryTrades !== 1 ? "s" : ""}
          </p>
        )}
        {maxDD.recoveryTrades === null && maxDD.maxDrawdown > 0 && (
          <p className="mt-1 text-xs text-loss/70">Pas encore récupéré</p>
        )}
      </div>

      {/* ── Drawdown actuel — barre de progression ───────────────────────── */}
      <div className="mt-4">
        <div className="flex justify-between items-baseline mb-1.5">
          <p className="text-[10px] uppercase tracking-wider text-foreground-muted">
            Drawdown actuel
          </p>
          <p className="text-xs font-medium" style={{ color: "rgb(var(--foreground))" }}>
            {currentDrawdown === 0 ? "Au pic" : `-${fmtEur(currentDrawdown)}`}
          </p>
        </div>

        <div className="h-2 bg-foreground/5 rounded-full overflow-hidden relative">
          {currentDrawdown > 0 ? (
            <div
              className="absolute top-0 left-0 h-full rounded-full transition-all"
              style={{
                width: `${Math.min(100, maxDD.maxDrawdown > 0 ? (currentDrawdown / maxDD.maxDrawdown) * 100 : 0)}%`,
                background: "linear-gradient(to right, rgb(var(--loss) / 0.4), rgb(var(--loss) / 0.85))",
              }}
            />
          ) : (
            // Au pic : point cyan à droite
            <div className="absolute right-1 top-1/2 -translate-y-1/2 w-1.5 h-1.5 rounded-full bg-accent" />
          )}
        </div>

        <p className="text-[10px] text-foreground-muted mt-1.5">
          {currentDrawdown > 0
            ? Math.round(currentDDPct) === 100
              ? "Soit -100 % du pic"
              : `Soit -${currentDDPct.toFixed(1)} % du pic`
            : "Aucun drawdown en cours"}
        </p>
        {currentDrawdown > 0 && Math.round(currentDDPct) === 100 && (
          <p className="text-[10px] text-loss mt-0.5">
            {lastPoint && lastPoint.cumulative < 0
              ? "Tu es passé sous ton point de départ"
              : "Drawdown supérieur à ton pic maximum"}
          </p>
        )}
      </div>

    </div>
  );
}

// ─── Zone 2 — Streaks ─────────────────────────────────────────────────────────

function StreakBand({
  type,
  length,
  maxLength,
}: {
  type: "win" | "loss";
  length: number;
  maxLength: number;
}) {
  const [hovered, setHovered] = useState(false);
  const width = maxLength > 0 ? `${Math.round((length / maxLength) * 100)}%` : "0%";
  const color = type === "win" ? "rgb(var(--profit))" : "rgb(var(--loss))";

  return (
    <div
      className="relative"
      style={{ width, minWidth: 12 }}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
    >
      <div
        style={{
          height: 12,
          borderRadius: 3,
          background: color,
          opacity: 0.7,
          transition: "opacity 100ms",
          cursor: "default",
          ...(hovered && { opacity: 1 }),
        }}
      />
      {hovered && (
        <div
          style={{
            position: "absolute",
            bottom: 18,
            left: "50%",
            transform: "translateX(-50%)",
            background: "rgb(var(--card))",
            border: "1px solid rgb(var(--border))",
            borderRadius: 6,
            padding: "4px 8px",
            fontSize: 11,
            color,
            whiteSpace: "nowrap",
            zIndex: 10,
            pointerEvents: "none",
          }}
        >
          {length} {type === "win" ? "wins" : "pertes"}
        </div>
      )}
    </div>
  );
}

function StreakZone({ trades }: { trades: AnalyticsTrade[] }) {
  const streaks = useMemo(() => buildStreaks(trades), [trades]);
  const stats   = useMemo(() => getStreakStats(streaks), [streaks]);

  const maxLength = Math.max(stats.longestWin, stats.longestLoss, 1);

  return (
    <div className="flex flex-col gap-4">
      {/* KPIs */}
      <div className="grid grid-cols-2 gap-3">
        <div>
          <p
            className="text-[10px] font-semibold uppercase text-foreground-muted leading-none mb-1.5"
            style={{ letterSpacing: "0.12em" }}
          >
            Série win max
          </p>
          <div className="text-2xl font-black tabular-nums text-profit leading-none">
            {stats.longestWin}
          </div>
        </div>
        <div>
          <p
            className="text-[10px] font-semibold uppercase text-foreground-muted leading-none mb-1.5"
            style={{ letterSpacing: "0.12em" }}
          >
            Série loss max
          </p>
          <div className="text-2xl font-black tabular-nums text-loss leading-none">
            {stats.longestLoss}
          </div>
        </div>
      </div>

      {/* Streak band timeline */}
      {stats.streaks.length > 0 && (
        <div className="flex flex-col gap-1.5">
          <p className="text-[10px] text-foreground-muted/60 select-none">
            Timeline des séries
          </p>
          <div className="flex flex-wrap gap-0.5 items-end" style={{ minHeight: 12 }}>
            {stats.streaks.slice(-30).map((s, i) => (
              <StreakBand
                key={i}
                type={s.type}
                length={s.length}
                maxLength={maxLength}
              />
            ))}
          </div>
        </div>
      )}

      {/* Current streak */}
      {stats.current.type !== "none" && (
        <div className="flex items-center gap-2 text-xs">
          <span className="text-foreground-muted">Série en cours :</span>
          <span
            className={cn(
              "font-semibold tabular-nums",
              stats.current.type === "win" ? "text-profit" : "text-loss"
            )}
          >
            {stats.current.length}×{" "}
            {stats.current.type === "win" ? "✓" : "✗"}
          </span>
        </div>
      )}
    </div>
  );
}

// ─── Zone 3 — Insights ────────────────────────────────────────────────────────

const INSIGHT_ICON = {
  positive: Shield,
  negative: AlertTriangle,
  neutral: RotateCcw,
} as const;

const INSIGHT_COLOR = {
  positive: "text-profit",
  negative: "text-loss",
  neutral:  "text-accent",
} as const;

function InsightRow({
  insight,
  index,
  reduced,
}: {
  insight: ResilienceInsight;
  index: number;
  reduced: boolean | null;
}) {
  const Icon = INSIGHT_ICON[insight.type];

  return (
    <motion.div
      initial={reduced ? {} : { opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.22, ease: "easeOut", delay: index * 0.06 }}
      className={cn("py-3", index > 0 && "border-t border-border/40")}
    >
      <div className="flex items-start gap-3">
        <Icon
          className={cn("w-[18px] h-[18px] shrink-0 mt-0.5", INSIGHT_COLOR[insight.type])}
          strokeWidth={1.75}
        />
        <div className="min-w-0">
          <p className="text-sm font-medium text-foreground leading-snug">
            {insight.title}
          </p>
          <p className="text-xs text-foreground-muted mt-0.5 leading-relaxed">
            {insight.description}
          </p>
        </div>
      </div>
    </motion.div>
  );
}

function InsightsZone({
  insights,
  reduced,
}: {
  insights: ResilienceInsight[];
  reduced: boolean | null;
}) {
  return (
    <div className="flex flex-col gap-1">
      <p
        className="text-[10px] font-semibold uppercase text-foreground-muted leading-none mb-1"
        style={{ letterSpacing: "0.12em" }}
      >
        Analyse comportementale
      </p>

      {insights.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-6 gap-3 opacity-60">
          <RotateCcw className="w-8 h-8 text-foreground-muted" strokeWidth={1.5} />
          <p className="text-xs text-foreground-muted text-center leading-relaxed">
            Continue à trader — des patterns comportementaux apparaîtront ici.
          </p>
        </div>
      ) : (
        <div>
          {insights.map((insight, i) => (
            <InsightRow
              key={insight.id}
              insight={insight}
              index={i}
              reduced={reduced}
            />
          ))}
        </div>
      )}
    </div>
  );
}

// ─── Zone stagger wrapper ─────────────────────────────────────────────────────

function Zone({
  children,
  index,
  reduced,
}: {
  children: React.ReactNode;
  index: number;
  reduced: boolean | null;
}) {
  return (
    <motion.div
      initial={reduced ? {} : { opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.28, ease: "easeOut", delay: index * 0.05 }}
    >
      {children}
    </motion.div>
  );
}

// ─── Main component ───────────────────────────────────────────────────────────

export function ResilienceBlock({ trades }: Props) {
  const reduced  = useReducedMotion();
  const insights = useMemo(() => generateResilienceInsights(trades), [trades]);

  /* ── Empty state ──────────────────────────────────────────────────────── */
  if (trades.length < 20) {
    return (
      <KpiCardPremium layout="full" accentColor="loss">
        <CardHeader>
          <CardTitle>Ta résilience</CardTitle>
          <p className="text-xs text-foreground-muted mt-1">
            Drawdown, séries gagnantes et comportement post-perte
          </p>
        </CardHeader>
        <div className="flex flex-col items-center justify-center py-12 gap-4">
          <Shield
            className="text-foreground-muted"
            style={{ width: 48, height: 48, opacity: 0.3 }}
            strokeWidth={1.5}
          />
          <div className="text-center space-y-1">
            <p className="text-sm text-foreground-muted">
              Pas assez de trades pour analyser ta résilience.
            </p>
            <p className="text-xs text-foreground-muted/60">
              <span className="text-foreground font-semibold tabular-nums">
                {trades.length}
              </span>
              {" / 20 trades"}
            </p>
          </div>
        </div>
      </KpiCardPremium>
    );
  }

  /* ── Full state ───────────────────────────────────────────────────────── */
  return (
    <KpiCardPremium layout="full" accentColor="loss">
      <CardHeader>
        <CardTitle>Ta résilience</CardTitle>
        <p className="text-xs text-foreground-muted mt-1">
          Drawdown, séries gagnantes et comportement post-perte
        </p>
      </CardHeader>

      <div className="grid grid-cols-1 lg:grid-cols-3 lg:divide-x lg:divide-border/40 gap-y-6 lg:gap-y-0">

        {/* Zone 1 — Drawdown */}
        <div className="lg:pr-6">
          <Zone index={0} reduced={reduced}>
            <DrawdownZone trades={trades} />
          </Zone>
        </div>

        {/* Zone 2 — Streaks */}
        <div className="lg:px-6">
          <Zone index={1} reduced={reduced}>
            <StreakZone trades={trades} />
          </Zone>
        </div>

        {/* Zone 3 — Insights */}
        <div className="lg:pl-6">
          <Zone index={2} reduced={reduced}>
            <InsightsZone insights={insights} reduced={reduced} />
          </Zone>
        </div>

      </div>
    </KpiCardPremium>
  );
}
