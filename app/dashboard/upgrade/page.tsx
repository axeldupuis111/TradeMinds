"use client";

import { useLanguage } from "@/lib/LanguageContext";
import { usePlan } from "@/lib/PlanContext";
import { useState } from "react";

interface PlanFeature {
  key: string;
  free: boolean | string;
  plus: boolean | string;
}

const features: PlanFeature[] = [
  { key: "plan_feat_csv_import",      free: "1/plan_week", plus: "plan_unlimited" },
  { key: "plan_feat_accounts",         free: "1",           plus: "plan_unlimited" },
  { key: "plan_feat_calendar",         free: true,          plus: true             },
  { key: "plan_feat_equity_curve",     free: true,          plus: true             },
  { key: "plan_feat_manual_trades",    free: true,          plus: true             },
  { key: "plan_feat_strategy_ai",      free: false,         plus: true             },
  { key: "plan_feat_analysis_ai",      free: false,         plus: "1/plan_day"     },
  { key: "plan_feat_coach_ai",         free: false,         plus: "10/plan_day"    },
  { key: "plan_feat_tags_emotions",    free: false,         plus: true             },
  { key: "plan_feat_pdf_export",       free: false,         plus: true             },
  { key: "plan_feat_analytics",        free: false,         plus: true             },
  { key: "plan_feat_public_profile",   free: false,         plus: true             },
  { key: "plan_feat_daily_summary",    free: false,         plus: true             },
];

export default function UpgradePage() {
  const { t } = useLanguage();
  const { plan: currentPlan } = usePlan();
  const [annual, setAnnual] = useState(false);
  const [notifyEmail, setNotifyEmail] = useState("");
  const [notifyStatus, setNotifyStatus] = useState<"idle" | "loading" | "success" | "duplicate" | "error">("idle");

  async function handleNotify() {
    const email = notifyEmail.trim();
    if (!email) return;
    setNotifyStatus("loading");
    try {
      const res = await fetch("/api/waitlist", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email }),
      });
      const data = await res.json();
      if (data.duplicate) setNotifyStatus("duplicate");
      else if (res.ok) setNotifyStatus("success");
      else setNotifyStatus("error");
    } catch {
      setNotifyStatus("error");
    }
  }

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
        <svg className="w-5 h-5 text-muted/40 mx-auto" fill="none" stroke="currentColor" viewBox="0 0 24 24">
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

  const activePlans = [
    {
      id: "free",
      name: t("plan_free"),
      sub: t("plan_sub_free"),
      monthlyPrice: "0€",
      annualPrice: "0€",
      annualMonthly: "",
      color: "border-[#2a2a2a]",
    },
    {
      id: "plus",
      name: t("plan_plus"),
      sub: t("plan_sub_plus"),
      monthlyPrice: "9.99€",
      annualPrice: "89.99€",
      annualMonthly: "7.50€",
      color: "border-accent",
      highlight: true,
    },
  ];

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

      {/* Active plans grid (Free + Plus) */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-6 max-w-2xl mx-auto">
        {activePlans.map((p) => {
          const isCurrent = p.id === currentPlan;
          const price = annual ? p.annualPrice : p.monthlyPrice;
          const period = annual ? `/${t("plan_year")}` : `/${t("plan_month")}`;
          const showSavings = annual && p.annualMonthly;

          return (
            <div
              key={p.id}
              className={`relative rounded-xl border-2 p-6 transition-all ${p.color} ${
                p.highlight && !isCurrent ? "shadow-lg shadow-accent/10" : ""
              } ${isCurrent ? "ring-2 ring-accent/50" : ""}`}
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
              <p className="text-muted text-xs mt-0.5">{p.sub}</p>
              <div className="mt-3">
                <div className="flex items-baseline gap-1">
                  <span className="text-3xl font-bold text-foreground">{price}</span>
                  <span className="text-muted text-sm">{period}</span>
                </div>
                {showSavings ? (
                  <p className="text-profit text-xs mt-1">
                    {t("plan_equiv")} {p.annualMonthly}/{t("plan_month")}
                  </p>
                ) : (
                  <div className="h-4" />
                )}
              </div>

              <div className="mt-5 space-y-2.5">
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

      {/* Premium — Coming soon card */}
      <div className="mt-6 max-w-2xl mx-auto">
        <div className="relative rounded-xl border-2 border-[#2a2a2a] p-6 opacity-70">
          {/* Badge */}
          <span className="absolute -top-3 left-1/2 -translate-x-1/2 bg-[#2a2a2a] text-muted text-xs font-bold px-3 py-0.5 rounded-full">
            {t("plan_premium_coming")}
          </span>

          <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4">
            <div className="flex-1">
              <h3 className="text-lg font-bold text-foreground">{t("plan_premium")}</h3>
              <p className="text-muted text-sm mt-1 max-w-md">{t("plan_premium_desc")}</p>
            </div>

            {/* Notify form */}
            <div className="sm:w-64 shrink-0">
              {notifyStatus === "success" ? (
                <p className="text-profit text-sm font-medium text-center py-2.5">
                  {t("pricing_notify_success")}
                </p>
              ) : notifyStatus === "duplicate" ? (
                <p className="text-orange-400 text-sm text-center py-2.5">
                  {t("pricing_notify_duplicate")}
                </p>
              ) : (
                <div className="flex gap-2">
                  <input
                    type="email"
                    value={notifyEmail}
                    onChange={(e) => setNotifyEmail(e.target.value)}
                    onKeyDown={(e) => { if (e.key === "Enter") handleNotify(); }}
                    placeholder="email@exemple.com"
                    className="flex-1 min-w-0 px-3 py-2 bg-[#1a1a1a] border border-[#2a2a2a] rounded-lg text-foreground text-sm placeholder-muted focus:outline-none focus:ring-1 focus:ring-accent/50 focus:border-accent/50"
                  />
                  <button
                    onClick={handleNotify}
                    disabled={notifyStatus === "loading" || !notifyEmail.trim()}
                    className="px-3 py-2 bg-[#1e1e1e] border border-[#2a2a2a] text-foreground text-sm rounded-lg hover:bg-[#2a2a2a] transition-colors disabled:opacity-50 whitespace-nowrap"
                  >
                    {notifyStatus === "loading" ? "..." : t("plan_premium_notify_btn")}
                  </button>
                </div>
              )}
              {notifyStatus === "error" && (
                <p className="text-loss text-xs mt-1">{t("pricing_notify_error")}</p>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Feature comparison table */}
      <div className="mt-10 max-w-2xl mx-auto">
        <h2 className="text-base font-semibold text-foreground mb-4">{t("plan_compare_title")}</h2>
        <div className="rounded-xl border border-border overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border bg-[#0f0f0f]">
                <th className="text-left px-4 py-3 text-muted font-medium">{t("plan_feature")}</th>
                <th className="text-center px-4 py-3 text-muted font-medium">{t("plan_free")}</th>
                <th className="text-center px-4 py-3 text-accent font-semibold">{t("plan_plus")}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {features.map((f) => (
                <tr key={f.key} className="bg-card hover:bg-border/20 transition-colors">
                  <td className="px-4 py-3 text-foreground">{t(f.key)}</td>
                  <td className="px-4 py-3 text-center">{renderValue(f.free)}</td>
                  <td className="px-4 py-3 text-center">{renderValue(f.plus)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <p className="text-center text-muted text-sm mt-6">{t("plan_stripe_soon")}</p>
    </div>
  );
}
