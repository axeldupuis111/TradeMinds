"use client";

import { useLanguage } from "@/lib/LanguageContext";
import { usePlan } from "@/lib/PlanContext";

interface PlanFeature {
  key: string;
  free: boolean | string;
  plus: boolean | string;
  premium: boolean | string;
}

const features: PlanFeature[] = [
  { key: "plan_feat_manual_trades", free: true, plus: true, premium: true },
  { key: "plan_feat_csv_import", free: false, plus: true, premium: true },
  { key: "plan_feat_accounts", free: "1", plus: "plan_unlimited", premium: "plan_unlimited" },
  { key: "plan_feat_strategy_ai", free: false, plus: true, premium: true },
  { key: "plan_feat_analysis_ai", free: false, plus: "1/plan_day", premium: "plan_unlimited" },
  { key: "plan_feat_calendar", free: true, plus: true, premium: true },
  { key: "plan_feat_equity_curve", free: true, plus: true, premium: true },
  { key: "plan_feat_priority_support", free: false, plus: false, premium: true },
];

export default function UpgradePage() {
  const { t } = useLanguage();
  const { plan: currentPlan } = usePlan();

  const plans = [
    { id: "free", name: t("plan_free"), price: "0€", period: `/${t("plan_month")}`, color: "border-[#2a2a2a]" },
    { id: "plus", name: t("plan_plus"), price: "9.99€", period: `/${t("plan_month")}`, color: "border-accent", highlight: true },
    { id: "premium", name: t("plan_premium"), price: "24.99€", period: `/${t("plan_month")}`, color: "border-yellow-500" },
  ];

  function renderValue(val: boolean | string): React.ReactNode {
    if (val === true) {
      return (
        <svg className="w-5 h-5 text-profit mx-auto" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
        </svg>
      );
    }
    if (val === false) {
      return (
        <svg className="w-5 h-5 text-muted mx-auto" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
        </svg>
      );
    }
    // String values like "1" or "1/plan_day" or "plan_unlimited"
    if (val.includes("/")) {
      const parts = val.split("/");
      return <span className="text-foreground text-sm">{parts[0]}/{t(parts[1])}</span>;
    }
    if (val === "plan_unlimited") {
      return <span className="text-profit text-sm font-medium">{t("plan_unlimited")}</span>;
    }
    return <span className="text-foreground text-sm">{val}</span>;
  }

  return (
    <div>
      <h1 className="text-2xl font-bold text-foreground">{t("plan_upgrade_title")}</h1>
      <p className="text-muted mt-1">{t("plan_upgrade_subtitle")}</p>

      {/* Plans grid */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mt-8">
        {plans.map((p) => {
          const isCurrent = p.id === currentPlan;
          return (
            <div
              key={p.id}
              className={`relative rounded-xl border-2 p-6 transition-all ${p.color} ${
                p.highlight && !isCurrent ? "shadow-lg shadow-accent/10" : ""
              } ${isCurrent ? "ring-2 ring-accent" : ""}`}
            >
              {isCurrent && (
                <span className="absolute -top-3 left-1/2 -translate-x-1/2 bg-accent text-white text-xs font-bold px-3 py-0.5 rounded-full">
                  {t("plan_current")}
                </span>
              )}
              {p.highlight && !isCurrent && (
                <span className="absolute -top-3 left-1/2 -translate-x-1/2 bg-accent text-white text-xs font-bold px-3 py-0.5 rounded-full">
                  {t("plan_popular")}
                </span>
              )}

              <h3 className="text-lg font-bold text-foreground">{p.name}</h3>
              <div className="mt-2 flex items-baseline gap-1">
                <span className="text-3xl font-bold text-foreground">{p.price}</span>
                <span className="text-muted text-sm">{p.period}</span>
              </div>

              <div className="mt-6 space-y-3">
                {features.map((f) => {
                  const val = f[p.id as keyof PlanFeature] as boolean | string;
                  return (
                    <div key={f.key} className="flex items-center gap-3">
                      <div className="w-6 flex justify-center shrink-0">{renderValue(val)}</div>
                      <span className="text-sm text-foreground">{t(f.key)}</span>
                    </div>
                  );
                })}
              </div>

              <button
                disabled={isCurrent}
                className={`w-full mt-6 py-2.5 rounded-lg font-medium text-sm transition-colors ${
                  isCurrent
                    ? "bg-[#1e1e1e] text-muted cursor-default"
                    : p.id === "premium"
                      ? "bg-yellow-500 text-black hover:bg-yellow-400"
                      : p.id === "plus"
                        ? "bg-accent text-white hover:bg-blue-600"
                        : "bg-[#1a1a1a] border border-[#2a2a2a] text-foreground hover:bg-[#2a2a2a]"
                }`}
              >
                {isCurrent ? t("plan_current_plan") : t("plan_choose")}
              </button>
            </div>
          );
        })}
      </div>

      <p className="text-center text-muted text-sm mt-6">{t("plan_stripe_soon")}</p>
    </div>
  );
}
