"use client";

import LanguageSelector from "@/components/LanguageSelector";
import { useLanguage } from "@/lib/LanguageContext";
import { usePlan } from "@/lib/PlanContext";
import { createClient } from "@/lib/supabase/client";
import { useRouter } from "next/navigation";

const planBadgeStyles: Record<string, string> = {
  free: "bg-[#2a2a2a] text-muted",
  plus: "bg-accent/20 text-accent",
  premium: "bg-yellow-500/20 text-yellow-400",
};

export default function Header({ onMenuToggle }: { onMenuToggle: () => void }) {
  const { t } = useLanguage();
  const { plan, loading } = usePlan();
  const router = useRouter();
  const supabase = createClient();

  async function handleSignOut() {
    await supabase.auth.signOut();
    router.push("/login");
    router.refresh();
  }

  return (
    <header className="h-14 bg-card border-b border-border flex items-center justify-between px-5">
      <div className="flex items-center gap-3">
        <button
          onClick={onMenuToggle}
          className="lg:hidden text-muted hover:text-foreground"
        >
          <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M4 6h16M4 12h16M4 18h16" />
          </svg>
        </button>
        <span className="text-sm font-semibold text-foreground lg:hidden">TradeMinds</span>
      </div>

      <div className="flex items-center gap-3">
        {!loading && (
          <span className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider ${planBadgeStyles[plan] || planBadgeStyles.free}`}>
            {plan}
          </span>
        )}
        <LanguageSelector />
        <button
          onClick={handleSignOut}
          className="text-sm text-muted hover:text-foreground transition-colors"
        >
          {t("header_signout")}
        </button>
      </div>
    </header>
  );
}
