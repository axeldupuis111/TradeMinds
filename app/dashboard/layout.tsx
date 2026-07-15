"use client";

import AmbientBackground from "@/components/dashboard/AmbientBackground";
import CommandPalette from "@/components/CommandPalette";
import Header from "@/components/Header";
import HelpWidget from "@/components/dashboard/HelpWidget";
import MobileTabBar from "@/components/MobileTabBar";
import OnboardingGuide from "@/components/dashboard/OnboardingGuide";
import Sidebar from "@/components/Sidebar";
import AlertCenter from "@/components/dashboard/AlertCenter";
import ChallengeGuardian from "@/components/dashboard/ChallengeGuardian";
import NewsWindowGuard from "@/components/dashboard/NewsWindowGuard";
import SignupAttribution from "@/components/dashboard/SignupAttribution";
import StopTradingGuard from "@/components/dashboard/StopTradingGuard";
import TimezoneSync from "@/components/dashboard/TimezoneSync";
import { SubscriptionBanner } from "@/components/SubscriptionBanner";
import { ActiveAccountProvider } from "@/lib/ActiveAccountContext";
import { AlertsProvider } from "@/lib/AlertsContext";
import { useLanguage } from "@/lib/LanguageContext";
import { createClient } from "@/lib/supabase/client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";

function SessionReminderBanner() {
  const { t } = useLanguage();
  const [show, setShow] = useState(false);
  const pathname = usePathname();
  const supabase = createClient();

  useEffect(() => {
    if (typeof window !== "undefined" && localStorage.getItem("session_reminder_disabled") === "1") return;
    const todayKey = `session_banner_dismissed_${new Date().toISOString().split("T")[0]}`;
    if (typeof window !== "undefined" && localStorage.getItem(todayKey)) return;

    async function check() {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;
      const today = new Date().toISOString().split("T")[0];
      const [{ data: todaySession }, { data: activeSession }] = await Promise.all([
        supabase
          .from("sessions")
          .select("id")
          .eq("user_id", user.id)
          .gte("created_at", today)
          .limit(1)
          .maybeSingle(),
        supabase
          .from("sessions")
          .select("id")
          .eq("user_id", user.id)
          .eq("active", true)
          .limit(1)
          .maybeSingle(),
      ]);
      if (!todaySession && !activeSession) setShow(true);
    }
    check();
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const hideOnPages = ["/dashboard/session", "/dashboard/analysis", "/dashboard/analytics", "/dashboard/strategy", "/dashboard/settings"];
  if (!show || hideOnPages.some((p) => pathname === p)) return null;

  function dismiss() {
    const todayKey = `session_banner_dismissed_${new Date().toISOString().split("T")[0]}`;
    localStorage.setItem(todayKey, "1");
    setShow(false);
  }

  return (
    <div className="flex items-center gap-3 px-4 py-3 bg-accent/10 border-b border-accent/20 text-sm">
      <span className="shrink-0">🎯</span>
      <p className="flex-1 text-foreground">{t("session_banner_text")}</p>
      <Link
        href="/dashboard/session"
        className="shrink-0 text-accent font-semibold hover:underline whitespace-nowrap"
      >
        {t("session_banner_cta")}
      </Link>
      <button onClick={dismiss} className="shrink-0 text-muted hover:text-foreground transition-colors ml-1" aria-label={t("detail_close")}>
        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M6 18L18 6M6 6l12 12" />
        </svg>
      </button>
    </div>
  );
}

function SessionDurationBanner() {
  const [overMinutes, setOverMinutes] = useState<number | null>(null);
  const [limitMinutes, setLimitMinutes] = useState<number | null>(null);
  const { t } = useLanguage();
  const pathname = usePathname();
  const supabase = createClient();

  useEffect(() => {
    let cancelled = false;

    async function check() {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user || cancelled) return;

      const today = new Date().toISOString().split("T")[0];

      // Active session for today
      const { data: session } = await supabase
        .from("sessions")
        .select("id, created_at")
        .eq("user_id", user.id)
        .eq("active", true)
        .gte("created_at", today)
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();

      if (!session || cancelled) {
        setOverMinutes(null);
        setLimitMinutes(null);
        return;
      }

      // Strategy max_session_minutes
      const { data: strat } = await supabase
        .from("strategies")
        .select("max_session_minutes")
        .eq("user_id", user.id)
        .order("created_at", { ascending: true })
        .limit(1)
        .maybeSingle();

      const maxMin = strat?.max_session_minutes ?? null;
      if (!maxMin || maxMin <= 0 || cancelled) {
        setOverMinutes(null);
        setLimitMinutes(null);
        return;
      }

      // Duration — frozen at pause timestamp if paused (localStorage)
      const start = new Date(session.created_at).getTime();
      const pausedRaw =
        typeof window !== "undefined"
          ? localStorage.getItem(`session_paused_${session.id}`)
          : null;
      const end = pausedRaw ? new Date(pausedRaw).getTime() : Date.now();
      const durationMin = Math.max(0, Math.floor((end - start) / 60000));

      if (durationMin >= maxMin) {
        setOverMinutes(durationMin);
        setLimitMinutes(maxMin);
      } else {
        setOverMinutes(null);
        setLimitMinutes(null);
      }
    }

    check();
    const interval = setInterval(check, 30000);
    return () => {
      cancelled = true;
      clearInterval(interval);
    };
  }, [pathname]); // eslint-disable-line react-hooks/exhaustive-deps

  // Hidden on the session page itself (widget already shows it there)
  if (pathname === "/dashboard/session") return null;
  if (overMinutes === null || limitMinutes === null) return null;

  return (
    <div className="flex items-center gap-3 px-4 py-3 bg-orange-500/10 border-b border-orange-500/20 text-sm">
      <span className="shrink-0">⏱️</span>
      <p className="flex-1 text-foreground">
        <span className="font-semibold">{t("session_duration_banner_title")}</span>
        {" · "}
        {t("session_duration_banner_message")
          .replace("{over}", String(overMinutes))
          .replace("{limit}", String(limitMinutes))}
      </p>
      <Link
        href="/dashboard/session"
        className="shrink-0 text-orange-500 font-semibold hover:underline whitespace-nowrap"
      >
        {t("session_duration_banner_cta")}
      </Link>
    </div>
  );
}

// Lien d'évitement clavier : invisible jusqu'au premier Tab, saute la sidebar
// et les bannières pour aller directement au contenu de la page.
function SkipToContent() {
  const { t } = useLanguage();
  return (
    <a
      href="#main-content"
      className="sr-only focus:not-sr-only focus:absolute focus:top-3 focus:left-3 focus:z-[100] focus:px-4 focus:py-2 focus:bg-card focus:border focus:border-accent focus:rounded-lg focus:text-sm focus:font-medium focus:text-foreground"
    >
      {t("a11y_skip_to_content")}
    </a>
  );
}

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const [sidebarOpen, setSidebarOpen] = useState(false);

  return (
    <AlertsProvider>
    <ActiveAccountProvider>
    <div className="flex h-screen overflow-hidden bg-background">
      <SkipToContent />
      <Sidebar open={sidebarOpen} onClose={() => setSidebarOpen(false)} />
      <div className="flex-1 flex flex-col overflow-hidden relative">
        <AmbientBackground />
        <TimezoneSync />
        <SignupAttribution />
        <StopTradingGuard />
        <ChallengeGuardian />
        <NewsWindowGuard />
        <Header onMenuToggle={() => setSidebarOpen(!sidebarOpen)} />
        {/* AlertCenter: unified alert bus (inert until sources push in B2+) */}
        <AlertCenter />
        <SubscriptionBanner />
        <SessionReminderBanner />
        <SessionDurationBanner />
        <main id="main-content" tabIndex={-1} className="flex-1 overflow-y-auto p-6 pb-24 lg:pb-6 focus:outline-none">{children}</main>
      </div>
      <HelpWidget />
      <OnboardingGuide />
      <CommandPalette />
      <MobileTabBar />
    </div>
    </ActiveAccountProvider>
    </AlertsProvider>
  );
}
