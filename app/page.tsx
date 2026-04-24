"use client";

import LanguageSelector from "@/components/LanguageSelector";
import { useLanguage } from "@/lib/LanguageContext";
import Link from "next/link";
import { useEffect, useRef, useState } from "react";

/* ─────────────────────────────────────────────
   Scroll-reveal helper
───────────────────────────────────────────── */
function useReveal(threshold = 0.1) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const obs = new IntersectionObserver(
      ([e]) => { if (e.isIntersecting) { el.classList.add("revealed"); obs.unobserve(el); } },
      { threshold }
    );
    obs.observe(el);
    return () => obs.disconnect();
  }, [threshold]);
  return ref;
}

function Reveal({ children, className = "", delay = 0 }: { children: React.ReactNode; className?: string; delay?: number }) {
  const ref = useReveal();
  return (
    <div
      ref={ref}
      className={`reveal-on-scroll ${className}`}
      style={delay ? { transitionDelay: `${delay}ms` } : undefined}
    >
      {children}
    </div>
  );
}

/* ─────────────────────────────────────────────
   NAVBAR
───────────────────────────────────────────── */
function Nav() {
  const { t } = useLanguage();
  return (
    <nav className="fixed top-0 left-0 right-0 z-50 border-b border-[#1c1c1e] bg-[#09090b]/80 backdrop-blur-[12px]">
      <div className="max-w-6xl mx-auto px-6 h-14 flex items-center justify-between gap-4">
        {/* Logo */}
        <Link href="/" className="flex items-center gap-2 shrink-0">
          <div className="w-6 h-6 flex items-center justify-center rounded-md bg-accent/20">
            <svg className="w-3.5 h-3.5 text-accent" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 18L9 11.25l4.306 4.307a11.95 11.95 0 015.814-5.519l2.74-1.22m0 0l-5.94-2.28m5.94 2.28l-2.28 5.941" />
            </svg>
          </div>
          <span className="text-[15px] font-bold text-foreground tracking-tight">TradeMinds</span>
        </Link>

        {/* Centre links — desktop only */}
        <div className="hidden md:flex items-center gap-6">
          <a href="#features" className="text-sm text-muted hover:text-foreground transition-colors">{t("nav_features")}</a>
          <a href="#pricing" className="text-sm text-muted hover:text-foreground transition-colors">{t("nav_pricing")}</a>
          <a href="#faq" className="text-sm text-muted hover:text-foreground transition-colors">{t("nav_faq")}</a>
        </div>

        {/* Right CTAs */}
        <div className="flex items-center gap-2">
          <LanguageSelector />
          <Link href="/login" className="hidden sm:inline text-sm text-muted hover:text-foreground transition-colors px-3 py-1.5">
            {t("nav_login")}
          </Link>
          <Link href="/login" className="text-sm px-4 py-1.5 bg-accent text-white rounded-lg font-semibold hover:bg-blue-600 glow-blue btn-scale">
            {t("nav_start")}
          </Link>
        </div>
      </div>
    </nav>
  );
}

/* ─────────────────────────────────────────────
   HERO
───────────────────────────────────────────── */
function Hero() {
  const { t } = useLanguage();
  return (
    <section className="hero-gradient pt-28 pb-20 px-6 overflow-hidden">
      <div className="max-w-4xl mx-auto text-center">
        <Reveal>
          {/* Badge */}
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full border border-accent/20 bg-accent/5 text-xs text-accent font-medium mb-8">
            <span className="w-1.5 h-1.5 rounded-full bg-accent animate-pulse" />
            {t("hero_social_proof")}
          </div>

          <h1 className="text-5xl sm:text-6xl lg:text-7xl font-bold text-foreground leading-[1.05] tracking-tight text-balance">
            {t("hero_title_1")}{" "}
            <span className="text-accent">{t("hero_title_2")}</span>
          </h1>

          <p className="mt-6 text-lg sm:text-xl text-muted max-w-2xl mx-auto leading-relaxed">
            {t("hero_subtitle_v2")}
          </p>

          <div className="mt-10 flex flex-col sm:flex-row items-center justify-center gap-3">
            <Link
              href="/login"
              className="px-8 py-3.5 bg-accent text-white rounded-xl font-semibold text-base hover:bg-blue-600 glow-pulse btn-scale"
            >
              {t("hero_cta")}
            </Link>
            <a
              href="#features"
              className="px-8 py-3.5 bg-white/5 border border-white/10 text-foreground rounded-xl font-semibold text-base hover:bg-white/10 btn-scale"
            >
              {t("hero_features")}
            </a>
          </div>


        </Reveal>

        {/* Dashboard mockup */}
        <Reveal className="mt-16">
          <div
            className="relative rounded-2xl border border-white/[0.08] bg-[#111113] p-5 sm:p-7 shadow-[0_25px_50px_rgba(0,0,0,0.5)]"
            style={{ transform: "perspective(1200px) rotateX(2deg)", transformOrigin: "center bottom" }}
          >
            {/* Blue glow behind */}
            <div className="absolute -inset-4 bg-gradient-to-b from-accent/8 via-transparent to-transparent rounded-3xl blur-2xl -z-10 pointer-events-none" />

            {/* Fake toolbar */}
            <div className="flex items-center gap-1.5 mb-4">
              <span className="w-2.5 h-2.5 rounded-full bg-loss/60" />
              <span className="w-2.5 h-2.5 rounded-full bg-warning/60" />
              <span className="w-2.5 h-2.5 rounded-full bg-profit/60" />
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 sm:gap-4">
              {/* Score circle */}
              <div className="col-span-2 sm:col-span-1 flex flex-col items-center justify-center bg-white/[0.03] rounded-xl p-4 border border-white/5 gap-2">
                <svg width="76" height="76" viewBox="0 0 76 76">
                  <circle cx="38" cy="38" r="32" fill="none" stroke="#1e1e1e" strokeWidth="6" />
                  <circle cx="38" cy="38" r="32" fill="none" stroke="#3b82f6" strokeWidth="6" strokeLinecap="round"
                    strokeDasharray={`${0.78 * 2 * Math.PI * 32} ${2 * Math.PI * 32}`}
                    transform="rotate(-90 38 38)" />
                  <text x="38" y="36" textAnchor="middle" fill="#fafafa" fontSize="17" fontWeight="bold">78</text>
                  <text x="38" y="48" textAnchor="middle" fill="#71717a" fontSize="8">{t("preview_discipline")}</text>
                </svg>
              </div>
              {/* Equity */}
              <div className="col-span-2 sm:col-span-1 bg-white/[0.03] rounded-xl p-4 border border-white/5">
                <p className="text-[10px] text-muted uppercase tracking-wider mb-2">{t("preview_equity")}</p>
                <svg viewBox="0 0 120 45" className="w-full h-11" preserveAspectRatio="none">
                  <defs>
                    <linearGradient id="eq2" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="#22c55e" stopOpacity="0.25" />
                      <stop offset="100%" stopColor="#22c55e" stopOpacity="0" />
                    </linearGradient>
                  </defs>
                  <path d="M0,38 L15,33 L30,36 L45,26 L55,28 L65,20 L80,16 L95,18 L105,10 L120,6" fill="none" stroke="#22c55e" strokeWidth="2" />
                  <path d="M0,38 L15,33 L30,36 L45,26 L55,28 L65,20 L80,16 L95,18 L105,10 L120,6 L120,45 L0,45Z" fill="url(#eq2)" />
                </svg>
              </div>
              {/* Stats */}
              <div className="bg-white/[0.03] rounded-xl p-4 border border-white/5">
                <p className="text-[10px] text-muted uppercase tracking-wider">{t("preview_winrate")}</p>
                <p className="text-xl font-bold text-foreground mt-0.5">62%</p>
                <p className="text-[10px] text-muted uppercase tracking-wider mt-2">{t("preview_trades")}</p>
                <p className="text-xl font-bold text-foreground mt-0.5">31</p>
              </div>
              {/* P&L */}
              <div className="bg-white/[0.03] rounded-xl p-4 border border-white/5">
                <p className="text-[10px] text-muted uppercase tracking-wider">{t("preview_pnl_total")}</p>
                <p className="text-xl font-bold text-profit mt-0.5">+1 840€</p>
                <p className="text-[10px] text-muted uppercase tracking-wider mt-2">{t("preview_challenge")}</p>
                <div className="mt-1.5 h-1.5 bg-[#1a1a1a] rounded-full overflow-hidden">
                  <div className="h-full w-[71%] bg-accent rounded-full" />
                </div>
                <p className="text-[10px] text-muted mt-1">71%</p>
              </div>
            </div>

            {/* Fake trade rows */}
            <div className="mt-4 border-t border-white/5 pt-3 space-y-2">
              {[
                { pair: "EUR/USD", dir: "BUY",  pnl: "+82.50",  win: true  },
                { pair: "GBP/JPY", dir: "SELL", pnl: "-34.20",  win: false },
                { pair: "XAU/USD", dir: "BUY",  pnl: "+156.00", win: true  },
              ].map((tr) => (
                <div key={tr.pair} className="flex items-center gap-3 text-xs">
                  <span className="text-foreground font-medium w-16">{tr.pair}</span>
                  <span className={`px-1.5 py-0.5 rounded text-[10px] font-medium ${tr.dir === "BUY" ? "bg-profit/10 text-profit" : "bg-loss/10 text-loss"}`}>{tr.dir}</span>
                  <div className="flex-1 h-px bg-white/[0.04]" />
                  <span className={`font-semibold tabular-nums ${tr.win ? "text-profit" : "text-loss"}`}>{tr.pnl}€</span>
                </div>
              ))}
            </div>
          </div>
        </Reveal>
      </div>
    </section>
  );
}

/* ─────────────────────────────────────────────
   PROBLEM
───────────────────────────────────────────── */
function Problem() {
  const { t } = useLanguage();
  const problems = [
    { icon: "loss",    bg: "bg-loss/10",    iconColor: "text-loss",    title: t("problem_1_title"), desc: t("problem_1_desc"),
      svg: <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M13 10V3L4 14h7v7l9-11h-7z" /></svg> },
    { icon: "warning", bg: "bg-warning/10", iconColor: "text-warning", title: t("problem_2_title"), desc: t("problem_2_desc"),
      svg: <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" /></svg> },
    { icon: "orange",  bg: "bg-orange-500/10", iconColor: "text-orange-400", title: t("problem_3_title"), desc: t("problem_3_desc"),
      svg: <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M18.364 18.364A9 9 0 005.636 5.636m12.728 12.728L5.636 5.636m12.728 12.728A9 9 0 015.636 5.636" /></svg> },
  ];
  return (
    <section className="py-24 px-6 border-t border-white/5">
      <div className="max-w-5xl mx-auto">
        <Reveal>
          <h2 className="text-3xl sm:text-4xl font-bold text-foreground text-center leading-tight">
            {t("problem_title")}<br />
            <span className="text-muted">{t("problem_subtitle")}</span>
          </h2>
        </Reveal>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mt-14">
          {problems.map((p, i) => (
            <Reveal key={p.title} delay={i * 80}>
              <div className="bg-[#111113] border border-[#1c1c1e] rounded-2xl p-8 hover:border-white/10 hover:bg-[#111113]/80 transition-all h-full">
                <div className={`w-12 h-12 rounded-xl flex items-center justify-center ${p.bg} ${p.iconColor} mb-5`}>
                  {p.svg}
                </div>
                <h3 className="text-xl font-bold text-foreground">{p.title}</h3>
                <p className="text-[#71717a] mt-2 text-sm leading-relaxed line-clamp-3">{p.desc}</p>
              </div>
            </Reveal>
          ))}
        </div>
      </div>
    </section>
  );
}

/* ─────────────────────────────────────────────
   FEATURES — alternating layout with screenshots
───────────────────────────────────────────── */

/* Feature screenshots */
const LANDING_PLATFORMS = ["MT5", "MT4", "cTrader", "Binance", "Bybit", "OKX", "Bitget", "TradingView"];

function ScreenshotImport({ t }: { t: (k: string) => string }) {
  return (
    <div className="feature-screenshot p-5 space-y-3">
      <div className="border-2 border-dashed border-[#2a2a2e] rounded-xl p-6 flex flex-col items-center gap-3 text-center">
        <div className="w-10 h-10 bg-accent/10 rounded-xl flex items-center justify-center text-accent">
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
          </svg>
        </div>
        <div>
          <p className="text-sm text-foreground font-medium">{t("feature_import_drop")}</p>
        </div>
        <div className="w-full">
          <div className="flex items-center gap-2 mb-2">
            <div className="w-5 h-5 bg-accent/10 rounded flex items-center justify-center text-accent">
              <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
              </svg>
            </div>
            <span className="text-xs text-foreground">trades_history.csv</span>
            <span className="ml-auto text-[10px] text-profit font-medium">{t("feature_import_tag")}</span>
          </div>
          <div className="w-full bg-[#1c1c1e] rounded-full h-1">
            <div className="bg-accent h-1 rounded-full w-full" />
          </div>
        </div>
      </div>
      {/* Platform badges */}
      <div>
        <p className="text-[10px] text-muted mb-1.5">{t("feature_import_formats")}</p>
        <div className="flex flex-wrap gap-1">
          {LANDING_PLATFORMS.map((name) => (
            <span key={name} className="px-2 py-0.5 rounded text-[10px] font-medium text-muted/80 border border-[#27272a] bg-[#18181b]">
              {name}
            </span>
          ))}
        </div>
      </div>
    </div>
  );
}

/* Avatars réutilisables */
function AIAvatar() {
  return (
    <div className="w-6 h-6 rounded-full bg-accent/20 shrink-0 flex items-center justify-center">
      <svg className="w-3 h-3 text-accent" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9.813 15.904L9 18.75l-.813-2.846a4.5 4.5 0 00-3.09-3.09L2.25 12l2.846-.813a4.5 4.5 0 003.09-3.09L9 5.25l.813 2.846a4.5 4.5 0 003.09 3.09L15.75 12l-2.846.813a4.5 4.5 0 00-3.09 3.09z" />
      </svg>
    </div>
  );
}
function UserAvatar() {
  return (
    <div className="w-6 h-6 rounded-full bg-white/10 border border-white/10 shrink-0 flex items-center justify-center text-[9px] font-bold text-muted">
      T
    </div>
  );
}

function ScreenshotAI({ t }: { t: (k: string) => string }) {
  const msgs = [
    { side: "ai",   text: t("feature_ai_msg_1"), time: "14:02" },
    { side: "user", text: t("feature_ai_msg_2"), time: "14:03" },
    { side: "ai",   text: t("feature_ai_msg_3"), time: "14:03" },
    { side: "user", text: t("feature_ai_msg_4"), time: "14:04" },
    { side: "ai",   text: t("feature_ai_msg_5"), time: "14:04" },
  ];
  return (
    <div className="feature-screenshot">
      {/* Header */}
      <div className="p-3 border-b border-[#1c1c1e] flex items-center gap-2">
        <AIAvatar />
        <div className="flex-1 min-w-0">
          <span className="text-xs font-semibold text-foreground">{t("feature_ai_coach_label")}</span>
          <p className="text-[10px] text-profit leading-none">● Online</p>
        </div>
      </div>
      {/* Messages */}
      <div className="p-4 space-y-3 max-h-[300px] overflow-y-auto">
        {msgs.map((m, i) => (
          m.side === "ai" ? (
            <div key={i} className="flex gap-2 items-end">
              <AIAvatar />
              <div className="flex flex-col gap-0.5">
                <div className="bg-[#1a1a1a] border border-[#2a2a2a] rounded-xl rounded-bl-sm px-3 py-2 text-xs text-foreground max-w-[85%] leading-relaxed">
                  {m.text}
                </div>
                <span className="text-[9px] text-muted/60 pl-1">{m.time}</span>
              </div>
            </div>
          ) : (
            <div key={i} className="flex gap-2 justify-end items-end">
              <div className="flex flex-col items-end gap-0.5">
                <div className="bg-accent rounded-xl rounded-br-sm px-3 py-2 text-xs text-white max-w-[72%]">
                  {m.text}
                </div>
                <span className="text-[9px] text-muted/60 pr-1">{m.time}</span>
              </div>
              <UserAvatar />
            </div>
          )
        ))}
      </div>
    </div>
  );
}

function ScreenshotScore({ t }: { t: (k: string) => string }) {
  const r = 36, circ = 2 * Math.PI * r;
  const rules = [
    { label: "SL ≤ 1%",        ok: true  },
    { label: "RR ≥ 2:1",       ok: true  },
    { label: "Max 3 trades/j",  ok: false },
    { label: "Trading Plan",    ok: true  },
    { label: "Pas de revanche", ok: false },
  ];
  return (
    <div className="feature-screenshot p-5">
      <div className="flex flex-col items-center gap-4">
        {/* Score ring */}
        <div className="flex items-center gap-6">
          <div className="relative w-24 h-24 shrink-0">
            <svg className="w-24 h-24 -rotate-90" viewBox="0 0 88 88">
              <circle cx="44" cy="44" r={r} fill="none" stroke="#1e1e1e" strokeWidth="7" />
              <circle cx="44" cy="44" r={r} fill="none" stroke="#3b82f6" strokeWidth="7" strokeLinecap="round"
                strokeDasharray={`${0.78 * circ} ${circ}`} />
            </svg>
            <div className="absolute inset-0 flex flex-col items-center justify-center">
              <span className="text-2xl font-bold text-foreground">78</span>
              <span className="text-[9px] text-muted leading-none mt-0.5">{t("preview_discipline")}</span>
            </div>
          </div>
          {/* Rules checklist */}
          <div className="flex-1 space-y-1.5">
            {rules.map((rule) => (
              <div key={rule.label} className="flex items-center gap-2">
                <svg className={`w-3.5 h-3.5 shrink-0 ${rule.ok ? "text-profit" : "text-loss"}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  {rule.ok
                    ? <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" />
                    : <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M6 18L18 6M6 6l12 12" />}
                </svg>
                <span className="text-[10px] text-foreground/80">{rule.label}</span>
              </div>
            ))}
          </div>
        </div>
        {/* Conformes / Violations */}
        <div className="grid grid-cols-2 gap-3 w-full">
          <div className="bg-profit/5 border border-profit/15 rounded-lg p-3 text-center">
            <p className="text-[10px] text-muted">{t("feature_score_conformes")}</p>
            <p className="text-lg font-bold text-profit">18/23</p>
          </div>
          <div className="bg-loss/5 border border-loss/15 rounded-lg p-3 text-center">
            <p className="text-[10px] text-muted">{t("feature_score_violations")}</p>
            <p className="text-lg font-bold text-loss">5</p>
          </div>
        </div>
      </div>
    </div>
  );
}

function ScreenshotChallenge() {
  return (
    <div className="feature-screenshot p-5">
      <div className="flex items-center justify-between mb-4">
        <div>
          <p className="text-sm font-semibold text-foreground">FTMO — 50 000€</p>
          <p className="text-xs text-muted">Compte #12345 · Jour 8</p>
        </div>
        <span className="text-[11px] px-2.5 py-1 bg-accent/10 text-accent rounded-full font-medium">Actif</span>
      </div>
      <div className="space-y-3.5">
        {[
          { label: "Objectif profit (8%)",     val: "+2 840€ / 4 000€", pct: 71, color: "bg-profit"    },
          { label: "Drawdown journalier (5%)", val: "-340€ / 2 500€",  pct: 14, color: "bg-warning"   },
          { label: "Drawdown total (10%)",     val: "-1 160€ / 5 000€",pct: 23, color: "bg-loss/70"   },
        ].map((bar) => (
          <div key={bar.label}>
            <div className="flex justify-between text-[11px] mb-1.5">
              <span className="text-muted">{bar.label}</span>
              <span className="text-foreground font-medium tabular-nums">{bar.val}</span>
            </div>
            <div className="h-2 bg-[#1e1e1e] rounded-full overflow-hidden">
              <div className={`h-full ${bar.color} rounded-full transition-all`} style={{ width: `${bar.pct}%` }} />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function Features() {
  const { t } = useLanguage();

  const features = [
    {
      label: t("feature_1_label"),
      labelColor: "text-accent bg-accent/10",
      title: t("feature_1_title"),
      desc: t("feature_1_desc"),
      screenshot: <ScreenshotImport t={t} />,
    },
    {
      label: t("feature_2_label"),
      labelColor: "text-purple-400 bg-purple-400/10",
      title: t("feature_2_title"),
      desc: t("feature_2_desc"),
      screenshot: <ScreenshotAI t={t} />,
      reverse: true,
    },
    {
      label: t("feature_3_label"),
      labelColor: "text-profit bg-profit/10",
      title: t("feature_3_title"),
      desc: t("feature_3_desc"),
      screenshot: <ScreenshotScore t={t} />,
    },
    {
      label: t("feature_4_label"),
      labelColor: "text-orange-400 bg-orange-400/10",
      title: t("feature_4_title"),
      desc: t("feature_4_desc"),
      screenshot: <ScreenshotChallenge />,
      reverse: true,
    },
  ];

  return (
    <section id="features" className="py-24 px-6 border-t border-white/5">
      <div className="max-w-5xl mx-auto">
        <Reveal>
          <h2 className="text-3xl sm:text-4xl font-bold text-foreground text-center">{t("features_title")}</h2>
        </Reveal>

        <div className="mt-16">
          {features.map((f, idx) => (
            <div key={f.title}>
              {idx > 0 && (
                <div className="flex items-center gap-4 my-14">
                  <div className="flex-1 h-px bg-gradient-to-r from-transparent via-white/10 to-transparent" />
                  <div className="w-6 h-6 rounded-full border border-white/10 flex items-center justify-center shrink-0">
                    <svg className="w-3 h-3 text-muted" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M19 9l-7 7-7-7" />
                    </svg>
                  </div>
                  <div className="flex-1 h-px bg-gradient-to-r from-transparent via-white/10 to-transparent" />
                </div>
              )}
              <Reveal>
                <div className={`flex flex-col ${f.reverse ? "lg:flex-row-reverse" : "lg:flex-row"} items-center gap-10 lg:gap-12`}>
                  {/* Text */}
                  <div className="flex-1 min-w-0">
                    <span className={`inline-block text-[11px] font-bold tracking-widest px-2.5 py-1 rounded-md mb-4 ${f.labelColor}`}>
                      {f.label}
                    </span>
                    <h3 className="text-2xl sm:text-3xl font-bold text-foreground">{f.title}</h3>
                    <p className="text-muted mt-4 leading-relaxed">{f.desc}</p>
                  </div>
                  {/* Arrow connector — desktop only */}
                  <div className="hidden lg:flex items-center justify-center shrink-0">
                    <svg
                      className="w-6 h-6 text-accent/40"
                      fill="none" stroke="currentColor" viewBox="0 0 24 24"
                      style={{ transform: f.reverse ? "scaleX(-1)" : undefined }}
                    >
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 5l7 7-7 7" />
                    </svg>
                  </div>
                  {/* Screenshot */}
                  <div className="w-full lg:w-[400px] shrink-0">
                    {f.screenshot}
                  </div>
                </div>
              </Reveal>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

/* ─────────────────────────────────────────────
   AI DETECTION
───────────────────────────────────────────── */
function AIDetection() {
  const { t } = useLanguage();
  const detections = [
    { text: t("ai_detect_1"), color: "text-loss",    bg: "bg-loss/5",    border: "border-loss/15",    icon: "🔥" },
    { text: t("ai_detect_2"), color: "text-profit",  bg: "bg-profit/5",  border: "border-profit/15",  icon: "⏰" },
    { text: t("ai_detect_3"), color: "text-warning", bg: "bg-warning/5", border: "border-warning/15", icon: "⚠️" },
    { text: t("ai_detect_4"), color: "text-purple-400", bg: "bg-purple-400/5", border: "border-purple-400/15", icon: "📊" },
  ];
  return (
    <section className="py-24 px-6 border-t border-white/5 bg-[#0c0c0e]">
      <div className="max-w-5xl mx-auto">
        <Reveal className="text-center mb-14">
          <h2 className="text-3xl sm:text-4xl font-bold text-foreground">{t("ai_detect_title")}</h2>
          <p className="text-muted mt-3 max-w-2xl mx-auto">{t("hero_subtitle_v2")}</p>
        </Reveal>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {detections.map((d, idx) => (
            <Reveal key={idx} delay={idx * 60}>
              <div className={`${d.bg} border ${d.border} rounded-2xl p-6 flex items-start gap-4 hover:scale-[1.01] transition-transform`}>
                <div className="w-10 h-10 rounded-xl flex items-center justify-center bg-white/5 text-xl shrink-0 icon-pulse">
                  {d.icon}
                </div>
                <p className="text-foreground text-sm leading-relaxed">{d.text}</p>
              </div>
            </Reveal>
          ))}
        </div>
      </div>
    </section>
  );
}

/* ─────────────────────────────────────────────
   SOCIAL PROOF / TESTIMONIALS
───────────────────────────────────────────── */
function SocialProof() {
  const { t } = useLanguage();
  const testimonials = [
    { text: t("testimonial_1_text"), author: t("testimonial_1_author"), initials: "T" },
    { text: t("testimonial_2_text"), author: t("testimonial_2_author"), initials: "S" },
    { text: t("testimonial_3_text"), author: t("testimonial_3_author"), initials: "M" },
  ];
  return (
    <section className="py-24 px-6 border-t border-white/5 bg-[#0c0c0e]">
      <div className="max-w-5xl mx-auto">
        <Reveal className="text-center mb-12">
          <h2 className="text-3xl sm:text-4xl font-bold text-foreground">{t("social_title")}</h2>
          {/* Social proof mini-cards */}
          <div className="flex flex-col sm:flex-row items-center justify-center gap-4 mt-6">
            <div className="flex flex-col items-center px-6 py-4 bg-white/[0.03] border border-white/[0.08] rounded-2xl min-w-[140px]">
              <span className="text-3xl font-bold text-foreground tabular-nums">500+</span>
              <span className="text-xs text-muted mt-1">{t("social_stat_1_label")}</span>
            </div>
            <div className="flex flex-col items-center px-6 py-4 bg-white/[0.03] border border-white/[0.08] rounded-2xl min-w-[140px]">
              <span className="text-3xl font-bold text-foreground tabular-nums">10 000+</span>
              <span className="text-xs text-muted mt-1">{t("social_stat_2_label")}</span>
            </div>
            <div className="flex flex-col items-center px-6 py-4 bg-white/[0.03] border border-white/[0.08] rounded-2xl min-w-[140px]">
              <div className="flex items-center gap-1">
                <span className="text-3xl font-bold text-foreground tabular-nums">4.8</span>
                <span className="text-xl font-bold text-gold">/5</span>
              </div>
              <div className="flex gap-0.5 mt-0.5">
                {Array.from({ length: 5 }).map((_, s) => (
                  <svg key={s} className="w-3 h-3 text-gold" fill="currentColor" viewBox="0 0 24 24">
                    <path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z" />
                  </svg>
                ))}
              </div>
              <span className="text-xs text-muted mt-1">{t("social_stat_3_label")}</span>
            </div>
          </div>
        </Reveal>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {testimonials.map((tm, i) => (
            <Reveal key={i} delay={i * 80}>
              <div className="bg-[#111113] border border-[#1c1c1e] rounded-2xl p-6 flex flex-col hover:border-white/10 transition-all h-full">
                {/* Stars */}
                <div className="flex gap-1 mb-4">
                  {Array.from({ length: 5 }).map((_, s) => (
                    <svg key={s} className="w-3.5 h-3.5 text-gold" fill="currentColor" viewBox="0 0 24 24">
                      <path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z" />
                    </svg>
                  ))}
                </div>
                <p className="text-[#c4c4c4] text-sm leading-relaxed italic flex-1">&ldquo;{tm.text}&rdquo;</p>
                <div className="flex items-center gap-3 mt-5">
                  <div className="w-8 h-8 rounded-full bg-accent/20 border border-accent/30 flex items-center justify-center text-accent text-xs font-bold shrink-0">
                    {tm.initials}
                  </div>
                  <p className="text-muted text-xs font-medium">{tm.author}</p>
                </div>
              </div>
            </Reveal>
          ))}
        </div>
      </div>
    </section>
  );
}

/* ─────────────────────────────────────────────
   HOW IT WORKS
───────────────────────────────────────────── */
function HowItWorks() {
  const { t } = useLanguage();
  const steps = [
    { num: "1", title: t("how_1_title"), desc: t("how_1_desc") },
    { num: "2", title: t("how_2_title"), desc: t("how_2_desc") },
    { num: "3", title: t("how_3_title"), desc: t("how_3_desc") },
  ];
  return (
    <section className="py-24 px-6 border-t border-white/5">
      <div className="max-w-4xl mx-auto">
        <Reveal>
          <h2 className="text-3xl sm:text-4xl font-bold text-foreground text-center">{t("how_title")}</h2>
        </Reveal>
        <div className="relative grid grid-cols-1 md:grid-cols-3 gap-8 mt-16">
          {/* Connecting line */}
          <div className="hidden md:block absolute top-8 left-[calc(16.66%+28px)] right-[calc(16.66%+28px)] h-px bg-gradient-to-r from-accent/20 via-accent/40 to-accent/20" />
          {steps.map((s, i) => (
            <Reveal key={s.num} delay={i * 100} className="text-center">
              <div className="w-14 h-14 mx-auto flex items-center justify-center rounded-2xl bg-gradient-to-br from-accent to-blue-700 text-white text-2xl font-bold shadow-lg shadow-accent/20 relative z-10">
                {s.num}
              </div>
              <h3 className="text-lg font-bold text-foreground mt-5">{s.title}</h3>
              <p className="text-muted mt-2 text-sm leading-relaxed">{s.desc}</p>
            </Reveal>
          ))}
        </div>
      </div>
    </section>
  );
}

/* ─────────────────────────────────────────────
   PREMIUM COMING SOON CARD
───────────────────────────────────────────── */
function PremiumComingSoon({ t }: { t: (k: string) => string }) {
  const [email, setEmail] = useState("");
  const [status, setStatus] = useState<"idle" | "loading" | "success" | "duplicate" | "error">("idle");

  async function handleNotify() {
    const trimmed = email.trim();
    if (!trimmed) return;
    setStatus("loading");
    try {
      const res = await fetch("/api/waitlist", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: trimmed }),
      });
      const data = await res.json();
      if (data.duplicate) setStatus("duplicate");
      else if (res.ok) setStatus("success");
      else setStatus("error");
    } catch {
      setStatus("error");
    }
  }

  return (
    <div className="relative bg-[#111113] border border-[#1c1c1e] rounded-2xl p-7 flex flex-col h-full">
      {/* Overlay */}
      <div className="absolute inset-0 rounded-2xl bg-[#09090b]/60 backdrop-blur-[1px] z-10 flex flex-col items-center justify-center gap-3">
        <span className="text-2xl">🔒</span>
        <span className="bg-[#1e1e1e] border border-[#2a2a2a] text-muted text-[11px] font-bold px-3 py-1 rounded-full">
          {t("plan_premium_coming")}
        </span>
        {status === "success" ? (
          <p className="text-profit text-xs font-medium text-center px-4">{t("pricing_notify_success")}</p>
        ) : status === "duplicate" ? (
          <p className="text-orange-400 text-xs text-center px-4">{t("pricing_notify_duplicate")}</p>
        ) : (
          <div className="flex gap-2 px-4 w-full max-w-xs">
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              onKeyDown={(e) => { if (e.key === "Enter") handleNotify(); }}
              placeholder="email@exemple.com"
              className="flex-1 min-w-0 px-3 py-2 bg-[#1a1a1a] border border-[#27272a] rounded-xl text-foreground text-xs placeholder-muted focus:outline-none focus:ring-1 focus:ring-accent/40"
            />
            <button
              onClick={handleNotify}
              disabled={status === "loading" || !email.trim()}
              className="px-3 py-2 bg-[#1e1e1e] border border-[#2a2a2a] text-foreground text-xs rounded-xl hover:bg-[#2a2a2a] transition-colors disabled:opacity-50 whitespace-nowrap"
            >
              {status === "loading" ? "..." : t("plan_premium_notify_btn")}
            </button>
          </div>
        )}
        {status === "error" && (
          <p className="text-loss text-xs">{t("pricing_notify_error")}</p>
        )}
      </div>

      {/* Card content (visible behind overlay) */}
      <div className="text-xs font-bold text-muted uppercase tracking-widest">{t("plan_premium")}</div>
      <p className="text-muted text-xs mt-1">{t("plan_premium_desc")}</p>
      <div className="mt-5">
        <span className="text-4xl font-bold text-muted">—</span>
        <span className="text-muted text-sm ml-1">/ mo</span>
      </div>
      <div className="h-4" />
      <ul className="mt-7 space-y-3 flex-1 opacity-40">
        {[t("plan_premium_coming"), "...", "...", "..."].map((feat, i) => (
          <li key={i} className="flex items-start gap-2.5 text-sm">
            <svg className="w-4 h-4 text-muted shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
            </svg>
            <span className="text-muted">{feat}</span>
          </li>
        ))}
      </ul>
      <div className="mt-8 block w-full py-3 rounded-xl font-semibold text-center bg-[#1a1a1a] border border-[#27272a] text-muted opacity-40 cursor-not-allowed">
        {t("plan_premium_coming")}
      </div>
    </div>
  );
}

/* ─────────────────────────────────────────────
   PRICING
───────────────────────────────────────────── */
function Pricing() {
  const { t } = useLanguage();
  const [annual, setAnnual] = useState(false);
  const [priceVisible, setPriceVisible] = useState(true);

  function toggleAnnual(val: boolean) {
    setPriceVisible(false);
    setTimeout(() => { setAnnual(val); setPriceVisible(true); }, 180);
  }

  const activePlans = [
    {
      name: t("plan_free"),
      sub: t("plan_sub_free"),
      monthlyPrice: "0€",
      annualPrice: "0€",
      annualMonthly: "",
      feats: [
        t("plan_benefit_free_1"),
        t("plan_benefit_free_2"),
        t("plan_benefit_free_3"),
        t("plan_benefit_free_4"),
      ],
      btnKey: "pricing_start_free",
      btnClass: "bg-[#1a1a1a] border border-[#27272a] text-[#d4d4d8] hover:border-[#3f3f46]",
      cardClass: "border-[#1c1c1e]",
    },
    {
      name: t("plan_plus"),
      sub: t("plan_sub_plus"),
      monthlyPrice: "9.99€",
      annualPrice: "89.99€",
      annualMonthly: "7.50€",
      feats: [
        t("plan_benefit_plus_1"),
        t("plan_benefit_plus_2"),
        t("plan_benefit_plus_3"),
        t("plan_benefit_plus_4"),
        t("plan_benefit_plus_5"),
        t("plan_benefit_plus_6"),
        t("plan_benefit_plus_7"),
      ],
      btnKey: "pricing_choose_plus",
      btnClass: "bg-accent text-white hover:bg-blue-600 glow-blue",
      cardClass: "card-gradient-border-blue shadow-lg shadow-accent/10",
      highlight: true,
    },
  ];

  return (
    <section id="pricing" className="py-24 px-6 border-t border-white/5">
      <div className="max-w-5xl mx-auto">
        <Reveal>
          <h2 className="text-3xl sm:text-4xl font-bold text-foreground text-center">{t("pricing_title")}</h2>
        </Reveal>

        {/* Toggle */}
        <Reveal className="flex items-center justify-center gap-3 mt-8">
          <button
            onClick={() => toggleAnnual(false)}
            className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${!annual ? "bg-[#1c1c1e] text-foreground" : "text-muted"}`}
          >
            {t("plan_monthly")}
          </button>
          <button
            onClick={() => toggleAnnual(true)}
            className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${annual ? "bg-[#1c1c1e] text-foreground" : "text-muted"}`}
          >
            {t("plan_annual")}
            <span className="ml-2 px-1.5 py-0.5 bg-profit/10 text-profit text-[11px] font-bold rounded-full badge-pulse inline-block">
              -25%
            </span>
          </button>
        </Reveal>

        {/* Plans grid: Free + Plus + Premium (3 cols) */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-6 mt-10 max-w-5xl mx-auto">
          {activePlans.map((p, i) => {
            const price = annual ? p.annualPrice : p.monthlyPrice;
            const period = annual ? `/${t("plan_year")}` : `/${t("plan_month")}`;
            const showSavings = annual && p.annualMonthly;
            return (
              <Reveal key={p.name} delay={i * 60}>
                <div className={`relative bg-[#111113] border rounded-2xl p-7 flex flex-col h-full ${p.cardClass}`}>
                  {p.highlight && (
                    <span className="absolute -top-3 left-1/2 -translate-x-1/2 bg-accent text-white text-[11px] font-bold px-3 py-0.5 rounded-full shadow-md">
                      {t("plan_popular")}
                    </span>
                  )}
                  <div className="text-xs font-bold text-foreground uppercase tracking-widest">{p.name}</div>
                  <p className="text-muted text-xs mt-1">{p.sub}</p>

                  <div className={`mt-5 transition-all duration-200 ${priceVisible ? "opacity-100" : "opacity-0 -translate-y-1"}`}>
                    <span className="text-4xl font-bold text-foreground">{price}</span>
                    <span className="text-muted text-sm ml-1">{period}</span>
                  </div>

                  {showSavings ? (
                    <p className="text-profit text-xs mt-1">{t("plan_equiv")} {p.annualMonthly}/{t("plan_month")}</p>
                  ) : (
                    <div className="h-4" />
                  )}

                  <ul className="mt-7 space-y-3 flex-1">
                    {p.feats.map((feat) => (
                      <li key={feat} className="flex items-start gap-2.5 text-sm">
                        <svg className="w-4 h-4 text-profit shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                        </svg>
                        <span className="text-foreground">{feat}</span>
                      </li>
                    ))}
                  </ul>

                  <Link href="/login" className={`mt-8 block w-full py-3 rounded-xl font-semibold text-center transition-colors btn-scale ${p.btnClass}`}>
                    {t(p.btnKey)}
                  </Link>
                </div>
              </Reveal>
            );
          })}

          {/* Premium — Coming soon as 3rd card inside grid */}
          <Reveal delay={120}>
            <PremiumComingSoon t={t} />
          </Reveal>
        </div>

        {/* Badges */}
        <Reveal className="flex flex-wrap items-center justify-center gap-5 mt-8 text-xs text-muted">
          <span className="flex items-center gap-1.5">
            <svg className="w-4 h-4 text-profit" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" /></svg>
            {t("plan_stripe_secure")}
          </span>
          <span className="flex items-center gap-1.5">
            <svg className="w-4 h-4 text-profit" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" /></svg>
            {t("pricing_no_commitment")}
          </span>
        </Reveal>
      </div>
    </section>
  );
}

/* ─────────────────────────────────────────────
   FAQ
───────────────────────────────────────────── */
function FAQ() {
  const { t } = useLanguage();
  const [openIdx, setOpenIdx] = useState<number | null>(null);
  const faqs = [
    { q: t("faq_q1"), a: t("faq_a1") },
    { q: t("faq_q2"), a: t("faq_a2") },
    { q: t("faq_q3"), a: t("faq_a3") },
    { q: t("faq_q4"), a: t("faq_a4") },
    { q: t("faq_q5"), a: t("faq_a5") },
    { q: t("faq_q6"), a: t("faq_a6") },
  ];
  return (
    <section id="faq" className="py-24 px-6 border-t border-white/5">
      <div className="max-w-3xl mx-auto">
        <Reveal>
          <h2 className="text-3xl sm:text-4xl font-bold text-foreground text-center mb-12">{t("faq_title")}</h2>
        </Reveal>
        <div className="divide-y divide-[#1c1c1e] border border-[#1c1c1e] rounded-2xl overflow-hidden">
          {faqs.map((faq, i) => (
            <div key={i} className="bg-[#111113]">
              <button
                onClick={() => setOpenIdx(openIdx === i ? null : i)}
                className="w-full flex items-center justify-between px-6 py-5 text-left hover:bg-white/[0.02] transition-colors"
              >
                <span className="text-foreground font-medium text-sm pr-6">{faq.q}</span>
                <div className={`w-5 h-5 flex items-center justify-center rounded-full border border-[#2a2a2e] text-muted shrink-0 transition-all duration-200 ${openIdx === i ? "bg-accent/10 border-accent/30 text-accent rotate-45" : ""}`}>
                  <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                  </svg>
                </div>
              </button>
              <div
                className="overflow-hidden transition-all duration-300"
                style={{ maxHeight: openIdx === i ? "300px" : "0px" }}
              >
                <p className="px-6 pb-5 text-muted text-sm leading-relaxed">{faq.a}</p>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

/* ─────────────────────────────────────────────
   FINAL CTA
───────────────────────────────────────────── */
function FinalCTA() {
  const { t } = useLanguage();
  return (
    <section className="py-24 px-6 border-t border-white/5 relative overflow-hidden">
      {/* Radial blue glow */}
      <div className="absolute inset-0 radial-glow-blue pointer-events-none" />
      <div className="max-w-2xl mx-auto text-center relative z-10">
        <Reveal>
          <h2 className="text-3xl sm:text-5xl font-bold text-foreground">{t("cta_title")}</h2>
          <p className="text-muted mt-4 text-lg">{t("cta_subtitle")}</p>
          <Link
            href="/login"
            className="mt-8 inline-block px-10 py-4 bg-accent text-white rounded-xl font-bold text-lg hover:bg-blue-600 glow-pulse btn-scale"
          >
            {t("cta_button")}
          </Link>
          <p className="text-muted text-xs mt-4">{t("pricing_no_commitment")}</p>
        </Reveal>
      </div>
    </section>
  );
}

/* ─────────────────────────────────────────────
   FOOTER
───────────────────────────────────────────── */
function Footer() {
  const { t } = useLanguage();
  return (
    <footer className="border-t border-[#1c1c1e] bg-[#0a0a0c] px-6 py-14">
      <div className="max-w-6xl mx-auto">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-10 mb-12">
          {/* Brand */}
          <div className="col-span-2 md:col-span-1">
            <div className="flex items-center gap-2 mb-3">
              <div className="w-6 h-6 flex items-center justify-center rounded-md bg-accent/20">
                <svg className="w-3.5 h-3.5 text-accent" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 18L9 11.25l4.306 4.307a11.95 11.95 0 015.814-5.519l2.74-1.22m0 0l-5.94-2.28m5.94 2.28l-2.28 5.941" />
                </svg>
              </div>
              <span className="font-bold text-foreground">TradeMinds</span>
            </div>
            <p className="text-muted text-xs leading-relaxed">{t("hero_subtitle_v2")}</p>
            {/* Social icons */}
            <div className="flex gap-3 mt-4">
              <a href="#" aria-label="Twitter/X" className="w-8 h-8 rounded-lg border border-[#1c1c1e] flex items-center justify-center text-muted hover:text-foreground hover:border-[#2a2a2e] transition-colors">
                <svg className="w-3.5 h-3.5" fill="currentColor" viewBox="0 0 24 24"><path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-4.714-6.231-5.401 6.231H2.746l7.73-8.835L1.254 2.25H8.08l4.253 5.622zm-1.161 17.52h1.833L7.084 4.126H5.117z"/></svg>
              </a>
              <a href="#" aria-label="Discord" className="w-8 h-8 rounded-lg border border-[#1c1c1e] flex items-center justify-center text-muted hover:text-foreground hover:border-[#2a2a2e] transition-colors">
                <svg className="w-3.5 h-3.5" fill="currentColor" viewBox="0 0 24 24"><path d="M20.317 4.37a19.791 19.791 0 0 0-4.885-1.515.074.074 0 0 0-.079.037c-.21.375-.444.864-.608 1.25a18.27 18.27 0 0 0-5.487 0 12.64 12.64 0 0 0-.617-1.25.077.077 0 0 0-.079-.037A19.736 19.736 0 0 0 3.677 4.37a.07.07 0 0 0-.032.027C.533 9.046-.32 13.58.099 18.057.1 18.085.117 18.11.125 18.132a19.9 19.9 0 0 0 5.993 3.03.078.078 0 0 0 .084-.028c.462-.63.874-1.295 1.226-1.994a.076.076 0 0 0-.041-.106 13.107 13.107 0 0 1-1.872-.892.077.077 0 0 1-.008-.128 10.2 10.2 0 0 0 .372-.292.074.074 0 0 1 .077-.01c3.928 1.793 8.18 1.793 12.062 0a.074.074 0 0 1 .078.01c.12.098.246.198.373.292a.077.077 0 0 1-.006.127 12.299 12.299 0 0 1-1.873.892.077.077 0 0 0-.041.107c.36.698.772 1.362 1.225 1.993a.076.076 0 0 0 .084.028 19.839 19.839 0 0 0 6.002-3.03.077.077 0 0 0 .032-.054c.5-5.177-.838-9.674-3.549-13.66a.061.061 0 0 0-.031-.03z"/></svg>
              </a>
            </div>
          </div>

          {/* Produit */}
          <div>
            <p className="text-foreground font-semibold text-sm mb-4">{t("footer_product")}</p>
            <ul className="space-y-2.5">
              {[
                { href: "#features", label: t("nav_features") },
                { href: "#pricing",  label: t("nav_pricing") },
                { href: "#faq",      label: t("nav_faq") },
              ].map((l) => (
                <li key={l.href}><a href={l.href} className="text-muted text-sm hover:text-foreground transition-colors">{l.label}</a></li>
              ))}
            </ul>
          </div>

          {/* Ressources */}
          <div>
            <p className="text-foreground font-semibold text-sm mb-4">{t("footer_resources")}</p>
            <ul className="space-y-2.5">
              {[
                { href: "#", label: t("footer_blog") },
                { href: "#", label: t("footer_contact") },
                { href: "#", label: t("footer_support") },
              ].map((l) => (
                <li key={l.label}><a href={l.href} className="text-muted text-sm hover:text-foreground transition-colors">{l.label}</a></li>
              ))}
            </ul>
          </div>

          {/* Légal */}
          <div>
            <p className="text-foreground font-semibold text-sm mb-4">{t("footer_legal_col")}</p>
            <ul className="space-y-2.5">
              <li><a href="/legal/terms" className="text-muted text-sm hover:text-foreground transition-colors">{t("footer_terms")}</a></li>
              <li><a href="/legal/privacy" className="text-muted text-sm hover:text-foreground transition-colors">{t("footer_privacy")}</a></li>
              <li><a href="#" className="text-muted text-sm hover:text-foreground transition-colors">{t("footer_mentions")}</a></li>
            </ul>
          </div>
        </div>

        {/* Bottom bar */}
        <div className="border-t border-[#1c1c1e] pt-6 flex flex-col sm:flex-row items-center justify-between gap-3">
          <p className="text-xs text-muted">© 2026 TradeMinds. {t("footer_legal")}.</p>
          <p className="text-xs text-muted">{t("plan_stripe_secure")}</p>
        </div>
      </div>
    </footer>
  );
}

/* ─────────────────────────────────────────────
   PAGE
───────────────────────────────────────────── */
export default function LandingPage() {
  return (
    <div className="min-h-screen bg-background force-dark landing-page">
      <Nav />
      <Hero />
      <Problem />
      <Features />
      <AIDetection />
      <SocialProof />
      <HowItWorks />
      <Pricing />
      <FAQ />
      <FinalCTA />
      <Footer />
    </div>
  );
}
