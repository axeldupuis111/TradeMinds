"use client";

/**
 * KpiCardPremium — carte KPI direction artistique "Terminal de précision".
 *
 * Deux modes :
 * - layout="kpi"  (défaut) : slots prédéfinis label / value / sublabel / visual
 * - layout="full"          : shell premium seul. children gèrent toute la structure.
 *
 * Dark : fond dégradé profond, sheen supérieur, double aura colorée, ombre deep.
 * Light : dégradé clair-sur-clair, ombre colorée teintée, pas d'aura.
 * Hover : lift translateY(-4px) via .kpi-premium.
 *
 * accentColor détermine :
 *  • la teinte de l'aura radial-gradient (dark only)
 *  • la couleur du halo extérieur (box-shadow dynamique)
 */

import { cn } from "@/lib/cn";
import { useTheme } from "@/lib/ThemeContext";

export type AccentColor = "cyan" | "green" | "amber" | "violet" | "loss";

// RGB channels (space-separated) pour le radial-gradient d'aura interne — dark only.
// On utilise des var() CSS pour bénéficier des overrides html.light automatiquement.
const AURA_TOKEN: Record<AccentColor, string> = {
  cyan:   "var(--accent-glow)",
  green:  "var(--profit)",
  amber:  "var(--accent-amber-glow)",
  violet: "var(--accent-violet-glow)",
  loss:   "var(--loss)",
};

// Halo extérieur dans box-shadow : couleur RGBA hardcodée par thème
// (pas de var() ici car on construit une string pour la propriété boxShadow)
const OUTER_GLOW_DARK: Record<AccentColor, string> = {
  cyan:   "rgba(0, 229, 208, 0.28)",
  green:  "rgba(52, 211, 153, 0.28)",
  amber:  "rgba(251, 191, 36, 0.34)",
  violet: "rgba(167, 139, 250, 0.22)",
  loss:   "rgba(239, 68, 68, 0.28)",
};
const OUTER_GLOW_LIGHT: Record<AccentColor, string> = {
  cyan:   "rgba(0, 168, 172, 0.25)",
  green:  "rgba(22, 163, 74, 0.20)",
  amber:  "rgba(217, 119, 6, 0.28)",
  violet: "rgba(124, 58, 237, 0.18)",
  loss:   "rgba(220, 38, 38, 0.22)",
};

export interface KpiCardPremiumProps {
  /**
   * "kpi"  → slots standard (label / value / sublabel / visual). Par défaut.
   * "full" → shell premium seul. Tout le contenu passe dans children.
   */
  layout?: "kpi" | "full";
  label?: string;
  value?: React.ReactNode;
  sublabel?: React.ReactNode;
  trend?: "up" | "down" | "neutral";
  accentColor?: AccentColor;
  /**
   * "hero"    → aura intense (card signature pleine largeur Score)
   * "default" → aura discrète (cards secondaires)
   */
  intensity?: "hero" | "default";
  visual?: React.ReactNode;
  badge?: React.ReactNode;
  className?: string;
  children?: React.ReactNode;
}

export function KpiCardPremium({
  layout = "kpi",
  label,
  value,
  sublabel,
  trend,
  accentColor = "cyan",
  intensity = "default",
  visual,
  badge,
  className,
  children,
}: KpiCardPremiumProps) {
  const { theme } = useTheme();
  const isDark = theme !== "light";

  // Configuration d'aura selon le rôle de la card
  const aura = intensity === "hero"
    ? {
        primaryEllipse:   "100% 80%",
        primaryPos:       "85% 0%",
        primaryOpacity:   0.38,
        secondaryEllipse: "50% 40%",
        secondaryPos:     "0% 100%",
        secondaryOpacity: 0.12,
      }
    : {
        primaryEllipse:   "60% 50%",
        primaryPos:       "95% -5%",
        primaryOpacity:   0.18,
        secondaryEllipse: "30% 25%",
        secondaryPos:     "0% 100%",
        secondaryOpacity: 0.06,
      };

  // Amber boost — luminosité visuelle plus basse que cyan/violet, compense par opacité renforcée.
  // Uniquement amber : les autres couleurs restent inchangées.
  if (accentColor === "amber") {
    aura.primaryOpacity   = intensity === "hero" ? 0.46 : 0.28;
    aura.secondaryOpacity = intensity === "hero" ? 0.12 : 0.10;
  }

  // Box-shadow dynamique selon l'accent et le thème
  const outerGlow = isDark ? OUTER_GLOW_DARK[accentColor] : OUTER_GLOW_LIGHT[accentColor];
  const boxShadow = isDark
    ? `0 30px 70px -20px rgba(0,0,0,.95), inset 0 0 0 1px rgba(255,255,255,.025), 0 0 80px -20px ${outerGlow}`
    : `0 20px 50px -20px ${outerGlow}, 0 4px 12px -2px rgba(0,0,0,.06)`;

  return (
    <div
      className={cn(
        "kpi-premium relative overflow-hidden rounded-xl cursor-default",
        isDark ? "border border-white/[0.08]" : "border border-border",
        className
      )}
      style={{
        background: `linear-gradient(160deg, rgb(var(--card-grad-top)) 0%, rgb(var(--card-grad-bot)) 100%)`,
        boxShadow,
      }}
    >
      {/* Sheen — top highlight line */}
      <div
        className="absolute top-0 inset-x-0 h-[2px] pointer-events-none z-20"
        style={{ background: `var(--sheen)` }}
      />

      {/* Double aura — intensité selon `intensity`. Dark only. */}
      {isDark && (
        <div
          className="absolute inset-0 pointer-events-none z-0"
          style={{
            background: [
              `radial-gradient(ellipse ${aura.primaryEllipse} at ${aura.primaryPos}, rgb(${AURA_TOKEN[accentColor]} / ${aura.primaryOpacity}) 0%, transparent 70%)`,
              `radial-gradient(ellipse ${aura.secondaryEllipse} at ${aura.secondaryPos}, rgb(${AURA_TOKEN[accentColor]} / ${aura.secondaryOpacity}) 0%, transparent 60%)`,
            ].join(", "),
          }}
        />
      )}

      {/* ── Content ─────────────────────────────────────────────────────── */}

      {layout === "full" ? (
        /* Full layout — children gèrent toute la structure interne */
        <div className="relative z-10 p-5">
          {children}
        </div>
      ) : (
        /* KPI layout — slots prédéfinis */
        <div className="relative z-10 p-5">

          {/* Label — uppercase, tracké, muted */}
          {label && (
            <p
              className="text-[10px] font-semibold uppercase text-foreground-muted mb-3 leading-none"
              style={{ letterSpacing: "0.12em" }}
            >
              {label}
            </p>
          )}

          {/* Rangée principale : valeur + visual */}
          <div className="flex items-start justify-between gap-3">

            {/* Gauche : valeur + sublabel */}
            <div className="flex-1 min-w-0">
              <div className="text-2xl font-black tabular-nums text-foreground leading-none">
                {value}
              </div>

              {/* Sublabel + flèche de tendance */}
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

            {/* Droite : slot visual (ScoreRing, WinRateGauge, Sparkline, icône…) */}
            {visual && (
              <div className="shrink-0 flex-none">
                {visual}
              </div>
            )}
          </div>

          {/* Badge */}
          {badge && <div className="mt-3">{badge}</div>}

          {/* Children supplémentaires (barres de progression, liens…) */}
          {children && <div className="mt-3 space-y-1.5">{children}</div>}

        </div>
      )}
    </div>
  );
}
