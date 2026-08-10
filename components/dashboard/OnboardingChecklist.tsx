"use client";

import { useLanguage } from "@/lib/LanguageContext";
import { cn } from "@/lib/cn";
import {
  ArrowRight,
  Check,
  ClipboardList,
  ListChecks,
  Play,
  Trophy,
  Upload,
  Wallet,
  X,
  type LucideIcon,
} from "lucide-react";
import Link from "next/link";
import { useEffect, useState } from "react";
import { motion, useReducedMotion } from "framer-motion";
import ConfettiBurst from "@/components/animations/ConfettiBurst";

export interface OnboardingState {
  hasAccount: boolean;
  hasTrades: boolean;
  hasStrategy: boolean;
  hasSession: boolean;
}

// Réduite, la carte laisse une barre d'une ligne : on ne perd pas le fil de
// l'activation, contrairement à l'ancien « masquer » qui la supprimait à vie.
const COLLAPSED_KEY = "td_onboarding_collapsed";
// Ancienne clé de fermeture définitive : relue une fois pour que ceux qui
// avaient masqué la carte la retrouvent réduite, pas réouverte en grand.
const LEGACY_DISMISS_KEY = "td_onboarding_dismissed";
const CELEBRATED_KEY = "td_onboarding_celebrated";
// Set once the user has seen the checklist incomplete, so the completion
// celebration only fires for genuine progress — never for users who were
// already fully set up before this existed.
const SEEN_INCOMPLETE_KEY = "td_onboarding_seen_incomplete";

type OnboardingKey = keyof OnboardingState;

interface Step {
  key: OnboardingKey;
  icon: LucideIcon;
  labelKey: string;
  /** Ce que l'étape débloque : affiché uniquement sur l'étape en cours. */
  whyKey: string;
  href: string;
  cta: string;
  minutes: number;
}

const STEPS: Step[] = [
  { key: "hasAccount",  icon: Wallet,        labelKey: "onboarding_step_account",  whyKey: "onboarding_why_account",  href: "/dashboard/challenge", cta: "onboarding_cta_account",  minutes: 1 },
  { key: "hasTrades",   icon: Upload,        labelKey: "onboarding_step_trades",   whyKey: "onboarding_why_trades",   href: "/dashboard/trades",    cta: "onboarding_cta_trades",   minutes: 3 },
  { key: "hasStrategy", icon: ClipboardList, labelKey: "onboarding_step_strategy", whyKey: "onboarding_why_strategy", href: "/dashboard/strategy",  cta: "onboarding_cta_strategy", minutes: 5 },
  { key: "hasSession",  icon: Play,          labelKey: "onboarding_step_session",  whyKey: "onboarding_why_session",  href: "/dashboard/session",   cta: "onboarding_cta_session",  minutes: 5 },
];

export default function OnboardingChecklist({ state }: { state: OnboardingState }) {
  const { t } = useLanguage();
  const prefersReduced = useReducedMotion();
  // `null` tant que localStorage n'est pas lu : on ne rend rien, sinon la carte
  // pleine apparaît puis se replie en barre au premier paint.
  const [collapsed, setCollapsed] = useState<boolean | null>(null);
  const [celebrated, setCelebrated] = useState(true);
  const [seenIncomplete, setSeenIncomplete] = useState(false);
  const [celebrationClosed, setCelebrationClosed] = useState(false);

  const done = STEPS.filter((s) => state[s.key]).length;
  const total = STEPS.length;
  const allDone = done === total;
  const pct = Math.round((done / total) * 100);

  useEffect(() => {
    const legacyDismissed = localStorage.getItem(LEGACY_DISMISS_KEY) === "1";
    setCollapsed(localStorage.getItem(COLLAPSED_KEY) === "1" || legacyDismissed);
    setCelebrated(localStorage.getItem(CELEBRATED_KEY) === "1");
    setSeenIncomplete(localStorage.getItem(SEEN_INCOMPLETE_KEY) === "1");
  }, []);

  // Remember that the user has been in an incomplete state at least once.
  useEffect(() => {
    if (!allDone) {
      localStorage.setItem(SEEN_INCOMPLETE_KEY, "1");
      setSeenIncomplete(true);
    }
  }, [allDone]);

  const celebrate =
    allDone && seenIncomplete && !celebrated && collapsed === false && !celebrationClosed;

  // Persist the celebration so it fires exactly once, even across reloads.
  useEffect(() => {
    if (celebrate) localStorage.setItem(CELEBRATED_KEY, "1");
  }, [celebrate]);

  function setCollapsedPersisted(next: boolean) {
    localStorage.setItem(COLLAPSED_KEY, next ? "1" : "0");
    localStorage.removeItem(LEGACY_DISMISS_KEY);
    setCollapsed(next);
  }

  const progressLabel = t("onboarding_progress")
    .replace("{done}", String(done))
    .replace("{total}", String(total));

  // ── One-time completion celebration ──────────────────────────────────────
  if (celebrate) {
    return (
      <div className="mb-4 rounded-xl border border-profit/30 bg-profit/5 p-5 text-center relative overflow-hidden">
        <ConfettiBurst />
        <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-profit/15">
          <Trophy className="h-6 w-6 text-profit" strokeWidth={1.75} />
        </div>
        <h2 className="text-base font-bold text-foreground">{t("onboarding_done_title")}</h2>
        <p className="mx-auto mt-1 max-w-md text-sm text-foreground-muted">{t("onboarding_done_subtitle")}</p>
        <div className="mt-4 flex items-center justify-center gap-3">
          <Link
            href="/dashboard/leaderboard"
            onClick={() => setCelebrationClosed(true)}
            className="inline-flex items-center gap-1.5 rounded-lg bg-accent px-4 py-2 text-sm font-medium text-on-accent transition-colors hover:bg-accent-hover focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/40"
          >
            {t("onboarding_done_cta")}
            <ArrowRight className="h-4 w-4" strokeWidth={2} />
          </Link>
          <button
            onClick={() => setCelebrationClosed(true)}
            className="text-sm text-foreground-muted transition-colors hover:text-foreground"
          >
            {t("onboarding_dismiss")}
          </button>
        </div>
      </div>
    );
  }

  // Setup terminé, ou état localStorage pas encore connu : rien à afficher.
  if (allDone || collapsed === null) return null;

  // ── Réduite : une ligne, qui garde la progression sous les yeux ───────────
  if (collapsed) {
    return (
      <button
        onClick={() => setCollapsedPersisted(false)}
        aria-expanded={false}
        className="group mb-4 flex w-full items-center gap-3 rounded-xl border border-border bg-card/60 px-4 py-2.5 text-left transition-colors hover:border-accent/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/40"
      >
        <ListChecks className="h-4 w-4 shrink-0 text-accent" strokeWidth={1.75} />
        <span className="text-sm font-semibold text-foreground">{t("onboarding_title")}</span>
        <div
          className="hidden h-1.5 w-24 overflow-hidden rounded-full bg-surface sm:block"
          role="progressbar"
          aria-valuemin={0}
          aria-valuemax={total}
          aria-valuenow={done}
          aria-label={progressLabel}
        >
          <div className="h-full bg-accent transition-all duration-500" style={{ width: `${pct}%` }} />
        </div>
        <span className="text-xs font-medium text-foreground-muted">{done}/{total}</span>
        <span className="ml-auto inline-flex items-center gap-1 text-xs font-semibold text-accent">
          {t("onboarding_resume")}
          <ArrowRight className="h-3 w-3 transition-transform group-hover:translate-x-0.5" strokeWidth={2} />
        </span>
      </button>
    );
  }

  // Prochaine étape non faite : mise en avant.
  const nextStepKey = STEPS.find((s) => !state[s.key])?.key;

  return (
    <div className="mb-4 overflow-hidden rounded-xl border border-accent/20 bg-accent/5 p-4 sm:p-5">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h2 className="text-base font-bold text-foreground">{t("onboarding_title")}</h2>
          <p className="mt-0.5 text-sm text-foreground-muted">{t("onboarding_subtitle")}</p>
        </div>
        <button
          onClick={() => setCollapsedPersisted(true)}
          className="shrink-0 rounded text-foreground-muted transition-colors hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/40"
          aria-label={t("onboarding_collapse")}
          aria-expanded
        >
          <X className="h-4 w-4" strokeWidth={1.5} />
        </button>
      </div>

      {/* Barre de progression */}
      <div className="mt-3 flex items-center gap-3">
        <div
          className="h-2 flex-1 overflow-hidden rounded-full bg-surface"
          role="progressbar"
          aria-valuemin={0}
          aria-valuemax={total}
          aria-valuenow={done}
          aria-label={progressLabel}
        >
          <motion.div
            className="h-full rounded-full bg-accent"
            initial={prefersReduced ? false : { width: 0 }}
            animate={{ width: `${pct}%` }}
            transition={{ duration: 0.7, ease: "easeOut" }}
          />
        </div>
        <span className="whitespace-nowrap text-xs font-medium text-foreground-muted">{done}/{total}</span>
      </div>

      {/* Étapes */}
      <ol className="mt-4 space-y-2">
        {STEPS.map((step, i) => {
          const completed = state[step.key];
          const isNext = step.key === nextStepKey;
          const Icon = step.icon;

          return (
            <motion.li
              key={step.key}
              initial={prefersReduced ? false : { opacity: 0, y: 6 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.3, delay: prefersReduced ? 0 : i * 0.06 }}
              aria-current={isNext ? "step" : undefined}
              className={cn(
                "rounded-lg transition-colors",
                isNext ? "border border-accent/30 bg-card p-3 sm:p-4" : "bg-card/50 px-3 py-2.5"
              )}
            >
              {isNext ? (
                // ── Étape en cours : ce qu'elle débloque + bouton plein ──
                <div className="flex items-start gap-3">
                  <span className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-accent/15">
                    <Icon className="h-4 w-4 text-accent" strokeWidth={1.75} />
                  </span>
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
                      <span className="text-[11px] font-semibold uppercase tracking-wide text-accent">
                        {t("onboarding_step_now")}
                      </span>
                      <span className="text-[11px] text-foreground-subtle">
                        {t("onboarding_minutes").replace("{n}", String(step.minutes))}
                      </span>
                    </div>
                    <p className="mt-0.5 text-sm font-semibold text-foreground">{t(step.labelKey)}</p>
                    <p className="mt-1 text-sm leading-relaxed text-foreground-muted">{t(step.whyKey)}</p>
                    <Link
                      href={step.href}
                      className="mt-3 inline-flex w-full items-center justify-center gap-1.5 rounded-lg bg-accent px-4 py-2 text-sm font-semibold text-on-accent transition-colors hover:bg-accent-hover focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/40 sm:w-auto"
                    >
                      {t(step.cta)}
                      <ArrowRight className="h-4 w-4" strokeWidth={2} />
                    </Link>
                  </div>
                </div>
              ) : completed ? (
                // ── Faite : compacte, barrée ──
                <div className="flex items-center gap-3">
                  <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-profit text-white">
                    <Check className="h-3 w-3" strokeWidth={3} />
                  </span>
                  <span className="flex-1 text-sm text-foreground-muted line-through">{t(step.labelKey)}</span>
                  <span className="sr-only">{t("onboarding_step_done")}</span>
                </div>
              ) : (
                // ── À venir : accessible en un clic, sans voler l'attention ──
                <Link
                  href={step.href}
                  className="group flex items-center gap-3 rounded focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/40"
                >
                  <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full border border-border">
                    <Icon className="h-3 w-3 text-foreground-subtle" strokeWidth={1.75} />
                  </span>
                  <span className="flex-1 text-sm text-foreground-muted transition-colors group-hover:text-foreground">
                    {t(step.labelKey)}
                  </span>
                  <span className="text-[11px] text-foreground-subtle">
                    {t("onboarding_minutes").replace("{n}", String(step.minutes))}
                  </span>
                  <ArrowRight
                    className="h-3.5 w-3.5 shrink-0 text-foreground-subtle transition-all group-hover:translate-x-0.5 group-hover:text-accent"
                    strokeWidth={2}
                  />
                </Link>
              )}
            </motion.li>
          );
        })}
      </ol>
    </div>
  );
}
