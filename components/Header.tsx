"use client";

import { OPEN_CMDK_EVENT } from "@/components/CommandPalette";
import LanguageSelector from "@/components/LanguageSelector";
import ThemeToggle from "@/components/ThemeToggle";
import { useLanguage } from "@/lib/LanguageContext";
import { usePlan } from "@/lib/PlanContext";
import { createClient } from "@/lib/supabase/client";
import { Search } from "lucide-react";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useState } from "react";

const planBadgeStyles: Record<string, string> = {
  free: "bg-surface text-muted",
  plus: "bg-accent/20 text-accent",
};

const PAGE_KEYS: Record<string, string> = {
  "/dashboard":            "header_page_dashboard",
  "/dashboard/session":    "header_page_session",
  "/dashboard/trades":     "header_page_trades",
  "/dashboard/sizer":      "sidebar_sizer",
  "/dashboard/strategy":   "header_page_strategy",
  "/dashboard/challenge":  "header_page_challenge",
  "/dashboard/analysis":   "header_page_analysis",
  "/dashboard/analytics":  "header_page_analytics",
  "/dashboard/goals":      "sidebar_goals",
  "/dashboard/review":     "sidebar_review",
  "/dashboard/leaderboard": "sidebar_leaderboard",
  "/dashboard/settings":   "header_page_settings",
  "/dashboard/upgrade":    "header_page_upgrade",
};

export default function Header({ onMenuToggle }: { onMenuToggle: () => void }) {
  const { t } = useLanguage();
  const { plan, loading } = usePlan();
  const router = useRouter();
  const pathname = usePathname();
  const supabase = createClient();

  const pageKey = PAGE_KEYS[pathname] || "header_page_dashboard";

  // Raccourci affiché selon la plateforme (⌘K sur Mac, Ctrl K ailleurs)
  const [shortcutLabel, setShortcutLabel] = useState("Ctrl K");
  useEffect(() => {
    if (typeof navigator !== "undefined" && /Mac|iPhone|iPad/.test(navigator.platform)) {
      setShortcutLabel("⌘K");
    }
  }, []);

  async function handleSignOut() {
    await supabase.auth.signOut();
    router.push("/login");
    router.refresh();
  }

  return (
    <header className="h-14 bg-card/70 backdrop-blur-xl border-b border-border/70 flex items-center justify-between px-5 shrink-0 relative z-[60]">
      {/* Left: hamburger (mobile) + breadcrumb */}
      <div className="flex items-center gap-3">
        <button
          onClick={onMenuToggle}
          className="lg:hidden text-muted hover:text-foreground transition-colors"
          aria-label="Menu"
        >
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M4 6h16M4 12h16M4 18h16" />
          </svg>
        </button>

        {/* Breadcrumb */}
        <div className="flex items-center gap-2 text-sm">
          <span className="text-muted hidden sm:inline">TradeDiscipline</span>
          <svg className="w-3.5 h-3.5 text-muted/40 hidden sm:inline" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M8.25 4.5l7.5 7.5-7.5 7.5" />
          </svg>
          <span className="font-medium text-foreground text-[13px]">{t(pageKey)}</span>
        </div>
      </div>

      {/* Right: search (Ctrl+K), language, theme, plan badge, signout */}
      <div className="flex items-center gap-2">
        <button
          onClick={() => window.dispatchEvent(new Event(OPEN_CMDK_EVENT))}
          className="hidden md:flex items-center gap-2 h-8 px-2.5 rounded-lg border border-border bg-surface/60 text-muted hover:text-foreground hover:border-accent/30 transition-colors"
          aria-label={t("cmdk_open_button")}
        >
          <Search className="w-3.5 h-3.5" strokeWidth={1.75} />
          <span className="text-xs">{t("cmdk_open_button")}</span>
          <kbd className="px-1.5 py-0.5 rounded border border-border bg-background text-[10px] font-medium leading-none">
            {shortcutLabel}
          </kbd>
        </button>
        <button
          onClick={() => window.dispatchEvent(new Event(OPEN_CMDK_EVENT))}
          className="md:hidden flex items-center justify-center w-8 h-8 rounded-lg text-muted hover:text-foreground hover:bg-white/5 transition-colors"
          aria-label={t("cmdk_open_button")}
        >
          <Search className="w-4 h-4" strokeWidth={1.75} />
        </button>
        <LanguageSelector />
        <ThemeToggle />

        {!loading && (
          <span className={`hidden sm:inline px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider ${planBadgeStyles[plan] || planBadgeStyles.free}`}>
            {plan === "plus" ? t("plan_plus") : plan === "premium" ? t("plan_premium") : t("plan_free")}
          </span>
        )}

        {/* Sign out icon button with tooltip */}
        <div className="relative group">
          <button
            onClick={handleSignOut}
            className="flex items-center justify-center w-8 h-8 rounded-lg text-muted hover:text-foreground hover:bg-white/5 transition-colors"
            aria-label={t("header_signout")}
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M15.75 9V5.25A2.25 2.25 0 0013.5 3h-6a2.25 2.25 0 00-2.25 2.25v13.5A2.25 2.25 0 007.5 21h6a2.25 2.25 0 002.25-2.25V15M12 9l-3 3m0 0l3 3m-3-3h12.75" />
            </svg>
          </button>
          <div className="absolute right-0 top-full mt-1.5 hidden group-hover:block bg-surface border border-border rounded-lg px-2.5 py-1.5 text-xs text-foreground whitespace-nowrap shadow-lg z-50">
            {t("header_signout")}
          </div>
        </div>
      </div>
    </header>
  );
}
