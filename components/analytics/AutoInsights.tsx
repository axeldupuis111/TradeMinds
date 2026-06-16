"use client";

import { useMemo } from "react";
import { motion, useReducedMotion } from "framer-motion";
import {
  TrendingUp,
  TrendingDown,
  AlertTriangle,
  Target,
  Clock,
  Calendar,
} from "lucide-react";
import { generateInsights, type Insight } from "@/lib/analytics/insights";
import type { AnalyticsTrade } from "@/lib/analytics/types";
import { useLanguage } from "@/lib/LanguageContext";
import { cn } from "@/lib/cn";

type Props = { trades: AnalyticsTrade[] };

// ─── Icon map ─────────────────────────────────────────────────────────────────

const ICON_MAP = {
  "trending-up": TrendingUp,
  "trending-down": TrendingDown,
  "alert-triangle": AlertTriangle,
  target: Target,
  clock: Clock,
  calendar: Calendar,
} as const;

const SEVERITY_CLASS = {
  positive: "text-profit",
  negative: "text-loss",
  neutral: "text-accent",
} as const;

// ─── Description renderer ─────────────────────────────────────────────────────
// Splits on [[value]] markers and wraps them in a bold span.

function renderDescription(desc: string) {
  const parts = desc.split(/(\[\[.*?\]\])/);
  return parts.map((part, i) => {
    if (part.startsWith("[[") && part.endsWith("]]")) {
      return (
        <span key={i} className="text-foreground font-semibold">
          {part.slice(2, -2)}
        </span>
      );
    }
    return <span key={i}>{part}</span>;
  });
}

// ─── Single insight row ───────────────────────────────────────────────────────

function InsightRow({
  insight,
  index,
  reduced,
}: {
  insight: Insight;
  index: number;
  reduced: boolean | null;
}) {
  const Icon = ICON_MAP[insight.icon];
  const iconCls = SEVERITY_CLASS[insight.severity];

  return (
    <motion.div
      initial={reduced ? {} : { opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.22, ease: "easeOut", delay: index * 0.05 }}
      className={cn("py-3", index > 0 && "border-t border-border/40")}
    >
      <div className="flex items-start gap-3">
        <Icon
          className={cn("w-[18px] h-[18px] shrink-0 mt-0.5", iconCls)}
          strokeWidth={1.75}
        />
        <div className="min-w-0">
          <p className="text-sm font-medium text-foreground leading-snug">
            {insight.title}
          </p>
          <p className="text-xs text-foreground-muted mt-0.5 leading-relaxed">
            {renderDescription(insight.description)}
          </p>
        </div>
      </div>
    </motion.div>
  );
}

// ─── Main component ───────────────────────────────────────────────────────────

export function AutoInsights({ trades }: Props) {
  const { t } = useLanguage();
  const reduced = useReducedMotion();
  const insights = useMemo(() => generateInsights(trades, t), [trades, t]);

  if (insights.length === 0) {
    return (
      <div className="flex items-center justify-center py-8 px-2">
        <p className="text-foreground-muted text-sm text-center leading-relaxed">
          {t("insights_empty")}
        </p>
      </div>
    );
  }

  return (
    <div>
      {insights.slice(0, 4).map((insight, i) => (
        <InsightRow
          key={insight.id}
          insight={insight}
          index={i}
          reduced={reduced}
        />
      ))}
    </div>
  );
}
