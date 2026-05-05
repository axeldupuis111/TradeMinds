"use client";

import LanguageSelector from "@/components/LanguageSelector";
import { useLanguage } from "@/lib/LanguageContext";
import Link from "next/link";
import { useRef, useState } from "react";
import { motion, useInView, useReducedMotion } from "framer-motion";
import FadeUp from "@/components/animations/FadeUp";
import CountUp from "@/components/animations/CountUp";
import StaggerContainer, { StaggerItem } from "@/components/animations/StaggerContainer";

/* ─────────────────────────────────────────────
   Scroll-reveal helper (Framer Motion)
───────────────────────────────────────────── */
function Reveal({ children, className = "", delay = 0 }: { children: React.ReactNode; className?: string; delay?: number }) {
  return (
    <FadeUp className={className} delay={delay / 1000}>
      {children}
    </FadeUp>
  );
}

/* ─────────────────────────────────────────────
   NAVBAR
───────────────────────────────────────────── */
function Nav() {
  const { t } = useLanguage();
  return (
    <nav className="fixed top-0 left-0 right-0 z-50 border-b border-[#1c1c1e] bg-[#09090b]/80 backdrop-blur-[12px]">
      <div className="max-w-6xl mx-auto px-6 h-14 relative flex items-center justify-between">
        {/* Logo */}
        <Link href="/" className="flex items-center gap-2 shrink-0">
          <div className="w-6 h-6 flex items-center justify-center rounded-md bg-accent/20">
            <svg className="w-3.5 h-3.5 text-accent" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 18L9 11.25l4.306 4.307a11.95 11.95 0 015.814-5.519l2.74-1.22m0 0l-5.94-2.28m5.94 2.28l-2.28 5.941" />
            </svg>
          </div>
          <span className="text-[15px] font-bold text-foreground tracking-tight">TradeDiscipline</span>
        </Link>

        {/* Centre links — desktop only, absolutely centred */}
        <div className="hidden md:flex items-center gap-6 absolute left-1/2 -translate-x-1/2">
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
  const prefersReducedMotion = useReducedMotion();
  return (
    <section className="hero-gradient pt-28 pb-20 px-6 overflow-hidden">
      <div className="max-w-4xl mx-auto text-center">
        <Reveal>
          {/* Badge */}
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full border border-accent/20 bg-accent/5 text-xs text-accent font-medium mb-8">
            <span className="w-1.5 h-1.5 rounded-full bg-accent animate-pulse" />
            {t("hero_social_proof")}
          </div>

          <h1 className="text-4xl md:text-5xl lg:text-6xl font-bold text-foreground leading-[1.05] tracking-tight text-balance" style={{ fontStyle: "normal" }}>
            {t("hero_title_1")}{" "}
            <span className="text-accent" style={{ fontStyle: "normal" }}>{t("hero_title_2")}</span>
          </h1>

          <p className="mt-6 text-xl md:text-2xl text-gray-300 max-w-3xl mx-auto leading-relaxed">
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

          <div className="mt-6 flex justify-center">
            <div className="inline-flex items-center bg-blue-500/10 border border-blue-500/20 rounded-full px-5 py-2.5 max-w-xl text-center">
              <span className="text-base leading-relaxed">
                <strong className="text-foreground font-semibold">{t("hero_ai_badge").split(" — ")[0]}</strong>
                {t("hero_ai_badge").includes(" — ") && (
                  <span className="text-muted font-normal"> — {t("hero_ai_badge").split(" — ").slice(1).join(" — ")}</span>
                )}
              </span>
            </div>
          </div>


        </Reveal>

        {/* Dashboard mockup — stagger animation */}
        <StaggerContainer className="mt-16" staggerDelay={0.15}>
          <StaggerItem>
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
                {/* Score circle — scale entrance */}
                <motion.div
                  className="col-span-2 sm:col-span-1 flex flex-col items-center justify-center bg-white/[0.03] rounded-xl p-4 border border-white/5 gap-2"
                  initial={prefersReducedMotion ? false : { opacity: 0, scale: 0.8 }}
                  animate={{ opacity: 1, scale: 1 }}
                  transition={{ duration: 0.6, delay: 0.4, ease: "easeOut" }}
                >
                  <svg width="76" height="76" viewBox="0 0 76 76">
                    <circle cx="38" cy="38" r="32" fill="none" stroke="#1e1e1e" strokeWidth="6" />
                    <circle cx="38" cy="38" r="32" fill="none" stroke="url(#scoreGrad)" strokeWidth="6" strokeLinecap="round"
                      strokeDasharray={`${0.85 * 2 * Math.PI * 32} ${2 * Math.PI * 32}`}
                      transform="rotate(-90 38 38)" />
                    <defs>
                      <linearGradient id="scoreGrad" x1="0" y1="0" x2="1" y2="1">
                        <stop offset="0%" stopColor="#3b82f6" />
                        <stop offset="100%" stopColor="#22c55e" />
                      </linearGradient>
                    </defs>
                    <text x="38" y="36" textAnchor="middle" fill="#fafafa" fontSize="17" fontWeight="bold">85</text>
                    <text x="38" y="48" textAnchor="middle" fill="#71717a" fontSize="8">{t("preview_discipline")}</text>
                  </svg>
                </motion.div>
                {/* Equity */}
                <motion.div
                  className="col-span-2 sm:col-span-1 bg-white/[0.03] rounded-xl p-4 border border-white/5"
                  initial={prefersReducedMotion ? false : { opacity: 0, y: 15 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.5, delay: 0.55, ease: "easeOut" }}
                >
                  <p className="text-[10px] text-muted uppercase tracking-wider mb-2">{t("preview_equity")}</p>
                  <svg viewBox="0 0 120 45" className="w-full h-11" preserveAspectRatio="none">
                    <defs>
                      <linearGradient id="eq2" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stopColor="#22c55e" stopOpacity="0.3" />
                        <stop offset="100%" stopColor="#22c55e" stopOpacity="0" />
                      </linearGradient>
                    </defs>
                    <path d="M0,42 L10,39 L22,41 L34,33 L46,28 L58,23 L70,18 L82,14 L94,10 L107,6 L120,3" fill="none" stroke="#22c55e" strokeWidth="2" />
                    <path d="M0,42 L10,39 L22,41 L34,33 L46,28 L58,23 L70,18 L82,14 L94,10 L107,6 L120,3 L120,45 L0,45Z" fill="url(#eq2)" />
                  </svg>
                </motion.div>
                {/* Stats */}
                <motion.div
                  className="bg-white/[0.03] rounded-xl p-4 border border-white/5"
                  initial={prefersReducedMotion ? false : { opacity: 0, y: 15 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.5, delay: 0.7, ease: "easeOut" }}
                >
                  <p className="text-[10px] text-muted uppercase tracking-wider">{t("preview_winrate")}</p>
                  <p className="text-xl font-bold text-foreground mt-0.5">68%</p>
                  <p className="text-[10px] text-muted uppercase tracking-wider mt-2">{t("preview_trades")}</p>
                  <p className="text-xl font-bold text-foreground mt-0.5">47</p>
                </motion.div>
                {/* P&L */}
                <motion.div
                  className="bg-white/[0.03] rounded-xl p-4 border border-white/5"
                  initial={prefersReducedMotion ? false : { opacity: 0, y: 15 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.5, delay: 0.85, ease: "easeOut" }}
                >
                  <p className="text-[10px] text-muted uppercase tracking-wider">{t("preview_pnl_total")}</p>
                  <p className="text-xl font-bold text-profit mt-0.5">+3 240€</p>
                  <p className="text-[10px] text-muted uppercase tracking-wider mt-2">{t("preview_challenge")}</p>
                  <div className="mt-1.5 h-1.5 bg-[#1a1a1a] rounded-full overflow-hidden">
                    <div className="h-full w-[89%] bg-accent rounded-full" />
                  </div>
                  <p className="text-[10px] text-muted mt-1">89%</p>
                </motion.div>
              </div>

              {/* AI Insight banner */}
              <motion.div
                className="mt-4 flex items-center gap-2.5 bg-profit/5 border border-profit/15 rounded-lg px-3.5 py-2.5"
                initial={prefersReducedMotion ? false : { opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.5, delay: 1.0, ease: "easeOut" }}
              >
                <span className="text-profit text-sm shrink-0">✅</span>
                <p className="text-xs text-foreground/80 leading-snug">12 jours de discipline consécutifs — <span className="text-profit font-semibold">nouveau record</span></p>
              </motion.div>

              {/* Fake trade rows */}
              <div className="mt-3 border-t border-white/5 pt-3 space-y-2">
                {[
                  { pair: "EUR/USD", dir: "BUY",  pnl: "+182.50", win: true,  date: "28/04" },
                  { pair: "GBP/JPY", dir: "SELL", pnl: "-47.20",  win: false, date: "27/04" },
                  { pair: "XAU/USD", dir: "BUY",  pnl: "+316.00", win: true,  date: "26/04" },
                ].map((tr, idx) => (
                  <motion.div
                    key={tr.pair}
                    className="flex items-center gap-3 text-xs"
                    initial={prefersReducedMotion ? false : { opacity: 0, x: -10 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ duration: 0.4, delay: 1.1 + idx * 0.1, ease: "easeOut" }}
                  >
                    <span className="text-muted/50 tabular-nums w-9 shrink-0">{tr.date}</span>
                    <span className="text-foreground font-medium w-14">{tr.pair}</span>
                    <span className={`px-1.5 py-0.5 rounded text-[10px] font-medium ${tr.dir === "BUY" ? "bg-profit/10 text-profit" : "bg-loss/10 text-loss"}`}>{tr.dir}</span>
                    <div className="flex-1 h-px bg-white/[0.04]" />
                    <span className={`font-semibold tabular-nums ${tr.win ? "text-profit" : "text-loss"}`}>{tr.pnl}€</span>
                  </motion.div>
                ))}
              </div>
            </div>
          </StaggerItem>
        </StaggerContainer>
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
            <Reveal key={p.title} delay={i * 100}>
              <motion.div
                className="bg-[#111113] border border-[#1c1c1e] rounded-2xl p-8 hover:border-white/10 hover:bg-[#111113]/80 transition-colors h-full"
                whileHover={{ y: -4, borderColor: "rgba(255,255,255,0.12)" }}
                transition={{ duration: 0.2 }}
              >
                <div className={`w-12 h-12 rounded-xl flex items-center justify-center ${p.bg} ${p.iconColor} mb-5`}>
                  {p.svg}
                </div>
                <h3 className="text-xl font-bold text-foreground">{p.title}</h3>
                <p className="text-[#71717a] mt-2 text-sm leading-relaxed line-clamp-3">{p.desc}</p>
              </motion.div>
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
  const [mode, setMode] = useState<"prop" | "own">("prop");
  return (
    <div className="feature-screenshot p-5">
      {/* Mode toggle */}
      <div className="flex rounded-lg border border-[#2a2a2e] overflow-hidden mb-4 text-xs font-medium">
        <button onClick={() => setMode("prop")} className={`flex-1 py-1.5 transition-colors ${mode === "prop" ? "bg-accent text-white" : "text-muted hover:text-foreground"}`}>Prop Firm</button>
        <button onClick={() => setMode("own")} className={`flex-1 py-1.5 transition-colors ${mode === "own" ? "bg-accent text-white" : "text-muted hover:text-foreground"}`}>Fonds Propres</button>
      </div>
      <div className="flex items-center justify-between mb-4">
        <div>
          {mode === "prop" ? (
            <>
              <p className="text-sm font-semibold text-foreground">Prop Firm — 50 000€</p>
              <p className="text-xs text-muted">Compte #12345 · Jour 8</p>
            </>
          ) : (
            <>
              <p className="text-sm font-semibold text-foreground">Compte perso — 10 000€</p>
              <p className="text-xs text-muted">Depuis le 01/01/2025</p>
            </>
          )}
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

  const features: Array<{
    label: string; labelColor: string; title: string; desc: string;
    screenshot: React.ReactNode; reverse?: boolean; screenshotGlow?: boolean;
    bullets?: string[]; wideScreenshot?: boolean;
  }> = [
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
      bullets: [
        "🔍 Détecte tes patterns invisibles (revenge, FOMO, overtrading)",
        "📊 Score de discipline objectif — pas de bullshit",
        "💬 Pose-lui des questions en langage naturel",
      ],
      screenshot: <ScreenshotAI t={t} />,
      screenshotGlow: true,
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
      wideScreenshot: false,
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
                    {f.bullets && (
                      <ul className="mt-5 space-y-2">
                        {f.bullets.map((b, bi) => (
                          <li key={bi} className="flex items-start gap-2 text-sm text-foreground/80">
                            <span className="shrink-0">{b.split(" ")[0]}</span>
                            <span>{b.slice(b.indexOf(" ") + 1)}</span>
                          </li>
                        ))}
                      </ul>
                    )}
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
                  <div className={`w-full shrink-0 ${f.screenshotGlow ? "lg:w-[50%]" : "lg:w-[400px]"} ${f.screenshotGlow ? "shadow-[0_0_40px_rgba(139,92,246,0.2),0_0_80px_rgba(59,130,246,0.1)] rounded-xl" : ""}`}>
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
          <p className="text-muted mt-3 max-w-2xl mx-auto">{t("ai_detect_subtitle")}</p>
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
          {/* Social proof mini-cards with animated counters */}
          <div className="flex flex-col sm:flex-row items-center justify-center gap-4 mt-6">
            <div className="flex flex-col items-center px-6 py-4 bg-white/[0.03] border border-white/[0.08] rounded-2xl min-w-[140px]">
              <span className="text-3xl font-bold text-foreground tabular-nums"><CountUp end={500} suffix="+" /></span>
              <span className="text-xs text-muted mt-1">{t("social_stat_1_label")}</span>
            </div>
            <div className="flex flex-col items-center px-6 py-4 bg-white/[0.03] border border-white/[0.08] rounded-2xl min-w-[140px]">
              <span className="text-3xl font-bold text-foreground tabular-nums"><CountUp end={10000} suffix="+" /></span>
              <span className="text-xs text-muted mt-1">{t("social_stat_2_label")}</span>
            </div>
            <div className="flex flex-col items-center px-6 py-4 bg-white/[0.03] border border-white/[0.08] rounded-2xl min-w-[140px]">
              <div className="flex items-center gap-1">
                <span className="text-3xl font-bold text-foreground tabular-nums"><CountUp end={4.8} decimals={1} /></span>
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
            <Reveal key={i} delay={i * 150}>
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
  const prefersReducedMotion = useReducedMotion();
  const lineRef = useRef<HTMLDivElement>(null);
  const lineInView = useInView(lineRef, { once: true, margin: "-100px" });
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
          {/* Connecting line — progressive width animation */}
          <div
            ref={lineRef}
            className="hidden md:block absolute top-8 left-[calc(16.66%+28px)] right-[calc(16.66%+28px)] h-px overflow-hidden"
          >
            <motion.div
              className="h-full bg-gradient-to-r from-accent/20 via-accent/40 to-accent/20"
              initial={prefersReducedMotion ? { width: "100%" } : { width: "0%" }}
              animate={lineInView ? { width: "100%" } : { width: "0%" }}
              transition={{ duration: 1.2, delay: 0.3, ease: "easeOut" }}
            />
          </div>
          {steps.map((s, i) => (
            <Reveal key={s.num} delay={i * 200} className="text-center">
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

  const premiumFeats = [
    t("plan_benefit_premium_1"),
    t("plan_benefit_premium_2"),
    t("plan_benefit_premium_3"),
    t("plan_benefit_premium_4"),
    t("plan_benefit_premium_5"),
  ];

  return (
    <div className="relative bg-[#111113] card-gradient-border-gold rounded-2xl p-7 flex flex-col h-full">
      {/* Coming soon badge */}
      <div className="absolute -top-3 left-1/2 -translate-x-1/2 flex items-center gap-1.5 bg-yellow-500/20 border border-yellow-500/40 text-yellow-400 text-[11px] font-bold px-3 py-0.5 rounded-full">
        🔒 {t("plan_premium_coming")}
      </div>

      <div className="text-xs font-bold text-yellow-400 uppercase tracking-widest">{t("plan_premium")}</div>
      <p className="text-gray-400 text-base mt-1">{t("plan_premium_desc")}</p>

      <ul className="mt-5 space-y-3 flex-1">
        {premiumFeats.map((feat, i) => (
          <li key={i} className="flex items-start gap-2.5 text-sm">
            <svg className="w-4 h-4 text-yellow-400 shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
            </svg>
            <span className="text-foreground">{feat}</span>
          </li>
        ))}
      </ul>

      {/* Email notification */}
      <div className="mt-6">
        {status === "success" ? (
          <p className="text-profit text-sm font-medium text-center py-3">{t("pricing_notify_success")}</p>
        ) : status === "duplicate" ? (
          <p className="text-orange-400 text-sm text-center py-3">{t("pricing_notify_duplicate")}</p>
        ) : (
          <>
            <p className="text-muted text-sm mb-2">{t("plan_premium_notify_label")}</p>
            <div className="flex gap-2">
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              onKeyDown={(e) => { if (e.key === "Enter") handleNotify(); }}
              placeholder="email@exemple.com"
              className="flex-1 min-w-0 px-3 py-2 bg-[#1a1a1a] border border-[#27272a] rounded-xl text-foreground text-sm placeholder-muted focus:outline-none focus:ring-1 focus:ring-yellow-500/40"
            />
            <button
              onClick={handleNotify}
              disabled={status === "loading" || !email.trim()}
              className="px-4 py-2 bg-yellow-500/20 border border-yellow-500/40 text-yellow-400 text-sm font-semibold rounded-xl hover:bg-yellow-500/30 transition-colors disabled:opacity-50 whitespace-nowrap"
            >
              {status === "loading" ? "..." : t("plan_premium_notify_btn")}
            </button>
          </div>
          </>
        )}
        {status === "error" && (
          <p className="text-loss text-xs mt-1">{t("pricing_notify_error")}</p>
        )}
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
      annualPrice: "95.88€",
      annualMonthly: "7.99€",
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
              -20%
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
                <motion.div
                  className={`relative bg-[#111113] border rounded-2xl p-7 flex flex-col h-full ${p.cardClass}`}
                  whileHover={{ borderColor: "rgba(59,130,246,0.3)", boxShadow: "0 0 20px rgba(59,130,246,0.1)" }}
                  transition={{ duration: 0.25 }}
                >
                  {p.highlight && (
                    <span className="absolute -top-3 left-1/2 -translate-x-1/2 bg-accent text-white text-[11px] font-bold px-3 py-0.5 rounded-full shadow-md">
                      {t("plan_popular")}
                    </span>
                  )}
                  <div className="text-xs font-bold text-foreground uppercase tracking-widest">{p.name}</div>
                  <p className="text-gray-400 text-base mt-1">{p.sub}</p>

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

                  <motion.div whileHover={{ scale: 1.03 }} transition={{ duration: 0.2 }}>
                    <Link href="/login" className={`mt-8 block w-full py-3 rounded-xl font-semibold text-center transition-colors ${p.btnClass}`}>
                      {t(p.btnKey)}
                    </Link>
                  </motion.div>
                  {p.highlight && (
                    <p className="text-center text-xs text-muted/50 mt-2">{t("pricing_coming_soon_note")}</p>
                  )}
                </motion.div>
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
              <span className="font-bold text-foreground">TradeDiscipline</span>
            </div>
            <p className="text-muted text-xs leading-relaxed">{t("footer_brand_desc")}</p>
          </div>

          {/* Produit */}
          <div>
            <p className="text-foreground font-semibold text-sm mb-4">{t("footer_product")}</p>
            <ul className="space-y-2.5">
              {[
                { href: "#features", label: t("nav_features") },
                { href: "#pricing",  label: t("nav_pricing") },
              ].map((l) => (
                <li key={l.href}><a href={l.href} className="text-muted text-sm hover:text-foreground transition-colors">{l.label}</a></li>
              ))}
            </ul>
          </div>

          {/* Ressources */}
          <div>
            <p className="text-foreground font-semibold text-sm mb-4">{t("footer_resources")}</p>
            <ul className="space-y-2.5">
              <li><span className="text-muted/40 text-sm cursor-not-allowed select-none">{t("footer_blog")}</span></li>
              <li><a href="/contact" className="text-muted text-sm hover:text-foreground transition-colors">{t("footer_contact")}</a></li>
              <li><a href="/faq" className="text-muted text-sm hover:text-foreground transition-colors">{t("footer_faq")}</a></li>
            </ul>
          </div>

          {/* Légal */}
          <div>
            <p className="text-foreground font-semibold text-sm mb-4">{t("footer_legal_col")}</p>
            <ul className="space-y-2.5">
              <li><a href="/cgu" className="text-muted text-sm hover:text-foreground transition-colors">{t("footer_terms")}</a></li>
              <li><a href="/confidentialite" className="text-muted text-sm hover:text-foreground transition-colors">{t("footer_privacy")}</a></li>
              <li><a href="/mentions-legales" className="text-muted text-sm hover:text-foreground transition-colors">{t("footer_mentions")}</a></li>
            </ul>
          </div>
        </div>

        {/* Bottom bar */}
        <div className="border-t border-[#1c1c1e] pt-6 flex flex-col sm:flex-row items-center justify-between gap-3">
          <p className="text-xs text-muted">© 2026 TradeDiscipline. {t("footer_legal")}.</p>
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
