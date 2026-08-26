"use client";

import NavItem from "@/components/sidebar/NavItem";
import InstallAppButton from "@/components/InstallAppButton";
import { useLanguage } from "@/lib/LanguageContext";
import { usePlan } from "@/lib/PlanContext";
import { countLockedFeatures } from "@/lib/plan-features";
import {
  Lock,
  Activity,
  BarChart3,
  Calculator,
  CalendarCheck,
  CalendarClock,
  Flag,
  Globe2,
  LayoutDashboard,
  ListChecks,
  Play,
  Settings,
  Sparkles,
  Target,
  Trophy,
  Users,
  Wallet,
  Zap,
  History,
  LineChart,
} from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import type { LucideIcon } from "lucide-react";

// requiredPlan = plan minimum pour utiliser la page (mur d'upgrade en dessous).
// Doit refléter le gating réel des pages : review → isPaid, macro → premium.
type GatePlan = "plus" | "premium";

const tradingItems: { key: string; href: string; icon: LucideIcon; requiredPlan?: GatePlan }[] = [
  { key: "sidebar_dashboard", href: "/dashboard",          icon: LayoutDashboard },
  { key: "sidebar_session",   href: "/dashboard/session",  icon: Play },
  { key: "sidebar_sizer",     href: "/dashboard/sizer",    icon: Calculator },
  { key: "sidebar_trades",    href: "/dashboard/trades",   icon: ListChecks },
  { key: "sidebar_challenge", href: "/dashboard/challenge", icon: Wallet },
];

const analyseItems: { key: string; href: string; icon: LucideIcon; requiredPlan?: GatePlan }[] = [
  { key: "sidebar_strategy",  href: "/dashboard/strategy",  icon: Target },
  { key: "sidebar_analysis",  href: "/dashboard/analysis",  icon: Sparkles },
  { key: "sidebar_analytics", href: "/dashboard/analytics", icon: BarChart3 },
  { key: "sidebar_calendar",  href: "/dashboard/calendar",  icon: CalendarClock },
  { key: "sidebar_macro",     href: "/dashboard/macro",     icon: Globe2, requiredPlan: "premium" },
  { key: "sidebar_projection", href: "/dashboard/projection", icon: LineChart, requiredPlan: "premium" },
  { key: "sidebar_backtest", href: "/dashboard/backtest", icon: History, requiredPlan: "premium" },
  { key: "sidebar_goals",     href: "/dashboard/goals",     icon: Flag, requiredPlan: "plus" },
  { key: "sidebar_review",    href: "/dashboard/review",    icon: CalendarCheck, requiredPlan: "plus" },
  { key: "sidebar_leaderboard", href: "/dashboard/leaderboard", icon: Trophy },
  { key: "sidebar_community", href: "/dashboard/community", icon: Users },
];

const PLAN_RANK: Record<string, number> = { free: 0, plus: 1, premium: 2 };

const planBadgeClass: Record<string, string> = {
  free:    "bg-surface text-muted",
  plus:    "bg-accent/20 text-accent shadow-[0_0_8px_rgb(var(--accent)/0.3)]",
  premium: "bg-gold/20 text-gold shadow-[0_0_8px_rgb(var(--gold)/0.3)]",
};

// La carte de plan prend la teinte du plan : or pour Premium, accent pour
// Plus — un petit rappel visuel du statut, cohérent avec le badge.
const planCardClass: Record<string, string> = {
  free:    "bg-background border-border",
  plus:    "bg-accent/[0.04] border-accent/25",
  premium: "bg-gold/[0.05] border-gold/30",
};

export default function Sidebar({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { t } = useLanguage();
  const { plan, loading } = usePlan();
  const router = useRouter();

  const showUpgrade = !loading && plan === "free";
  const badgeClass = planBadgeClass[plan] || planBadgeClass.free;
  const planLabel = plan === "plus" ? t("plan_plus") : plan === "premium" ? t("plan_premium") : t("plan_free");

  // Verrou visible sur les onglets hors plan — pas de badge pendant le
  // chargement pour éviter un flash « verrouillé » chez les abonnés.
  const lockedFor = (required?: GatePlan): GatePlan | undefined =>
    required && !loading && PLAN_RANK[plan] < PLAN_RANK[required] ? required : undefined;

  const lockedCount = loading ? 0 : countLockedFeatures(plan);

  return (
    <>
      {open && (
        <div
          className="fixed inset-0 bg-black/60 backdrop-blur-sm z-40 lg:hidden"
          onClick={onClose}
        />
      )}

      <aside
        className={`fixed top-0 left-0 z-50 h-full w-[240px] bg-card/80 backdrop-blur-xl border-r border-border/70 flex flex-col transition-transform duration-200 lg:translate-x-0 lg:static lg:z-auto ${
          open ? "translate-x-0" : "-translate-x-full"
        }`}
      >
        {/* Logo */}
        <div className="h-14 flex items-center gap-2.5 px-5 border-b border-border">
          <div className="w-6 h-6 flex items-center justify-center rounded-md bg-gradient-to-br from-accent to-teal-500 shadow-sm shadow-accent/30">
            <Activity className="w-3.5 h-3.5 text-white" strokeWidth={2.25} />
          </div>
          <span className="text-[15px] font-bold text-foreground tracking-tight">TradeDiscipline</span>
        </div>

        {/* Main nav */}
        <nav className="flex-1 py-4 px-2.5 space-y-4 overflow-y-auto">
          {/* TRADING group */}
          <div>
            <p className="text-[10px] font-semibold text-muted/60 tracking-[0.1em] uppercase px-3 mb-1.5">
              {t("sidebar_group_trading")}
            </p>
            <div className="space-y-0.5">
              {tradingItems.map((item) => (
                <NavItem
                  key={item.href}
                  href={item.href}
                  icon={item.icon}
                  labelKey={item.key}
                  lockedPlan={lockedFor(item.requiredPlan)}
                  onNavigate={onClose}
                />
              ))}
            </div>
          </div>

          {/* Separator */}
          <div className="h-px bg-border mx-1" />

          {/* ANALYSE group */}
          <div>
            <p className="text-[10px] font-semibold text-muted/60 tracking-[0.1em] uppercase px-3 mb-1.5">
              {t("sidebar_group_analyse")}
            </p>
            <div className="space-y-0.5">
              {analyseItems.map((item) => (
                <NavItem
                  key={item.href}
                  href={item.href}
                  icon={item.icon}
                  labelKey={item.key}
                  lockedPlan={lockedFor(item.requiredPlan)}
                  onNavigate={onClose}
                />
              ))}
            </div>
          </div>
        </nav>

        {/* Bottom section */}
        <div className="px-2.5 pb-3 space-y-0.5">
          <div className="h-px bg-border mx-1 mb-2" />

          <p className="text-[10px] font-semibold text-muted/60 tracking-[0.1em] uppercase px-3 mb-1.5">
            {t("sidebar_group_compte")}
          </p>

          <NavItem
            href="/dashboard/settings"
            icon={Settings}
            labelKey="sidebar_settings"
            onNavigate={onClose}
          />

          {/* Install the PWA — renders nothing if already installed / unsupported */}
          <InstallAppButton className="flex w-full items-center gap-3 px-3 py-[10px] rounded-lg text-sm font-medium text-muted hover:text-foreground hover:bg-surface transition-colors" />

          {showUpgrade && (
            <Link
              href="/dashboard/upgrade"
              onClick={onClose}
              className="flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-semibold bg-gradient-to-r from-accent to-purple-600 text-white hover:from-accent-hover hover:to-purple-700 transition-all shadow-md shadow-accent/20"
            >
              <Zap className="w-5 h-5 icon-pulse shrink-0" strokeWidth={1.75} />
              {t("sidebar_upgrade")}
            </Link>
          )}

          {/* Plan badge */}
          {loading ? (
            <div className="mt-3 mx-1 p-3 bg-background border border-border rounded-xl">
              <div className="flex items-center justify-between mb-2">
                <div className="h-3 w-20 bg-surface animate-pulse rounded" />
                <div className="h-4 w-14 bg-surface animate-pulse rounded-full" />
              </div>
              <div className="h-3 w-28 bg-surface/50 animate-pulse rounded" />
            </div>
          ) : (
            <div className={`mt-3 mx-1 p-3 border rounded-xl ${planCardClass[plan] || planCardClass.free}`}>
              <div className="flex items-center justify-between mb-2">
                <p className="text-xs text-muted">{t("sidebar_current_plan")}</p>
                <span className={`text-xs font-bold uppercase tracking-wider px-2 py-0.5 rounded-full ${badgeClass}`}>
                  {planLabel}
                </span>
              </div>
              <button
                onClick={() => { onClose(); router.push("/dashboard/upgrade"); }}
                className="text-xs text-muted hover:text-accent transition-colors"
              >
                {t("sidebar_plan_manage")}
              </button>
              {lockedCount > 0 && (
                <Link
                  href="/dashboard/upgrade"
                  onClick={onClose}
                  className="mt-2 flex items-center gap-1.5 text-xs font-medium text-gold hover:underline"
                >
                  <Lock className="w-3 h-3 shrink-0" strokeWidth={2} />
                  {t("sidebar_locked_count").replace("{n}", String(lockedCount))}
                </Link>
              )}
            </div>
          )}
        </div>
      </aside>
    </>
  );
}
