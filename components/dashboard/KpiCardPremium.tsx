"use client";

/**
 * KpiCardPremium — carte KPI direction artistique "Terminal de précision".
 *
 * Dark mode : fond en dégradé profond, sheen supérieur, aura colorée dans
 * le coin, ombre portée deep. Hover : lift translateY(-4px).
 * Light mode : dégradé subtil clair-sur-clair, ombre colorée teintée,
 * pas d'aura (rend sale sur fond clair).
 */

import { cn } from "@/lib/cn";
import { useTheme } from "@/lib/ThemeContext";

export type AccentColor = "cyan" | "green" | "amber";

// CSS token to use for aura radial gradient (RGB channels, space-separated)
const AURA_TOKEN: Record<AccentColor, string> = {
  cyan:  "var(--accent-glow)",
  green: "var(--profit)",
  amber: "var(--warning)",
};

export interface KpiCardPremiumProps {
  label: string;
  value: React.ReactNode;
  sublabel?: React.ReactNode;
  trend?: "up" | "down" | "neutral";
  accentColor?: AccentColor;
  visual?: React.ReactNode;
  badge?: React.ReactNode;
  className?: string;
  children?: React.ReactNode;
}

export function KpiCardPremium({
  label,
  value,
  sublabel,
  trend,
  accentColor = "cyan",
  visual,
  badge,
  className,
  children,
}: KpiCardPremiumProps) {
  const { theme } = useTheme();
  const isDark = theme !== "light";

  return (
    <div
      className={cn(
        "kpi-premium relative overflow-hidden rounded-xl cursor-default",
        isDark ? "border border-white/[0.08]" : "border border-border",
        className
      )}
      style={{
        background: `linear-gradient(160deg, rgb(var(--card-grad-top)) 0%, rgb(var(--card-grad-bot)) 100%)`,
        boxShadow: `var(--glow-shadow)`,
      }}
    >
      {/* Sheen — top highlight line (bright in dark, subtle inner shadow in light) */}
      <div
        className="absolute top-0 inset-x-0 h-px pointer-events-none z-20"
        style={{ background: `var(--sheen)` }}
      />

      {/* Aura — radial glow in top-right corner, dark mode only */}
      {isDark && (
        <div
          className="absolute inset-0 pointer-events-none z-0"
          style={{
            background: `radial-gradient(ellipse 80% 60% at 90% 5%, rgb(${AURA_TOKEN[accentColor]} / 0.18) 0%, transparent 70%)`,
          }}
        />
      )}

      {/* Content */}
      <div className="relative z-10 p-5">

        {/* Label — uppercase, tracked, muted */}
        <p
          className="text-[10px] font-semibold uppercase text-foreground-muted mb-3 leading-none"
          style={{ letterSpacing: "0.12em" }}
        >
          {label}
        </p>

        {/* Main row: value + visual */}
        <div className="flex items-start justify-between gap-3">

          {/* Left: value + sublabel */}
          <div className="flex-1 min-w-0">
            {/* Value — consumer sets content (CountUp etc.) */}
            <div className="text-2xl font-black tabular-nums text-foreground leading-none">
              {value}
            </div>

            {/* Sublabel + trend arrow */}
            {(sublabel != null || trend) && (
              <div className="flex items-center gap-1 mt-2">
                {trend === "up" && (
                  <span className="text-profit text-[11px] font-bold leading-none">↑</span>
                )}
                {trend === "down" && (
                  <span className="text-loss text-[11px] font-bold leading-none">↓</span>
                )}
                {trend === "neutral" && (
                  <span className="text-warning text-[11px] font-bold leading-none">→</span>
                )}
                {sublabel != null && (
                  <p className="text-xs text-foreground-muted leading-snug truncate">
                    {sublabel}
                  </p>
                )}
              </div>
            )}
          </div>

          {/* Right: visual slot (ScoreRing, WinRateGauge, Sparkline, icon…) */}
          {visual && (
            <div className="shrink-0 flex-none">
              {visual}
            </div>
          )}
        </div>

        {/* Badge */}
        {badge && <div className="mt-3">{badge}</div>}

        {/* Extra children (progress bars, links…) */}
        {children && <div className="mt-3 space-y-1.5">{children}</div>}

      </div>
    </div>
  );
}
