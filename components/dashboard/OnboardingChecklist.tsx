"use client";

import { useLanguage } from "@/lib/LanguageContext";
import { cn } from "@/lib/cn";
import { Check, ArrowRight, X, Trophy } from "lucide-react";
import Link from "next/link";
import { useEffect, useState } from "react";
import ConfettiBurst from "@/components/animations/ConfettiBurst";

export interface OnboardingState {
  hasAccount: boolean;
  hasTrades: boolean;
  hasStrategy: boolean;
  hasSession: boolean;
}

const DISMISS_KEY = "td_onboarding_dismissed";
const CELEBRATED_KEY = "td_onboarding_celebrated";
// Set once the user has seen the checklist incomplete, so the completion
// celebration only fires for genuine progress — never for users who were
// already fully set up before this existed.
const SEEN_INCOMPLETE_KEY = "td_onboarding_seen_incomplete";

interface Step {
  key: OnboardingKey;
  labelKey: string;
  href: string;
  cta: string;
}

type OnboardingKey = keyof OnboardingState;

const STEPS: Step[] = [
  { key: "hasAccount",  labelKey: "onboarding_step_account",  href: "/dashboard/accounts", cta: "onboarding_cta_account" },
  { key: "hasTrades",   labelKey: "onboarding_step_trades",   href: "/dashboard/trades",   cta: "onboarding_cta_trades" },
  { key: "hasStrategy", labelKey: "onboarding_step_strategy", href: "/dashboard/strategy", cta: "onboarding_cta_strategy" },
  { key: "hasSession",  labelKey: "onboarding_step_session",  href: "/dashboard/session",  cta: "onboarding_cta_session" },
];

export default function OnboardingChecklist({ state }: { state: OnboardingState }) {
  const { t } = useLanguage();
  // Start "hidden" to avoid a flash before we read localStorage.
  const [dismissed, setDismissed] = useState(true);
  const [celebrated, setCelebrated] = useState(true);
  const [seenIncomplete, setSeenIncomplete] = useState(false);
  const [celebrationClosed, setCelebrationClosed] = useState(false);

  const done = STEPS.filter((s) => state[s.key]).length;
  const total = STEPS.length;
  const allDone = done === total;

  useEffect(() => {
    setDismissed(localStorage.getItem(DISMISS_KEY) === "1");
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

  const celebrate = allDone && seenIncomplete && !celebrated && !dismissed && !celebrationClosed;

  // Persist the celebration so it fires exactly once, even across reloads.
  useEffect(() => {
    if (celebrate) localStorage.setItem(CELEBRATED_KEY, "1");
  }, [celebrate]);

  function dismiss() {
    localStorage.setItem(DISMISS_KEY, "1");
    setDismissed(true);
  }

  // ── One-time completion celebration ──────────────────────────────────────
  if (celebrate) {
    return (
      <div className="mb-4 rounded-xl border border-profit/30 bg-profit/5 p-5 text-center relative overflow-hidden">
        <ConfettiBurst />
        <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-profit/15">
          <Trophy className="h-6 w-6 text-profit" strokeWidth={1.75} />
        </div>
        <h2 className="text-base font-bold text-foreground">{t("onboarding_done_title")}</h2>
        <p className="mx-auto mt-1 max-w-md text-sm text-muted">{t("onboarding_done_subtitle")}</p>
        <div className="mt-4 flex items-center justify-center gap-3">
          <Link
            href="/dashboard/leaderboard"
            onClick={() => setCelebrationClosed(true)}
            className="inline-flex items-center gap-1.5 rounded-lg bg-accent px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-blue-600"
          >
            {t("onboarding_done_cta")}
            <ArrowRight className="h-4 w-4" strokeWidth={2} />
          </Link>
          <button
            onClick={() => setCelebrationClosed(true)}
            className="text-sm text-muted transition-colors hover:text-foreground"
          >
            {t("onboarding_dismiss")}
          </button>
        </div>
      </div>
    );
  }

  // On masque si tout est fait OU si l'utilisateur a fermé la carte.
  if (allDone || dismissed) return null;

  // Prochaine étape non faite : mise en avant.
  const nextStepKey = STEPS.find((s) => !state[s.key])?.key;

  return (
    <div className="mb-4 rounded-xl border border-accent/20 bg-accent/5 p-4 sm:p-5">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h2 className="text-base font-bold text-foreground">{t("onboarding_title")}</h2>
          <p className="text-sm text-muted mt-0.5">{t("onboarding_subtitle")}</p>
        </div>
        <button
          onClick={dismiss}
          className="text-muted hover:text-foreground transition-colors shrink-0"
          aria-label={t("onboarding_dismiss")}
        >
          <X className="w-4 h-4" strokeWidth={1.5} />
        </button>
      </div>

      {/* Barre de progression */}
      <div className="mt-3 flex items-center gap-3">
        <div className="flex-1 h-2 rounded-full bg-surface overflow-hidden">
          <div
            className="h-full bg-accent transition-all duration-500"
            style={{ width: `${(done / total) * 100}%` }}
          />
        </div>
        <span className="text-xs font-medium text-muted whitespace-nowrap">{done}/{total}</span>
      </div>

      {/* Étapes */}
      <ul className="mt-4 space-y-2">
        {STEPS.map((step) => {
          const completed = state[step.key];
          const isNext = step.key === nextStepKey;
          return (
            <li
              key={step.key}
              className={cn(
                "flex items-center gap-3 rounded-lg px-3 py-2.5 transition-colors",
                isNext ? "bg-card border border-accent/30" : "bg-card/50"
              )}
            >
              <span
                className={cn(
                  "flex items-center justify-center w-5 h-5 rounded-full shrink-0",
                  completed ? "bg-profit text-white" : "border border-border text-transparent"
                )}
              >
                <Check className="w-3 h-3" strokeWidth={3} />
              </span>
              <span className={cn("text-sm flex-1", completed ? "text-muted line-through" : "text-foreground")}>
                {t(step.labelKey)}
              </span>
              {!completed && (
                <Link
                  href={step.href}
                  className={cn(
                    "inline-flex items-center gap-1 text-xs font-semibold whitespace-nowrap",
                    isNext ? "text-accent hover:underline" : "text-muted hover:text-accent"
                  )}
                >
                  {t(step.cta)}
                  <ArrowRight className="w-3 h-3" strokeWidth={2} />
                </Link>
              )}
            </li>
          );
        })}
      </ul>
    </div>
  );
}
