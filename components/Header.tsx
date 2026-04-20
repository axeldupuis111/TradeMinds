"use client";

import LanguageSelector from "@/components/LanguageSelector";
import { useLanguage } from "@/lib/LanguageContext";
import { usePlan } from "@/lib/PlanContext";
import { createClient } from "@/lib/supabase/client";
import { usePathname, useRouter } from "next/navigation";

const planBadgeStyles: Record<string, string> = {
  free: "bg-[#2a2a2a] text-muted",
  plus: "bg-accent/20 text-accent",
};

const PAGE_KEYS: Record<string, string> = {
  "/dashboard":            "header_page_dashboard",
  "/dashboard/session":    "header_page_session",
  "/dashboard/trades":     "header_page_trades",
  "/dashboard/strategy":   "header_page_strategy",
  "/dashboard/challenge":  "header_page_challenge",
  "/dashboard/analysis":   "header_page_analysis",
  "/dashboard/analytics":  "header_page_analytics",
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

  async function handleSignOut() {
    await supabase.auth.signOut();
    router.push("/login");
    router.refresh();
  }

  return (
    <header className="h-14 bg-[#111113] border-b border-[#1c1c1e] flex items-center justify-between px-5 shrink-0">
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
          <span className="text-muted hidden sm:inline">TradeMinds</span>
          <svg className="w-3.5 h-3.5 text-muted/40 hidden sm:inline" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M8.25 4.5l7.5 7.5-7.5 7.5" />
          </svg>
          <span className="font-medium text-foreground text-[13px]">{t(pageKey)}</span>
        </div>
      </div>

      {/* Right: language, plan badge, signout */}
      <div className="flex items-center gap-2">
        <LanguageSelector />

        {!loading && (
          <span className={`hidden sm:inline px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider ${planBadgeStyles[plan] || planBadgeStyles.free}`}>
            {plan}
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
          <div className="absolute right-0 top-full mt-1.5 hidden group-hover:block bg-[#1a1a1a] border border-[#2a2a2a] rounded-lg px-2.5 py-1.5 text-xs text-foreground whitespace-nowrap shadow-lg z-50">
            {t("header_signout")}
          </div>
        </div>
      </div>
    </header>
  );
}
