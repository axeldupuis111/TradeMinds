"use client";

import Header from "@/components/Header";
import Sidebar from "@/components/Sidebar";
import StopTradingGuard from "@/components/dashboard/StopTradingGuard";
import { createClient } from "@/lib/supabase/client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";

function SessionReminderBanner() {
  const [show, setShow] = useState(false);
  const pathname = usePathname();
  const supabase = createClient();

  useEffect(() => {
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

  if (!show || pathname === "/dashboard/session") return null;

  function dismiss() {
    const todayKey = `session_banner_dismissed_${new Date().toISOString().split("T")[0]}`;
    localStorage.setItem(todayKey, "1");
    setShow(false);
  }

  return (
    <div className="flex items-center gap-3 px-4 py-3 bg-accent/10 border-b border-accent/20 text-sm">
      <span className="shrink-0">🎯</span>
      <p className="flex-1 text-foreground">N&apos;oublie pas de préparer ta session avant de trader</p>
      <Link
        href="/dashboard/session"
        className="shrink-0 text-accent font-semibold hover:underline whitespace-nowrap"
      >
        Compléter ma session →
      </Link>
      <button onClick={dismiss} className="shrink-0 text-muted hover:text-foreground transition-colors ml-1" aria-label="Fermer">
        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M6 18L18 6M6 6l12 12" />
        </svg>
      </button>
    </div>
  );
}

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const [sidebarOpen, setSidebarOpen] = useState(false);

  return (
    <div className="flex h-screen overflow-hidden bg-background">
      <Sidebar open={sidebarOpen} onClose={() => setSidebarOpen(false)} />
      <div className="flex-1 flex flex-col overflow-hidden">
        <StopTradingGuard />
        <Header onMenuToggle={() => setSidebarOpen(!sidebarOpen)} />
        <SessionReminderBanner />
        <main className="flex-1 overflow-y-auto p-6">{children}</main>
      </div>
    </div>
  );
}
