"use client";

/**
 * LiveDemo — démo produit animée en boucle ("GIF natif" en Framer Motion).
 *
 * Scène auto-jouée qui montre le produit en action :
 *   Phase 0 — Sync : 3 trades MT5 arrivent en cascade
 *   Phase 1 — Scan : balayage IA + surlignage rouge des trades suspects
 *   Phase 2 — Détection : alerte revenge trading
 *   Phase 3 — Coaching : message du coach + score qui chute 85 → 72
 * Puis tout disparaît et la boucle recommence.
 *
 * Ne tourne que lorsqu'elle est visible (useInView) ; avec
 * prefers-reduced-motion, affiche directement l'état final statique.
 */

import { useLanguage } from "@/lib/LanguageContext";
import { AnimatePresence, motion, useInView, useReducedMotion } from "framer-motion";
import { useEffect, useRef, useState } from "react";

const ease = [0.16, 1, 0.3, 1] as const;

const TRADES = [
  { time: "14:02", pair: "XAUUSD", dir: "SELL", pnl: "-85€" },
  { time: "14:05", pair: "XAUUSD", dir: "SELL", pnl: "-120€" },
  { time: "14:09", pair: "XAUUSD", dir: "SELL", pnl: "-95€" },
];

// Durées de chaque phase (ms) — total ≈ 10,5s par boucle
const PHASE_DURATIONS = [2400, 1800, 2800, 3200, 500];

export default function LiveDemo() {
  const { t } = useLanguage();
  const prefersReduced = useReducedMotion();
  const stageRef = useRef<HTMLDivElement>(null);
  const inView = useInView(stageRef, { margin: "-80px" });
  // phase 4 = fondu de sortie avant reboucle
  const [phase, setPhase] = useState(0);

  useEffect(() => {
    if (prefersReduced) {
      setPhase(3); // état final statique
      return;
    }
    if (!inView) return;
    const id = window.setTimeout(() => {
      setPhase((p) => (p + 1) % PHASE_DURATIONS.length);
    }, PHASE_DURATIONS[phase]);
    return () => window.clearTimeout(id);
  }, [phase, inView, prefersReduced]);

  const showTrades = phase >= 0 && phase < 4;
  const scanning = phase === 1;
  const flagged = phase >= 1 && phase < 4;
  const showAlert = phase >= 2 && phase < 4;
  const showCoach = phase >= 3 && phase < 4;
  const scoreDropped = phase >= 3 && phase < 4;

  const steps = [
    { label: t("demo_step_1"), active: phase === 0 },
    { label: t("demo_step_2"), active: phase === 1 || phase === 2 },
    { label: t("demo_step_3"), active: phase === 3 },
  ];

  return (
    <div className="max-w-2xl mx-auto mb-16">
      <div
        ref={stageRef}
        className="rounded-2xl border overflow-hidden"
        style={{
          borderColor: "rgb(var(--border))",
          background: "rgb(var(--card))",
          boxShadow: "0 24px 60px -16px rgba(0,0,0,0.55), 0 0 60px -30px rgb(var(--accent)/0.25)",
        }}
      >
        {/* Barre fenêtre */}
        <div
          className="flex items-center justify-between px-4 py-2.5 border-b"
          style={{ borderColor: "rgb(var(--border))", background: "rgb(var(--surface)/0.5)" }}
        >
          <div className="flex items-center gap-2">
            <span className="w-2 h-2 rounded-full" style={{ background: "rgb(var(--loss)/0.5)" }} aria-hidden />
            <span className="w-2 h-2 rounded-full" style={{ background: "rgb(var(--warning)/0.5)" }} aria-hidden />
            <span className="w-2 h-2 rounded-full" style={{ background: "rgb(var(--profit)/0.5)" }} aria-hidden />
            <span className="ml-2 text-[11px] font-medium" style={{ color: "rgb(var(--muted))", fontStyle: "normal" }}>
              {t("demo_sync_label")}
            </span>
          </div>
          <span
            className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[9px] font-bold uppercase tracking-wider"
            style={{ background: "rgb(var(--profit)/0.1)", color: "rgb(var(--profit))", fontStyle: "normal" }}
          >
            <span className="w-1.5 h-1.5 rounded-full animate-pulse" style={{ background: "rgb(var(--profit))" }} aria-hidden />
            {t("demo_live")}
          </span>
        </div>

        {/* Scène — hauteur fixe, pas de layout shift */}
        <div className="relative p-4 sm:p-5 h-[330px] sm:h-[310px] overflow-hidden">
          {/* Balayage scan IA */}
          <AnimatePresence>
            {scanning && (
              <motion.div
                key="scanbeam"
                className="absolute inset-x-0 h-16 pointer-events-none z-10"
                style={{
                  background: "linear-gradient(180deg, transparent 0%, rgb(var(--accent)/0.08) 50%, transparent 100%)",
                  borderTop: "1px solid rgb(var(--accent)/0.35)",
                }}
                initial={{ top: -64, opacity: 0 }}
                animate={{ top: ["0%", "85%"], opacity: 1 }}
                exit={{ opacity: 0 }}
                transition={{ top: { duration: 1.5, ease: "easeInOut" }, opacity: { duration: 0.2 } }}
                aria-hidden
              />
            )}
          </AnimatePresence>

          {/* Lignes de trades */}
          <div className="space-y-2">
            <AnimatePresence>
              {showTrades &&
                TRADES.map((tr, i) => (
                  <motion.div
                    key={`${tr.time}-${phase >= 4 ? "out" : "in"}`}
                    initial={prefersReduced ? false : { opacity: 0, x: 32 }}
                    animate={{
                      opacity: 1,
                      x: 0,
                      borderColor: flagged ? "rgb(var(--loss)/0.45)" : "rgb(var(--border))",
                      background: flagged ? "rgb(var(--loss)/0.05)" : "rgb(var(--surface)/0.4)",
                    }}
                    exit={{ opacity: 0, x: -24 }}
                    transition={{ duration: 0.45, delay: phase === 0 ? i * 0.5 : 0, ease }}
                    className="flex items-center gap-3 px-3.5 py-2.5 rounded-xl border text-[13px]"
                  >
                    <span className="tabular-nums" style={{ color: "rgb(var(--muted))", fontStyle: "normal" }}>{tr.time}</span>
                    <span className="font-semibold" style={{ color: "rgb(var(--foreground))", fontStyle: "normal" }}>{tr.pair}</span>
                    <span
                      className="px-1.5 py-0.5 rounded text-[10px] font-bold"
                      style={{ background: "rgb(var(--loss)/0.1)", color: "rgb(var(--loss))", fontStyle: "normal" }}
                    >
                      {tr.dir}
                    </span>
                    <span className="flex-1 h-px" style={{ background: "rgb(var(--border))" }} aria-hidden />
                    <span className="font-bold tabular-nums" style={{ color: "rgb(var(--loss))", fontStyle: "normal" }}>{tr.pnl}</span>
                  </motion.div>
                ))}
            </AnimatePresence>
          </div>

          {/* Alerte détection */}
          <AnimatePresence>
            {showAlert && (
              <motion.div
                key="alert"
                initial={prefersReduced ? false : { opacity: 0, y: 14, scale: 0.97 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                exit={{ opacity: 0, y: -10 }}
                transition={{ duration: 0.4, ease }}
                className="mt-3 flex items-start gap-3 px-4 py-3 rounded-xl border"
                style={{ background: "rgb(var(--loss)/0.07)", borderColor: "rgb(var(--loss)/0.25)" }}
              >
                <svg className="w-4 h-4 mt-0.5 shrink-0" style={{ color: "rgb(var(--loss))" }} fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24" aria-hidden>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v4m0 4h.01M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z" />
                </svg>
                <div className="min-w-0">
                  <p className="text-[13px] font-bold" style={{ color: "rgb(var(--loss))", fontStyle: "normal" }}>
                    {t("demo_alert_title")}
                  </p>
                  <p className="text-xs mt-0.5" style={{ color: "rgb(var(--foreground)/0.75)", fontStyle: "normal" }}>
                    {t("demo_alert_desc")}
                  </p>
                </div>
              </motion.div>
            )}
          </AnimatePresence>

          {/* Coach + score */}
          <AnimatePresence>
            {showCoach && (
              <motion.div
                key="coach"
                initial={prefersReduced ? false : { opacity: 0, y: 14 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                transition={{ duration: 0.4, ease }}
                className="mt-3 flex items-center gap-3 px-4 py-3 rounded-xl border"
                style={{ background: "rgb(var(--accent)/0.06)", borderColor: "rgb(var(--accent)/0.22)" }}
              >
                <span
                  className="w-7 h-7 rounded-lg flex items-center justify-center shrink-0"
                  style={{ background: "rgb(var(--accent)/0.14)" }}
                  aria-hidden
                >
                  <svg className="w-3.5 h-3.5" style={{ color: "rgb(var(--accent))" }} fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M9.813 15.904L9 18.75l-.813-2.846a4.5 4.5 0 00-3.09-3.09L2.25 12l2.846-.813a4.5 4.5 0 003.09-3.09L9 5.25l.813 2.846a4.5 4.5 0 003.09 3.09L15.75 12l-2.846.813a4.5 4.5 0 00-3.09 3.09z" />
                  </svg>
                </span>
                <p className="text-xs leading-relaxed flex-1 min-w-0" style={{ color: "rgb(var(--foreground)/0.85)", fontStyle: "normal" }}>
                  <span className="font-bold" style={{ color: "rgb(var(--accent))" }}>{t("demo_coach_title")} : </span>
                  {t("demo_coach_msg")}
                </p>
                {/* Score qui chute */}
                <motion.span
                  className="shrink-0 px-2.5 py-1.5 rounded-lg text-sm font-black tabular-nums border"
                  initial={false}
                  animate={{
                    color: scoreDropped ? "rgb(var(--warning))" : "rgb(var(--profit))",
                    borderColor: scoreDropped ? "rgb(var(--warning)/0.3)" : "rgb(var(--profit)/0.3)",
                    background: scoreDropped ? "rgb(var(--warning)/0.08)" : "rgb(var(--profit)/0.08)",
                  }}
                  style={{ fontStyle: "normal" }}
                >
                  <ScoreTicker from={85} to={72} active={scoreDropped && !prefersReduced} static72={!!prefersReduced} />
                </motion.span>
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        {/* Étapes */}
        <div
          className="flex items-center justify-center gap-1.5 sm:gap-3 px-4 py-3 border-t flex-wrap"
          style={{ borderColor: "rgb(var(--border))", background: "rgb(var(--surface)/0.3)" }}
        >
          {steps.map((s, i) => (
            <div key={s.label} className="flex items-center gap-1.5 sm:gap-3">
              {i > 0 && (
                <svg className="w-3 h-3" style={{ color: "rgb(var(--muted)/0.5)" }} fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24" aria-hidden>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M8.25 4.5l7.5 7.5-7.5 7.5" />
                </svg>
              )}
              <span
                className="px-2.5 py-1 rounded-full text-[11px] font-semibold transition-colors duration-300"
                style={{
                  color: s.active ? "rgb(var(--accent))" : "rgb(var(--foreground-muted))",
                  background: s.active ? "rgb(var(--accent)/0.1)" : "transparent",
                  fontStyle: "normal",
                }}
              >
                {s.label}
              </span>
            </div>
          ))}
        </div>
      </div>

      <p className="text-center text-xs mt-4" style={{ color: "rgb(var(--foreground-muted))", fontStyle: "normal" }}>
        {t("demo_caption")}
      </p>
    </div>
  );
}

/** Petit ticker 85 → 72 quand le coach intervient. */
function ScoreTicker({ from, to, active, static72 }: { from: number; to: number; active: boolean; static72: boolean }) {
  const [val, setVal] = useState(static72 ? to : from);

  useEffect(() => {
    if (static72) return;
    if (!active) {
      setVal(from);
      return;
    }
    const duration = 900;
    const start = performance.now();
    let raf: number;
    const tick = (now: number) => {
      const p = Math.min(1, (now - start) / duration);
      const eased = 1 - Math.pow(1 - p, 3);
      setVal(Math.round(from + (to - from) * eased));
      if (p < 1) raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [active, from, to, static72]);

  return <>{val}</>;
}
