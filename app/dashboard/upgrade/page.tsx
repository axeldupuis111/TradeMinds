"use client";

import { useLanguage } from "@/lib/LanguageContext";
import { usePlan } from "@/lib/PlanContext";
import { useState } from "react";

interface PlanFeature {
  key: string;
  free: boolean | string;
  plus: boolean | string;
  premium: boolean | string;
}

const features: PlanFeature[] = [
  { key: "plan_feat_csv_import", free: "1/plan_week", plus: "plan_unlimited", premium: "plan_unlimited" },
  { key: "plan_feat_accounts", free: "1", plus: "plan_unlimited", premium: "plan_unlimited" },
  { key: "plan_feat_calendar", free: true, plus: true, premium: true },
  { key: "plan_feat_equity_curve", free: true, plus: true, premium: true },
  { key: "plan_feat_strategy_ai", free: false, plus: true, premium: true },
  { key: "plan_feat_analysis_ai", free: false, plus: "1/plan_day", premium: "plan_unlimited" },
  { key: "plan_feat_priority_support", free: false, plus: false, premium: true },
  { key: "plan_feat_badge_premium", free: false, plus: false, premium: true },
];

export default function UpgradePage() {
  const { t } = useLanguage();
  const { plan: currentPlan } = usePlan();
  const [annual, setAnnual] = useState(false);

  const plans = [
    {
      id: "free",
      name: t("plan_free"),
      monthlyPrice: "0€",
      annualPrice: "0€",
      annualMonthly: "",
      color: "border-[#2a2a2a]",
    },
    {
      id: "plus",
      name: t("plan_plus"),
      monthlyPrice: "9.99€",
      annualPrice: "89.99€",
      annualMonthly: "7.50€",
      color: "border-accent",
      highlight: true,
    },
    {
      id: "premium",
      name: t("plan_premium"),
      monthlyPrice: "19.99€",
      annualPrice: "179.99€",
      annualMonthly: "15€",
      color: "border-yellow-500",
    },
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

      {/* Toggle monthly/annual */}
      <div className="flex items-center justify-center gap-3 mt-8">
        <span className={`text-sm font-medium transition-colors ${!annual ? "text-foreground" : "text-muted"}`}>
          {t("plan_monthly")}
        </span>
        <button
          onClick={() => setAnnual(!annual)}
          className="relative w-14 h-7 rounded-full bg-[#1e1e1e] border border-[#2a2a2a] transition-colors"
        >
          <div
            className={`absolute top-0.5 w-6 h-6 rounded-full transition-all duration-300 ${
              annual ? "left-[30px] bg-accent" : "left-0.5 bg-[#555]"
            }`}
          />
        </button>
        <span className={`text-sm font-medium transition-colors ${annual ? "text-foreground" : "text-muted"}`}>
          {t("plan_annual")}
        </span>
        {annual && (
          <span className="px-2 py-0.5 bg-profit/10 text-profit text-xs font-bold rounded-full">
            -25%
          </span>
        )}
      </div>

      {/* Plans grid */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mt-6">
        {plans.map((p) => {
          const isCurrent = p.id === currentPlan;
          const price = annual ? p.annualPrice : p.monthlyPrice;
          const period = annual ? `/${t("plan_year")}` : `/${t("plan_month")}`;
          const showSavings = annual && p.annualMonthly;

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
              <div className="mt-2">
                <div className="flex items-baseline gap-1 transition-all duration-300">
                  <span className="text-3xl font-bold text-foreground">{price}</span>
                  <span className="text-muted text-sm">{period}</span>
                </div>
                {showSavings && (
                  <p className="text-profit text-xs mt-1 transition-all duration-300">
                    {t("plan_equiv")} {p.annualMonthly}/{t("plan_month")}
                  </p>
                )}
                {!showSavings && p.id !== "free" && (
                  <p className="text-xs mt-1 text-transparent select-none">.</p>
                )}
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
