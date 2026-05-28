"use client";

import { Card, CardHeader, CardTitle } from "@/components/ui/Card";
import { useLanguage } from "@/lib/LanguageContext";
import {
  AlertTriangle,
  CheckCircle2,
  Lightbulb,
  Sparkles,
  type LucideIcon,
} from "lucide-react";
import Link from "next/link";

// ─── Icon mapping (by insight source order: pattern → recommendation → strength) ──

interface InsightStyle {
  Icon: LucideIcon;
  bg: string;
  text: string;
}

const INSIGHT_STYLES: InsightStyle[] = [
  { Icon: Lightbulb,     bg: "bg-accent/10",   text: "text-accent"   }, // 0: pattern
  { Icon: AlertTriangle, bg: "bg-warning/10",   text: "text-warning"  }, // 1: recommendation
  { Icon: CheckCircle2,  bg: "bg-profit/10",    text: "text-profit"   }, // 2: strength
  { Icon: Lightbulb,     bg: "bg-accent/10",    text: "text-accent"   }, // 3+: default
];

// ─── Props ────────────────────────────────────────────────────────────────────

export interface AiInsightsProps {
  insights: string[];
  filteredAllLength: number;
}

// ─── Component ────────────────────────────────────────────────────────────────

export function AiInsights({ insights, filteredAllLength }: AiInsightsProps) {
  const { t } = useLanguage();

  return (
    <Card padding="md">
      <CardHeader>
        <div className="flex items-center gap-2">
          <Sparkles className="w-4 h-4 text-accent" strokeWidth={1.5} />
          <CardTitle>{t("dash_insights_title")}</CardTitle>
        </div>
        <Link href="/dashboard/analysis" className="text-xs text-accent hover:underline shrink-0">
          {t("dash_insights_see_all")}
        </Link>
      </CardHeader>

      {insights.length > 0 ? (
        <div className="space-y-2.5">
          {insights.map((ins, i) => {
            const style = INSIGHT_STYLES[Math.min(i, INSIGHT_STYLES.length - 1)];
            const { Icon, bg, text } = style;
            return (
              <div
                key={i}
                className="flex items-start gap-3 p-3 rounded-lg bg-surface border border-border"
              >
                <div className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0 ${bg}`}>
                  <Icon className={`w-4 h-4 ${text}`} strokeWidth={1.75} />
                </div>
                <p className="text-sm text-foreground-muted leading-relaxed">{ins}</p>
              </div>
            );
          })}
        </div>
      ) : filteredAllLength > 0 ? (
        <div className="space-y-3">
          <p className="text-sm text-foreground-muted">
            {t("dash_insights_has_trades").replace("{count}", String(filteredAllLength))}
          </p>
          <Link
            href="/dashboard/analysis"
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-accent/10 border border-accent/20 text-accent text-xs font-medium hover:bg-accent/15 transition-colors"
          >
            {t("dash_action_analyze")} →
          </Link>
        </div>
      ) : (
        <div className="space-y-3">
          <p className="text-sm text-foreground-muted">{t("dash_insights_no_trades")}</p>
          <Link
            href="/dashboard/trades"
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-surface border border-border text-foreground-muted text-xs font-medium hover:text-foreground hover:border-muted transition-colors"
          >
            {t("dash_action_import")} →
          </Link>
        </div>
      )}
    </Card>
  );
}
