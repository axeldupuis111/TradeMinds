"use client";

/**
 * DisciplineQuiz — mini-test interactif "Quel est ton score de discipline ?"
 *
 * 4 questions à choix unique, score animé à la fin (ring SVG + count-up),
 * verdict personnalisé + CTA inscription. 100 % client-side, sans inscription.
 * Aimant à conversion : transforme la métrique signature du produit
 * (score de discipline) en expérience interactive sur la landing.
 */

import { useLanguage } from "@/lib/LanguageContext";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import Link from "next/link";
import { useEffect, useState } from "react";

const ease = [0.16, 1, 0.3, 1] as const;

interface Answer {
  labelKey: string;
  points: number;
}

interface Question {
  qKey: string;
  answers: Answer[];
}

const QUESTIONS: Question[] = [
  {
    qKey: "quiz_q1",
    answers: [
      { labelKey: "quiz_q1_a", points: 25 },
      { labelKey: "quiz_q1_b", points: 12 },
      { labelKey: "quiz_q1_c", points: 0 },
    ],
  },
  {
    qKey: "quiz_q2",
    answers: [
      { labelKey: "quiz_q2_a", points: 25 },
      { labelKey: "quiz_q2_b", points: 12 },
      { labelKey: "quiz_q2_c", points: 0 },
    ],
  },
  {
    qKey: "quiz_q3",
    answers: [
      { labelKey: "quiz_q3_a", points: 25 },
      { labelKey: "quiz_q3_b", points: 12 },
      { labelKey: "quiz_q3_c", points: 0 },
    ],
  },
  {
    qKey: "quiz_q4",
    answers: [
      { labelKey: "quiz_q4_a", points: 25 },
      { labelKey: "quiz_q4_b", points: 12 },
      { labelKey: "quiz_q4_c", points: 0 },
    ],
  },
];

function verdictKey(score: number): string {
  if (score >= 80) return "quiz_verdict_high";
  if (score >= 45) return "quiz_verdict_mid";
  return "quiz_verdict_low";
}

function scoreColor(score: number): string {
  if (score >= 80) return "rgb(var(--profit))";
  if (score >= 45) return "rgb(var(--warning))";
  return "rgb(var(--loss))";
}

/** Count-up animé vers le score final. */
function ScoreCounter({ target }: { target: number }) {
  const [val, setVal] = useState(0);
  const prefersReduced = useReducedMotion();

  useEffect(() => {
    if (prefersReduced) {
      setVal(target);
      return;
    }
    const duration = 1200;
    const start = performance.now();
    let raf: number;
    const tick = (now: number) => {
      const p = Math.min(1, (now - start) / duration);
      // easeOutCubic
      const eased = 1 - Math.pow(1 - p, 3);
      setVal(Math.round(target * eased));
      if (p < 1) raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [target, prefersReduced]);

  return <>{val}</>;
}

export default function DisciplineQuiz() {
  const { t } = useLanguage();
  const prefersReduced = useReducedMotion();
  const [step, setStep] = useState(0); // 0..3 questions, 4 = résultat
  const [score, setScore] = useState(0);

  const done = step >= QUESTIONS.length;
  const ringR = 52;
  const ringC = 2 * Math.PI * ringR;

  function answer(points: number) {
    setScore((s) => s + points);
    setStep((s) => s + 1);
  }

  function restart() {
    setScore(0);
    setStep(0);
  }

  return (
    <section className="py-28 px-6 border-t relative overflow-hidden" style={{ borderColor: "rgb(var(--border)/0.5)" }}>
      {/* Halo de fond */}
      <div className="absolute inset-0 pointer-events-none" aria-hidden>
        <div
          className="absolute top-1/4 left-1/2 -translate-x-1/2 w-[500px] h-[350px] rounded-full blur-[100px]"
          style={{ background: "rgb(var(--accent)/0.06)" }}
        />
      </div>

      <div className="max-w-2xl mx-auto relative z-10">
        <motion.div
          initial={prefersReduced ? false : { opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: "-60px" }}
          transition={{ duration: 0.65, ease }}
          className="text-center mb-10"
        >
          <p className="text-xs font-bold uppercase tracking-widest mb-4" style={{ color: "rgb(var(--accent))", fontStyle: "normal" }}>
            {t("quiz_eyebrow")}
          </p>
          <h2 className="text-4xl sm:text-5xl font-bold" style={{ color: "rgb(var(--foreground))" }}>
            {t("quiz_title")}
          </h2>
          <p className="mt-4 text-base" style={{ color: "rgb(var(--muted))", fontStyle: "normal" }}>
            {t("quiz_subtitle")}
          </p>
        </motion.div>

        <motion.div
          initial={prefersReduced ? false : { opacity: 0, y: 24 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: "-60px" }}
          transition={{ duration: 0.65, delay: 0.1, ease }}
          className="rounded-2xl border overflow-hidden"
          style={{
            borderColor: "rgb(var(--border))",
            background: "rgb(var(--card))",
            boxShadow: "0 24px 60px -16px rgba(0,0,0,0.5)",
          }}
        >
          {/* Barre de progression */}
          <div className="h-1 w-full" style={{ background: "rgb(var(--border)/0.4)" }} aria-hidden>
            <motion.div
              className="h-full"
              style={{ background: "linear-gradient(90deg, rgb(var(--accent)), #3b82f6)" }}
              animate={{ width: `${(Math.min(step, QUESTIONS.length) / QUESTIONS.length) * 100}%` }}
              transition={{ duration: 0.35, ease }}
            />
          </div>

          <div className="p-6 sm:p-10 min-h-[340px] flex flex-col justify-center">
            <AnimatePresence mode="wait">
              {!done ? (
                <motion.div
                  key={step}
                  initial={prefersReduced ? false : { opacity: 0, x: 28 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={prefersReduced ? undefined : { opacity: 0, x: -28 }}
                  transition={{ duration: 0.3, ease }}
                >
                  <p className="text-xs font-semibold uppercase tracking-widest mb-3 tabular-nums" style={{ color: "rgb(var(--muted))", fontStyle: "normal" }}>
                    {step + 1} / {QUESTIONS.length}
                  </p>
                  <h3 className="text-xl sm:text-2xl font-bold mb-7" style={{ color: "rgb(var(--foreground))", fontFamily: "var(--font-geist-sans), system-ui, sans-serif", fontStyle: "normal" }}>
                    {t(QUESTIONS[step].qKey)}
                  </h3>
                  <div className="space-y-2.5">
                    {QUESTIONS[step].answers.map((a) => (
                      <button
                        key={a.labelKey}
                        type="button"
                        onClick={() => answer(a.points)}
                        className="quiz-answer w-full text-left px-5 py-3.5 rounded-xl border text-[15px] transition-all duration-150 hover:scale-[1.01] active:scale-[0.99] focus-visible:outline focus-visible:outline-2 focus-visible:outline-[rgb(var(--accent))]"
                        style={{
                          borderColor: "rgb(var(--border))",
                          background: "rgb(var(--surface)/0.4)",
                          color: "rgb(var(--foreground))",
                          fontStyle: "normal",
                        }}
                      >
                        {t(a.labelKey)}
                      </button>
                    ))}
                  </div>
                </motion.div>
              ) : (
                <motion.div
                  key="result"
                  initial={prefersReduced ? false : { opacity: 0, scale: 0.96 }}
                  animate={{ opacity: 1, scale: 1 }}
                  transition={{ duration: 0.4, ease }}
                  className="text-center"
                >
                  <p className="text-xs font-semibold uppercase tracking-widest mb-5" style={{ color: "rgb(var(--muted))", fontStyle: "normal" }}>
                    {t("quiz_result_label")}
                  </p>

                  {/* Ring de score animé */}
                  <div className="flex justify-center mb-6">
                    <svg width="130" height="130" viewBox="0 0 130 130" role="img" aria-label={`Score ${score}/100`}>
                      <circle cx="65" cy="65" r={ringR} fill="none" stroke="rgb(var(--border))" strokeWidth="8" />
                      <motion.circle
                        cx="65" cy="65" r={ringR} fill="none"
                        stroke={scoreColor(score)} strokeWidth="8" strokeLinecap="round"
                        strokeDasharray={`${ringC} ${ringC}`}
                        initial={prefersReduced ? { strokeDashoffset: ringC * (1 - score / 100) } : { strokeDashoffset: ringC }}
                        animate={{ strokeDashoffset: ringC * (1 - score / 100) }}
                        transform="rotate(-90 65 65)"
                        transition={{ duration: 1.2, ease: [0.4, 0, 0.2, 1] }}
                      />
                      <text x="65" y="62" textAnchor="middle" fill="rgb(var(--foreground))" fontSize="30" fontWeight="800" fontStyle="normal">
                        <ScoreCounter target={score} />
                      </text>
                      <text x="65" y="80" textAnchor="middle" fill="rgb(var(--muted))" fontSize="11" fontStyle="normal">/100</text>
                    </svg>
                  </div>

                  <p className="text-lg font-semibold mb-2 text-balance" style={{ color: "rgb(var(--foreground))", fontStyle: "normal" }}>
                    {t(verdictKey(score))}
                  </p>
                  <p className="text-sm mb-8" style={{ color: "rgb(var(--muted))", fontStyle: "normal" }}>
                    {t("quiz_disclaimer")}
                  </p>

                  <div className="flex flex-col sm:flex-row items-center justify-center gap-3">
                    <Link
                      href="/login"
                      className="btn-primary-shimmer relative px-7 py-3.5 rounded-xl font-semibold text-sm text-white transition-transform duration-200 hover:scale-[1.02] active:scale-[0.98] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[rgb(var(--accent))]"
                      style={{
                        background: "linear-gradient(135deg, rgb(var(--accent)) 0%, #3b82f6 100%)",
                        boxShadow: "0 0 0 1px rgb(var(--accent)/0.3), 0 4px 24px rgb(var(--accent)/0.2)",
                      }}
                    >
                      <span className="relative z-10">{t("quiz_cta")}</span>
                    </Link>
                    <button
                      type="button"
                      onClick={restart}
                      className="px-5 py-3 rounded-xl text-sm font-medium transition-colors hover:text-[rgb(var(--foreground))]"
                      style={{ color: "rgb(var(--muted))", fontStyle: "normal" }}
                    >
                      {t("quiz_restart")}
                    </button>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        </motion.div>
      </div>
    </section>
  );
}
