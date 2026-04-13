"use client";

import { useLanguage } from "@/lib/LanguageContext";
import { usePlan } from "@/lib/PlanContext";
import Link from "next/link";
import { usePathname } from "next/navigation";

const navItems = [
  {
    key: "sidebar_dashboard",
    href: "/dashboard",
    icon: <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-4 0a1 1 0 01-1-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 01-1 1h-2z" /></svg>,
  },
  {
    key: "sidebar_trades",
    href: "/dashboard/trades",
    icon: <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M4 6h16M4 10h16M4 14h16M4 18h16" /></svg>,
  },
  {
    key: "sidebar_strategy",
    href: "/dashboard/strategy",
    icon: <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>,
  },
  {
    key: "sidebar_challenge",
    href: "/dashboard/challenge",
    icon: <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M5 3l3.057-3 3.943 3H5zm4 6V7H7v2H4l1 12h8l1-12h-5zm2-4H7l1-2h2l1 2z" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 21v-6m-3 6h6" /></svg>,
  },
  {
    key: "sidebar_analysis",
    href: "/dashboard/analysis",
    icon: <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" /></svg>,
  },
  {
    key: "sidebar_analytics",
    href: "/dashboard/analytics",
    icon: <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" /></svg>,
  },
];

export default function Sidebar({
  open,
  onClose,
}: {
  open: boolean;
  onClose: () => void;
}) {
  const { t } = useLanguage();
  const { plan } = usePlan();
  const pathname = usePathname();
  const showUpgrade = plan === "free" || plan === "plus";

  return (
    <>
      {open && (
        <div
          className="fixed inset-0 bg-black/50 z-40 lg:hidden"
          onClick={onClose}
        />
      )}

      <aside
        className={`fixed top-0 left-0 z-50 h-full w-60 bg-card border-r border-border flex flex-col transition-transform duration-200 lg:translate-x-0 lg:static lg:z-auto ${
          open ? "translate-x-0" : "-translate-x-full"
        }`}
      >
        <div className="h-14 flex items-center px-5 border-b border-border">
          <span className="text-lg font-bold text-foreground">TradeMinds</span>
        </div>

        <nav className="flex-1 py-4 px-3 space-y-1">
          {navItems.map((item) => {
            const active = pathname === item.href;
            return (
              <Link
                key={item.href}
                href={item.href}
                onClick={onClose}
                className={`flex items-center gap-3 px-3 py-2 rounded-lg text-sm transition-colors ${
                  active
                    ? "bg-accent/10 text-accent"
                    : "text-muted hover:text-foreground hover:bg-border/50"
                }`}
              >
                {item.icon}
                {t(item.key)}
              </Link>
            );
          })}

          {/* Upgrade link */}
          {showUpgrade && (
            <>
              <div className="h-px bg-[#1e1e1e] my-2" />
              <Link
                href="/dashboard/upgrade"
                onClick={onClose}
                className={`flex items-center gap-3 px-3 py-2 rounded-lg text-sm transition-colors ${
                  pathname === "/dashboard/upgrade"
                    ? "bg-yellow-500/10 text-yellow-400"
                    : "text-yellow-400/70 hover:text-yellow-400 hover:bg-yellow-500/10"
                }`}
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M11.049 2.927c.3-.921 1.603-.921 1.902 0l1.519 4.674a1 1 0 00.95.69h4.915c.969 0 1.371 1.24.588 1.81l-3.976 2.888a1 1 0 00-.363 1.118l1.518 4.674c.3.922-.755 1.688-1.538 1.118l-3.976-2.888a1 1 0 00-1.176 0l-3.976 2.888c-.783.57-1.838-.197-1.538-1.118l1.518-4.674a1 1 0 00-.363-1.118l-3.976-2.888c-.784-.57-.38-1.81.588-1.81h4.914a1 1 0 00.951-.69l1.519-4.674z" />
                </svg>
                {t("sidebar_upgrade")}
              </Link>
            </>
          )}
        </nav>
      </aside>
    </>
  );
}
