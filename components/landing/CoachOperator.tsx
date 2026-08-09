"use client";

import React, { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { motion, AnimatePresence, useReducedMotion, useInView } from "framer-motion";
import { useLanguage } from "@/lib/LanguageContext";
import { localizedHref } from "@/lib/locale-href";
import {
  CAPABILITY_TIERS,
  COACH_CAPABILITIES,
  capabilityPlan,
  coachDailyMessages,
  coachQuotaKey,
  toolCountForPlan,
  totalToolCount,
  type CapabilityPlan,
} from "@/lib/coach-capabilities";

/**
 * La démonstration que le coach AGIT.
 *
 * Le problème commercial : « chat IA » ne veut plus rien dire, tous les
 * journaux en ont un. La différence ne se raconte pas, elle se regarde. Le
 * visiteur choisit une demande et voit le coach l'exécuter, avec les mêmes
 * éléments d'interface que dans le produit (encadré de validation rouge,
 * pastille verte d'action). Ce qu'il voit ici est littéralement ce qu'il aura.
 *
 * Le troisième scénario montre volontairement un REFUS d'agir sans validation :
 * la sécurité est un argument de vente, pas un détail technique.
 */

const ease = [0.16, 1, 0.3, 1] as const;
const COPY = "rgb(var(--foreground-muted))";

/** Une étape jouée : une ligne de narration, puis éventuellement un résultat. */
interface Beat {
  /** Clé i18n de la ligne écrite par le coach. */
  key: string;
  /** Millisecondes avant d'afficher la ligne suivante. */
  hold: number;
}

interface Scenario {
  id: string;
  /** Clé i18n de la demande, telle que le trader l'écrirait. */
  promptKey: string;
  beats: Beat[];
  /** Ce qui apparaît à la fin : une action faite, ou une validation demandée. */
  outcome:
    | { type: "action"; labelKey: string }
    | { type: "confirm"; labelKey: string };
}

const SCENARIOS: Scenario[] = [
  {
    id: "annotate",
    promptKey: "op_demo_1_prompt",
    beats: [
      { key: "op_demo_1_beat_1", hold: 1100 },
      { key: "op_demo_1_beat_2", hold: 1300 },
      { key: "op_demo_1_beat_3", hold: 900 },
    ],
    outcome: { type: "action", labelKey: "op_demo_1_chip" },
  },
  {
    id: "log",
    promptKey: "op_demo_2_prompt",
    beats: [
      { key: "op_demo_2_beat_1", hold: 1200 },
      { key: "op_demo_2_beat_2", hold: 1000 },
    ],
    outcome: { type: "action", labelKey: "op_demo_2_chip" },
  },
  {
    id: "delete",
    promptKey: "op_demo_3_prompt",
    beats: [
      { key: "op_demo_3_beat_1", hold: 1100 },
      { key: "op_demo_3_beat_2", hold: 1200 },
    ],
    outcome: { type: "confirm", labelKey: "op_demo_3_confirm" },
  },
];

function CoachAvatar() {
  return (
    <div
      className="w-6 h-6 rounded-full flex items-center justify-center shrink-0"
      style={{ background: "rgb(var(--accent)/0.15)", border: "1px solid rgb(var(--accent)/0.3)" }}
    >
      <svg className="w-3 h-3" style={{ color: "rgb(var(--accent))" }} fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden>
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9.813 15.904L9 18.75l-.813-2.846a4.5 4.5 0 00-3.09-3.09L2.25 12l2.846-.813a4.5 4.5 0 003.09-3.09L9 5.25l.813 2.846a4.5 4.5 0 003.09 3.09L15.75 12l-2.846.813a4.5 4.5 0 00-3.09 3.09z" />
      </svg>
    </div>
  );
}

/** Rejoue la scène choisie, une ligne à la fois. */
function Stage({ scenario, t }: { scenario: Scenario; t: (k: string) => string }) {
  const prefersReduced = useReducedMotion();
  const [step, setStep] = useState(prefersReduced ? scenario.beats.length + 1 : 0);
  const timers = useRef<ReturnType<typeof setTimeout>[]>([]);

  useEffect(() => {
    timers.current.forEach(clearTimeout);
    timers.current = [];
    if (prefersReduced) { setStep(scenario.beats.length + 1); return; }

    setStep(0);
    let elapsed = 420; // le temps que la demande du trader s'affiche
    scenario.beats.forEach((beat, i) => {
      elapsed += beat.hold;
      timers.current.push(setTimeout(() => setStep(i + 1), elapsed));
    });
    timers.current.push(setTimeout(() => setStep(scenario.beats.length + 1), elapsed + 700));

    return () => { timers.current.forEach(clearTimeout); timers.current = []; };
  }, [scenario, prefersReduced]);

  const visibleBeats = scenario.beats.slice(0, step);
  const showOutcome = step > scenario.beats.length;
  const thinking = !prefersReduced && step <= scenario.beats.length;

  return (
    <div className="p-4 sm:p-5 space-y-3 min-h-[290px] sm:min-h-[270px]">
      {/* La demande, telle que le trader l'écrirait */}
      <motion.div
        className="flex justify-end"
        initial={prefersReduced ? false : { opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.35, ease }}
      >
        <p
          className="px-3 py-2 rounded-xl rounded-br-sm text-[12px] sm:text-[13px] leading-relaxed text-white max-w-[85%]"
          style={{ background: "linear-gradient(135deg, rgb(var(--accent)) 0%, #3b82f6 100%)" }}
        >
          {t(scenario.promptKey)}
        </p>
      </motion.div>

      {/* La narration du coach, ligne par ligne : il travaille sous tes yeux */}
      <div className="flex gap-2 items-start">
        <CoachAvatar />
        <div className="flex-1 space-y-2">
          <AnimatePresence initial={false}>
            {visibleBeats.map((beat) => (
              <motion.p
                key={beat.key}
                initial={prefersReduced ? false : { opacity: 0, y: 6 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.32, ease }}
                className="text-[12px] sm:text-[13px] leading-relaxed"
                style={{ color: "rgb(var(--foreground))" }}
              >
                {t(beat.key)}
              </motion.p>
            ))}
          </AnimatePresence>

          {thinking && (
            <div className="flex items-center gap-1.5 py-1" aria-hidden>
              <span className="typing-dot typing-dot-1" />
              <span className="typing-dot typing-dot-2" />
              <span className="typing-dot typing-dot-3" />
            </div>
          )}

          <AnimatePresence>
            {showOutcome && scenario.outcome.type === "action" && (
              <motion.div
                key="chip"
                initial={prefersReduced ? false : { opacity: 0, scale: 0.94 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ duration: 0.3, ease }}
                className="flex items-center gap-2 flex-wrap"
              >
                <span
                  className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-medium"
                  style={{
                    background: "rgb(var(--profit)/0.12)",
                    border: "1px solid rgb(var(--profit)/0.35)",
                    color: "rgb(var(--profit))",
                  }}
                >
                  <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden>
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" />
                  </svg>
                  {t(scenario.outcome.labelKey)}
                </span>
                <span className="text-[11px] underline underline-offset-2" style={{ color: COPY }}>
                  {t("op_demo_undo")}
                </span>
              </motion.div>
            )}

            {/* Le garde-fou, montré tel quel : rien ne part sans ton clic. */}
            {showOutcome && scenario.outcome.type === "confirm" && (
              <motion.div
                key="confirm"
                initial={prefersReduced ? false : { opacity: 0, y: 6 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.3, ease }}
                className="rounded-lg border px-3 py-2"
                style={{ borderColor: "rgb(239 68 68 / 0.35)", background: "rgb(239 68 68 / 0.07)" }}
              >
                <p className="text-[12px] mb-1.5" style={{ color: "rgb(var(--foreground))" }}>
                  {t(scenario.outcome.labelKey)}
                </p>
                <div className="flex gap-2">
                  <span className="px-2.5 py-1 rounded-md text-[11px] font-semibold text-white" style={{ background: "rgb(239 68 68)" }}>
                    {t("coach_confirm_accept")}
                  </span>
                  <span className="px-2.5 py-1 rounded-md text-[11px] border" style={{ borderColor: "rgb(var(--border))", color: COPY }}>
                    {t("coach_confirm_reject")}
                  </span>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>
    </div>
  );
}

/** Les trois paliers : il te répond, il te corrige, il le fait à ta place. */
function TierColumn({ tier, t }: { tier: (typeof CAPABILITY_TIERS)[number]; t: (k: string) => string }) {
  const gained = COACH_CAPABILITIES.filter((c) => capabilityPlan(c) === tier.plan);
  const highlight = tier.plan === "premium";
  const quota = t(coachQuotaKey(tier.plan)).replace("{count}", String(coachDailyMessages(tier.plan)));

  return (
    <div
      className="rounded-2xl border p-5 h-full flex flex-col"
      style={{
        borderColor: highlight ? "rgb(var(--accent)/0.4)" : "rgb(var(--border))",
        background: highlight ? "rgb(var(--accent)/0.04)" : "rgb(var(--card))",
      }}
    >
      {/* Le nom du plan d'abord : sans lui, le lecteur lit une promesse sans
          savoir ce qu'elle coûte ni ce qu'il faut prendre pour l'avoir. */}
      <div className="flex items-center justify-between gap-2 mb-2">
        <span
          className="text-[10px] font-bold uppercase tracking-[0.14em]"
          style={{ color: highlight ? "rgb(var(--accent))" : COPY }}
        >
          {t(tier.planKey)}
        </span>
        <span
          className="text-[11px] font-semibold px-2 py-0.5 rounded-full whitespace-nowrap"
          style={{
            background: highlight ? "rgb(var(--accent)/0.15)" : "rgb(var(--surface))",
            color: highlight ? "rgb(var(--accent))" : COPY,
          }}
        >
          {t("op_tier_tools").replace("{count}", String(toolCountForPlan(tier.plan)))}
        </span>
      </div>

      <h3 className="text-lg font-bold" style={{ color: "rgb(var(--foreground))" }}>{t(tier.titleKey)}</h3>

      {/* La fréquence, tout de suite : une capacité sans occasion de s'en
          servir n'est pas une capacité. */}
      <p className="text-[12px] font-medium mt-1 mb-3" style={{ color: highlight ? "rgb(var(--accent))" : "rgb(var(--profit))" }}>
        {quota}
      </p>

      <p className="text-[13px] mb-4" style={{ color: COPY }}>
        {t(tier.promiseKey).replace("{count}", String(toolCountForPlan(tier.plan)))}
      </p>
      <ul className="space-y-2">
        {gained.map((cap) => (
          <li key={cap.key} className="flex gap-2 text-[13px] leading-snug" style={{ color: "rgb(var(--foreground))" }}>
            <svg
              className="w-3.5 h-3.5 mt-0.5 shrink-0"
              style={{ color: highlight ? "rgb(var(--accent))" : "rgb(var(--profit))" }}
              fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden
            >
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" />
            </svg>
            <span>{t(cap.key)}</span>
          </li>
        ))}
      </ul>
      {tier.plan !== "free" && (
        <p className="text-[11px] mt-4 pt-3 border-t" style={{ color: COPY, borderColor: "rgb(var(--border)/0.6)" }}>
          {t("op_tier_cumulative")}
        </p>
      )}
    </div>
  );
}

export default function CoachOperator() {
  const { t, lang } = useLanguage();
  const [active, setActive] = useState(0);
  const [touched, setTouched] = useState(false);
  const sectionRef = useRef<HTMLElement>(null);
  const inView = useInView(sectionRef, { once: true, margin: "-100px" });
  const prefersReduced = useReducedMotion();

  // Tant que le visiteur n'a rien choisi, les scènes défilent seules : la
  // section doit se vendre même à quelqu'un qui ne clique jamais.
  useEffect(() => {
    if (touched || !inView || prefersReduced) return;
    const id = setInterval(() => setActive((i) => (i + 1) % SCENARIOS.length), 7200);
    return () => clearInterval(id);
  }, [touched, inView, prefersReduced]);

  const choose = useCallback((i: number) => {
    setTouched(true);
    setActive(i);
  }, []);

  return (
    <section ref={sectionRef} id="coach" className="landing-section px-6 border-t" style={{ borderColor: "rgb(var(--border)/0.5)" }}>
      <div className="max-w-6xl mx-auto">
        <motion.div
          className="text-center mb-10"
          initial={prefersReduced ? false : { opacity: 0, y: 16 }}
          animate={inView ? { opacity: 1, y: 0 } : undefined}
          transition={{ duration: 0.6, ease }}
        >
          <p className="text-[11px] font-semibold tracking-[0.18em] uppercase mb-3" style={{ color: "rgb(var(--accent))" }}>
            {t("op_eyebrow")}
          </p>
          <h2 className="text-3xl sm:text-5xl font-bold mb-4" style={{ color: "rgb(var(--foreground))" }}>
            {t("op_title")}
          </h2>
          <p className="text-base sm:text-lg max-w-2xl mx-auto" style={{ color: COPY }}>
            {t("op_subtitle").replace("{count}", String(totalToolCount()))}
          </p>
        </motion.div>

        {/* La scène : on demande, il exécute */}
        <motion.div
          className="max-w-2xl mx-auto"
          initial={prefersReduced ? false : { opacity: 0, y: 20 }}
          animate={inView ? { opacity: 1, y: 0 } : undefined}
          transition={{ duration: 0.6, delay: 0.12, ease }}
        >
          <p className="text-center text-[13px] mb-3" style={{ color: COPY }}>{t("op_pick")}</p>
          <div className="flex flex-wrap justify-center gap-2 mb-4">
            {SCENARIOS.map((s, i) => (
              <button
                key={s.id}
                type="button"
                onClick={() => choose(i)}
                aria-pressed={i === active}
                className="px-3 py-1.5 rounded-full text-[12px] font-medium transition-all focus-visible:outline focus-visible:outline-2 focus-visible:outline-[rgb(var(--accent))]"
                style={{
                  background: i === active ? "rgb(var(--accent)/0.15)" : "rgb(var(--card))",
                  border: `1px solid ${i === active ? "rgb(var(--accent)/0.5)" : "rgb(var(--border))"}`,
                  color: i === active ? "rgb(var(--accent))" : COPY,
                }}
              >
                {t(`op_chip_${s.id}`)}
              </button>
            ))}
          </div>

          <div
            className="rounded-2xl border overflow-hidden"
            style={{ borderColor: "rgb(var(--border))", background: "rgb(var(--card))" }}
          >
            <div
              className="px-4 py-2.5 flex items-center gap-2 border-b"
              style={{ borderColor: "rgb(var(--border)/0.5)", background: "rgb(var(--surface)/0.5)" }}
            >
              <CoachAvatar />
              <p className="text-xs font-semibold" style={{ color: "rgb(var(--foreground))" }}>{t("feature_ai_coach_label")}</p>
              <span className="ml-auto text-[10px]" style={{ color: COPY }}>{t("op_live")}</span>
            </div>
            <Stage key={SCENARIOS[active].id} scenario={SCENARIOS[active]} t={t} />
          </div>

          <p className="text-center text-[12px] mt-3" style={{ color: COPY }}>{t("op_safety")}</p>
        </motion.div>

        {/* Ce qu'il sait faire, palier par palier */}
        <motion.div
          className="grid md:grid-cols-3 gap-4 mt-14"
          initial={prefersReduced ? false : { opacity: 0, y: 20 }}
          animate={inView ? { opacity: 1, y: 0 } : undefined}
          transition={{ duration: 0.6, delay: 0.2, ease }}
        >
          {CAPABILITY_TIERS.map((tier) => (
            <TierColumn key={tier.plan} tier={tier} t={t} />
          ))}
        </motion.div>

        <p className="text-center text-[12px] mt-6 max-w-2xl mx-auto" style={{ color: COPY }}>
          {t("op_not_a_broker")}
        </p>

        <div className="text-center mt-10">
          <Link
            href={localizedHref("/auth/signup", lang)}
            className="inline-flex items-center gap-2 px-6 py-3 rounded-xl font-semibold text-white transition-all hover:brightness-110"
            style={{ background: "linear-gradient(135deg, rgb(var(--accent)) 0%, #3b82f6 100%)" }}
          >
            {t("op_cta")}
          </Link>
          <p className="text-[12px] mt-3" style={{ color: COPY }}>{t("op_cta_note")}</p>
        </div>
      </div>
    </section>
  );
}

export type { CapabilityPlan };
