"use client";

import { useLanguage } from "@/lib/LanguageContext";
import { usePlan } from "@/lib/PlanContext";
import Link from "next/link";
import { useEffect, useState } from "react";

const STORAGE_KEY = "onboarding_completed";
const STEP_KEY = "onboarding_step";

interface Step {
  icon: string;
  titleKey: string;
  descKey: string;
  href: string;
  ctaKey: string;
  plusOnly?: boolean;
}

const ALL_STEPS: Step[] = [
  {
    icon: "📥",
    titleKey: "onboarding_step1_title",
    descKey: "onboarding_step1_desc",
    href: "/dashboard/trades",
    ctaKey: "onboarding_step1_cta",
  },
  {
    icon: "📋",
    titleKey: "onboarding_step2_title",
    descKey: "onboarding_step2_desc",
    href: "/dashboard/strategy",
    ctaKey: "onboarding_step2_cta",
    plusOnly: true,
  },
  {
    icon: "🏷️",
    titleKey: "onboarding_step3_title",
    descKey: "onboarding_step3_desc",
    href: "/dashboard/trades",
    ctaKey: "onboarding_step3_cta",
  },
  {
    icon: "🤖",
    titleKey: "onboarding_step4_title",
    descKey: "onboarding_step4_desc",
    href: "/dashboard/analysis",
    ctaKey: "onboarding_step4_cta",
    plusOnly: true,
  },
  {
    icon: "📊",
    titleKey: "onboarding_step5_title",
    descKey: "onboarding_step5_desc",
    href: "/dashboard/analytics",
    ctaKey: "onboarding_step5_cta",
  },
];

export default function OnboardingGuide() {
  const { t } = useLanguage();
  const { plan, loading } = usePlan();
  const [visible, setVisible] = useState(false);
  const [currentStep, setCurrentStep] = useState(0);

  useEffect(() => {
    if (loading) return;
    const done = localStorage.getItem(STORAGE_KEY);
    if (!done) {
      const saved = localStorage.getItem(STEP_KEY);
      if (saved) setCurrentStep(parseInt(saved, 10));
      setVisible(true);
    }
  }, [loading]);

  if (!visible || loading) return null;

  const isPaid = plan === "plus" || plan === "premium";
  const steps = isPaid ? ALL_STEPS : ALL_STEPS.filter((s) => !s.plusOnly);

  function dismiss() {
    localStorage.setItem(STORAGE_KEY, "1");
    localStorage.removeItem(STEP_KEY);
    setVisible(false);
  }

  function next() {
    if (currentStep < steps.length - 1) {
      const nextStep = currentStep + 1;
      setCurrentStep(nextStep);
      localStorage.setItem(STEP_KEY, String(nextStep));
    } else {
      dismiss();
    }
  }

  function prev() {
    if (currentStep > 0) setCurrentStep(currentStep - 1);
  }

  const step = steps[currentStep];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm animate-in fade-in duration-300">
      <div className="bg-card border border-border rounded-2xl shadow-2xl w-full max-w-lg mx-4 overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-6 pt-5 pb-2">
          <h2 className="text-lg font-bold text-foreground">
            {isPaid ? t("onboarding_title_plus") : t("onboarding_title_free")}
          </h2>
          <button
            onClick={() => setVisible(false)}
            className="text-muted hover:text-foreground transition-colors"
            aria-label="Close"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Progress dots */}
        <div className="flex items-center gap-1.5 px-6 pb-4">
          {steps.map((_, i) => (
            <div
              key={i}
              className={`h-1 rounded-full transition-all duration-300 ${
                i === currentStep
                  ? "w-6 bg-accent"
                  : i < currentStep
                    ? "w-3 bg-accent/40"
                    : "w-3 bg-border"
              }`}
            />
          ))}
          <span className="ml-auto text-xs text-muted">
            {currentStep + 1}/{steps.length}
          </span>
        </div>

        {/* Step content */}
        <div className="px-6 pb-6">
          <div className="flex items-start gap-4">
            <span className="text-3xl shrink-0 mt-1">{step.icon}</span>
            <div className="flex-1 min-w-0">
              <h3 className="text-base font-semibold text-foreground mb-1">
                {t(step.titleKey)}
              </h3>
              <p className="text-sm text-muted leading-relaxed">
                {t(step.descKey)}
              </p>
            </div>
          </div>

          {/* CTA link */}
          <Link
            href={step.href}
            onClick={next}
            className="mt-4 flex items-center justify-center gap-2 w-full py-2.5 bg-accent text-white text-sm font-medium rounded-lg hover:bg-blue-600 transition-colors"
          >
            {t(step.ctaKey)} →
          </Link>
        </div>

        {/* Navigation */}
        <div className="flex items-center justify-between px-6 py-3 bg-surface/50 border-t border-border">
          <button
            onClick={prev}
            disabled={currentStep === 0}
            className="text-sm text-muted hover:text-foreground disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
          >
            ← {t("onboarding_prev")}
          </button>

          <button
            onClick={dismiss}
            className="text-xs text-muted hover:text-foreground transition-colors"
          >
            {t("onboarding_skip")}
          </button>

          <button
            onClick={next}
            className="text-sm font-medium text-accent hover:text-blue-600 transition-colors"
          >
            {currentStep === steps.length - 1
              ? t("onboarding_finish")
              : t("onboarding_next") + " →"}
          </button>
        </div>
      </div>
    </div>
  );
}
