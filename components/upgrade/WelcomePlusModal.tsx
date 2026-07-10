"use client";

import { useLanguage } from "@/lib/LanguageContext";

interface WelcomePlusModalProps {
  isOpen: boolean;
  onClose: () => void;
  isPlanReady: boolean;
  plan?: "plus" | "premium";
}

export function WelcomePlusModal({ isOpen, onClose, isPlanReady, plan = "plus" }: WelcomePlusModalProps) {
  const { t } = useLanguage();

  if (!isOpen) return null;

  const planLabel = plan === "premium" ? t("plan_premium") : t("plan_plus");

  // Premium met en avant ses bénéfices exclusifs ; Plus garde sa liste de features.
  const features = plan === "premium"
    ? [
        t("plan_benefit_premium_1"),
        t("plan_benefit_premium_2"),
        t("plan_benefit_premium_3"),
        t("upgrade_welcome_feature_1"),
        t("upgrade_welcome_feature_2"),
      ]
    : [
        t("upgrade_welcome_feature_1"),
        t("upgrade_welcome_feature_2"),
        t("upgrade_welcome_feature_3"),
        t("upgrade_welcome_feature_4"),
        t("upgrade_welcome_feature_5"),
      ];

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
    >
      <div
        className="relative bg-card border border-border rounded-2xl shadow-2xl max-w-md w-full p-8"
        onClick={(e) => e.stopPropagation()}
      >
        <button
          onClick={onClose}
          className="absolute top-4 right-4 text-muted hover:text-foreground transition-colors"
          aria-label={t("close")}
        >
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <line x1="18" y1="6" x2="6" y2="18" />
            <line x1="6" y1="6" x2="18" y2="18" />
          </svg>
        </button>

        <div className="text-center mb-4">
          <div className="text-5xl mb-2">🎉</div>
          <h2 className="text-2xl font-bold text-foreground">
            {t("upgrade_welcome_title_dyn").replace("{plan}", planLabel)}
          </h2>
          <p className="text-muted mt-2 text-sm">
            {isPlanReady
              ? t("upgrade_welcome_subtitle_ready")
              : t("upgrade_welcome_subtitle_pending")}
          </p>
        </div>

        <ul className="space-y-2 mb-6">
          {features.map((feature, i) => (
            <li key={i} className="flex items-center gap-3 text-sm text-foreground">
              <span className="text-profit font-bold">✓</span>
              {feature}
            </li>
          ))}
        </ul>

        <button
          onClick={onClose}
          disabled={!isPlanReady}
          className="w-full bg-accent hover:bg-accent-hover disabled:bg-surface disabled:text-muted disabled:cursor-not-allowed text-white font-semibold py-3 px-6 rounded-lg transition-colors"
        >
          {isPlanReady
            ? t("upgrade_welcome_cta_dyn").replace("{plan}", planLabel)
            : t("upgrade_welcome_cta_pending")}
        </button>
      </div>
    </div>
  );
}
