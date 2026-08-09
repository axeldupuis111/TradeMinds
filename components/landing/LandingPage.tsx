"use client";

import DisciplineQuiz from "@/components/landing/DisciplineQuiz";
import LiveDemo from "@/components/landing/LiveDemo";
import CoachOperator from "@/components/landing/CoachOperator";
import PublicHeader from "@/components/PublicHeader";
import { FoundingBanner } from "@/components/FoundingBanner";
import { useLanguage } from "@/lib/LanguageContext";
import { localizedHref } from "@/lib/locale-href";
import { PLAN_FEATURES, FREE_BENEFITS, PLUS_BENEFITS, PREMIUM_BENEFITS } from "@/lib/plan-features";
import Link from "next/link";
import React, { useRef, useState, useEffect } from "react";
import { motion, useInView, useReducedMotion, AnimatePresence, useMotionValue, useSpring, useTransform, useScroll } from "framer-motion";
import type { TargetAndTransition, Transition } from "framer-motion";

/* ─────────────────────────────────────────────
   ANIMATION PRIMITIVES
   - Use whileInView + viewport (SSR-safe, no hydration flash)
   - No filter:blur on initial (causes paint cost + SSR mismatch)
   - prefersReducedMotion: initial={false} disables entrance
───────────────────────────────────────────── */
const ease = [0.16, 1, 0.3, 1] as const;

/* ─────────────────────────────────────────────
   TEXT TONES
   `--muted` (#71717a) ne passe pas AA sur le fond sombre (4.12:1). Il reste
   volontairement utilisé pour le "chrome" des maquettes produit (micro-labels
   8-11px, axes, légendes) où le gris sourd fait partie du rendu réaliste.
   Toute vraie phrase de copy passe par COPY (#a1a1aa, ~7:1).
───────────────────────────────────────────── */
const COPY = "rgb(var(--foreground-muted))";

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
          initial={prefersReduced ? false : { opacity: 0, y: 26, scale: 0.97, rotateX: 8 }}
          whileInView={{ opacity: 1, y: 0, scale: 1, rotateX: 0 }}
          viewport={{ once: true, margin: "-40px" }}
          transition={{ duration: 0.6, delay: i * stagger, ease }}
          style={{ transformPerspective: 1200 }}
        >
          {child}
        </motion.div>
      ))}
    </div>
  );
}

/* Compteur "brut" (sans wrapper) — utilisable dans un <text> SVG ou inline.
   Démarre au montage (le mockup hero est visible dès le chargement). */
function NumberCount({ end, decimals = 0, duration = 1700 }: { end: number; decimals?: number; duration?: number }) {
  const [val, setVal] = useState(0);
  const reduced = useReducedMotion();
  useEffect(() => {
    if (reduced) { setVal(end); return; }
    const start = performance.now();
    let raf = 0;
    const tick = (now: number) => {
      const p = Math.min((now - start) / duration, 1);
      const eased = p === 1 ? 1 : 1 - Math.pow(2, -10 * p);
      setVal(end * eased);
      if (p < 1) raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [end, reduced, duration]);
  return <>{decimals > 0 ? val.toFixed(decimals) : Math.round(val)}</>;
}

/* Indicateur "live" — compteur d'inscrits qui monte (FOMO).
   Icône + chiffre seulement → aucun texte à traduire (i18n-safe). */
function LiveActivity() {
  const reduced = useReducedMotion();
  const [n, setN] = useState(517);
  useEffect(() => {
    if (reduced) return;
    const id = setInterval(() => setN((v) => v + 1), 4500);
    return () => clearInterval(id);
  }, [reduced]);
  return (
    <div
      className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full border backdrop-blur-md"
      style={{ borderColor: "rgb(var(--border))", background: "rgb(var(--card)/0.9)", boxShadow: "0 8px 24px -8px rgba(0,0,0,0.6)" }}
    >
      <span className="relative flex w-1.5 h-1.5 shrink-0">
        <span className="ring-ping absolute inset-0 rounded-full" style={{ background: "rgb(var(--profit))" }} />
        <span className="relative w-1.5 h-1.5 rounded-full" style={{ background: "rgb(var(--profit))" }} />
      </span>
      <svg className="w-3.5 h-3.5 shrink-0" style={{ color: "rgb(var(--muted))" }} fill="none" stroke="currentColor" strokeWidth={1.7} viewBox="0 0 24 24" aria-hidden>
        <path strokeLinecap="round" strokeLinejoin="round" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
      </svg>
      <AnimatePresence mode="popLayout">
        <motion.span
          key={n}
          initial={reduced ? false : { opacity: 0, y: -6 }}
          animate={{ opacity: 1, y: 0 }}
          exit={reduced ? undefined : { opacity: 0, y: 6 }}
          transition={{ duration: 0.25, ease }}
          className="text-xs font-bold tabular-nums"
          style={{ color: "rgb(var(--foreground))" }}
        >
          {n.toLocaleString("fr-FR")}
        </motion.span>
      </AnimatePresence>
      <svg className="w-2.5 h-2.5 shrink-0" style={{ color: "rgb(var(--profit))" }} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={3} aria-hidden>
        <path strokeLinecap="round" strokeLinejoin="round" d="M5 15l7-7 7 7" />
      </svg>
    </div>
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
   MAGNETIC BUTTON — pulls subtly toward cursor
───────────────────────────────────────────── */
function Magnetic({
  children,
  strength = 0.35,
  className = "",
}: {
  children: React.ReactNode;
  strength?: number;
  className?: string;
}) {
  const prefersReduced = useReducedMotion();
  const ref = useRef<HTMLDivElement>(null);
  const x = useMotionValue(0);
  const y = useMotionValue(0);
  const sx = useSpring(x, { stiffness: 200, damping: 15, mass: 0.3 });
  const sy = useSpring(y, { stiffness: 200, damping: 15, mass: 0.3 });

  function move(e: React.MouseEvent<HTMLDivElement>) {
    if (prefersReduced || !ref.current) return;
    const r = ref.current.getBoundingClientRect();
    x.set((e.clientX - (r.left + r.width / 2)) * strength);
    y.set((e.clientY - (r.top + r.height / 2)) * strength);
  }
  function leave() {
    x.set(0);
    y.set(0);
  }

  return (
    <motion.div
      ref={ref}
      onMouseMove={move}
      onMouseLeave={leave}
      style={prefersReduced ? undefined : { x: sx, y: sy }}
      className={className}
    >
      {children}
    </motion.div>
  );
}

/* ─────────────────────────────────────────────
   SPOTLIGHT CARD — radial glow follows cursor
   Drop-in replacement for a motion.div card.
───────────────────────────────────────────── */
function SpotlightCard({
  children,
  className = "",
  style,
  whileHover,
  transition,
}: {
  children: React.ReactNode;
  className?: string;
  style?: React.CSSProperties;
  whileHover?: TargetAndTransition;
  transition?: Transition;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const prefersReduced = useReducedMotion();

  function move(e: React.MouseEvent<HTMLDivElement>) {
    if (prefersReduced || !ref.current) return;
    const r = ref.current.getBoundingClientRect();
    ref.current.style.setProperty("--mx", `${e.clientX - r.left}px`);
    ref.current.style.setProperty("--my", `${e.clientY - r.top}px`);
  }

  return (
    <motion.div
      ref={ref}
      onMouseMove={move}
      className={`spotlight-card ${className}`}
      style={style}
      whileHover={whileHover}
      transition={transition}
    >
      {children}
    </motion.div>
  );
}

/* ─────────────────────────────────────────────
   SECTION EYEBROW — label + animated underline
───────────────────────────────────────────── */
function Eyebrow({ children, className = "" }: { children: React.ReactNode; className?: string }) {
  return (
    <p className={`inline-flex flex-col items-center gap-1.5 text-xs font-bold uppercase tracking-widest mb-4 ${className}`} style={{ color: "rgb(var(--accent))", fontStyle: "normal" }}>
      <span>{children}</span>
      <span
        className="eyebrow-line block h-px w-8 rounded-full"
        style={{ background: "linear-gradient(90deg, transparent, rgb(var(--accent)), transparent)" }}
        aria-hidden
      />
    </p>
  );
}

/* ─────────────────────────────────────────────
   PAGE AMBIENCE — slow drifting blobs (whole page)
   Pas de random → SSR-safe ; le mouvement est coupé
   en CSS sous prefers-reduced-motion.
───────────────────────────────────────────── */
function PageAmbience() {
  return (
    <div className="absolute inset-0 overflow-hidden pointer-events-none -z-10" aria-hidden>
      <div className="blob-drift-slow absolute top-[20%] -left-24 w-[340px] h-[340px] rounded-full blur-[72px]" style={{ background: "rgb(var(--accent)/0.06)" }} />
      <div className="blob-drift-rev absolute top-[55%] -right-28 w-[380px] h-[380px] rounded-full blur-[80px]" style={{ background: "rgba(59,130,246,0.05)" }} />
      <div className="blob-drift-slow absolute top-[82%] left-1/3 w-[300px] h-[300px] rounded-full blur-[68px]" style={{ background: "rgba(167,139,250,0.05)" }} />
    </div>
  );
}

/* ─────────────────────────────────────────────
   HERO PARTICLES — floating ambient dots
───────────────────────────────────────────── */
const HERO_PARTICLES = Array.from({ length: 22 }, (_, i) => {
  // deterministic pseudo-random so SSR & client match
  const r = (n: number) => {
    const s = Math.sin((i + 1) * n) * 10000;
    return s - Math.floor(s);
  };
  const palette = ["0,212,216", "59,130,246", "167,139,250"];
  return {
    left: `${(r(12.9898) * 100).toFixed(2)}%`,
    top: `${(60 + r(78.233) * 40).toFixed(2)}%`,
    // rounded so server (Node) and client float results stringify identically (no hydration mismatch)
    size: Number((2 + r(43.12) * 4).toFixed(2)),
    drift: `${(r(11.7) * 60 - 30).toFixed(1)}px`,
    travel: `${(140 + r(91.3) * 220).toFixed(0)}px`,
    dur: `${(9 + r(3.71) * 10).toFixed(1)}s`,
    delay: `${(r(27.1) * 9).toFixed(1)}s`,
    op: (0.25 + r(8.3) * 0.4).toFixed(2),
    color: palette[Math.floor(r(5.5) * palette.length) % palette.length],
  };
});

function HeroParticles() {
  const prefersReduced = useReducedMotion();
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);
  // Decorative only — render client-side after mount so SSR/client never diverge.
  if (prefersReduced || !mounted) return null;
  return (
    <div className="absolute inset-0 pointer-events-none overflow-hidden -z-0" aria-hidden>
      {HERO_PARTICLES.map((p, i) => (
        <span
          key={i}
          className="hero-particle"
          style={{
            left: p.left,
            top: p.top,
            width: p.size,
            height: p.size,
            background: `rgb(${p.color})`,
            boxShadow: `0 0 ${p.size * 2}px rgb(${p.color} / 0.6)`,
            ["--p-drift" as string]: p.drift,
            ["--p-travel" as string]: p.travel,
            ["--p-dur" as string]: p.dur,
            ["--p-delay" as string]: p.delay,
            ["--p-op" as string]: p.op,
          }}
        />
      ))}
    </div>
  );
}

/* ─────────────────────────────────────────────
   HERO
───────────────────────────────────────────── */
function Hero() {
  const { t } = useLanguage();
  const prefersReduced = useReducedMotion();
  const sectionRef = useRef<HTMLElement>(null);

  // Cursor-following spotlight
  const spotX = useMotionValue(50);
  const spotY = useMotionValue(28);
  const sxSpring = useSpring(spotX, { stiffness: 90, damping: 22, mass: 0.5 });
  const sySpring = useSpring(spotY, { stiffness: 90, damping: 22, mass: 0.5 });
  const spotlight = useTransform(
    [sxSpring, sySpring],
    ([x, y]: number[]) =>
      `radial-gradient(620px circle at ${x}% ${y}%, rgb(var(--accent)/0.10), transparent 70%)`
  );

  function handleSpot(e: React.MouseEvent<HTMLElement>) {
    if (prefersReduced || !sectionRef.current) return;
    const r = sectionRef.current.getBoundingClientRect();
    spotX.set(((e.clientX - r.left) / r.width) * 100);
    spotY.set(((e.clientY - r.top) / r.height) * 100);
  }

  // Scroll parallax on aurora layer
  const { scrollYProgress } = useScroll({ target: sectionRef, offset: ["start start", "end start"] });
  const auroraY = useTransform(scrollYProgress, [0, 1], [0, 120]);
  const auroraScale = useTransform(scrollYProgress, [0, 1], [1, 1.25]);

  // Word-by-word title reveal
  const title2Words = t("hero_title_2").split(" ");

  return (
    <section ref={sectionRef} onMouseMove={handleSpot} className="landing-hero relative px-6 overflow-hidden">
      {/* Cursor spotlight */}
      {!prefersReduced && (
        <motion.div className="absolute inset-0 pointer-events-none -z-0" aria-hidden style={{ background: spotlight }} />
      )}

      {/* Floating ambient particles */}
      <HeroParticles />

      {/* Gradient blobs — floating aurora effect (+ scroll parallax) */}
      <motion.div
        className="absolute top-0 left-1/2 -translate-x-1/2 w-[900px] h-[600px] pointer-events-none -z-0"
        aria-hidden
        style={prefersReduced ? undefined : { y: auroraY, scale: auroraScale }}
      >
        <div className="aurora-a absolute top-0 left-1/4 w-80 h-80 rounded-full blur-[80px] will-change-transform"
          style={{ background: "rgb(var(--accent)/0.12)" }} />
        <div className="aurora-b absolute top-20 right-1/4 w-64 h-64 rounded-full blur-[72px] will-change-transform"
          style={{ background: "rgba(59,130,246,0.09)" }} />
        <div className="aurora-c absolute top-40 left-1/2 w-48 h-48 rounded-full blur-[64px] will-change-transform"
          style={{ background: "rgba(167,139,250,0.06)" }} />
      </motion.div>

      <div className="max-w-5xl mx-auto text-center relative z-10">
        {/* Social proof badge */}
        <motion.div
          initial={prefersReduced ? false : { opacity: 0, y: 10, scale: 0.97 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          transition={{ duration: 0.5, ease }}
          className="badge-shine-host inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full border border-[rgb(var(--accent)/0.2)] bg-[rgb(var(--accent)/0.05)] text-xs font-medium mb-10"
          style={{ color: "rgb(var(--accent))", fontStyle: "normal" }}
        >
          <span className="relative flex w-1.5 h-1.5 shrink-0">
            <span className="ring-ping absolute inset-0 rounded-full bg-[rgb(var(--accent))]" />
            <span className="relative w-1.5 h-1.5 rounded-full bg-[rgb(var(--accent))]" />
          </span>
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
          {t("hero_title_1").split(" ").map((word, i) => (
            <motion.span
              key={`t1-${i}`}
              className="inline-block"
              initial={prefersReduced ? false : { opacity: 0, y: "0.45em", rotateX: -35 }}
              animate={{ opacity: 1, y: 0, rotateX: 0 }}
              transition={{ duration: 0.55, delay: 0.1 + i * 0.06, ease }}
              style={{ transformOrigin: "bottom" }}
            >
              {word}{" "}
            </motion.span>
          ))}
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
            {title2Words.map((word, i) => (
              <motion.span
                key={i}
                className="inline-block"
                initial={prefersReduced ? false : { opacity: 0, y: "0.5em", rotateX: -40 }}
                animate={{ opacity: 1, y: 0, rotateX: 0 }}
                transition={{ duration: 0.6, delay: 0.35 + i * 0.1, ease }}
                style={{ transformOrigin: "bottom" }}
              >
                {word}
                {i < title2Words.length - 1 ? " " : ""}
              </motion.span>
            ))}
          </span>
        </motion.h1>

        {/* Subtitle */}
        <motion.p
          initial={prefersReduced ? false : { opacity: 0, y: 18 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.65, delay: 0.22, ease }}
          className="mt-6 text-base sm:text-lg md:text-xl max-w-2xl mx-auto leading-relaxed"
          style={{ color: COPY, fontStyle: "normal" }}
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
          <Magnetic strength={0.4}>
            <Link
              href="/login"
              /* `border border-transparent` + inline-flex : le bouton secondaire
                 porte une bordure et pas celui-ci, d'où 1,3px d'écart de hauteur
                 et 3px de décalage vertical entre les deux. */
              className="btn-primary-shimmer group relative inline-flex items-center justify-center border border-transparent px-7 py-3.5 rounded-xl font-semibold text-sm text-white transition-transform duration-200 hover:scale-[1.03] active:scale-[0.98] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[rgb(var(--accent))]"
              style={{
                background: "linear-gradient(135deg, rgb(var(--accent)) 0%, #3b82f6 100%)",
                boxShadow: "0 0 0 1px rgb(var(--accent)/0.3), 0 4px 24px rgb(var(--accent)/0.2)",
              }}
            >
              <span className="relative z-10">{t("hero_cta")}</span>
            </Link>
          </Magnetic>
          <Magnetic strength={0.25}>
            <a
              href="#features"
              className="inline-flex items-center justify-center px-7 py-3.5 rounded-xl font-semibold text-sm border transition-all duration-200 hover:scale-[1.02] active:scale-[0.98] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[rgb(var(--accent))]"
              style={{
                color: "rgb(var(--foreground))",
                borderColor: "rgb(var(--border))",
                background: "rgb(var(--card))",
                fontStyle: "normal",
              }}
            >
              {t("hero_features")}
            </a>
          </Magnetic>
        </motion.div>

        {/* Risk-reversal reassurance — reduces signup friction right under the CTA */}
        <motion.p
          initial={prefersReduced ? false : { opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.6, delay: 0.42, ease }}
          className="mt-3 text-center text-xs"
          style={{ color: COPY, fontStyle: "normal" }}
        >
          {t("hero_reassurance")}
        </motion.p>

        {/* Offre fondateur — sous la réassurance pour éviter la juxtaposition avec « gratuit » */}
        <div className="mt-8 mx-auto max-w-2xl">
          <FoundingBanner href="/login" />
        </div>

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
              color: COPY,
              fontStyle: "normal",
            }}
          >
            <svg className="w-3.5 h-3.5 shrink-0" style={{ color: "rgb(var(--accent))" }} fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden>
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.813 15.904L9 18.75l-.813-2.846a4.5 4.5 0 00-3.09-3.09L2.25 12l2.846-.813a4.5 4.5 0 003.09-3.09L9 5.25l.813 2.846a4.5 4.5 0 003.09 3.09L15.75 12l-2.846.813a4.5 4.5 0 00-3.09 3.09z" />
            </svg>
            {t("hero_ai_badge")}
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

  // Parallax léger au scroll — profondeur quand on descend
  const { scrollYProgress } = useScroll({ target: ref, offset: ["start end", "end start"] });
  const parallaxY = useSpring(useTransform(scrollYProgress, [0, 1], [48, -48]), { stiffness: 80, damping: 24, mass: 0.4 });

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
      {!prefersReduced && (
        <motion.div
          className="absolute -top-4 right-2 sm:right-4 z-20 idle-bob"
          initial={{ opacity: 0, scale: 0.8, y: -6 }}
          whileInView={{ opacity: 1, scale: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.5, delay: 1.2, ease }}
        >
          <LiveActivity />
        </motion.div>
      )}
      <motion.div style={prefersReduced ? undefined : { y: parallaxY }}>
        <HeroStoryChart />
      </motion.div>
    </motion.div>
  );
}

/* ─────────────────────────────────────────────
   HERO STORY CHART — la courbe d'équité racontée
   Un seul grand chart annoté par l'IA en 3 actes :
   tilt détecté (rouge) → intervention (cyan) →
   process retrouvé (vert). Déterministe, SSR-safe.
───────────────────────────────────────────── */

// Géométrie de la courbe (viewBox 1000×380). Trois actes.
const CURVE_CALM = "M0,295 L45,286 L90,291 L135,276 L180,268 L225,274 L270,256 L310,252";
const CURVE_TILT = "M310,252 L340,268 L365,261 L390,290 L415,283 L440,306 L465,299 L490,318 L505,314";
const CURVE_DISC = "M505,314 L550,298 L600,288 L650,268 L700,252 L750,228 L800,208 L850,184 L900,158 L950,138 L1000,118";
// Zones sous la courbe (remplissage dégradé par acte).
const AREA_TILT = `${CURVE_TILT} L505,380 L310,380 Z`;
const AREA_DISC = `${CURVE_DISC} L1000,380 L505,380 Z`;

// Bougies décoratives en fond de chart (pseudo-random déterministe → SSR-safe).
const STORY_CANDLES = Array.from({ length: 30 }, (_, i) => {
  const r = (n: number) => { const s = Math.sin((i + 1) * n) * 10000; return s - Math.floor(s); };
  return { x: 12 + i * 33, h: 10 + r(3.7) * 20, up: r(7.1) > 0.45 };
});

// Pastille pulsante ancrée sur un point de la courbe.
function StoryDot({ cx, cy, color, delay, reduced }: { cx: number; cy: number; color: string; delay: number; reduced: boolean }) {
  return (
    <motion.g
      initial={reduced ? false : { opacity: 0, scale: 0 }}
      animate={{ opacity: 1, scale: 1 }}
      transition={{ duration: 0.4, delay, ease }}
      style={{ transformOrigin: `${cx}px ${cy}px` }}
    >
      {!reduced && (
        <circle cx={cx} cy={cy} r="7" fill="none" stroke={color} strokeWidth="1.5" opacity="0.6">
          <animate attributeName="r" values="5;13;5" dur="2.4s" repeatCount="indefinite" />
          <animate attributeName="opacity" values="0.6;0;0.6" dur="2.4s" repeatCount="indefinite" />
        </circle>
      )}
      <circle cx={cx} cy={cy} r="4.5" fill={color} style={{ filter: `drop-shadow(0 0 5px ${color})` }} />
    </motion.g>
  );
}

// Étiquette d'annotation IA flottant au-dessus du chart.
function StoryChip({ tone, title, body, delay, className }: { tone: "alert" | "action" | "win"; title: string; body: string; delay: number; className: string }) {
  const prefersReduced = useReducedMotion();
  const c = tone === "alert" ? "var(--loss)" : tone === "action" ? "var(--accent)" : "var(--profit)";
  return (
    <motion.div
      className={`absolute z-10 max-w-[46%] sm:max-w-[240px] rounded-lg border px-2.5 py-1.5 sm:px-3 sm:py-2 backdrop-blur-md ${className}`}
      style={{
        background: "rgb(var(--card)/0.88)",
        borderColor: `rgb(${c}/0.35)`,
        boxShadow: `0 8px 28px -8px rgba(0,0,0,0.65), 0 0 18px -6px rgb(${c}/0.4)`,
        fontStyle: "normal",
      }}
      initial={prefersReduced ? false : { opacity: 0, y: 10, scale: 0.92 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      transition={{ duration: 0.5, delay, ease }}
    >
      <p className="flex items-center gap-1.5 text-[10px] sm:text-[11px] font-bold leading-tight" style={{ color: `rgb(${c})` }}>
        <span className="inline-block w-1.5 h-1.5 rounded-full shrink-0" style={{ background: `rgb(${c})` }} aria-hidden />
        {title}
      </p>
      <p className="hidden sm:block text-[10px] mt-0.5 leading-snug" style={{ color: "rgb(var(--foreground)/0.75)" }}>{body}</p>
    </motion.div>
  );
}

function HeroStoryChart() {
  const { t } = useLanguage();
  const prefersReduced = useReducedMotion();
  // Bougies client-only : Math.sin peut diverger d'un ULP entre moteurs JS
  // (Node/V8 au SSR vs JavaScriptCore/SpiderMonkey chez le visiteur) →
  // mismatch d'hydratation. Même principe que HeroParticles.
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);

  return (
    <div
      className="relative rounded-2xl border overflow-hidden"
      style={{
        borderColor: "rgb(var(--border))",
        background: "linear-gradient(180deg, rgb(var(--card)) 0%, rgb(var(--surface)/0.55) 100%)",
        boxShadow: "0 32px 80px -12px rgba(0,0,0,0.7), 0 0 0 1px rgba(255,255,255,0.03)",
        transform: prefersReduced ? undefined : "perspective(1600px) rotateX(1.5deg)",
        transformOrigin: "center bottom",
      }}
    >
      {/* Bandeau : lecture IA en direct */}
      <div className="flex items-center justify-between gap-3 px-4 sm:px-6 pt-4 sm:pt-5">
        <p className="flex items-center gap-2 text-[10px] sm:text-[11px] font-bold uppercase tracking-widest" style={{ color: "rgb(var(--muted))", fontStyle: "normal" }}>
          <span className="relative flex w-1.5 h-1.5 shrink-0">
            <span className="ring-ping absolute inset-0 rounded-full" style={{ background: "rgb(var(--accent))" }} />
            <span className="relative w-1.5 h-1.5 rounded-full" style={{ background: "rgb(var(--accent))" }} />
          </span>
          {t("hero_chart_kicker")}
        </p>
        <div className="hidden sm:flex items-center gap-1.5 px-2.5 py-1 rounded-full border text-[10px] font-semibold" style={{ borderColor: "rgb(var(--accent)/0.3)", color: "rgb(var(--accent))", background: "rgb(var(--accent)/0.06)", fontStyle: "normal" }}>
          <svg className="w-3 h-3" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24" aria-hidden>
            <path strokeLinecap="round" strokeLinejoin="round" d="M9.813 15.904L9 18.75l-.813-2.846a4.5 4.5 0 00-3.09-3.09L2.25 12l2.846-.813a4.5 4.5 0 003.09-3.09L9 5.25l.813 2.846a4.5 4.5 0 003.09 3.09L15.75 12l-2.846.813a4.5 4.5 0 00-3.09 3.09z" />
          </svg>
          {t("hero_chart_badge")}
        </div>
      </div>

      {/* Scène : chart annoté */}
      <div className="relative h-[290px] sm:h-[340px] lg:h-[380px]" aria-label={t("hero_chart_kicker")} role="img">
        <svg viewBox="0 0 1000 380" preserveAspectRatio="none" className="absolute inset-0 w-full h-full" aria-hidden>
          <defs>
            <linearGradient id="storyTilt" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="rgb(var(--loss))" stopOpacity="0.16" />
              <stop offset="100%" stopColor="rgb(var(--loss))" stopOpacity="0" />
            </linearGradient>
            <linearGradient id="storyDisc" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="rgb(var(--profit))" stopOpacity="0.2" />
              <stop offset="100%" stopColor="rgb(var(--profit))" stopOpacity="0" />
            </linearGradient>
          </defs>

          {/* Grille horizontale */}
          {[76, 152, 228, 304].map((y) => (
            <line key={y} x1="0" y1={y} x2="1000" y2={y} stroke="rgb(var(--border))" strokeWidth="1" strokeDasharray="3 7" opacity="0.35" />
          ))}

          {/* Bougies décoratives (client-only, cf. commentaire mounted) */}
          {mounted && STORY_CANDLES.map((cd, i) => (
            <g key={i} opacity="0.22">
              <line x1={cd.x} y1={356 - cd.h} x2={cd.x} y2={362} stroke={cd.up ? "rgb(var(--profit))" : "rgb(var(--loss))"} strokeWidth="1" />
              <rect x={cd.x - 3} y={358 - cd.h * 0.7} width="6" height={cd.h * 0.55} rx="1" fill={cd.up ? "rgb(var(--profit))" : "rgb(var(--loss))"} />
            </g>
          ))}

          {/* Zones sous la courbe */}
          <motion.path d={AREA_TILT} fill="url(#storyTilt)"
            initial={prefersReduced ? false : { opacity: 0 }} animate={{ opacity: 1 }} transition={{ duration: 0.7, delay: 1.7 }} />
          <motion.path d={AREA_DISC} fill="url(#storyDisc)"
            initial={prefersReduced ? false : { opacity: 0 }} animate={{ opacity: 1 }} transition={{ duration: 0.9, delay: 2.9 }} />

          {/* Acte 1 — gains calmes */}
          <motion.path d={CURVE_CALM} fill="none" stroke="rgb(var(--foreground)/0.65)" strokeWidth="2.5" strokeLinejoin="round"
            initial={prefersReduced ? false : { pathLength: 0 }} animate={{ pathLength: 1 }} transition={{ duration: 0.9, delay: 0.55, ease: "easeOut" }} />
          {/* Acte 2 — tilt */}
          <motion.path d={CURVE_TILT} fill="none" stroke="rgb(var(--loss))" strokeWidth="2.5" strokeLinejoin="round"
            style={{ filter: "drop-shadow(0 0 4px rgb(var(--loss)/0.5))" }}
            initial={prefersReduced ? false : { pathLength: 0 }} animate={{ pathLength: 1 }} transition={{ duration: 0.8, delay: 1.45, ease: "easeIn" }} />
          {/* Intervention — ligne verticale cyan */}
          <motion.line x1="505" y1="30" x2="505" y2="360" stroke="rgb(var(--accent))" strokeWidth="1.5" strokeDasharray="5 6"
            style={{ filter: "drop-shadow(0 0 4px rgb(var(--accent)/0.6))" }}
            initial={prefersReduced ? false : { opacity: 0, pathLength: 0 }} animate={{ opacity: 0.85, pathLength: 1 }} transition={{ duration: 0.6, delay: 2.35, ease: "easeOut" }} />
          {/* Acte 3 — discipline retrouvée */}
          <motion.path d={CURVE_DISC} fill="none" stroke="rgb(var(--profit))" strokeWidth="3" strokeLinejoin="round"
            style={{ filter: "drop-shadow(0 0 5px rgb(var(--profit)/0.45))" }}
            initial={prefersReduced ? false : { pathLength: 0 }} animate={{ pathLength: 1 }} transition={{ duration: 1.5, delay: 2.85, ease: [0.4, 0, 0.2, 1] }} />
          {/* Éclat "live" en boucle sur le segment discipliné */}
          {!prefersReduced && (
            <motion.path d={CURVE_DISC} fill="none" stroke="rgb(var(--profit))" strokeWidth="4" strokeLinecap="round"
              pathLength={1} strokeDasharray="0.06 1"
              style={{ filter: "drop-shadow(0 0 3px rgb(var(--profit)))" }}
              initial={{ strokeDashoffset: 1 }} animate={{ strokeDashoffset: [1, -0.06] }}
              transition={{ duration: 2.8, repeat: Infinity, ease: "easeInOut", delay: 4.6, repeatDelay: 0.8 }} />
          )}

          {/* Pastilles ancrées aux moments clés */}
          <StoryDot cx={440} cy={306} color="rgb(var(--loss))" delay={2.0} reduced={!!prefersReduced} />
          <StoryDot cx={505} cy={314} color="rgb(var(--accent))" delay={2.6} reduced={!!prefersReduced} />
          <StoryDot cx={850} cy={184} color="rgb(var(--profit))" delay={4.1} reduced={!!prefersReduced} />
        </svg>

        {/* Annotations IA (HTML — positions en % du viewBox 1000×380) */}
        <StoryChip tone="alert" title={t("hero_chart_alert_title")} body={t("hero_chart_alert_body")} delay={2.1} className="left-[24%] top-[38%]" />
        <StoryChip tone="action" title={t("hero_chart_action_title")} body={t("hero_chart_action_body")} delay={2.7} className="left-[51.5%] top-[4%]" />
        <StoryChip tone="win" title={t("hero_chart_win_title")} body={t("hero_chart_win_body")} delay={4.2} className="left-[63%] top-[22%]" />
      </div>

      {/* Pied : les chiffres qui comptent */}
      <div className="relative flex items-center justify-around border-t px-4 py-3 sm:py-3.5" style={{ borderColor: "rgb(var(--border)/0.7)", background: "rgb(var(--card)/0.6)" }}>
        {[
          { label: "DISCIPLINE", value: <><NumberCount end={85} duration={2200} />/100</>, color: "rgb(var(--accent))" },
          { label: t("preview_winrate"), value: <><NumberCount end={68} duration={2200} />%</>, color: "rgb(var(--foreground))" },
          { label: t("preview_trades"), value: <NumberCount end={47} duration={2200} />, color: "rgb(var(--foreground))" },
          { label: t("preview_pnl_total"), value: <>+<NumberCount end={3240} duration={2400} />€</>, color: "rgb(var(--profit))" },
        ].map((s, i) => (
          <motion.div key={i} className="text-center" style={{ fontStyle: "normal" }}
            initial={prefersReduced ? false : { opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.45, delay: 0.7 + i * 0.1, ease }}>
            <p className="text-sm sm:text-base font-bold tabular-nums leading-none" style={{ color: s.color }}>{s.value}</p>
            <p className="text-[8px] sm:text-[9px] uppercase tracking-widest mt-1" style={{ color: "rgb(var(--muted))" }}>{s.label}</p>
          </motion.div>
        ))}
      </div>
    </div>
  );
}

/* ─────────────────────────────────────────────
   LIVE MARKET TICKER — bandeau prix défilant
   Données décoratives (pas un vrai flux) — pur effet.
───────────────────────────────────────────── */
const TICKER_INSTRUMENTS = [
  { sym: "EUR/USD", price: "1.0842", chg: "+0.32%", up: true },
  { sym: "XAU/USD", price: "2 384.10", chg: "+1.14%", up: true },
  { sym: "GBP/JPY", price: "198.42", chg: "-0.21%", up: false },
  { sym: "BTC/USD", price: "67 240", chg: "+2.48%", up: true },
  { sym: "US30", price: "39 118", chg: "+0.54%", up: true },
  { sym: "NAS100", price: "18 902", chg: "-0.37%", up: false },
  { sym: "ETH/USD", price: "3 512", chg: "+1.92%", up: true },
  { sym: "USD/JPY", price: "156.78", chg: "+0.11%", up: true },
  { sym: "GBP/USD", price: "1.2715", chg: "-0.18%", up: false },
  { sym: "SOL/USD", price: "172.3", chg: "+4.21%", up: true },
];

function MarketTicker() {
  const items = [...TICKER_INSTRUMENTS, ...TICKER_INSTRUMENTS];
  return (
    <section
      className="relative py-3 border-y overflow-hidden"
      style={{ borderColor: "rgb(var(--border)/0.5)", background: "rgb(var(--card)/0.4)" }}
      aria-hidden
    >
      <div
        style={{
          maskImage: "linear-gradient(90deg, transparent 0%, black 8%, black 92%, transparent 100%)",
          WebkitMaskImage: "linear-gradient(90deg, transparent 0%, black 8%, black 92%, transparent 100%)",
        }}
      >
        <div className="ticker-track flex items-center gap-7 w-max">
          {items.map((it, i) => {
            const c = it.up ? "rgb(var(--profit))" : "rgb(var(--loss))";
            return (
              <div key={`${it.sym}-${i}`} className="flex items-center gap-2.5 shrink-0 whitespace-nowrap">
                <span className="relative flex w-1.5 h-1.5">
                  <span className="ticker-flash absolute inset-0 rounded-full" style={{ background: c, animationDelay: `${(i % 7) * 0.4}s` }} />
                  <span className="relative w-1.5 h-1.5 rounded-full" style={{ background: c }} />
                </span>
                <span className="text-[13px] font-semibold tracking-wide" style={{ color: "rgb(var(--foreground)/0.85)", fontStyle: "normal" }}>{it.sym}</span>
                <span className="text-[13px] tabular-nums" style={{ color: COPY, fontStyle: "normal" }}>{it.price}</span>
                <span className="text-[12px] font-bold tabular-nums inline-flex items-center gap-0.5" style={{ color: c, fontStyle: "normal" }}>
                  <svg className="w-2.5 h-2.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={3} aria-hidden style={{ transform: it.up ? "none" : "rotate(180deg)" }}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M5 15l7-7 7 7" />
                  </svg>
                  {it.chg}
                </span>
              </div>
            );
          })}
        </div>
      </div>
    </section>
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
    <section className="landing-section px-6">
      <div className="max-w-5xl mx-auto">
        <Reveal className="text-center mb-16">
          <Eyebrow>{t("eyebrow_problem")}</Eyebrow>
          <h2 className="text-4xl sm:text-5xl font-bold leading-tight" style={{ color: "rgb(var(--foreground))" }}>
            {t("problem_title")}
            <br />
            <span style={{ color: COPY }}>{t("problem_subtitle")}</span>
          </h2>
        </Reveal>

        <StaggerReveal className="grid grid-cols-1 md:grid-cols-3 gap-4" stagger={0.1}>
          {problems.map((p) => (
            <SpotlightCard
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
              <p className="text-[15px] leading-relaxed" style={{ color: COPY, fontStyle: "normal" }}>{p.desc}</p>
            </SpotlightCard>
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
    <SpotlightCard
      className="rounded-2xl border overflow-hidden h-full group/card"
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
        <p className="text-[15px] leading-relaxed" style={{ color: COPY, fontStyle: "normal" }}>{f.desc}</p>
      </div>
      <div className="mt-4 border-t" style={{ borderColor: "rgb(var(--border)/0.5)", background: "rgb(var(--surface)/0.3)" }}>
        {f.visual}
      </div>
    </SpotlightCard>
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
    <section id="features" className="landing-section px-6 border-t" style={{ borderColor: "rgb(var(--border)/0.5)" }}>
      <div className="max-w-5xl mx-auto">
        <Reveal className="text-center mb-16">
          <Eyebrow>{t("eyebrow_features")}</Eyebrow>
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
                    <p className="text-[14px] mt-0.5" style={{ color: COPY, fontStyle: "normal" }}>{step.sub}</p>
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
    <section className="landing-section px-6 border-t" style={{ borderColor: "rgb(var(--border)/0.5)" }}>
      <div className="max-w-5xl mx-auto">
        <Reveal className="text-center mb-14">
          <Eyebrow>{t("eyebrow_ai_coach")}</Eyebrow>
          <h2 className="text-4xl sm:text-5xl font-bold" style={{ color: "rgb(var(--foreground))" }}>{t("ai_detect_title")}</h2>
          <p className="mt-4 max-w-xl mx-auto text-base leading-relaxed" style={{ color: COPY, fontStyle: "normal" }}>{t("ai_detect_subtitle")}</p>
        </Reveal>

        {/* Démo produit en boucle — le coach IA en action */}
        <Reveal delay={0.1}>
          <LiveDemo />
        </Reveal>

        <StaggerReveal className="grid grid-cols-1 sm:grid-cols-2 gap-3" stagger={0.09}>
          {detections.map((d, i) => (
            <SpotlightCard
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
            </SpotlightCard>
          ))}
        </StaggerReveal>
      </div>
    </section>
  );
}

/* ─────────────────────────────────────────────
   ROI BAND — "TradeDiscipline pays for itself"
───────────────────────────────────────────── */
/* Démonstration de rentabilité (sans chiffre inventé) : une inégalité animée
   « 1 erreur évitée ❯❯ des mois remboursés », puis les DEUX forfaits payants à
   leur vrai prix + coût ramené au jour (dérivé, honnête). But : vendre les plans
   payants en montrant qu'ils sont remboursés dès la première erreur évitée. */
const ROI_PAID_PLANS = [
  { nameKey: "plan_plus", price: "14.99€", perDay: "0.49€", tone: "--accent" },
  { nameKey: "plan_premium", price: "29.99€", perDay: "0.99€", tone: "--warning" },
];

function RoiPayback({ t }: { t: (k: string) => string }) {
  const reduced = useReducedMotion();
  const ref = useRef<HTMLDivElement>(null);
  const inView = useInView(ref, { once: true, margin: "-80px" });
  const go = reduced || inView;

  return (
    <div ref={ref} className="mt-8">
      {/* ── Inégalité animée : 1 erreur évitée ❯❯ des mois remboursés ── */}
      <div
        className="relative rounded-2xl border p-5 sm:p-7 max-w-2xl mx-auto overflow-hidden"
        style={{
          background: "radial-gradient(ellipse 90% 130% at 100% 50%, rgb(var(--profit)/0.08), transparent 60%), rgb(var(--surface)/0.4)",
          borderColor: "rgb(var(--profit)/0.25)",
        }}
      >
        <div className="flex flex-col sm:flex-row items-center justify-center gap-3 sm:gap-6 text-center">
          {/* gauche — une erreur évitée */}
          <motion.div
            initial={reduced ? false : { opacity: 0, x: -18 }}
            animate={go ? { opacity: 1, x: 0 } : {}}
            transition={{ duration: 0.55, ease }}
          >
            <p className="text-xl sm:text-2xl font-extrabold leading-tight" style={{ color: "rgb(var(--foreground))", fontStyle: "normal" }}>
              <span style={{ color: "rgb(var(--loss))" }}>1</span> {t("pricing_roi_ineq_left")}
            </p>
            <p className="text-[11px] mt-1 uppercase tracking-wide" style={{ color: COPY, fontStyle: "normal" }}>{t("pricing_roi_ineq_left_sub")}</p>
          </motion.div>

          {/* chevrons animés — vers le bas en mobile, vers la droite en desktop */}
          <div className="flex items-center gap-0.5 rotate-90 sm:rotate-0" aria-hidden>
            {[0, 1, 2].map((k) => (
              <motion.svg
                key={k}
                className="w-4 h-4"
                style={{ color: "rgb(var(--profit))" }}
                initial={false}
                animate={reduced ? { opacity: 0.7 } : { opacity: go ? [0.2, 1, 0.2] : 0.2 }}
                transition={{ duration: 1.3, repeat: go && !reduced ? Infinity : 0, delay: k * 0.16, ease: "easeInOut" }}
                viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={3}
              >
                <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
              </motion.svg>
            ))}
          </div>

          {/* droite — des mois remboursés */}
          <motion.div
            initial={reduced ? false : { opacity: 0, x: 18 }}
            animate={go ? { opacity: 1, x: 0 } : {}}
            transition={{ duration: 0.55, ease, delay: 0.15 }}
          >
            <p className="text-xl sm:text-2xl font-extrabold leading-tight" style={{ color: "rgb(var(--profit))", fontStyle: "normal" }}>{t("pricing_roi_ineq_right")}</p>
          </motion.div>
        </div>
      </div>

      {/* ── Les deux forfaits payants, prix réels + coût/jour ── */}
      <div className="mt-4 grid grid-cols-1 sm:grid-cols-2 gap-3 max-w-2xl mx-auto">
        {ROI_PAID_PLANS.map((p, i) => (
          <motion.div
            key={p.nameKey}
            className="rounded-xl border p-4 flex items-center gap-3"
            style={{ background: `rgb(var(${p.tone})/0.06)`, borderColor: `rgb(var(${p.tone})/0.28)` }}
            initial={reduced ? false : { opacity: 0, y: 12 }}
            animate={go ? { opacity: 1, y: 0 } : {}}
            transition={{ duration: 0.5, ease, delay: reduced ? 0 : 0.3 + i * 0.12 }}
          >
            <span className="w-2 h-2 rounded-full shrink-0" style={{ background: `rgb(var(${p.tone}))` }} />
            <div className="min-w-0">
              <p className="text-sm font-bold" style={{ color: "rgb(var(--foreground))", fontStyle: "normal" }}>{t(p.nameKey)}</p>
              <p className="text-[11px]" style={{ color: COPY, fontStyle: "normal" }}>{t("pricing_roi_perday").replace("{v}", p.perDay)}</p>
            </div>
            <p className="ml-auto text-lg sm:text-xl font-extrabold tabular-nums whitespace-nowrap" style={{ color: `rgb(var(${p.tone}))`, fontStyle: "normal" }}>
              {p.price}
              <span className="text-[11px] font-medium" style={{ color: COPY }}>{t("pricing_roi_permonth")}</span>
            </p>
          </motion.div>
        ))}
      </div>

      {/* ── Verdict ── */}
      <motion.div
        className="flex items-center justify-center gap-1.5 mt-5"
        initial={false}
        animate={{ opacity: go ? 1 : 0, y: go ? 0 : 6 }}
        transition={{ duration: 0.5, delay: reduced ? 0 : 0.6, ease }}
      >
        <svg className="w-4 h-4 shrink-0" style={{ color: "rgb(var(--profit))" }} fill="none" stroke="currentColor" strokeWidth={2.5} viewBox="0 0 24 24" aria-hidden>
          <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
        </svg>
        <span className="text-sm font-bold text-center" style={{ color: "rgb(var(--profit))", fontStyle: "normal" }}>{t("pricing_roi_verdict")}</span>
      </motion.div>
    </div>
  );
}

function ROIBand({ t }: { t: (k: string) => string }) {
  const points = [
    {
      tone: "--profit",
      title: t("pricing_roi_point1_t"),
      desc: t("pricing_roi_point1_d"),
      icon: "M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15", // remboursé / cycle
    },
    {
      tone: "--accent",
      title: t("pricing_roi_point2_t"),
      desc: t("pricing_roi_point2_d"),
      icon: "M17 9V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-2M21 12h-6a2 2 0 100 4h6a1 1 0 001-1v-2a1 1 0 00-1-1z", // portefeuille / coût/jour
    },
    {
      tone: "--warning",
      title: t("pricing_roi_point3_t"),
      desc: t("pricing_roi_point3_d"),
      icon: "M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z", // bouclier / capital protégé
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
        <p className="mt-3 text-sm sm:text-base text-center max-w-2xl mx-auto leading-relaxed" style={{ color: COPY, fontStyle: "normal" }}>
          {t("pricing_roi_sub")}
        </p>

        {/* Démonstration de rentabilité (inégalité + forfaits payants) */}
        <RoiPayback t={t} />

        {/* 3 points de fond (honnêtes, sans chiffre inventé) */}
        <StaggerReveal className="mt-10 grid grid-cols-1 sm:grid-cols-3 gap-3" stagger={0.1}>
          {points.map((p) => (
            <div
              key={p.title}
              className="rounded-xl border p-5 h-full"
              style={{ background: `rgb(var(${p.tone})/0.05)`, borderColor: `rgb(var(${p.tone})/0.18)` }}
            >
              <div className="w-9 h-9 rounded-lg flex items-center justify-center mb-3" style={{ background: `rgb(var(${p.tone})/0.12)` }}>
                <svg className="w-4.5 h-4.5" style={{ color: `rgb(var(${p.tone}))`, width: 18, height: 18 }} fill="none" stroke="currentColor" strokeWidth={1.75} viewBox="0 0 24 24" aria-hidden>
                  <path strokeLinecap="round" strokeLinejoin="round" d={p.icon} />
                </svg>
              </div>
              <p className="text-sm font-bold" style={{ color: "rgb(var(--foreground))", fontStyle: "normal" }}>{p.title}</p>
              <p className="mt-1.5 text-[13px] leading-relaxed" style={{ color: COPY, fontStyle: "normal" }}>{p.desc}</p>
            </div>
          ))}
        </StaggerReveal>

        {/* kicker */}
        <p className="mt-8 text-center text-sm font-medium max-w-xl mx-auto" style={{ color: "rgb(var(--foreground)/0.85)", fontStyle: "normal" }}>
          {t("pricing_roi_kicker")}
        </p>
      </div>
    </Reveal>
  );
}

/* ─────────────────────────────────────────────
   PRICING — comparatif complet repliable
   Rend la matrice partagée lib/plan-features.ts
   (la même que la page « gérer mon plan »).
───────────────────────────────────────────── */
function CompareCell({ val, t }: { val: boolean | string; t: (k: string) => string }) {
  if (val === true) {
    return (
      <svg role="img" aria-label={t("upgrade_included")} className="w-4 h-4 mx-auto" style={{ color: "rgb(var(--profit))" }} fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" />
      </svg>
    );
  }
  if (val === false) {
    return (
      <svg role="img" aria-label={t("upgrade_not_included")} className="w-4 h-4 mx-auto" style={{ color: "rgb(var(--muted)/0.35)" }} fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
      </svg>
    );
  }
  if (val.includes("/")) {
    const [n, periodKey] = val.split("/");
    return <span className="text-sm" style={{ color: "rgb(var(--foreground)/0.85)", fontStyle: "normal" }}>{n}/{t(periodKey)}</span>;
  }
  if (val === "plan_unlimited") {
    return <span className="text-sm font-medium" style={{ color: "rgb(var(--profit))", fontStyle: "normal" }}>{t("plan_unlimited")}</span>;
  }
  // Autres clés i18n (ex. plan_taster_once) — traduites telles quelles.
  if (val.startsWith("plan_")) {
    return <span className="text-sm" style={{ color: "rgb(var(--foreground)/0.85)", fontStyle: "normal" }}>{t(val)}</span>;
  }
  return <span className="text-sm" style={{ color: "rgb(var(--foreground)/0.85)", fontStyle: "normal" }}>{val}</span>;
}

function PricingCompareTable({ t }: { t: (k: string) => string }) {
  const [open, setOpen] = useState(false);
  return (
    <Reveal className="mt-8">
      <div className="flex justify-center">
        <button
          type="button"
          onClick={() => setOpen((o) => !o)}
          aria-expanded={open}
          className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl border text-sm font-medium transition-colors hover:border-[rgb(var(--accent)/0.4)]"
          style={{ borderColor: "rgb(var(--border))", background: "rgb(var(--card))", color: "rgb(var(--foreground))", fontStyle: "normal" }}
        >
          {t("pricing_compare_toggle")}
          <svg className={`w-4 h-4 transition-transform duration-200 ${open ? "rotate-180" : ""}`} style={{ color: "rgb(var(--muted))" }} fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
          </svg>
        </button>
      </div>

      <AnimatePresence initial={false}>
        {open && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.3, ease }}
            className="overflow-hidden"
          >
            <div className="mt-5 rounded-2xl border overflow-x-auto" style={{ borderColor: "rgb(var(--border))", background: "rgb(var(--card))" }}>
              <table className="w-full text-sm min-w-[560px]">
                <thead>
                  <tr className="border-b" style={{ borderColor: "rgb(var(--border))", background: "rgb(var(--surface)/0.5)" }}>
                    <th className="text-left px-4 py-3 font-medium" style={{ color: COPY, fontStyle: "normal" }}>{t("plan_feature")}</th>
                    <th className="text-center px-4 py-3 font-medium" style={{ color: COPY, fontStyle: "normal" }}>{t("plan_free")}</th>
                    <th className="text-center px-4 py-3 font-semibold" style={{ color: "rgb(var(--accent))", fontStyle: "normal" }}>{t("plan_plus")}</th>
                    <th className="text-center px-4 py-3 font-semibold" style={{ color: "rgb(245,158,11)", fontStyle: "normal" }}>{t("plan_premium")}</th>
                  </tr>
                </thead>
                <tbody>
                  {PLAN_FEATURES.map((f) => (
                    <React.Fragment key={f.key}>
                      {f.groupKey && (
                        <tr style={{ background: "rgb(var(--surface)/0.55)" }}>
                          <td colSpan={4} className="px-4 py-2 text-[11px] font-bold uppercase tracking-wider" style={{ color: COPY, fontStyle: "normal" }}>{t(f.groupKey)}</td>
                        </tr>
                      )}
                      <tr className="border-t" style={{ borderColor: "rgb(var(--border)/0.6)" }}>
                        <td className="px-4 py-2.5" style={{ color: "rgb(var(--foreground)/0.9)", fontStyle: "normal" }}>{t(f.key)}</td>
                        <td className="px-4 py-2.5 text-center"><CompareCell val={f.free} t={t} /></td>
                        <td className="px-4 py-2.5 text-center"><CompareCell val={f.plus} t={t} /></td>
                        <td className="px-4 py-2.5 text-center"><CompareCell val={f.premium} t={t} /></td>
                      </tr>
                    </React.Fragment>
                  ))}
                </tbody>
              </table>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
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
      feats: FREE_BENEFITS.map((k) => t(k)),
      featsLabel: "",
      includesNote: "",
      btnKey: "pricing_start_free",
      roiKey: "",
      popular: false,
      gold: false,
    },
    {
      name: t("plan_plus"),
      sub: t("plan_sub_plus"),
      monthlyPrice: "14.99€",
      annualPrice: "134.90€",
      annualMonthly: "11.24€",
      feats: PLUS_BENEFITS.map((k) => t(k)),
      featsLabel: "",
      includesNote: "",
      btnKey: "pricing_choose_plus",
      roiKey: "plan_roi_plus",
      popular: true,
      gold: false,
    },
    {
      // Premium : uniquement ce qu'il AJOUTE, le contenu du Plus est signalé
      // à part (includesNote) pour ne jamais mélanger les deux.
      name: t("plan_premium"),
      sub: t("plan_premium_desc"),
      monthlyPrice: "29.99€",
      annualPrice: "269.90€",
      annualMonthly: "22.49€",
      feats: PREMIUM_BENEFITS.map((k) => t(k)),
      featsLabel: t("plan_premium_exclusives"),
      includesNote: t("plan_premium_includes_plus_short"),
      btnKey: "pricing_choose_premium",
      roiKey: "plan_roi_premium",
      popular: false,
      gold: true,
    },
  ];

  return (
    <section id="pricing" className="landing-section px-6 border-t" style={{ borderColor: "rgb(var(--border)/0.5)" }}>
      <div className="max-w-5xl mx-auto">
        <Reveal className="text-center mb-12">
          <Eyebrow>{t("eyebrow_pricing")}</Eyebrow>
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
                color: !annual ? "rgb(var(--foreground))" : COPY,
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
                color: annual ? "rgb(var(--foreground))" : COPY,
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
                <p className="text-xs mb-5" style={{ color: COPY, fontStyle: "normal" }}>{p.sub}</p>

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
                      <span className="text-sm mb-0.5" style={{ color: COPY, fontStyle: "normal" }}>{period}</span>
                    </div>
                    {savings
                      ? <p className="text-xs mt-1 font-medium" style={{ color: "rgb(var(--profit))", fontStyle: "normal" }}>{t("plan_equiv")} {p.annualMonthly}/{t("plan_month")}</p>
                      : <div className="h-5" aria-hidden />
                    }
                  </motion.div>
                </AnimatePresence>

                <div className="mt-5 flex-1">
                  {p.featsLabel && (
                    <p className="text-[10px] font-bold uppercase tracking-widest mb-2.5" style={{ color: "rgb(245,158,11)", fontStyle: "normal" }}>{p.featsLabel}</p>
                  )}
                  <ul className="space-y-2.5">
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
                  {/* « Tout le plan Plus inclus » — séparé des exclusivités */}
                  {p.includesNote && (
                    <p className="mt-4 pt-3 border-t flex items-center gap-2 text-[13px] font-medium" style={{ borderColor: "rgba(245,158,11,0.2)", color: "rgb(var(--foreground)/0.75)", fontStyle: "normal" }}>
                      <span className="inline-flex items-center justify-center w-4 h-4 rounded-full shrink-0 text-[11px] font-bold" style={{ background: "rgba(245,158,11,0.12)", color: "rgb(245,158,11)" }} aria-hidden>+</span>
                      {p.includesNote}
                    </p>
                  )}
                </div>

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

        {/* Comparatif complet (repliable) — toutes les fonctionnalités, aucun oubli */}
        <PricingCompareTable t={t} />

        <Reveal className="flex flex-wrap items-center justify-center gap-6 mt-8 text-xs text-[rgb(var(--foreground-muted))]">
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
    <section id="faq" className="landing-section px-6 border-t" style={{ borderColor: "rgb(var(--border)/0.5)" }}>
      <div className="max-w-2xl mx-auto">
        <Reveal className="text-center mb-14">
          <Eyebrow>{t("eyebrow_faq")}</Eyebrow>
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
                      <p className="px-5 pb-4 text-[15px] leading-relaxed" style={{ color: COPY, fontStyle: "normal" }}>{faq.a}</p>
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
    <section className="landing-section px-6 border-t relative overflow-hidden" style={{ borderColor: "rgb(var(--border)/0.5)" }}>
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

          <p className="mt-5 text-lg leading-relaxed" style={{ color: COPY, fontStyle: "normal" }}>
            {t("cta_subtitle")}
          </p>

          <div className="mt-10">
            <Magnetic strength={0.45} className="inline-block">
              <Link
                href="/login"
                className="btn-primary-shimmer group relative inline-block px-8 py-3.5 rounded-xl font-bold text-base text-white transition-all duration-200 hover:scale-[1.03] active:scale-[0.98] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[rgb(var(--accent))]"
                style={{
                  background: "linear-gradient(135deg, rgb(var(--accent)) 0%, #3b82f6 100%)",
                  boxShadow: "0 0 0 1px rgb(var(--accent)/0.3), 0 8px 32px rgb(var(--accent)/0.25)",
                }}
              >
                <span className="relative z-10">{t("cta_button")}</span>
              </Link>
            </Magnetic>
          </div>

          <p className="text-xs mt-4" style={{ color: COPY, fontStyle: "normal" }}>{t("pricing_no_commitment")}</p>
        </Reveal>
      </div>
    </section>
  );
}

/* ─────────────────────────────────────────────
   FOOTER
───────────────────────────────────────────── */
function Footer() {
  const { t, lang } = useLanguage();

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
            <p className="text-xs leading-relaxed" style={{ color: COPY, fontStyle: "normal" }}>{t("footer_brand_desc")}</p>
          </div>

          {[
            {
              heading: t("footer_product"),
              links: [{ href: "#features", label: t("nav_features") }, { href: "#pricing", label: t("nav_pricing") }],
            },
            {
              heading: t("footer_resources"),
              // Pages multilingues : on préserve la locale du visiteur dans l'URL
              links: [
                { href: localizedHref("/trading-journal", lang), label: t("footer_trading_journal") },
                { href: localizedHref("/blog", lang), label: "Blog" },
                { href: localizedHref("/contact", lang), label: t("footer_contact") },
                { href: localizedHref("/faq", lang), label: t("footer_faq") },
              ],
            },
            {
              heading: t("footer_legal_col"),
              links: [
                { href: "/legal/terms", label: t("footer_terms") },
                { href: "/legal/cgv", label: t("footer_cgv") },
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
                    <a href={l.href} className="text-sm transition-colors hover:text-[rgb(var(--foreground))]" style={{ color: COPY, fontStyle: "normal" }}>{l.label}</a>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>

        <div className="border-t pt-6" style={{ borderColor: "rgb(var(--border)/0.5)" }}>
          <p className="text-xs" style={{ color: COPY, fontStyle: "normal" }}>© 2026 TradeDiscipline. {t("footer_legal")}.</p>
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
   COACH ASSISTANT — "chambre de transformation"
   Signature originale : l'intention en langage naturel est tapée à gauche,
   part en impulsion lumineuse le long d'un conduit jusqu'au cœur-réacteur
   (anneaux contra-rotatifs + flare réactif), qui "imprime" à droite le
   résultat CONCRET — assemblé pièce par pièce (objectif, trade annoté, CSV…).
   Boucle sur 6 capacités. 100% transform/opacity, SSR-safe, reduced-motion-safe.
───────────────────────────────────────────── */
type CoachStepKind = "insight" | "goal" | "annotate" | "strategy" | "export" | "challenge";
interface CoachStep {
  kind: CoachStepKind;
  cmdKey: string;   // commande tapée (réutilise coach_cap_*_ex)
  labelKey: string; // libellé outil (réutilise coach_cap_*_title)
  tone: string;     // couleur d'accent de l'étape (var CSS)
}
const COACH_STEPS: CoachStep[] = [
  { kind: "goal",      cmdKey: "coach_cap_goals_ex",     labelKey: "coach_cap_goals_title",     tone: "--accent" },
  { kind: "annotate",  cmdKey: "coach_cap_annotate_ex",  labelKey: "coach_cap_annotate_title",  tone: "--loss" },
  { kind: "strategy",  cmdKey: "coach_cap_strategy_ex",  labelKey: "coach_cap_strategy_title",  tone: "--profit" },
  { kind: "insight",   cmdKey: "coach_cap_analyze_ex",   labelKey: "coach_cap_analyze_title",   tone: "--warning" },
  { kind: "export",    cmdKey: "coach_cap_export_ex",    labelKey: "coach_cap_export_title",    tone: "--accent" },
  { kind: "challenge", cmdKey: "coach_cap_challenge_ex", labelKey: "coach_cap_challenge_title", tone: "--profit" },
];

/* Machine à écrire : révèle le texte caractère par caractère, re-joue à chaque
   changement de `text` (donc à chaque étape). */
function CoachTyper({ text, onDone }: { text: string; onDone?: () => void }) {
  const [n, setN] = useState(0);
  const reduced = useReducedMotion();
  const doneRef = useRef(onDone);
  doneRef.current = onDone;
  useEffect(() => {
    if (reduced) { setN(text.length); doneRef.current?.(); return; }
    setN(0);
    let idx = 0;
    const id = setInterval(() => {
      idx += 1;
      setN(idx);
      if (idx >= text.length) { clearInterval(id); doneRef.current?.(); }
    }, 26);
    return () => clearInterval(id);
  }, [text, reduced]);
  return (
    <span>
      {text.slice(0, n)}
      <span className="coach-caret" style={{ background: "rgb(var(--accent))" }} aria-hidden />
    </span>
  );
}

/* Cœur-réacteur : anneaux contra-rotatifs + polygone + noyau qui "encaisse"
   l'impulsion (flare) pendant la phase d'exécution. */
function ReactorCore({ hot, tone }: { hot: boolean; tone: string }) {
  const reduced = useReducedMotion();
  const spin = (dur: number, dir = 1): TargetAndTransition =>
    reduced ? {} : { rotate: dir * 360, transition: { duration: dur, ease: "linear", repeat: Infinity } };
  const col = `rgb(var(${tone}))`;
  return (
    <div className="relative shrink-0" style={{ width: 116, height: 116 }}>
      {/* halo réactif */}
      <motion.div
        className="absolute inset-0 rounded-full"
        style={{ background: `radial-gradient(circle, ${col} 0%, transparent 68%)` }}
        animate={reduced ? { opacity: 0.22 } : { opacity: hot ? 0.5 : 0.16, scale: hot ? 1.12 : 0.94 }}
        transition={{ duration: 0.5, ease }}
      />
      <svg viewBox="0 0 120 120" className="absolute inset-0 w-full h-full">
        <defs>
          <linearGradient id="reactorStroke" x1="0" y1="0" x2="1" y2="1">
            <stop offset="0%" stopColor={col} stopOpacity="0.9" />
            <stop offset="100%" stopColor={col} stopOpacity="0.25" />
          </linearGradient>
        </defs>
        {/* anneau externe pointillé */}
        <motion.circle
          cx="60" cy="60" r="52" fill="none" stroke="url(#reactorStroke)" strokeWidth="1.5"
          strokeDasharray="4 10" style={{ transformOrigin: "center", transformBox: "fill-box" }} animate={spin(26)}
        />
        {/* hexagone contra-rotatif */}
        <motion.polygon
          points="60,16 98,38 98,82 60,104 22,82 22,38"
          fill="none" stroke={col} strokeOpacity="0.35" strokeWidth="1.2"
          style={{ transformOrigin: "center", transformBox: "fill-box" }} animate={spin(18, -1)}
        />
        {/* arc rapide */}
        <motion.circle
          cx="60" cy="60" r="38" fill="none" stroke={col} strokeWidth="2"
          strokeDasharray="60 179" strokeLinecap="round"
          style={{ transformOrigin: "center", transformBox: "fill-box" }} animate={spin(9)}
        />
        {/* onde de choc à l'exécution */}
        <motion.circle
          cx="60" cy="60" fill="none" stroke={col} strokeWidth="1.5"
          initial={false}
          animate={hot && !reduced ? { r: [30, 56], opacity: [0.6, 0] } : { r: 30, opacity: 0 }}
          transition={{ duration: 0.7, ease }}
        />
        {/* noyau */}
        <motion.circle
          cx="60" cy="60" fill={col}
          animate={reduced ? { r: 12 } : { r: hot ? 15 : 11, opacity: hot ? 1 : 0.82 }}
          transition={{ duration: 0.4, ease }}
        />
        <motion.circle
          cx="60" cy="60" r="5" fill="rgb(var(--background))"
          animate={reduced ? {} : { opacity: hot ? 0.2 : 0.55 }}
          transition={{ duration: 0.4 }}
        />
      </svg>
    </div>
  );
}

/* Impulsion qui file le long d'un conduit horizontal (command → cœur → résultat). */
function Conduit({ fire, reverse = false, tone }: { fire: boolean; reverse?: boolean; tone: string }) {
  const reduced = useReducedMotion();
  const col = `rgb(var(${tone}))`;
  return (
    <div className="relative hidden md:block h-px flex-1 mx-1" style={{ background: "rgb(var(--border))" }}>
      <div className="absolute inset-0 overflow-hidden">
        {!reduced && (
          <motion.span
            key={fire ? "on" : "off"}
            className="absolute top-1/2 h-1.5 w-6 rounded-full -translate-y-1/2"
            style={{ background: `linear-gradient(90deg, transparent, ${col})`, boxShadow: `0 0 10px ${col}` }}
            initial={{ left: reverse ? "100%" : "-24px", opacity: 0 }}
            animate={fire ? { left: reverse ? "-24px" : "100%", opacity: [0, 1, 1, 0] } : { opacity: 0 }}
            transition={{ duration: 0.7, ease }}
          />
        )}
      </div>
    </div>
  );
}

/* Petit rendu de résultat CONCRET, distinct par capacité, assemblé pièce à pièce. */
function CoachOutcome({ step, show, t }: { step: CoachStep; show: boolean; t: (k: string) => string }) {
  const reduced = useReducedMotion();
  const col = `rgb(var(${step.tone}))`;
  const container = {
    hidden: {},
    show: { transition: { staggerChildren: 0.11, delayChildren: 0.04 } },
  };
  const piece = {
    hidden: reduced ? { opacity: 1 } : { opacity: 0, y: 9 },
    show: { opacity: 1, y: 0, transition: { duration: 0.42, ease } },
  };
  const chip = {
    hidden: reduced ? { opacity: 1, scale: 1 } : { opacity: 0, scale: 0.4 },
    show: { opacity: 1, scale: 1, transition: { type: "spring" as const, stiffness: 520, damping: 20 } },
  };

  const inner = () => {
    switch (step.kind) {
      case "goal":
        return (
          <>
            <motion.div variants={piece} className="flex items-center justify-between">
              <span className="text-sm font-bold" style={{ color: "rgb(var(--foreground))" }}>{t("landing_coach_out_goal")}</span>
              <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded" style={{ color: col, background: `rgb(var(${step.tone})/0.12)` }}>{t("landing_coach_target")}</span>
            </motion.div>
            <motion.div variants={piece} className="mt-3 h-2 rounded-full overflow-hidden" style={{ background: "rgb(var(--border))" }}>
              <motion.div className="h-full rounded-full" style={{ background: col }}
                initial={{ width: 0 }} animate={show ? { width: "66%" } : { width: 0 }} transition={{ duration: 0.9, ease, delay: 0.25 }} />
            </motion.div>
            <motion.p variants={piece} className="mt-2 text-[11px]" style={{ color: "rgb(var(--muted))" }}>2 / 3 · {t("landing_coach_period_month")}</motion.p>
          </>
        );
      case "annotate":
        return (
          <>
            <motion.div variants={piece} className="flex items-center gap-2">
              <span className="text-sm font-bold" style={{ color: "rgb(var(--foreground))" }}>EUR/USD</span>
              <span className="text-[10px] px-1.5 py-0.5 rounded font-semibold" style={{ color: "rgb(var(--loss))", background: "rgb(var(--loss)/0.12)" }}>SHORT</span>
              <span className="ml-auto text-[11px] tabular-nums" style={{ color: "rgb(var(--muted))" }}>−1.8%</span>
            </motion.div>
            <div className="mt-3 flex items-center gap-1.5">
              <motion.span variants={piece} className="text-[11px]" style={{ color: "rgb(var(--muted))" }}>{t("landing_coach_emotion_label")}</motion.span>
              <motion.span variants={chip} className="inline-flex items-center gap-1 text-[11px] font-bold px-2 py-0.5 rounded-full" style={{ color: col, background: `rgb(var(${step.tone})/0.14)`, border: `1px solid rgb(var(${step.tone})/0.3)` }}>
                🤑 {t("emotion_fomo")}
              </motion.span>
            </div>
          </>
        );
      case "strategy":
        return (
          <>
            {[t("landing_coach_check_1"), t("landing_coach_check_2")].map((c, k) => (
              <motion.div variants={piece} key={k} className="flex items-center gap-2 mb-1.5">
                <span className="flex items-center justify-center w-4 h-4 rounded" style={{ background: "rgb(var(--profit)/0.16)" }}>
                  <svg className="w-2.5 h-2.5" viewBox="0 0 24 24" fill="none" stroke="rgb(var(--profit))" strokeWidth={3}><path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" /></svg>
                </span>
                <span className="text-[12px]" style={{ color: "rgb(var(--muted))" }}>{c}</span>
              </motion.div>
            ))}
            <motion.div variants={chip} className="flex items-center gap-2 rounded-lg px-2 py-1.5 -mx-1" style={{ background: `rgb(var(${step.tone})/0.1)`, border: `1px solid rgb(var(${step.tone})/0.28)` }}>
              <motion.span className="flex items-center justify-center w-4 h-4 rounded" style={{ background: col }}
                initial={{ scale: 0 }} animate={show ? { scale: 1 } : { scale: 0 }} transition={{ type: "spring", stiffness: 500, damping: 18, delay: 0.35 }}>
                <svg className="w-2.5 h-2.5" viewBox="0 0 24 24" fill="none" stroke="rgb(var(--background))" strokeWidth={3.5}><path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" /></svg>
              </motion.span>
              <span className="text-[12px] font-semibold" style={{ color: "rgb(var(--foreground))" }}>{t("landing_coach_out_strategy")}</span>
            </motion.div>
          </>
        );
      case "insight":
        return (
          <>
            <motion.p variants={piece} className="text-[10px] uppercase tracking-wide font-bold" style={{ color: col }}>{t("landing_coach_insight_kicker")}</motion.p>
            <motion.div variants={piece} className="mt-1 text-sm font-bold" style={{ color: "rgb(var(--foreground))" }}>{t("landing_coach_out_analyze")}</motion.div>
            <div className="mt-3 flex items-end gap-1.5 h-10">
              {[38, 62, 90, 54, 30].map((h, k) => (
                <motion.span key={k} className="flex-1 rounded-t" style={{ background: k === 2 ? col : "rgb(var(--border))" }}
                  initial={{ height: 0 }} animate={show ? { height: `${h}%` } : { height: 0 }} transition={{ duration: 0.5, ease, delay: 0.2 + k * 0.06 }} />
              ))}
            </div>
          </>
        );
      case "export":
        return (
          <>
            <motion.div variants={piece} className="flex items-center gap-2.5">
              <span className="flex items-center justify-center w-8 h-9 rounded-md text-[9px] font-bold" style={{ background: `rgb(var(${step.tone})/0.14)`, color: col, border: `1px solid rgb(var(${step.tone})/0.3)` }}>CSV</span>
              <div className="min-w-0">
                <p className="text-[12px] font-semibold truncate" style={{ color: "rgb(var(--foreground))" }}>trades-2026-07.csv</p>
                <p className="text-[10px]" style={{ color: "rgb(var(--muted))" }}><NumberCount end={1240} duration={1100} /> {t("landing_coach_rows")}</p>
              </div>
              <motion.span variants={chip} className="ml-auto flex items-center justify-center w-6 h-6 rounded-full" style={{ background: "rgb(var(--profit)/0.16)" }}>
                <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="rgb(var(--profit))" strokeWidth={3}><path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" /></svg>
              </motion.span>
            </motion.div>
            <motion.div variants={piece} className="mt-3 h-1.5 rounded-full overflow-hidden" style={{ background: "rgb(var(--border))" }}>
              <motion.div className="h-full rounded-full" style={{ background: col }} initial={{ width: 0 }} animate={show ? { width: "100%" } : { width: 0 }} transition={{ duration: 0.9, ease }} />
            </motion.div>
          </>
        );
      case "challenge":
        return (
          <>
            <motion.div variants={piece} className="flex items-center gap-2.5">
              <motion.span variants={chip} className="flex items-center justify-center w-9 h-9 rounded-xl text-lg" style={{ background: `rgb(var(${step.tone})/0.14)`, border: `1px solid rgb(var(${step.tone})/0.3)` }}>🏆</motion.span>
              <div>
                <p className="text-[13px] font-bold" style={{ color: "rgb(var(--foreground))" }}>{t("landing_coach_out_challenge")}</p>
                <p className="text-[11px]" style={{ color: "rgb(var(--muted))" }}>+<NumberCount end={128} duration={1000} /> {t("landing_coach_participants")}</p>
              </div>
            </motion.div>
            <motion.p variants={piece} className="mt-2.5 text-[11px] font-semibold" style={{ color: col }}>{t("landing_coach_joined")}</motion.p>
          </>
        );
    }
  };

  return (
    <motion.div
      variants={container}
      initial="hidden"
      animate={show ? "show" : "hidden"}
      className="rounded-2xl border p-4 w-full"
      style={{ background: "rgb(var(--card))", borderColor: `rgb(var(${step.tone})/0.3)`, boxShadow: `0 18px 50px -24px rgb(var(${step.tone})/0.5)` }}
    >
      {inner()}
    </motion.div>
  );
}

function CoachAssistant() {
  const { t } = useLanguage();
  const reduced = useReducedMotion();
  const [i, setI] = useState(0);
  // phase: typing → send (impulsion aller) → exec (cœur chaud) → print (résultat) → return (impulsion retour + fait)
  const [phase, setPhase] = useState<"typing" | "send" | "exec" | "print">("typing");
  const step = COACH_STEPS[i];

  // Orchestration : re-programmée à chaque étape (clé = i).
  useEffect(() => {
    if (reduced) { setPhase("print"); return; }
    setPhase("typing");
    const timers: ReturnType<typeof setTimeout>[] = [];
    // La frappe finit ~ (longueur × 26ms) ; on lance l'impulsion peu après.
    const typeMs = Math.min(1700, COACH_STEPS[i] ? t(step.cmdKey).length * 26 + 250 : 900);
    timers.push(setTimeout(() => setPhase("send"), typeMs));
    timers.push(setTimeout(() => setPhase("exec"), typeMs + 650));
    timers.push(setTimeout(() => setPhase("print"), typeMs + 950));
    timers.push(setTimeout(() => setI((v) => (v + 1) % COACH_STEPS.length), typeMs + 3200));
    return () => timers.forEach(clearTimeout);
  }, [i, reduced]); // eslint-disable-line react-hooks/exhaustive-deps

  const hot = phase === "exec" || phase === "print";
  const showOut = phase === "print";

  return (
    <section className="landing-section px-6 border-t" style={{ borderColor: "rgb(var(--border)/0.5)" }}>
      <div className="max-w-5xl mx-auto">
        <Reveal className="text-center mb-14">
          <Eyebrow>{t("landing_coach_eyebrow")}</Eyebrow>
          <h2 className="text-4xl sm:text-5xl font-bold leading-tight" style={{ color: "rgb(var(--foreground))" }}>
            {t("landing_coach_title")}
          </h2>
          <p className="mt-4 text-lg max-w-2xl mx-auto" style={{ color: COPY, fontStyle: "normal" }}>
            {t("landing_coach_subtitle")}
          </p>
        </Reveal>

        <Reveal delay={0.1}>
          <div className="relative rounded-3xl border p-6 sm:p-10 overflow-hidden" style={{ background: "rgb(var(--surface)/0.5)", borderColor: "rgb(var(--border))" }}>
            {/* halo d'ambiance derrière le cœur */}
            <div className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 w-72 h-72 rounded-full pointer-events-none"
              style={{ background: `radial-gradient(circle, rgb(var(${step.tone})/0.12), transparent 70%)`, filter: "blur(8px)" }} aria-hidden />

            <div className="relative flex flex-col md:flex-row items-stretch md:items-center gap-6 md:gap-2">
              {/* ── Intention (commande tapée) ── */}
              <div className="md:flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-2">
                  <span className="w-1.5 h-1.5 rounded-full" style={{ background: "rgb(var(--profit))" }} />
                  <span className="text-[10px] font-bold uppercase tracking-widest" style={{ color: "rgb(var(--muted))" }}>{t("landing_coach_you")}</span>
                </div>
                <div className="rounded-2xl rounded-tl-sm border px-4 py-3 min-h-[64px]" style={{ background: "rgb(var(--card))", borderColor: "rgb(var(--border))" }}>
                  <p className="text-sm leading-relaxed" style={{ color: "rgb(var(--foreground))" }}>
                    <CoachTyper text={t(step.cmdKey)} />
                  </p>
                </div>
              </div>

              <Conduit fire={phase === "send" || phase === "exec"} tone={step.tone} />

              {/* ── Cœur-réacteur ── */}
              <div className="flex flex-col items-center shrink-0">
                <ReactorCore hot={hot} tone={step.tone} />
                <AnimatePresence mode="wait">
                  <motion.span
                    key={phase === "print" ? "done" : "work"}
                    initial={reduced ? false : { opacity: 0, y: 4 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={reduced ? undefined : { opacity: 0, y: -4 }}
                    transition={{ duration: 0.25 }}
                    className="mt-2 text-[10px] font-bold uppercase tracking-widest"
                    style={{ color: phase === "print" ? "rgb(var(--profit))" : "rgb(var(--muted))" }}
                  >
                    {phase === "print" ? t("landing_coach_done") : t("landing_coach_working")}
                  </motion.span>
                </AnimatePresence>
              </div>

              <Conduit fire={phase === "print"} reverse tone={step.tone} />

              {/* ── Résultat concret ── */}
              <div className="md:flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-2 md:justify-end">
                  <span className="text-[10px] font-bold uppercase tracking-widest" style={{ color: "rgb(var(--muted))" }}>{t(step.labelKey)}</span>
                  <span className="w-1.5 h-1.5 rounded-full" style={{ background: `rgb(var(${step.tone}))` }} />
                </div>
                <AnimatePresence mode="wait">
                  <motion.div key={i} initial={reduced ? false : { opacity: 0 }} animate={{ opacity: 1 }} exit={reduced ? undefined : { opacity: 0 }} transition={{ duration: 0.2 }}>
                    <CoachOutcome step={step} show={showOut} t={t} />
                  </motion.div>
                </AnimatePresence>
              </div>
            </div>

            {/* ── Rail des capacités (l'active s'allume) ── */}
            <div className="relative mt-8 flex flex-wrap justify-center gap-2">
              {COACH_STEPS.map((s, k) => {
                const active = k === i;
                return (
                  <button
                    key={s.kind}
                    onClick={() => setI(k)}
                    className="px-3 py-1.5 rounded-full text-[11px] font-semibold transition-colors duration-300 border"
                    style={{
                      color: active ? `rgb(var(${s.tone}))` : "rgb(var(--muted))",
                      background: active ? `rgb(var(${s.tone})/0.12)` : "rgb(var(--card))",
                      borderColor: active ? `rgb(var(${s.tone})/0.4)` : "rgb(var(--border))",
                    }}
                  >
                    {t(s.labelKey)}
                  </button>
                );
              })}
            </div>
          </div>
        </Reveal>
      </div>
    </section>
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
      <PageAmbience />
      <PublicHeader showAnchors />
      <main>
        <Hero />
        <MarketTicker />
        <PlatformMarquee />
        <Problem />
        <DisciplineQuiz />
        <Features />
        <AIDetection />
        <CoachAssistant />
        <CoachOperator />
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
