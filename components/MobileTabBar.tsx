"use client";

/**
 * MobileTabBar — navigation app-like fixée en bas de l'écran (mobile only).
 *
 * Les 4 destinations quotidiennes du trader. Glassmorphism cohérent avec le
 * header, indicateur actif animé (layoutId partagé), safe-area iOS.
 * Masquée à partir de lg (la sidebar prend le relais).
 */

import { useLanguage } from "@/lib/LanguageContext";
import { motion, useReducedMotion } from "framer-motion";
import { BarChart3, LayoutDashboard, ListChecks, Play } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";

const TABS = [
  { href: "/dashboard",           labelKey: "sidebar_dashboard", icon: LayoutDashboard },
  { href: "/dashboard/session",   labelKey: "sidebar_session",   icon: Play },
  { href: "/dashboard/trades",    labelKey: "sidebar_trades",    icon: ListChecks },
  { href: "/dashboard/analytics", labelKey: "sidebar_analytics", icon: BarChart3 },
];

export default function MobileTabBar() {
  const { t } = useLanguage();
  const pathname = usePathname();
  const prefersReduced = useReducedMotion();

  return (
    <nav
      className="lg:hidden fixed bottom-0 inset-x-0 z-40 border-t border-border/70 bg-card/85 backdrop-blur-xl"
      style={{ paddingBottom: "env(safe-area-inset-bottom)" }}
      aria-label="Navigation"
    >
      <div className="grid grid-cols-4">
        {TABS.map((tab) => {
          const active = pathname === tab.href;
          const Icon = tab.icon;
          return (
            <Link
              key={tab.href}
              href={tab.href}
              className={`relative flex flex-col items-center gap-0.5 py-2 transition-colors ${
                active ? "text-accent" : "text-muted hover:text-foreground"
              }`}
            >
              {active && (
                <motion.span
                  layoutId="mobile-tab-indicator"
                  className="absolute top-0 inset-x-4 h-0.5 rounded-full bg-accent"
                  transition={prefersReduced ? { duration: 0 } : { type: "spring", stiffness: 400, damping: 34 }}
                  aria-hidden
                />
              )}
              <Icon className="w-5 h-5" strokeWidth={active ? 2 : 1.75} />
              <span className="text-[10px] font-medium leading-none">{t(tab.labelKey)}</span>
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
