"use client";

import DisciplineQuiz from "@/components/landing/DisciplineQuiz";
import LiveDemo from "@/components/landing/LiveDemo";
import PublicHeader from "@/components/PublicHeader";
import { useLanguage } from "@/lib/LanguageContext";
import Link from "next/link";
import React, { useRef, useState, useEffect } from "react";
import { motion, useInView, useReducedMotion, AnimatePresence, useMotionValue, useSpring, useTransform, useScroll } from "framer-motion";

/* ─────────────────────────────────────────────
   ANIMATION PRIMITIVES
   - Use whileInView + viewport (SSR-safe, no hydration flash)
   - No filter:blur on initial (causes paint cost + SSR mismatch)
   - prefersReducedMotion: initial={false} disables entrance
───────────────────────────────────────────── */
const ease = [0.16, 1, 0.3, 1] as const;

function Reveal({
  children,
  className = "",
  delay = 0,
}: {
  children: React.ReactNode;
  className?: string;
  delay?: number;
}) {
  const prefersReduced = useReducedMotion();
  return (
    <motion.div
      className={className}
      initial={prefersReduced ? false : { opacity: 0, y: 20 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: "-60px" }}
      transition={{ duration: 0.65, delay, ease }}
    >
      {children}
    </motion.div>
  );
}

function StaggerReveal({
  children,
  className = "",
  stagger = 0.08,
}: {
  children: React.ReactNode;
  className?: string;
  stagger?: number;
}) {
  const prefersReduced = useReducedMotion();
  const items = React.Children.toArray(children);
  return (
    <div className={className}>
      {items.map((child, i) => (
        <motion.div
          key={i}
          initial={prefersReduced ? false : { opacity: 0, y: 18 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: "-40px" }}
          transition={{ duration: 0.55, delay: i * stagger, ease }}
        >
          {child}
        </motion.div>
      ))}
    </div>
  );
}

/* ─────────────────────────────────────────────
   ANIMATED COUNTER
───────────────────────────────────────────── */
function Counter({
  end,
  suffix = "",
  decimals = 0,
}: {
  end: number;
  suffix?: string;
  decimals?: number;
}) {
  const [val, setVal] = useState(0);
  const ref = useRef<HTMLSpanElement>(null);
  const inView = useInView(ref, { once: true, margin: "-40px" });
  const prefersReduced = useReducedMotion();

  useEffect(() => {
    if (!inView) return;
    if (prefersReduced) { setVal(end); return; }
    const duration = 1400;
    const step = 16;
    const steps = duration / step;
    const increment = end / steps;
    let current = 0;
    const timer = setInterval(() => {
      current += increment;
      if (current >= end) { setVal(end); clearInterval(timer); }
      else setVal(current);
    }, step);
    return () => clearInterval(timer);
  }, [inView, end, prefersReduced]);

  return (
    <span ref={ref} className="tabular-nums">
      {decimals > 0 ? val.toFixed(decimals) : Math.floor(val).toLocaleString()}
      {suffix}
    </span>
  );
}

/* ─────────────────────────────────────────────
   GRID BACKGROUND
   absolute (not fixed) — scoped to landing page
───────────────────────────────────────────── */
function GridBackground() {
  return (
    <div className="absolute inset-0 pointer-events-none overflow-hidden" aria-hidden>
      <div
        className="absolute inset-0 opacity-[0.028] grid-dots-mask"
        style={{
          backgroundImage: `radial-gradient(circle, rgb(var(--foreground)) 1px, transparent 1px)`,
          backgroundSize: "32px 32px",
        }}
      />
    </div>
  );
}

/* ─────────────────────────────────────────────
   HERO
───────────────────────────────────────────── */
function Hero() {
  const { t } = useLanguage();
  const prefersReduced = useReducedMotion();

  return (
    <section className="relative pt-32 pb-24 px-6 overflow-hidden">
      {/* Gradient blobs — floating aurora effect */}
      <div
        className="absolute top-0 left-1/2 -translate-x-1/2 w-[900px] h-[600px] pointer-events-none -z-0"
        aria-hidden
      >
        <div className="aurora-a absolute top-0 left-1/4 w-80 h-80 rounded-full blur-[120px]"
          style={{ background: "rgb(var(--accent)/0.09)" }} />
        <div className="aurora-b absolute top-20 right-1/4 w-64 h-64 rounded-full blur-[100px]"
          style={{ background: "rgba(59,130,246,0.07)" }} />
        <div className="aurora-c absolute top-40 left-1/2 w-48 h-48 rounded-full blur-[90px]"
          style={{ background: "rgba(167,139,250,0.04)" }} />
      </div>

      <div className="max-w-5xl mx-auto text-center relative z-10">
        {/* Social proof badge */}
        <motion.div
          initial={prefersReduced ? false : { opacity: 0, y: 10, scale: 0.97 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          transition={{ duration: 0.5, ease }}
          className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full border border-[rgb(var(--accent)/0.2)] bg-[rgb(var(--accent)/0.05)] text-xs font-medium mb-10"
          style={{ color: "rgb(var(--accent))", fontStyle: "normal" }}
        >
          <span className="w-1.5 h-1.5 rounded-full bg-[rgb(var(--accent))] animate-pulse shrink-0" />
          {t("hero_social_proof")}
        </motion.div>

        {/* H1 — Geist Sans (overrides landing-page serif) */}
        <motion.h1
          initial={prefersReduced ? false : { opacity: 0, y: 24 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.75, delay: 0.1, ease }}
          className="text-4xl sm:text-5xl md:text-6xl lg:text-7xl font-bold leading-[1.05] tracking-tight text-balance"
          style={{
            fontFamily: "var(--font-geist-sans), system-ui, sans-serif",
            fontStyle: "normal",
            fontWeight: 700,
          }}
        >
          {t("hero_title_1")}{" "}
          <span
            className="text-gradient-animated"
            style={{
              background: "linear-gradient(135deg, rgb(var(--accent)) 0%, #60a5fa 40%, #a78bfa 70%, rgb(var(--accent)) 100%)",
              WebkitBackgroundClip: "text",
              WebkitTextFillColor: "transparent",
              backgroundClip: "text",
              fontStyle: "normal",
            }}
          >
            {t("hero_title_2")}
          </span>
        </motion.h1>

        {/* Subtitle */}
        <motion.p
          initial={prefersReduced ? false : { opacity: 0, y: 18 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.65, delay: 0.22, ease }}
          className="mt-6 text-base sm:text-lg md:text-xl max-w-2xl mx-auto leading-relaxed"
          style={{ color: "rgb(var(--muted))", fontStyle: "normal" }}
        >
          {t("hero_subtitle_v2")}
        </motion.p>

        {/* CTA buttons */}
        <motion.div
          initial={prefersReduced ? false : { opacity: 0, y: 14 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, delay: 0.35, ease }}
          className="mt-10 flex flex-col sm:flex-row items-center justify-center gap-3"
        >
          <Link
            href="/login"
            className="btn-primary-shimmer group relative px-7 py-3.5 rounded-xl font-semibold text-sm text-white transition-transform duration-200 hover:scale-[1.02] active:scale-[0.98] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[rgb(var(--accent))]"
            style={{
              background: "linear-gradient(135deg, rgb(var(--accent)) 0%, #3b82f6 100%)",
              boxShadow: "0 0 0 1px rgb(var(--accent)/0.3), 0 4px 24px rgb(var(--accent)/0.2)",
            }}
          >
            <span className="relative z-10">{t("hero_cta")}</span>
          </Link>
          <a
            href="#features"
            className="px-7 py-3.5 rounded-xl font-semibold text-sm border transition-all duration-200 hover:scale-[1.02] active:scale-[0.98] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[rgb(var(--accent))]"
            style={{
              color: "rgb(var(--foreground))",
              borderColor: "rgb(var(--border))",
              background: "rgb(var(--card))",
              fontStyle: "normal",
            }}
          >
            {t("hero_features")}
          </a>
        </motion.div>

        {/* AI trust badge */}
        <motion.div
          initial={prefersReduced ? false : { opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.6, delay: 0.5, ease }}
          className="mt-5 flex justify-center"
        >
          <div
            className="inline-flex items-center gap-2 px-4 py-2 rounded-full border text-xs"
            style={{
              borderColor: "rgb(var(--border))",
              background: "rgb(var(--card))",
              color: "rgb(var(--muted))",
              fontStyle: "normal",
            }}
          >
            <svg className="w-3.5 h-3.5 shrink-0" style={{ color: "rgb(var(--accent))" }} fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden>
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.813 15.904L9 18.75l-.813-2.846a4.5 4.5 0 00-3.09-3.09L2.25 12l2.846-.813a4.5 4.5 0 003.09-3.09L9 5.25l.813 2.846a4.5 4.5 0 003.09 3.09L15.75 12l-2.846.813a4.5 4.5 0 00-3.09 3.09z" />
            </svg>
            {t("hero_ai_badge").split(" — ")[0]}
            {t("hero_ai_badge").includes(" — ") && (
              <><span className="opacity-30">·</span><span>{t("hero_ai_badge").split(" — ").slice(1).join(" — ")}</span></>
            )}
          </div>
        </motion.div>

        {/* Dashboard mockup — with mouse-parallax 3D tilt */}
        <HeroDashboard />
      </div>
    </section>
  );
}

/* ─────────────────────────────────────────────
   HERO DASHBOARD — cinematic mouse-parallax tilt
───────────────────────────────────────────── */
function HeroDashboard() {
  const prefersReduced = useReducedMotion();
  const ref = useRef<HTMLDivElement>(null);

  const mx = useMotionValue(0);
  const my = useMotionValue(0);
  const spring = { stiffness: 120, damping: 20, mass: 0.4 };
  const rotateX = useSpring(useTransform(my, [-0.5, 0.5], [2.5, -2.5]), spring);
  const rotateY = useSpring(useTransform(mx, [-0.5, 0.5], [-3.5, 3.5]), spring);

  function handleMove(e: React.MouseEvent<HTMLDivElement>) {
    if (prefersReduced || !ref.current) return;
    const r = ref.current.getBoundingClientRect();
    mx.set((e.clientX - r.left) / r.width - 0.5);
    my.set((e.clientY - r.top) / r.height - 0.5);
  }
  function handleLeave() {
    mx.set(0);
    my.set(0);
  }

  return (
    <motion.div
      ref={ref}
      onMouseMove={handleMove}
      onMouseLeave={handleLeave}
      initial={prefersReduced ? false : { opacity: 0, y: 36 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true }}
      transition={{ duration: 0.85, delay: 0.42, ease }}
      className="mt-16 relative"
      style={prefersReduced ? undefined : { perspective: 1600, rotateX, rotateY, transformStyle: "preserve-3d" }}
    >
      <div
        className="absolute -inset-x-8 -top-8 -bottom-16 pointer-events-none -z-10"
        aria-hidden
        style={{
          background: "radial-gradient(ellipse 70% 60% at 50% 40%, rgb(var(--accent)/0.1) 0%, transparent 70%)",
        }}
      />
      <DashboardMockup />
    </motion.div>
  );
}

/* ─────────────────────────────────────────────
   DASHBOARD MOCKUP
───────────────────────────────────────────── */
function DashboardMockup() {
  const { t } = useLanguage();
  const prefersReduced = useReducedMotion();

  return (
    <div
      className="rounded-2xl border overflow-hidden"
      style={{
        borderColor: "rgb(var(--border))",
        background: "rgb(var(--card))",
        boxShadow: "0 32px 80px -12px rgba(0,0,0,0.7), 0 0 0 1px rgba(255,255,255,0.03)",
        /* Perspective tilt — subtle, removed via media query if no-motion */
        transform: prefersReduced ? undefined : "perspective(1600px) rotateX(1.5deg)",
        transformOrigin: "center bottom",
      }}
    >
      {/* Window chrome bar */}
      <div
        className="flex items-center gap-2 px-4 py-3 border-b"
        style={{ borderColor: "rgb(var(--border))", background: "rgb(var(--surface)/0.5)" }}
      >
        <span className="w-2.5 h-2.5 rounded-full" style={{ background: "rgb(var(--loss)/0.5)" }} aria-hidden />
        <span className="w-2.5 h-2.5 rounded-full" style={{ background: "rgb(var(--warning)/0.5)" }} aria-hidden />
        <span className="w-2.5 h-2.5 rounded-full" style={{ background: "rgb(var(--profit)/0.5)" }} aria-hidden />
        <div
          className="ml-3 flex items-center gap-2 px-3 py-1 rounded-md border text-[10px]"
          style={{ background: "rgb(var(--card))", borderColor: "rgb(var(--border))", color: "rgb(var(--muted))", fontStyle: "normal" }}
        >
          <svg className="w-2.5 h-2.5" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden>
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 11V7a4 4 0 118 0m-4 8v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2z" />
          </svg>
          app.tradediscipline.com
        </div>
      </div>

      {/* KPI grid */}
      <div className="p-4 sm:p-6 grid grid-cols-2 sm:grid-cols-4 gap-3 sm:gap-4">
        {/* Discipline score */}
        <motion.div
          className="col-span-1 flex flex-col items-center justify-center rounded-xl p-4 gap-2 border"
          style={{ background: "rgb(var(--surface)/0.5)", borderColor: "rgb(var(--border))" }}
          initial={prefersReduced ? false : { opacity: 0, scale: 0.88 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 0.55, delay: 0.52, ease }}
        >
          <svg width="72" height="72" viewBox="0 0 72 72" aria-label="Discipline score 85%" role="img">
            <defs>
              <linearGradient id="scoreG" x1="0" y1="0" x2="1" y2="1">
                <stop offset="0%" stopColor="rgb(var(--accent))" />
                <stop offset="100%" stopColor="rgb(var(--profit))" />
              </linearGradient>
            </defs>
            {/* Track */}
            <circle cx="36" cy="36" r="29" fill="none" stroke="rgb(var(--border))" strokeWidth="5.5" />
            {/* Animated progress arc */}
            <motion.circle
              cx="36" cy="36" r="29" fill="none"
              stroke="url(#scoreG)" strokeWidth="5.5" strokeLinecap="round"
              strokeDasharray={`${2 * Math.PI * 29} ${2 * Math.PI * 29}`}
              initial={prefersReduced ? false : { strokeDashoffset: 2 * Math.PI * 29 }}
              animate={{ strokeDashoffset: 2 * Math.PI * 29 * (1 - 0.85) }}
              transform="rotate(-90 36 36)"
              transition={{ duration: 1.4, delay: 0.6, ease: [0.4, 0, 0.2, 1] }}
            />
            <text x="36" y="33" textAnchor="middle" fill="rgb(var(--foreground))" fontSize="16" fontWeight="700" fontStyle="normal">85</text>
            <text x="36" y="44" textAnchor="middle" fill="rgb(var(--muted))" fontSize="7" fontStyle="normal">DISCIPLINE</text>
          </svg>
        </motion.div>

        {/* Equity chart */}
        <motion.div
          className="col-span-1 rounded-xl p-3.5 border"
          style={{ background: "rgb(var(--surface)/0.5)", borderColor: "rgb(var(--border))" }}
          initial={prefersReduced ? false : { opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.62, ease }}
        >
          <p className="text-[9px] uppercase tracking-widest mb-2" style={{ color: "rgb(var(--muted))", fontStyle: "normal" }}>{t("preview_equity")}</p>
          <svg viewBox="0 0 100 40" className="w-full h-9" preserveAspectRatio="none" aria-hidden>
            <defs>
              <linearGradient id="eqG" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="rgb(var(--profit))" stopOpacity="0.25" />
                <stop offset="100%" stopColor="rgb(var(--profit))" stopOpacity="0" />
              </linearGradient>
            </defs>
            {/* Animated fill area */}
            <motion.path
              d="M0,38 L9,35 L20,37 L31,28 L42,24 L53,19 L64,14 L76,10 L87,6 L100,2 L100,40 L0,40Z"
              fill="url(#eqG)"
              initial={prefersReduced ? false : { opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ duration: 0.6, delay: 1.6 }}
            />
            {/* Animated line drawing in */}
            <motion.path
              d="M0,38 L9,35 L20,37 L31,28 L42,24 L53,19 L64,14 L76,10 L87,6 L100,2"
              fill="none" stroke="rgb(var(--profit))" strokeWidth="1.5"
              initial={prefersReduced ? false : { pathLength: 0, opacity: 0 }}
              animate={{ pathLength: 1, opacity: 1 }}
              transition={{ duration: 1.6, delay: 0.65, ease: "easeOut" }}
            />
          </svg>
          <p className="text-sm font-bold mt-1.5" style={{ color: "rgb(var(--profit))", fontStyle: "normal" }}>+3 240€</p>
        </motion.div>

        {/* Win rate */}
        <motion.div
          className="rounded-xl p-3.5 border"
          style={{ background: "rgb(var(--surface)/0.5)", borderColor: "rgb(var(--border))" }}
          initial={prefersReduced ? false : { opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.72, ease }}
        >
          <p className="text-[9px] uppercase tracking-widest" style={{ color: "rgb(var(--muted))", fontStyle: "normal" }}>{t("preview_winrate")}</p>
          <p className="text-2xl font-bold mt-0.5 tracking-tight" style={{ color: "rgb(var(--foreground))", fontStyle: "normal" }}>68%</p>
          <p className="text-[9px] uppercase tracking-widest mt-2.5" style={{ color: "rgb(var(--muted))", fontStyle: "normal" }}>{t("preview_trades")}</p>
          <p className="text-2xl font-bold mt-0.5 tracking-tight" style={{ color: "rgb(var(--foreground))", fontStyle: "normal" }}>47</p>
        </motion.div>

        {/* Challenge progress */}
        <motion.div
          className="rounded-xl p-3.5 border"
          style={{ background: "rgb(var(--surface)/0.5)", borderColor: "rgb(var(--border))" }}
          initial={prefersReduced ? false : { opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.82, ease }}
        >
          <p className="text-[9px] uppercase tracking-widest" style={{ color: "rgb(var(--muted))", fontStyle: "normal" }}>{t("preview_pnl_total")}</p>
          <p className="text-lg font-bold mt-0.5" style={{ color: "rgb(var(--profit))", fontStyle: "normal" }}>+3 240€</p>
          <p className="text-[9px] uppercase tracking-widest mt-2.5" style={{ color: "rgb(var(--muted))", fontStyle: "normal" }}>{t("preview_challenge")}</p>
          <div className="mt-1.5 h-1 rounded-full overflow-hidden" style={{ background: "rgb(var(--surface))" }}>
            <motion.div
              className="h-full rounded-full"
              style={{ background: "linear-gradient(90deg, rgb(var(--accent)) 0%, rgb(var(--profit)) 100%)" }}
              initial={{ width: "0%" }}
              animate={{ width: "89%" }}
              transition={{ duration: 1.2, delay: 1.0, ease: [0.4, 0, 0.2, 1] }}
            />
          </div>
          <p className="text-[9px] mt-1" style={{ color: "rgb(var(--muted))", fontStyle: "normal" }}>89%</p>
        </motion.div>
      </div>

      {/* AI insight bar */}
      <motion.div
        className="mx-4 sm:mx-6 mb-3 flex items-center gap-2.5 rounded-lg px-4 py-2.5 border"
        style={{
          background: "rgb(var(--profit)/0.06)",
          borderColor: "rgb(var(--profit)/0.15)",
        }}
        initial={prefersReduced ? false : { opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.45, delay: 1.0, ease }}
      >
        <div className="w-5 h-5 rounded-md flex items-center justify-center shrink-0" style={{ background: "rgb(var(--profit)/0.15)" }} aria-hidden>
          <svg className="w-3 h-3" style={{ color: "rgb(var(--profit))" }} fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.813 15.904L9 18.75l-.813-2.846a4.5 4.5 0 00-3.09-3.09L2.25 12l2.846-.813a4.5 4.5 0 003.09-3.09L9 5.25l.813 2.846a4.5 4.5 0 003.09 3.09L15.75 12l-2.846.813a4.5 4.5 0 00-3.09 3.09z" />
          </svg>
        </div>
        <p className="text-xs leading-snug" style={{ color: "rgb(var(--foreground)/0.8)", fontStyle: "normal" }}>
          {t("mockup_streak_label")} — <span className="font-semibold" style={{ color: "rgb(var(--profit))" }}>{t("mockup_streak_record")}</span>
        </p>
      </motion.div>

      {/* Trade rows */}
      <div className="mx-4 sm:mx-6 mb-5 border rounded-xl overflow-hidden" style={{ borderColor: "rgb(var(--border))" }}>
        {[
          { pair: "EUR/USD", dir: "BUY",  pnl: "+182.50", win: true,  date: "28/04" },
          { pair: "GBP/JPY", dir: "SELL", pnl: "-47.20",  win: false, date: "27/04" },
          { pair: "XAU/USD", dir: "BUY",  pnl: "+316.00", win: true,  date: "26/04" },
        ].map((tr, idx) => (
          <motion.div
            key={tr.pair}
            className="flex items-center gap-3 px-4 py-2.5 text-xs transition-colors"
            style={{
              borderBottom: idx < 2 ? `1px solid rgb(var(--border))` : undefined,
              fontStyle: "normal",
            }}
            initial={prefersReduced ? false : { opacity: 0, x: -8 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.35, delay: 1.1 + idx * 0.07, ease }}
          >
            <span className="tabular-nums w-9 shrink-0" style={{ color: "rgb(var(--muted)/0.5)" }}>{tr.date}</span>
            <span className="font-medium w-14" style={{ color: "rgb(var(--foreground))" }}>{tr.pair}</span>
            <span
              className="px-2 py-0.5 rounded-md text-[10px] font-semibold"
              style={{
                background: tr.dir === "BUY" ? "rgb(var(--profit)/0.1)" : "rgb(var(--loss)/0.1)",
                color: tr.dir === "BUY" ? "rgb(var(--profit))" : "rgb(var(--loss))",
              }}
            >
              {tr.dir}
            </span>
            <div className="flex-1 h-px" style={{ background: "rgb(var(--border))" }} aria-hidden />
            <span className="font-bold tabular-nums" style={{ color: tr.win ? "rgb(var(--profit))" : "rgb(var(--loss))" }}>{tr.pnl}€</span>
          </motion.div>
        ))}
      </div>
    </div>
  );
}

/* ─────────────────────────────────────────────
   PLATFORM MARQUEE
   Défilement infini des plateformes compatibles
───────────────────────────────────────────── */
const MARQUEE_PLATFORMS = ["MetaTrader 4", "MetaTrader 5", "cTrader", "TradingView", "Binance", "Bybit", "CSV / Excel"];

function PlatformMarquee() {
  const { t } = useLanguage();
  // 6 copies : la piste doit faire ≥ 2× la largeur des grands écrans (1920px)
  // pour que la boucle translateX(-50%) ne montre jamais de trou
  // (½ piste = 3 copies exactes → raccord invisible).
  const items = Array.from({ length: 6 }, () => MARQUEE_PLATFORMS).flat();

  return (
    <section className="py-10 px-0 overflow-hidden" aria-label={t("marquee_caption")}>
      <p className="text-center text-[11px] font-semibold uppercase tracking-[0.18em] mb-6" style={{ color: "rgb(var(--muted)/0.7)", fontStyle: "normal" }}>
        {t("marquee_caption")}
      </p>
      <div
        className="relative"
        style={{
          maskImage: "linear-gradient(90deg, transparent 0%, black 12%, black 88%, transparent 100%)",
          WebkitMaskImage: "linear-gradient(90deg, transparent 0%, black 12%, black 88%, transparent 100%)",
        }}
      >
        <div className="marquee-track flex items-center gap-3 w-max">
          {items.map((name, i) => (
            <span
              key={`${name}-${i}`}
              className="shrink-0 px-5 py-2.5 rounded-xl border text-sm font-semibold whitespace-nowrap"
              style={{
                borderColor: "rgb(var(--border))",
                background: "rgb(var(--card))",
                color: "rgb(var(--foreground)/0.75)",
                fontStyle: "normal",
              }}
              aria-hidden={i >= MARQUEE_PLATFORMS.length}
            >
              {name}
            </span>
          ))}
        </div>
      </div>
    </section>
  );
}

/* ─────────────────────────────────────────────
   STATS STRIP
───────────────────────────────────────────── */
function StatsStrip() {
  const { t } = useLanguage();
  const stats = [
    { value: 500,   suffix: "+",  label: t("social_stat_1_label"),  decimals: 0 },
    { value: 10000, suffix: "+",  label: t("social_stat_2_label"),  decimals: 0 },
    { value: 4.8,   suffix: "/5", label: t("social_stat_3_label"),  decimals: 1 },
  ];

  return (
    <section className="py-12 px-6 border-y" style={{ borderColor: "rgb(var(--border)/0.5)" }}>
      <div className="max-w-4xl mx-auto">
        <div className="grid grid-cols-3 divide-x" style={{ "--tw-divide-opacity": 1 } as React.CSSProperties}>
          {stats.map((s, i) => (
            <Reveal key={i} delay={i * 0.07} className="text-center px-4 sm:px-8">
              <p className="text-2xl sm:text-3xl md:text-4xl font-bold tracking-tight" style={{ fontStyle: "normal", color: "rgb(var(--foreground))" }}>
                <Counter end={s.value} suffix={s.suffix} decimals={s.decimals} />
              </p>
              <p className="text-[13px] mt-1.5 font-medium tracking-wide" style={{ color: "rgb(var(--muted))", fontStyle: "normal" }}>{s.label}</p>
            </Reveal>
          ))}
        </div>
      </div>
    </section>
  );
}

/* ─────────────────────────────────────────────
   PROBLEM SECTION
───────────────────────────────────────────── */
function Problem() {
  const { t } = useLanguage();
  const problems = [
    {
      colorClass: "text-[rgb(var(--loss))]",
      bgStyle: { background: "rgb(var(--loss)/0.05)", borderColor: "rgb(var(--loss)/0.12)" },
      accentBg: { background: "rgb(var(--loss)/0.12)" },
      title: t("problem_1_title"),
      desc: t("problem_1_desc"),
      icon: (
        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden>
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M13 10V3L4 14h7v7l9-11h-7z" />
        </svg>
      ),
    },
    {
      colorClass: "text-amber-400",
      bgStyle: { background: "rgba(251,191,36,0.05)", borderColor: "rgba(251,191,36,0.12)" },
      accentBg: { background: "rgba(251,191,36,0.12)" },
      title: t("problem_2_title"),
      desc: t("problem_2_desc"),
      icon: (
        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden>
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
        </svg>
      ),
    },
    {
      colorClass: "text-purple-400",
      bgStyle: { background: "rgba(167,139,250,0.05)", borderColor: "rgba(167,139,250,0.12)" },
      accentBg: { background: "rgba(167,139,250,0.12)" },
      title: t("problem_3_title"),
      desc: t("problem_3_desc"),
      icon: (
        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden>
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M18.364 18.364A9 9 0 005.636 5.636m12.728 12.728L5.636 5.636m12.728 12.728A9 9 0 015.636 5.636" />
        </svg>
      ),
    },
  ];

  return (
    <section className="py-28 px-6">
      <div className="max-w-5xl mx-auto">
        <Reveal className="text-center mb-16">
          <p className="text-xs font-bold uppercase tracking-widest mb-4" style={{ color: "rgb(var(--accent))", fontStyle: "normal" }}>
            {t("eyebrow_problem")}
          </p>
          <h2 className="text-4xl sm:text-5xl font-bold leading-tight" style={{ color: "rgb(var(--foreground))" }}>
            {t("problem_title")}
            <br />
            <span style={{ color: "rgb(var(--muted))" }}>{t("problem_subtitle")}</span>
          </h2>
        </Reveal>

        <StaggerReveal className="grid grid-cols-1 md:grid-cols-3 gap-4" stagger={0.1}>
          {problems.map((p) => (
            <motion.div
              key={p.title}
              className={`border rounded-2xl p-7 ${p.colorClass}`}
              style={p.bgStyle}
              whileHover={{ y: -5, scale: 1.006, boxShadow: "0 20px 56px -12px rgba(0,0,0,0.55), inset 0 1px 0 rgba(255,255,255,0.07)" }}
              transition={{ duration: 0.22, ease: [0.16, 1, 0.3, 1] }}
            >
              <div className="w-10 h-10 rounded-xl flex items-center justify-center mb-5" style={p.accentBg}>
                {p.icon}
              </div>
              <h3 className="text-base font-bold mb-2" style={{ color: "rgb(var(--foreground))", fontStyle: "normal" }}>{p.title}</h3>
              <p className="text-[15px] leading-relaxed" style={{ color: "rgb(var(--muted))", fontStyle: "normal" }}>{p.desc}</p>
            </motion.div>
          ))}
        </StaggerReveal>
      </div>
    </section>
  );
}

/* ─────────────────────────────────────────────
   FEATURES — bento grid
───────────────────────────────────────────── */
const PLATFORMS = ["MT5", "MT4", "cTrader", "Binance", "Bybit", "OKX", "Bitget", "TradingView"];

function BentoImport({ t }: { t: (k: string) => string }) {
  return (
    <div className="h-full flex flex-col gap-4 p-6">
      <div
        className="border-2 border-dashed rounded-xl p-5 flex flex-col items-center gap-3 text-center transition-colors"
        style={{ borderColor: "rgb(var(--border))" }}
      >
        <div className="w-9 h-9 rounded-lg flex items-center justify-center" style={{ background: "rgb(var(--accent)/0.1)", color: "rgb(var(--accent))" }}>
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden>
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
          </svg>
        </div>
        <p className="text-sm font-semibold" style={{ color: "rgb(var(--foreground))", fontStyle: "normal" }}>{t("feature_import_drop")}</p>
        <div className="w-full">
          <div className="flex items-center gap-2 mb-2 px-1">
            <svg className="w-3.5 h-3.5 shrink-0" style={{ color: "rgb(var(--accent))" }} fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden>
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
            </svg>
            <span className="text-xs" style={{ color: "rgb(var(--foreground)/0.7)", fontStyle: "normal" }}>trades_history.csv</span>
            <span className="ml-auto text-[10px] font-semibold" style={{ color: "rgb(var(--profit))", fontStyle: "normal" }}>{t("feature_import_tag")}</span>
          </div>
          <div className="h-1 rounded-full overflow-hidden" style={{ background: "rgb(var(--border))" }}>
            <div className="h-full rounded-full" style={{ width: "100%", background: "rgb(var(--accent))" }} />
          </div>
        </div>
      </div>
      <div>
        <p className="text-[10px] mb-2 font-medium" style={{ color: "rgb(var(--muted))", fontStyle: "normal" }}>{t("feature_import_formats")}</p>
        <div className="flex flex-wrap gap-1.5">
          {PLATFORMS.map((name) => (
            <span key={name} className="px-2 py-0.5 rounded-md text-[10px] font-medium border" style={{ color: "rgb(var(--muted)/0.8)", borderColor: "rgb(var(--border))", background: "rgb(var(--surface))", fontStyle: "normal" }}>
              {name}
            </span>
          ))}
        </div>
      </div>
    </div>
  );
}

function AiAvatar() {
  return (
    <div className="w-5 h-5 rounded-full flex items-center justify-center shrink-0" style={{ background: "rgb(var(--accent)/0.15)" }} aria-hidden>
      <svg className="w-2.5 h-2.5" style={{ color: "rgb(var(--accent))" }} fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9.813 15.904L9 18.75l-.813-2.846a4.5 4.5 0 00-3.09-3.09L2.25 12l2.846-.813a4.5 4.5 0 003.09-3.09L9 5.25l.813 2.846a4.5 4.5 0 003.09 3.09L15.75 12l-2.846.813a4.5 4.5 0 00-3.09 3.09z" />
      </svg>
    </div>
  );
}

function BentoAIChat({ t }: { t: (k: string) => string }) {
  const [showTyping, setShowTyping] = useState(true);
  const prefersReduced = useReducedMotion();

  useEffect(() => {
    if (prefersReduced) { setShowTyping(false); return; }
    const timer = setTimeout(() => setShowTyping(false), 2000);
    return () => clearTimeout(timer);
  }, [prefersReduced]);

  const earlyMsgs = [
    { side: "ai",   text: t("feature_ai_msg_1") },
    { side: "user", text: t("feature_ai_msg_2") },
    { side: "ai",   text: t("feature_ai_msg_3") },
  ];
  const lastAiMsg = t("feature_ai_msg_5");

  return (
    <div className="h-full flex flex-col">
      {/* Header */}
      <div className="px-4 py-3 flex items-center gap-2 border-b" style={{ borderColor: "rgb(var(--border)/0.5)" }}>
        <div className="w-6 h-6 rounded-full flex items-center justify-center" style={{ background: "rgb(var(--accent)/0.15)" }}>
          <svg className="w-3 h-3" style={{ color: "rgb(var(--accent))" }} fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden>
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9.813 15.904L9 18.75l-.813-2.846a4.5 4.5 0 00-3.09-3.09L2.25 12l2.846-.813a4.5 4.5 0 003.09-3.09L9 5.25l.813 2.846a4.5 4.5 0 003.09 3.09L15.75 12l-2.846.813a4.5 4.5 0 00-3.09 3.09z" />
          </svg>
        </div>
        <div>
          <p className="text-xs font-semibold" style={{ color: "rgb(var(--foreground))", fontStyle: "normal" }}>{t("feature_ai_coach_label")}</p>
          <p className="presence-dot text-[9px] leading-none" style={{ color: "rgb(var(--profit))", fontStyle: "normal" }}>● Online</p>
        </div>
      </div>

      {/* Messages */}
      <div className="flex-1 p-4 space-y-3 overflow-hidden">
        {earlyMsgs.map((m, i) =>
          m.side === "ai" ? (
            <motion.div
              key={i}
              className="flex gap-2 items-end"
              initial={prefersReduced ? false : { opacity: 0, y: 6 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.4, delay: i * 0.12, ease }}
            >
              <AiAvatar />
              <div className="rounded-xl rounded-bl-sm px-3 py-2 text-[11px] max-w-[85%] leading-relaxed border card-inset" style={{ background: "rgb(var(--surface))", borderColor: "rgb(var(--border))", color: "rgb(var(--foreground))", fontStyle: "normal" }}>
                {m.text}
              </div>
            </motion.div>
          ) : (
            <motion.div
              key={i}
              className="flex justify-end"
              initial={prefersReduced ? false : { opacity: 0, y: 6 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.4, delay: i * 0.12, ease }}
            >
              <div className="px-3 py-2 text-[11px] max-w-[72%] rounded-xl rounded-br-sm leading-relaxed text-white" style={{ background: "linear-gradient(135deg, rgb(var(--accent)) 0%, #3b82f6 100%)", fontStyle: "normal" }}>
                {m.text}
              </div>
            </motion.div>
          )
        )}

        {/* Typing indicator → fades out, last message fades in */}
        <AnimatePresence mode="wait">
          {showTyping ? (
            <motion.div
              key="typing"
              className="flex gap-2 items-end"
              initial={{ opacity: 0, y: 6 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -4, transition: { duration: 0.2 } }}
              transition={{ duration: 0.3, delay: 0.4 }}
            >
              <AiAvatar />
              <div className="rounded-xl rounded-bl-sm px-3.5 py-2.5 border flex items-center gap-1.5" style={{ background: "rgb(var(--surface))", borderColor: "rgb(var(--border))" }}>
                <span className="typing-dot typing-dot-1" />
                <span className="typing-dot typing-dot-2" />
                <span className="typing-dot typing-dot-3" />
              </div>
            </motion.div>
          ) : (
            <motion.div
              key="last-msg"
              className="flex gap-2 items-end"
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.35, ease }}
            >
              <AiAvatar />
              <div className="rounded-xl rounded-bl-sm px-3 py-2 text-[11px] max-w-[85%] leading-relaxed border card-inset" style={{ background: "rgb(var(--surface))", borderColor: "rgb(var(--border))", color: "rgb(var(--foreground))", fontStyle: "normal" }}>
                {lastAiMsg}
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}

function BentoDisciplineScore({ t }: { t: (k: string) => string }) {
  const r = 34, circ = 2 * Math.PI * r;
  const rules = [
    { label: "SL ≤ 1%",                 ok: true  },
    { label: "RR ≥ 2:1",                 ok: true  },
    { label: t("mockup_rule_max_trades"), ok: false },
    { label: "Trading Plan",             ok: true  },
    { label: t("mockup_rule_no_revenge"), ok: false },
  ];
  return (
    <div className="h-full p-5 flex flex-col gap-4">
      <div className="flex items-center gap-5">
        <div className="relative w-20 h-20 shrink-0">
          <svg className="w-20 h-20 -rotate-90" viewBox="0 0 80 80" aria-label="Discipline score 78%" role="img">
            <circle cx="40" cy="40" r={r} fill="none" stroke="rgb(var(--border))" strokeWidth="6" />
            <motion.circle
              cx="40" cy="40" r={r} fill="none"
              stroke="rgb(var(--accent))" strokeWidth="6" strokeLinecap="round"
              strokeDasharray={`${circ} ${circ}`}
              initial={{ strokeDashoffset: circ }}
              whileInView={{ strokeDashoffset: circ * (1 - 0.78) }}
              viewport={{ once: true }}
              transition={{ duration: 1.3, delay: 0.2, ease: [0.4, 0, 0.2, 1] }}
            />
          </svg>
          <div className="absolute inset-0 flex flex-col items-center justify-center">
            <span className="text-xl font-bold tracking-tight" style={{ color: "rgb(var(--foreground))", fontStyle: "normal" }}>78</span>
            <span className="text-[8px] leading-none mt-0.5" style={{ color: "rgb(var(--muted))", fontStyle: "normal" }}>SCORE</span>
          </div>
        </div>
        <div className="flex-1 space-y-1.5">
          {rules.map((rule) => (
            <div key={rule.label} className="flex items-center gap-2">
              <div
                className="w-3.5 h-3.5 rounded-full flex items-center justify-center shrink-0"
                style={{ background: rule.ok ? "rgb(var(--profit)/0.15)" : "rgb(var(--loss)/0.15)" }}
              >
                <svg
                  className="w-2 h-2"
                  style={{ color: rule.ok ? "rgb(var(--profit))" : "rgb(var(--loss))" }}
                  fill="none" stroke="currentColor" viewBox="0 0 24 24"
                  aria-hidden
                >
                  {rule.ok
                    ? <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                    : <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M6 18L18 6M6 6l12 12" />}
                </svg>
              </div>
              <span className="text-[10px]" style={{ color: "rgb(var(--foreground)/0.8)", fontStyle: "normal" }}>{rule.label}</span>
            </div>
          ))}
        </div>
      </div>
      <div className="grid grid-cols-2 gap-2.5">
        <div className="rounded-lg p-3 text-center border" style={{ background: "rgb(var(--profit)/0.06)", borderColor: "rgb(var(--profit)/0.12)" }}>
          <p className="text-[9px] mb-0.5" style={{ color: "rgb(var(--muted))", fontStyle: "normal" }}>{t("feature_score_conformes")}</p>
          <p className="text-base font-bold" style={{ color: "rgb(var(--profit))", fontStyle: "normal" }}>18/23</p>
        </div>
        <div className="rounded-lg p-3 text-center border" style={{ background: "rgb(var(--loss)/0.06)", borderColor: "rgb(var(--loss)/0.12)" }}>
          <p className="text-[9px] mb-0.5" style={{ color: "rgb(var(--muted))", fontStyle: "normal" }}>{t("feature_score_violations")}</p>
          <p className="text-base font-bold" style={{ color: "rgb(var(--loss))", fontStyle: "normal" }}>5</p>
        </div>
      </div>
    </div>
  );
}

/* MetaTrader → TradeDiscipline live sync — animated connection */
function BentoSync({ t }: { t: (k: string) => string }) {
  const prefersReduced = useReducedMotion();

  const Node = ({ label, sub, children }: { label: string; sub?: string; children: React.ReactNode }) => (
    <div className="flex flex-col items-center gap-1.5 shrink-0">
      <div
        className="w-12 h-12 rounded-xl flex items-center justify-center border"
        style={{ background: "rgb(var(--surface))", borderColor: "rgb(var(--border))" }}
      >
        {children}
      </div>
      <span className="text-[10px] font-semibold" style={{ color: "rgb(var(--foreground))", fontStyle: "normal" }}>{label}</span>
      {sub && <span className="text-[8px]" style={{ color: "rgb(var(--muted))", fontStyle: "normal" }}>{sub}</span>}
    </div>
  );

  return (
    <div className="h-full p-6 flex flex-col gap-5">
      {/* Connection diagram */}
      <div className="flex items-center justify-between gap-2">
        <Node label={t("feature_sync_node_mt")} sub="MT4 / MT5">
          <span className="text-base font-bold tracking-tight" style={{ color: "rgb(var(--accent))", fontStyle: "normal" }}>MT</span>
        </Node>

        {/* Animated connector */}
        <div className="relative flex-1 h-10 mx-1" aria-hidden>
          {/* Base dashed line */}
          <div
            className="absolute top-1/2 left-0 right-0 -translate-y-1/2 h-px"
            style={{
              backgroundImage: "linear-gradient(90deg, rgb(var(--border)) 0 6px, transparent 6px 12px)",
              backgroundSize: "12px 1px",
            }}
          />
          {/* Active gradient overlay */}
          <div
            className="absolute top-1/2 left-0 right-0 -translate-y-1/2 h-px"
            style={{ background: "linear-gradient(90deg, transparent, rgb(var(--accent)/0.5), transparent)" }}
          />
          {/* Traveling pulse */}
          <motion.div
            className="absolute top-1/2 w-2 h-2 rounded-full -translate-y-1/2"
            style={{ background: "rgb(var(--accent))", boxShadow: "0 0 8px 2px rgb(var(--accent)/0.5)" }}
            initial={prefersReduced ? { left: "50%", opacity: 1 } : { left: "4%", opacity: 0 }}
            animate={prefersReduced ? {} : { left: ["4%", "92%"], opacity: [0, 1, 1, 0] }}
            transition={prefersReduced ? undefined : { duration: 1.8, repeat: Infinity, ease: "easeInOut", times: [0, 0.1, 0.9, 1] }}
          />
        </div>

        <Node label={t("feature_sync_node_app")}>
          <svg className="w-5 h-5" style={{ color: "rgb(var(--accent))" }} fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24" aria-hidden>
            <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 18L9 11.25l4.306 4.307a11.95 11.95 0 015.814-5.519l2.74-1.22m0 0l-5.94-2.28m5.94 2.28l-2.28 5.941" />
          </svg>
        </Node>
      </div>

      {/* Live status row */}
      <div className="flex items-center gap-2.5 rounded-lg px-3.5 py-2.5 border" style={{ background: "rgb(var(--profit)/0.06)", borderColor: "rgb(var(--profit)/0.15)" }}>
        <span className="presence-dot w-2 h-2 rounded-full shrink-0" style={{ background: "rgb(var(--profit))" }} aria-hidden />
        <span className="text-xs flex-1" style={{ color: "rgb(var(--foreground)/0.85)", fontStyle: "normal" }}>{t("feature_sync_status")}</span>
        <span
          className="text-[9px] font-bold tracking-wider px-2 py-0.5 rounded-full"
          style={{ background: "rgb(var(--profit)/0.15)", color: "rgb(var(--profit))", fontStyle: "normal" }}
        >
          {t("feature_sync_live")}
        </span>
      </div>

      {/* CSV note */}
      <div className="flex items-center gap-2 mt-auto">
        <svg className="w-3.5 h-3.5 shrink-0" style={{ color: "rgb(var(--muted))" }} fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden>
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
        </svg>
        <span className="text-[10px]" style={{ color: "rgb(var(--muted))", fontStyle: "normal" }}>{t("feature_sync_vs_csv")}</span>
      </div>
    </div>
  );
}

/* Strategy coach — natural language → setup rules, tags & params (real app behaviour) */
function BentoStrategy({ t }: { t: (k: string) => string }) {
  const prefersReduced = useReducedMotion();
  const violet = "rgb(167,139,250)";

  // Extracted risk/structure parameters (mirror the real Strategy page)
  const params = [
    t("feature_strategy_rule_pairs"),
    t("feature_strategy_rule_session"),
    t("feature_strategy_rule_rr"),
    t("feature_strategy_rule_trades"),
    t("feature_strategy_rule_risk"),
  ];

  // Auto-generated trading tags, grouped & colour-coded like the app.
  // Chips use universal ICT terminology on purpose — it shows the AI speaks the trader's language.
  const categories = [
    { header: t("feature_strategy_cat_setups"),  rgb: "59,130,246",  chips: [t("feature_strategy_tag_setup_1"), t("feature_strategy_tag_setup_2")] },
    { header: t("feature_strategy_cat_zones"),   rgb: "167,139,250", chips: [t("feature_strategy_tag_zone_1"), t("feature_strategy_tag_zone_2")] },
    { header: t("feature_strategy_cat_targets"), rgb: "251,191,36",  chips: [t("feature_strategy_tag_target_1"), t("feature_strategy_tag_target_2")] },
    { header: t("feature_strategy_cat_timing"),  rgb: "34,197,94",   chips: [t("feature_strategy_tag_timing_1"), t("feature_strategy_tag_timing_2")] },
  ];

  let chipIdx = 0; // global stagger index across all chips

  return (
    <div className="p-6">
      <div className="flex flex-col lg:flex-row gap-4 lg:gap-5">
        {/* Left — natural language prompt */}
        <div className="lg:w-[36%] flex flex-col gap-2 shrink-0">
          <div className="flex items-center gap-2">
            <div className="w-5 h-5 rounded-full flex items-center justify-center text-[9px] font-bold shrink-0" style={{ background: "rgb(var(--surface))", border: "1px solid rgb(var(--border))", color: "rgb(var(--muted))" }} aria-hidden>T</div>
            <span className="text-[11px] font-medium" style={{ color: "rgb(var(--muted))", fontStyle: "normal" }}>{t("feature_strategy_you")}</span>
          </div>
          <div
            className="rounded-xl rounded-tl-sm px-3.5 py-3 text-[12.5px] leading-relaxed border flex-1"
            style={{ background: "rgb(var(--surface))", borderColor: "rgb(var(--border))", color: "rgb(var(--foreground)/0.85)", fontStyle: "normal" }}
          >
            {t("feature_strategy_prompt")}
          </div>
        </div>

        {/* IA pulse + arrow */}
        <div className="flex lg:flex-col items-center justify-center gap-1 shrink-0" aria-hidden>
          <div className="flex items-center gap-1 px-2 py-0.5 rounded-full" style={{ background: "rgba(167,139,250,0.12)" }}>
            <motion.svg
              className="w-3 h-3" style={{ color: violet }} fill="none" stroke="currentColor" viewBox="0 0 24 24"
              animate={prefersReduced ? {} : { rotate: [0, 15, -10, 0], scale: [1, 1.15, 1] }}
              transition={prefersReduced ? undefined : { duration: 2.4, repeat: Infinity, ease: "easeInOut" }}
            >
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9.813 15.904L9 18.75l-.813-2.846a4.5 4.5 0 00-3.09-3.09L2.25 12l2.846-.813a4.5 4.5 0 003.09-3.09L9 5.25l.813 2.846a4.5 4.5 0 003.09 3.09L15.75 12l-2.846.813a4.5 4.5 0 00-3.09 3.09z" />
            </motion.svg>
            <span className="text-[9px] font-bold tracking-wider" style={{ color: violet, fontStyle: "normal" }}>IA</span>
          </div>
          <svg className="w-4 h-4 rotate-90 lg:rotate-0" style={{ color: "rgb(var(--muted)/0.6)" }} fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
          </svg>
        </div>

        {/* Right — auto-generated output */}
        <div className="flex-1 flex flex-col gap-4 min-w-0">
          <div className="flex items-center gap-1.5">
            <svg className="w-3.5 h-3.5 shrink-0" style={{ color: violet }} fill="currentColor" viewBox="0 0 24 24" aria-hidden>
              <path d="M9.813 15.904L9 18.75l-.813-2.846a4.5 4.5 0 00-3.09-3.09L2.25 12l2.846-.813a4.5 4.5 0 003.09-3.09L9 5.25l.813 2.846a4.5 4.5 0 003.09 3.09L15.75 12l-2.846.813a4.5 4.5 0 00-3.09 3.09z" />
            </svg>
            <span className="text-[10px] font-semibold uppercase tracking-wider" style={{ color: violet, fontStyle: "normal" }}>{t("feature_strategy_generated")}</span>
          </div>

          {/* Extracted parameters */}
          <div>
            <p className="text-[10px] uppercase tracking-widest mb-1.5" style={{ color: "rgb(var(--muted))", fontStyle: "normal" }}>{t("feature_strategy_params_label")}</p>
            <div className="flex flex-wrap gap-1.5">
              {params.map((p, i) => (
                <motion.span
                  key={p}
                  className="px-2 py-0.5 rounded-md text-[11px] font-medium border"
                  style={{ color: "rgb(var(--foreground)/0.85)", background: "rgb(var(--accent)/0.06)", borderColor: "rgb(var(--accent)/0.2)", fontStyle: "normal" }}
                  initial={prefersReduced ? false : { opacity: 0, y: 6 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  viewport={{ once: true }}
                  transition={{ duration: 0.35, delay: 0.1 + i * 0.06, ease }}
                >
                  {p}
                </motion.span>
              ))}
            </div>
          </div>

          {/* Generated tags by category */}
          <div>
            <p className="text-[10px] uppercase tracking-widest mb-2" style={{ color: "rgb(var(--muted))", fontStyle: "normal" }}>{t("feature_strategy_tags_label")}</p>
            <div className="grid grid-cols-2 gap-x-4 gap-y-2.5">
              {categories.map((cat) => (
                <div key={cat.header}>
                  <p className="text-[10px] font-semibold mb-1" style={{ color: `rgb(${cat.rgb})`, fontStyle: "normal" }}>{cat.header}</p>
                  <div className="flex flex-wrap gap-1">
                    {cat.chips.map((chip) => {
                      const delay = 0.45 + chipIdx * 0.05;
                      chipIdx += 1;
                      return (
                        <motion.span
                          key={chip}
                          className="px-1.5 py-0.5 rounded text-[10.5px] font-medium border"
                          style={{ color: `rgb(${cat.rgb})`, background: `rgba(${cat.rgb},0.08)`, borderColor: `rgba(${cat.rgb},0.2)`, fontStyle: "normal" }}
                          initial={prefersReduced ? false : { opacity: 0, scale: 0.9 }}
                          whileInView={{ opacity: 1, scale: 1 }}
                          viewport={{ once: true }}
                          transition={{ duration: 0.3, delay, ease }}
                        >
                          {chip}
                        </motion.span>
                      );
                    })}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* Kicker — the "not generic ChatGPT" message */}
      <div className="mt-5 pt-4 border-t flex items-start gap-2" style={{ borderColor: "rgb(var(--border)/0.6)" }}>
        <svg className="w-3.5 h-3.5 shrink-0 mt-0.5" style={{ color: violet }} fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden>
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M13 10V3L4 14h7v7l9-11h-7z" />
        </svg>
        <p className="text-[12.5px] leading-relaxed" style={{ color: "rgb(var(--foreground)/0.7)", fontStyle: "normal" }}>{t("feature_strategy_kicker")}</p>
      </div>
    </div>
  );
}

type FeatureDef = {
  tagStyle: React.CSSProperties;
  tag: string;
  title: string;
  desc: string;
  visual: React.ReactNode;
};

function FeatureCard({ f }: { f: FeatureDef }) {
  return (
    <motion.div
      className="relative rounded-2xl border overflow-hidden h-full group/card"
      style={{ background: "rgb(var(--card))", borderColor: "rgb(var(--border))" }}
      whileHover={{ y: -4, borderColor: "rgb(var(--accent)/0.28)", boxShadow: "0 0 0 1px rgb(var(--accent)/0.08), 0 24px 60px -12px rgba(0,0,0,0.55), inset 0 1px 0 rgba(255,255,255,0.05)" }}
      transition={{ duration: 0.24, ease: [0.16, 1, 0.3, 1] }}
    >
      <div
        className="absolute inset-x-0 top-0 h-px opacity-0 group-hover/card:opacity-100 transition-opacity duration-300 pointer-events-none"
        style={{ background: "linear-gradient(90deg, transparent 0%, rgb(var(--accent)/0.6) 50%, transparent 100%)" }}
        aria-hidden
      />
      <div className="p-6 pb-0">
        <span
          className="inline-block text-[10px] font-bold tracking-widest px-2.5 py-1 rounded-md border mb-3"
          style={{ ...f.tagStyle, fontStyle: "normal" }}
        >
          {f.tag}
        </span>
        <h3 className="text-lg sm:text-xl font-bold mb-1.5" style={{ color: "rgb(var(--foreground))", fontStyle: "normal" }}>{f.title}</h3>
        <p className="text-[15px] leading-relaxed" style={{ color: "rgb(var(--muted))", fontStyle: "normal" }}>{f.desc}</p>
      </div>
      <div className="mt-4 border-t" style={{ borderColor: "rgb(var(--border)/0.5)", background: "rgb(var(--surface)/0.3)" }}>
        {f.visual}
      </div>
    </motion.div>
  );
}

function Features() {
  const { t } = useLanguage();
  const prefersReduced = useReducedMotion();

  const accentTag = { color: "rgb(var(--accent))", background: "rgb(var(--accent)/0.08)", borderColor: "rgb(var(--accent)/0.15)" };
  const violetTag = { color: "rgb(167,139,250)", background: "rgba(167,139,250,0.08)", borderColor: "rgba(167,139,250,0.15)" };
  const profitTag = { color: "rgb(var(--profit))", background: "rgb(var(--profit)/0.08)", borderColor: "rgb(var(--profit)/0.15)" };

  // The feature blocks arranged as the real usage chronology.
  const steps: { num: string; title: string; sub: string; cards: FeatureDef[] }[] = [
    {
      num: "1",
      title: t("chrono_step_1"),
      sub: t("chrono_step_1_sub"),
      cards: [
        { tagStyle: accentTag, tag: t("feature_1_label"), title: t("feature_1_title"), desc: t("feature_1_desc"), visual: <BentoImport t={t} /> },
        { tagStyle: accentTag, tag: t("feature_sync_label"), title: t("feature_sync_title"), desc: t("feature_sync_desc"), visual: <BentoSync t={t} /> },
      ],
    },
    {
      num: "2",
      title: t("chrono_step_2"),
      sub: t("chrono_step_2_sub"),
      cards: [
        { tagStyle: violetTag, tag: t("feature_strategy_label"), title: t("feature_strategy_title"), desc: t("feature_strategy_desc"), visual: <BentoStrategy t={t} /> },
      ],
    },
    {
      num: "3",
      title: t("chrono_step_3"),
      sub: t("chrono_step_3_sub"),
      cards: [
        { tagStyle: violetTag, tag: t("feature_2_label"), title: t("feature_2_title"), desc: t("feature_2_desc"), visual: <BentoAIChat t={t} /> },
        { tagStyle: profitTag, tag: t("feature_3_label"), title: t("feature_3_title"), desc: t("feature_3_desc"), visual: <BentoDisciplineScore t={t} /> },
      ],
    },
  ];

  return (
    <section id="features" className="py-28 px-6 border-t" style={{ borderColor: "rgb(var(--border)/0.5)" }}>
      <div className="max-w-5xl mx-auto">
        <Reveal className="text-center mb-16">
          <p className="text-[13px] font-bold uppercase tracking-widest mb-4" style={{ color: "rgb(var(--accent))", fontStyle: "normal" }}>{t("eyebrow_features")}</p>
          <h2 className="text-4xl sm:text-5xl font-bold" style={{ color: "rgb(var(--foreground))" }}>{t("features_title")}</h2>
        </Reveal>

        {/* Chronological flow — the blocks ARE the steps */}
        <div className="space-y-6">
          {steps.map((step, si) => (
            <div key={step.num}>
              {/* Connector between steps */}
              {si > 0 && (
                <div className="flex justify-center py-2" aria-hidden>
                  <div className="flex flex-col items-center gap-1">
                    <div className="w-px h-6" style={{ background: "linear-gradient(180deg, rgb(var(--accent)/0.4), rgb(var(--accent)/0.15))" }} />
                    <svg className="w-4 h-4 -mt-1" style={{ color: "rgb(var(--accent)/0.5)" }} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 14l-7 7m0 0l-7-7m7 7V3" />
                    </svg>
                  </div>
                </div>
              )}

              <Reveal>
                {/* Step header */}
                <div className="flex items-center gap-4 mb-5">
                  <motion.div
                    className="w-11 h-11 shrink-0 flex items-center justify-center rounded-xl text-base font-bold border"
                    style={{
                      background: "linear-gradient(135deg, rgb(var(--accent)/0.16) 0%, rgb(var(--accent)/0.05) 100%)",
                      borderColor: "rgb(var(--accent)/0.3)",
                      color: "rgb(var(--accent))",
                      fontStyle: "normal",
                    }}
                    initial={prefersReduced ? false : { scale: 0.8, opacity: 0 }}
                    whileInView={{ scale: 1, opacity: 1 }}
                    viewport={{ once: true }}
                    transition={{ duration: 0.4, ease }}
                    aria-label={`Étape ${step.num}`}
                  >
                    {step.num}
                  </motion.div>
                  <div>
                    <h3 className="text-xl sm:text-2xl font-bold leading-tight" style={{ color: "rgb(var(--foreground))", fontStyle: "normal" }}>{step.title}</h3>
                    <p className="text-[14px] mt-0.5" style={{ color: "rgb(var(--muted))", fontStyle: "normal" }}>{step.sub}</p>
                  </div>
                </div>

                {/* Step cards */}
                <div className={`grid gap-4 ${step.cards.length > 1 ? "md:grid-cols-2" : "grid-cols-1"}`}>
                  {step.cards.map((f) => (
                    <FeatureCard key={f.title} f={f} />
                  ))}
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
    {
      text: t("ai_detect_1"),
      rgb: "239,68,68",
      // flame — revenge trading
      icon: "M12 2c1 3-1 4-2 6-1 1.5-1 3 0 4 1-.5 1.5-1.5 1.5-3 1 1 2 2.5 2 4a3.5 3.5 0 11-7 0c0-1 .3-2 1-3 .2 1 .8 1.5 1.5 1.5-1-2 1-4 3-9.5z",
      filled: true,
    },
    {
      text: t("ai_detect_2"),
      rgb: "34,197,94",
      // clock — best hours
      icon: "M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z",
      filled: false,
    },
    {
      text: t("ai_detect_3"),
      rgb: "251,191,36",
      // warning — recurring rule break
      icon: "M12 9v4m0 4h.01M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z",
      filled: false,
    },
    {
      text: t("ai_detect_4"),
      rgb: "167,139,250",
      // chart — FOMO / setup analytics
      icon: "M3 3v18h18M7 15l3-3 3 2 5-6",
      filled: false,
    },
  ];

  return (
    <section className="py-28 px-6 border-t" style={{ borderColor: "rgb(var(--border)/0.5)" }}>
      <div className="max-w-5xl mx-auto">
        <Reveal className="text-center mb-14">
          <p className="text-xs font-bold uppercase tracking-widest mb-4" style={{ color: "rgb(var(--accent))", fontStyle: "normal" }}>{t("eyebrow_ai_coach")}</p>
          <h2 className="text-4xl sm:text-5xl font-bold" style={{ color: "rgb(var(--foreground))" }}>{t("ai_detect_title")}</h2>
          <p className="mt-4 max-w-xl mx-auto text-base leading-relaxed" style={{ color: "rgb(var(--muted))", fontStyle: "normal" }}>{t("ai_detect_subtitle")}</p>
        </Reveal>

        {/* Démo produit en boucle — le coach IA en action */}
        <Reveal delay={0.1}>
          <LiveDemo />
        </Reveal>

        <StaggerReveal className="grid grid-cols-1 sm:grid-cols-2 gap-3" stagger={0.09}>
          {detections.map((d, i) => (
            <motion.div
              key={i}
              className="border rounded-2xl p-5 flex items-start gap-4"
              style={{ background: `rgba(${d.rgb},0.05)`, borderColor: `rgba(${d.rgb},0.14)` }}
              whileHover={{ y: -4, scale: 1.005, boxShadow: "0 16px 48px -12px rgba(0,0,0,0.5), inset 0 1px 0 rgba(255,255,255,0.05)" }}
              transition={{ duration: 0.2, ease: [0.16, 1, 0.3, 1] }}
            >
              <div className="w-9 h-9 rounded-xl flex items-center justify-center shrink-0" style={{ background: `rgba(${d.rgb},0.12)` }} aria-hidden>
                <svg
                  className="w-[18px] h-[18px]"
                  style={{ color: `rgb(${d.rgb})` }}
                  viewBox="0 0 24 24"
                  fill={d.filled ? "currentColor" : "none"}
                  stroke={d.filled ? "none" : "currentColor"}
                  strokeWidth={1.7}
                  strokeLinecap="round"
                  strokeLinejoin="round"
                >
                  <path d={d.icon} />
                </svg>
              </div>
              <p className="text-[15px] leading-relaxed" style={{ color: "rgb(var(--foreground)/0.85)", fontStyle: "normal" }}>{d.text}</p>
            </motion.div>
          ))}
        </StaggerReveal>
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
    <section className="py-28 px-6 border-t" style={{ borderColor: "rgb(var(--border)/0.5)" }}>
      <div className="max-w-5xl mx-auto">
        <Reveal className="text-center mb-16">
          <p className="text-xs font-bold uppercase tracking-widest mb-4" style={{ color: "rgb(var(--accent))", fontStyle: "normal" }}>{t("eyebrow_social")}</p>
          <h2 className="text-4xl sm:text-5xl font-bold" style={{ color: "rgb(var(--foreground))" }}>{t("social_title")}</h2>
        </Reveal>

        <StaggerReveal className="grid grid-cols-1 md:grid-cols-3 gap-4" stagger={0.1}>
          {testimonials.map((tm, i) => (
            <motion.div
              key={i}
              className="border rounded-2xl p-6 flex flex-col"
              style={{ background: "rgb(var(--card))", borderColor: "rgb(var(--border))" }}
              whileHover={{ y: -5, borderColor: "rgb(var(--accent)/0.25)", boxShadow: "0 20px 56px -12px rgba(0,0,0,0.5), inset 0 1px 0 rgba(255,255,255,0.05)" }}
              transition={{ duration: 0.22, ease: [0.16, 1, 0.3, 1] }}
            >
              <div className="flex gap-0.5 mb-4" aria-label="5 stars" role="img">
                {Array.from({ length: 5 }).map((_, s) => (
                  <svg key={s} className="w-3.5 h-3.5 text-amber-400" fill="currentColor" viewBox="0 0 24 24" aria-hidden>
                    <path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z" />
                  </svg>
                ))}
              </div>
              <blockquote className="text-[15px] leading-relaxed flex-1" style={{ color: "rgb(var(--foreground)/0.75)", fontStyle: "normal" }}>
                &ldquo;{tm.text}&rdquo;
              </blockquote>
              <div className="flex items-center gap-3 mt-5 pt-4 border-t" style={{ borderColor: "rgb(var(--border)/0.5)" }}>
                <div
                  className="w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold text-white shrink-0"
                  style={{ background: "linear-gradient(135deg, rgb(var(--accent)) 0%, #3b82f6 100%)" }}
                  aria-hidden
                >
                  {tm.initials}
                </div>
                <p className="text-xs font-medium" style={{ color: "rgb(var(--muted))", fontStyle: "normal" }}>{tm.author}</p>
              </div>
            </motion.div>
          ))}
        </StaggerReveal>
      </div>
    </section>
  );
}

/* ─────────────────────────────────────────────
   ROI BAND — "TradeDiscipline pays for itself"
───────────────────────────────────────────── */
function ROIBand({ t }: { t: (k: string) => string }) {
  const stats = [
    {
      kind: "loss" as const,
      prefix: "−",
      value: 180,
      decimals: 0,
      suffix: "€",
      label: t("pricing_roi_stat1_label"),
      color: "rgb(var(--loss))",
      tint: { background: "rgb(var(--loss)/0.06)", borderColor: "rgb(var(--loss)/0.15)" },
    },
    {
      kind: "accent" as const,
      prefix: "",
      value: 9.99,
      decimals: 2,
      suffix: "€",
      label: t("pricing_roi_stat2_label"),
      color: "rgb(var(--accent))",
      tint: { background: "rgb(var(--accent)/0.06)", borderColor: "rgb(var(--accent)/0.2)" },
    },
    {
      kind: "text" as const,
      textValue: t("pricing_roi_stat3_value"),
      label: t("pricing_roi_stat3_label"),
      color: "rgb(var(--profit))",
      tint: { background: "rgb(var(--profit)/0.06)", borderColor: "rgb(var(--profit)/0.15)" },
    },
  ];

  return (
    <Reveal className="mb-14">
      <div
        className="relative rounded-2xl border overflow-hidden p-6 sm:p-8"
        style={{
          borderColor: "rgb(var(--accent)/0.15)",
          background:
            "radial-gradient(ellipse 80% 120% at 50% 0%, rgb(var(--accent)/0.06) 0%, transparent 60%), rgb(var(--card))",
        }}
      >
        {/* eyebrow */}
        <div className="flex items-center justify-center gap-2 mb-3">
          <span className="eyebrow-dot w-1.5 h-1.5 rounded-full" style={{ background: "rgb(var(--accent))" }} aria-hidden />
          <p className="text-[11px] font-bold uppercase tracking-widest" style={{ color: "rgb(var(--accent))", fontStyle: "normal" }}>
            {t("pricing_roi_eyebrow")}
          </p>
        </div>

        <h3 className="text-2xl sm:text-3xl font-bold text-center" style={{ color: "rgb(var(--foreground))", fontStyle: "normal" }}>
          {t("pricing_roi_title")}
        </h3>
        <p className="mt-3 text-sm sm:text-base text-center max-w-2xl mx-auto leading-relaxed" style={{ color: "rgb(var(--muted))", fontStyle: "normal" }}>
          {t("pricing_roi_sub")}
        </p>

        {/* Comparison stats */}
        <div className="mt-7 grid grid-cols-1 sm:grid-cols-3 gap-3">
          {stats.map((s, i) => (
            <div key={i} className="relative">
              <motion.div
                className="rounded-xl border p-5 text-center h-full flex flex-col justify-center"
                style={s.tint}
                whileHover={{ y: -3, scale: 1.01 }}
                transition={{ duration: 0.2, ease: [0.16, 1, 0.3, 1] }}
              >
                {s.kind === "text" ? (
                  <p className="text-2xl sm:text-3xl font-bold tracking-tight" style={{ color: s.color, fontStyle: "normal" }}>
                    {s.textValue}
                  </p>
                ) : (
                  <p className="text-3xl sm:text-4xl font-bold tracking-tight" style={{ color: s.color, fontStyle: "normal" }}>
                    {s.prefix}
                    <Counter end={s.value!} decimals={s.decimals!} suffix={s.suffix} />
                  </p>
                )}
                <p className="mt-2 text-[13px] leading-snug" style={{ color: "rgb(var(--muted))", fontStyle: "normal" }}>{s.label}</p>
              </motion.div>

              {/* connector chevrons between cards (desktop) */}
              {i < stats.length - 1 && (
                <div className="hidden sm:flex absolute top-1/2 -right-3 -translate-y-1/2 z-10 items-center justify-center" aria-hidden>
                  <div
                    className="w-6 h-6 rounded-full flex items-center justify-center border"
                    style={{ background: "rgb(var(--card))", borderColor: "rgb(var(--border))" }}
                  >
                    <svg className="w-3 h-3" style={{ color: "rgb(var(--muted))" }} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M9 5l7 7-7 7" />
                    </svg>
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>

        {/* kicker */}
        <p className="mt-6 text-center text-sm font-medium max-w-xl mx-auto" style={{ color: "rgb(var(--foreground)/0.85)", fontStyle: "normal" }}>
          {t("pricing_roi_kicker")}
        </p>
      </div>
    </Reveal>
  );
}

/* ─────────────────────────────────────────────
   PRICING
───────────────────────────────────────────── */
function Pricing() {
  const { t } = useLanguage();
  const [annual, setAnnual] = useState(false);

  const plans = [
    {
      name: t("plan_free"),
      sub: t("plan_sub_free"),
      monthlyPrice: "0€",
      annualPrice: "0€",
      annualMonthly: "",
      feats: [t("plan_benefit_free_1"), t("plan_benefit_free_2"), t("plan_benefit_free_3"), t("plan_benefit_free_4")],
      btnKey: "pricing_start_free",
      roiKey: "",
      popular: false,
      gold: false,
    },
    {
      name: t("plan_plus"),
      sub: t("plan_sub_plus"),
      monthlyPrice: "9.99€",
      annualPrice: "89.99€",
      annualMonthly: "7.50€",
      feats: [
        t("plan_benefit_plus_1"), t("plan_benefit_plus_2"), t("plan_benefit_plus_3"),
        t("plan_benefit_plus_4"), t("plan_benefit_plus_5"), t("plan_benefit_plus_6"), t("plan_benefit_plus_7"),
      ],
      btnKey: "pricing_choose_plus",
      roiKey: "plan_roi_plus",
      popular: true,
      gold: false,
    },
    {
      name: t("plan_premium"),
      sub: t("plan_premium_desc"),
      monthlyPrice: "19.99€",
      annualPrice: "179.88€",
      annualMonthly: "14.99€",
      feats: [
        t("plan_benefit_premium_1"), t("plan_benefit_premium_2"), t("plan_benefit_premium_3"),
        t("plan_benefit_plus_1"), t("plan_benefit_plus_2"), t("plan_benefit_plus_3"),
      ],
      btnKey: "pricing_choose_premium",
      roiKey: "plan_roi_premium",
      popular: false,
      gold: true,
    },
  ];

  return (
    <section id="pricing" className="py-28 px-6 border-t" style={{ borderColor: "rgb(var(--border)/0.5)" }}>
      <div className="max-w-5xl mx-auto">
        <Reveal className="text-center mb-12">
          <p className="text-xs font-bold uppercase tracking-widest mb-4" style={{ color: "rgb(var(--accent))", fontStyle: "normal" }}>{t("eyebrow_pricing")}</p>
          <h2 className="text-4xl sm:text-5xl font-bold" style={{ color: "rgb(var(--foreground))" }}>{t("pricing_title")}</h2>
        </Reveal>

        {/* ROI / value band — "it pays for itself" */}
        <ROIBand t={t} />

        {/* Toggle */}
        <Reveal className="flex justify-center mb-10">
          <div className="inline-flex items-center gap-1 p-1 rounded-xl border" style={{ borderColor: "rgb(var(--border))", background: "rgb(var(--card))" }}>
            <button
              type="button"
              onClick={() => setAnnual(false)}
              className="px-4 py-1.5 rounded-lg text-sm font-medium transition-all focus-visible:outline focus-visible:outline-2 focus-visible:outline-[rgb(var(--accent))]"
              style={{
                background: !annual ? "rgb(var(--surface))" : "transparent",
                color: !annual ? "rgb(var(--foreground))" : "rgb(var(--muted))",
                fontStyle: "normal",
              }}
              aria-pressed={!annual}
            >
              {t("plan_monthly")}
            </button>
            <button
              type="button"
              onClick={() => setAnnual(true)}
              className="px-4 py-1.5 rounded-lg text-sm font-medium transition-all flex items-center gap-2 focus-visible:outline focus-visible:outline-2 focus-visible:outline-[rgb(var(--accent))]"
              style={{
                background: annual ? "rgb(var(--surface))" : "transparent",
                color: annual ? "rgb(var(--foreground))" : "rgb(var(--muted))",
                fontStyle: "normal",
              }}
              aria-pressed={annual}
            >
              {t("plan_annual")}
              <span className="px-1.5 py-0.5 text-[10px] font-bold rounded-full" style={{ background: "rgb(var(--profit)/0.12)", color: "rgb(var(--profit))", fontStyle: "normal" }}>
                -25%
              </span>
            </button>
          </div>
        </Reveal>

        <StaggerReveal className="grid grid-cols-1 sm:grid-cols-3 gap-4" stagger={0.07}>
          {plans.map((p) => {
            const price = annual ? p.annualPrice : p.monthlyPrice;
            const period = annual ? `/${t("plan_year")}` : `/${t("plan_month")}`;
            const savings = annual && p.annualMonthly;

            return (
              <motion.div
                key={p.name}
                className={`relative rounded-2xl border flex flex-col p-6 ${p.popular ? "card-breathe comet-border" : ""}`}
                style={{
                  background: "rgb(var(--card))",
                  borderColor: p.popular
                    ? "rgb(var(--accent)/0.35)"
                    : p.gold
                    ? "rgba(245,158,11,0.3)"
                    : "rgb(var(--border))",
                }}
                whileHover={{ y: -5, boxShadow: p.popular
                  ? "0 0 0 1px rgb(var(--accent)/0.28), 0 24px 60px -12px rgba(0,0,0,0.5), 0 0 80px -24px rgb(var(--accent)/0.18)"
                  : "0 20px 56px -12px rgba(0,0,0,0.5), inset 0 1px 0 rgba(255,255,255,0.04)"
                }}
                transition={{ duration: 0.22, ease: [0.16, 1, 0.3, 1] }}
              >
                {p.popular && (
                  <div
                    className="absolute -top-3 left-1/2 -translate-x-1/2 text-white text-[10px] font-bold px-3 py-1 rounded-full"
                    style={{ background: "linear-gradient(135deg, rgb(var(--accent)) 0%, #3b82f6 100%)", fontStyle: "normal" }}
                  >
                    {t("plan_popular")}
                  </div>
                )}

                <p
                  className="text-xs font-bold uppercase tracking-widest mb-1"
                  style={{ color: p.gold ? "rgb(245,158,11)" : "rgb(var(--foreground))", fontStyle: "normal" }}
                >
                  {p.name}
                </p>
                <p className="text-xs mb-5" style={{ color: "rgb(var(--muted))", fontStyle: "normal" }}>{p.sub}</p>

                <AnimatePresence mode="wait">
                  <motion.div
                    key={`${p.name}-${annual}`}
                    initial={{ opacity: 0, y: -6 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: 6 }}
                    transition={{ duration: 0.15 }}
                  >
                    <div className="flex items-end gap-1">
                      <span className="text-3xl font-bold tracking-tight" style={{ color: "rgb(var(--foreground))", fontStyle: "normal" }}>{price}</span>
                      <span className="text-sm mb-0.5" style={{ color: "rgb(var(--muted))", fontStyle: "normal" }}>{period}</span>
                    </div>
                    {savings
                      ? <p className="text-xs mt-1 font-medium" style={{ color: "rgb(var(--profit))", fontStyle: "normal" }}>{t("plan_equiv")} {p.annualMonthly}/{t("plan_month")}</p>
                      : <div className="h-5" aria-hidden />
                    }
                  </motion.div>
                </AnimatePresence>

                <ul className="mt-5 space-y-2.5 flex-1">
                  {p.feats.map((feat) => (
                    <li key={feat} className="flex items-start gap-2.5 text-[15px]">
                      <div
                        className="w-4 h-4 rounded-full flex items-center justify-center shrink-0 mt-0.5"
                        style={{ background: p.gold ? "rgba(245,158,11,0.1)" : "rgb(var(--profit)/0.1)" }}
                        aria-hidden
                      >
                        <svg className="w-2.5 h-2.5" style={{ color: p.gold ? "rgb(245,158,11)" : "rgb(var(--profit))" }} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" />
                        </svg>
                      </div>
                      <span style={{ color: "rgb(var(--foreground)/0.8)", fontStyle: "normal" }}>{feat}</span>
                    </li>
                  ))}
                </ul>

                <Link
                  href="/login"
                  className="mt-7 block w-full py-2.5 rounded-xl font-semibold text-sm text-center transition-transform duration-200 hover:scale-[1.02] active:scale-[0.98] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[rgb(var(--accent))]"
                  style={p.popular ? {
                    background: "linear-gradient(135deg, rgb(var(--accent)) 0%, #3b82f6 100%)",
                    boxShadow: "0 0 0 1px rgb(var(--accent)/0.3), 0 4px 16px rgb(var(--accent)/0.2)",
                    color: "white",
                    fontStyle: "normal",
                  } : p.gold ? {
                    background: "rgba(245,158,11,0.1)",
                    border: "1px solid rgba(245,158,11,0.25)",
                    color: "rgb(245,158,11)",
                    fontStyle: "normal",
                  } : {
                    background: "rgb(var(--surface))",
                    border: "1px solid rgb(var(--border))",
                    color: "rgb(var(--foreground))",
                    fontStyle: "normal",
                  }}
                >
                  {t(p.btnKey)}
                </Link>

                {p.roiKey && (
                  <div className="mt-3 flex items-center justify-center gap-1.5">
                    <svg className="w-3.5 h-3.5 shrink-0" style={{ color: "rgb(var(--profit))" }} fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden>
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6" />
                    </svg>
                    <span className="text-[11px] font-medium text-center" style={{ color: "rgb(var(--profit))", fontStyle: "normal" }}>
                      {t(p.roiKey)}
                    </span>
                  </div>
                )}
              </motion.div>
            );
          })}
        </StaggerReveal>

        <Reveal className="flex flex-wrap items-center justify-center gap-6 mt-8 text-xs text-[rgb(var(--muted))]">
          {[
            { icon: "M5 13l4 4L19 7", label: t("pricing_no_commitment") },
            { icon: "M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z", label: t("plan_stripe_secure") },
          ].map((item) => (
            <span key={item.label} className="flex items-center gap-1.5" style={{ fontStyle: "normal" }}>
              <svg className="w-3.5 h-3.5 shrink-0" style={{ color: "rgb(var(--profit))" }} fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden>
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d={item.icon} />
              </svg>
              {item.label}
            </span>
          ))}
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
    <section id="faq" className="py-28 px-6 border-t" style={{ borderColor: "rgb(var(--border)/0.5)" }}>
      <div className="max-w-2xl mx-auto">
        <Reveal className="text-center mb-14">
          <p className="text-xs font-bold uppercase tracking-widest mb-4" style={{ color: "rgb(var(--accent))", fontStyle: "normal" }}>{t("eyebrow_faq")}</p>
          <h2 className="text-4xl sm:text-5xl font-bold" style={{ color: "rgb(var(--foreground))" }}>{t("faq_title")}</h2>
        </Reveal>

        <div className="space-y-2">
          {faqs.map((faq, i) => (
            <Reveal key={i} delay={i * 0.04}>
              <div className="border rounded-xl overflow-hidden" style={{ borderColor: "rgb(var(--border))", background: "rgb(var(--card))" }}>
                <button
                  type="button"
                  onClick={() => setOpenIdx(openIdx === i ? null : i)}
                  className="w-full flex items-center justify-between px-5 py-4 text-left transition-colors hover:bg-[rgb(var(--surface)/0.4)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-[rgb(var(--accent))]"
                  aria-expanded={openIdx === i}
                  aria-controls={`faq-answer-${i}`}
                  id={`faq-question-${i}`}
                >
                  <span className="text-[15px] font-medium pr-6" style={{ color: "rgb(var(--foreground))", fontStyle: "normal" }}>{faq.q}</span>
                  <motion.div
                    animate={{ rotate: openIdx === i ? 45 : 0 }}
                    transition={{ duration: 0.18 }}
                    className="w-5 h-5 flex items-center justify-center rounded-md border shrink-0"
                    style={{ borderColor: "rgb(var(--border))", color: "rgb(var(--muted))" }}
                    aria-hidden
                  >
                    <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                    </svg>
                  </motion.div>
                </button>
                <AnimatePresence>
                  {openIdx === i && (
                    <motion.div
                      id={`faq-answer-${i}`}
                      role="region"
                      aria-labelledby={`faq-question-${i}`}
                      initial={{ height: 0, opacity: 0 }}
                      animate={{ height: "auto", opacity: 1 }}
                      exit={{ height: 0, opacity: 0 }}
                      transition={{ duration: 0.22, ease: [0.4, 0, 0.2, 1] }}
                      className="overflow-hidden"
                    >
                      <p className="px-5 pb-4 text-[15px] leading-relaxed" style={{ color: "rgb(var(--muted))", fontStyle: "normal" }}>{faq.a}</p>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
            </Reveal>
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
    <section className="py-28 px-6 border-t relative overflow-hidden" style={{ borderColor: "rgb(var(--border)/0.5)" }}>
      <div className="absolute inset-0 pointer-events-none" aria-hidden>
        <div
          className="absolute top-0 left-1/2 -translate-x-1/2 w-[600px] h-[400px] rounded-full blur-[80px]"
          style={{ background: "linear-gradient(180deg, rgb(var(--accent)/0.1) 0%, rgba(59,130,246,0.04) 60%, transparent 100%)" }}
        />
      </div>

      <div className="max-w-2xl mx-auto text-center relative z-10">
        <Reveal>
          <div
            className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full border text-xs font-medium mb-8"
            style={{ borderColor: "rgb(var(--accent)/0.2)", background: "rgb(var(--accent)/0.05)", color: "rgb(var(--accent))", fontStyle: "normal" }}
          >
            <span className="w-1.5 h-1.5 rounded-full bg-[rgb(var(--accent))] animate-pulse" aria-hidden />
            {t("cta_free_badge")}
          </div>

          <h2
            className="text-4xl sm:text-5xl md:text-6xl font-bold leading-[1.05] tracking-tight text-balance"
            style={{ color: "rgb(var(--foreground))", fontFamily: "var(--font-geist-sans), system-ui, sans-serif", fontStyle: "normal" }}
          >
            {t("cta_title")}
          </h2>

          <p className="mt-5 text-lg leading-relaxed" style={{ color: "rgb(var(--muted))", fontStyle: "normal" }}>
            {t("cta_subtitle")}
          </p>

          <div className="mt-10">
            <Link
              href="/login"
              className="btn-primary-shimmer group relative inline-block px-8 py-3.5 rounded-xl font-bold text-base text-white transition-all duration-200 hover:scale-[1.02] active:scale-[0.98] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[rgb(var(--accent))]"
              style={{
                background: "linear-gradient(135deg, rgb(var(--accent)) 0%, #3b82f6 100%)",
                boxShadow: "0 0 0 1px rgb(var(--accent)/0.3), 0 8px 32px rgb(var(--accent)/0.25)",
              }}
            >
              <span className="relative z-10">{t("cta_button")}</span>
            </Link>
          </div>

          <p className="text-xs mt-4" style={{ color: "rgb(var(--muted))", fontStyle: "normal" }}>{t("pricing_no_commitment")}</p>
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
    <footer className="border-t px-6 py-14" style={{ borderColor: "rgb(var(--border)/0.5)", background: "rgb(var(--background))" }}>
      <div className="max-w-5xl mx-auto">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-10 mb-12">
          <div className="col-span-2 md:col-span-1">
            <div className="flex items-center gap-2 mb-3">
              <div className="w-6 h-6 flex items-center justify-center rounded-md" style={{ background: "rgb(var(--accent)/0.12)" }}>
                <svg className="w-3.5 h-3.5" style={{ color: "rgb(var(--accent))" }} fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24" aria-hidden>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 18L9 11.25l4.306 4.307a11.95 11.95 0 015.814-5.519l2.74-1.22m0 0l-5.94-2.28m5.94 2.28l-2.28 5.941" />
                </svg>
              </div>
              <span className="font-bold text-sm" style={{ color: "rgb(var(--foreground))", fontStyle: "normal" }}>TradeDiscipline</span>
            </div>
            <p className="text-xs leading-relaxed" style={{ color: "rgb(var(--muted))", fontStyle: "normal" }}>{t("footer_brand_desc")}</p>
          </div>

          {[
            {
              heading: t("footer_product"),
              links: [{ href: "#features", label: t("nav_features") }, { href: "#pricing", label: t("nav_pricing") }],
            },
            {
              heading: t("footer_resources"),
              links: [{ href: "/contact", label: t("footer_contact") }, { href: "/faq", label: t("footer_faq") }],
            },
            {
              heading: t("footer_legal_col"),
              links: [
                { href: "/legal/terms", label: t("footer_terms") },
                { href: "/legal/privacy", label: t("footer_privacy") },
                { href: "/mentions-legales", label: t("footer_mentions") },
              ],
            },
          ].map((col) => (
            <div key={col.heading}>
              <p className="font-semibold text-xs uppercase tracking-wider mb-4" style={{ color: "rgb(var(--foreground))", fontStyle: "normal" }}>{col.heading}</p>
              <ul className="space-y-2.5">
                {col.links.map((l) => (
                  <li key={l.href}>
                    <a href={l.href} className="text-sm transition-colors hover:text-[rgb(var(--foreground))]" style={{ color: "rgb(var(--muted))", fontStyle: "normal" }}>{l.label}</a>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>

        <div className="border-t pt-6" style={{ borderColor: "rgb(var(--border)/0.5)" }}>
          <p className="text-xs" style={{ color: "rgb(var(--muted))", fontStyle: "normal" }}>© 2026 TradeDiscipline. {t("footer_legal")}.</p>
        </div>
      </div>
    </footer>
  );
}

/* ─────────────────────────────────────────────
   SCROLL PROGRESS BAR
───────────────────────────────────────────── */
function ScrollProgress() {
  const { scrollYProgress } = useScroll();
  const scaleX = useSpring(scrollYProgress, { stiffness: 120, damping: 30, mass: 0.3 });
  return (
    <motion.div
      className="scroll-progress fixed top-0 left-0 right-0 h-0.5 z-[60]"
      style={{ scaleX }}
      aria-hidden
    />
  );
}

/* ─────────────────────────────────────────────
   STICKY MOBILE CTA
   Barre fixe en bas (mobile only), apparaît après
   le scroll du hero — boost de conversion mobile.
───────────────────────────────────────────── */
function StickyMobileCTA() {
  const { t } = useLanguage();
  const [visible, setVisible] = useState(false);
  const [dismissed, setDismissed] = useState(false);

  useEffect(() => {
    function onScroll() {
      setVisible(window.scrollY > 700);
    }
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  return (
    <AnimatePresence>
      {visible && !dismissed && (
        <motion.div
          initial={{ y: 80, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          exit={{ y: 80, opacity: 0 }}
          transition={{ duration: 0.3, ease }}
          className="fixed bottom-0 inset-x-0 z-50 lg:hidden px-4 pb-4 pt-2 pointer-events-none"
          style={{ paddingBottom: "max(1rem, env(safe-area-inset-bottom))" }}
        >
          <div
            className="pointer-events-auto flex items-center gap-2 p-2 rounded-2xl border backdrop-blur-xl"
            style={{
              borderColor: "rgb(var(--border))",
              background: "rgb(var(--card)/0.92)",
              boxShadow: "0 -8px 40px rgba(0,0,0,0.5), 0 0 0 1px rgba(255,255,255,0.03)",
            }}
          >
            <Link
              href="/login"
              className="flex-1 text-center px-5 py-3 rounded-xl font-semibold text-sm text-white"
              style={{
                background: "linear-gradient(135deg, rgb(var(--accent)) 0%, #3b82f6 100%)",
                boxShadow: "0 4px 16px rgb(var(--accent)/0.25)",
                fontStyle: "normal",
              }}
            >
              {t("hero_cta")}
            </Link>
            <button
              type="button"
              onClick={() => setDismissed(true)}
              className="shrink-0 w-10 h-10 flex items-center justify-center rounded-xl transition-colors"
              style={{ color: "rgb(var(--muted))" }}
              aria-label="Fermer"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden>
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

/* ─────────────────────────────────────────────
   STRUCTURED DATA — FAQ rich snippets (SEO)
───────────────────────────────────────────── */
function StructuredData() {
  const { t } = useLanguage();

  const faqJsonLd = {
    "@context": "https://schema.org",
    "@type": "FAQPage",
    mainEntity: [1, 2, 3, 4, 5, 6].map((i) => ({
      "@type": "Question",
      name: t(`faq_q${i}`),
      acceptedAnswer: { "@type": "Answer", text: t(`faq_a${i}`) },
    })),
  };

  const appJsonLd = {
    "@context": "https://schema.org",
    "@type": "SoftwareApplication",
    name: "TradeDiscipline",
    applicationCategory: "FinanceApplication",
    operatingSystem: "Web",
    url: "https://tradediscipline.app",
    description: t("hero_subtitle_v2"),
    offers: { "@type": "Offer", price: "0", priceCurrency: "EUR" },
  };

  return (
    <script
      type="application/ld+json"
      dangerouslySetInnerHTML={{ __html: JSON.stringify([faqJsonLd, appJsonLd]) }}
    />
  );
}

/* ─────────────────────────────────────────────
   PAGE ROOT
───────────────────────────────────────────── */
export default function LandingPage() {
  return (
    <div className="min-h-screen force-dark landing-page relative overflow-x-hidden" style={{ background: "rgb(var(--background))" }}>
      <ScrollProgress />
      <GridBackground />
      <PublicHeader showAnchors />
      <main>
        <Hero />
        <PlatformMarquee />
        <StatsStrip />
        <Problem />
        <DisciplineQuiz />
        <Features />
        <AIDetection />
        <SocialProof />
        <Pricing />
        <FAQ />
        <FinalCTA />
      </main>
      <Footer />
      <StickyMobileCTA />
      <StructuredData />
    </div>
  );
}
