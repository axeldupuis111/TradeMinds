"use client";

import { createClient } from "@/lib/supabase/client";
import { useLanguage } from "@/lib/LanguageContext";
import { usePlan } from "@/lib/PlanContext";
import Link from "next/link";
import { useRef, useState } from "react";

interface PlanFeature {
  key: string;
  free: boolean | string;
  plus: boolean | string;
  demoHref?: string;
}

const features: PlanFeature[] = [
  { key: "plan_feat_csv_import",        free: "1/plan_day",  plus: "plan_unlimited"                          },
  { key: "plan_feat_accounts",          free: "1",           plus: "plan_unlimited"                          },
  { key: "plan_feat_calendar",          free: true,          plus: true                                      },
  { key: "plan_feat_equity_curve",      free: true,          plus: true                                      },
  { key: "plan_feat_manual_trades",     free: true,          plus: true                                      },
  { key: "plan_feat_session_pretrade",  free: true,          plus: true                                      },
  { key: "plan_feat_strategy_ai",       free: false,         plus: true,  demoHref: "/dashboard/strategy"    },
  { key: "plan_feat_analysis_ai",       free: false,         plus: "1/plan_day", demoHref: "/dashboard/analysis" },
  { key: "plan_feat_coach_ai",          free: false,         plus: "10/plan_day", demoHref: "/dashboard/analysis" },
  { key: "plan_feat_tags_emotions",     free: false,         plus: true                                      },
  { key: "plan_feat_pdf_export",        free: false,         plus: true                                      },
  { key: "plan_feat_analytics",         free: false,         plus: true                                      },
  { key: "plan_feat_public_profile",    free: false,         plus: true                                      },
  { key: "plan_feat_daily_summary",     free: false,         plus: true                                      },
  { key: "plan_feat_stop_trading",      free: false,         plus: true                                      },
];

const faqKeys = [
  { q: "faq_upgrade_q1", a: "faq_upgrade_a1" },
  { q: "faq_upgrade_q2", a: "faq_upgrade_a2" },
  { q: "faq_upgrade_q3", a: "faq_upgrade_a3" },
  { q: "faq_upgrade_q4", a: "faq_upgrade_a4" },
];

export default function UpgradePage() {
  const { t } = useLanguage();
  const { plan: currentPlan, refreshPlan } = usePlan();
  const supabase = createClient();
  const [annual, setAnnual] = useState(false);
  const [notifyEmail, setNotifyEmail] = useState("");
  const [notifyStatus, setNotifyStatus] = useState<"idle" | "loading" | "success" | "duplicate" | "error">("idle");
  const [showDowngradeModal, setShowDowngradeModal] = useState(false);
  const [downgrading, setDowngrading] = useState(false);
  const [toast, setToast] = useState<string | null>(null);
  const [openFaq, setOpenFaq] = useState<number | null>(null);
  const premiumRef = useRef<HTMLDivElement>(null);

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

  async function handleDowngrade() {
    setDowngrading(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;
      await supabase.from("profiles").update({ plan: "free", plan_expires_at: null }).eq("id", user.id);
      await refreshPlan();
      setShowDowngradeModal(false);
    } finally {
      setDowngrading(false);
    }
  }

  function handlePlusClick() {
    setToast(t("plan_stripe_toast"));
    setTimeout(() => setToast(null), 6000);
    premiumRef.current?.scrollIntoView({ behavior: "smooth" });
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

  return (
    <div>
      {/* Toast */}
      {toast && (
        <div className="fixed top-4 right-4 z-50 px-4 py-3 rounded-lg bg-accent text-white text-sm font-medium shadow-lg max-w-sm">
          {toast}
        </div>
      )}

      {/* Downgrade confirmation modal */}
      {showDowngradeModal && (
        <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4">
          <div className="bg-card border border-border rounded-xl p-6 max-w-md w-full shadow-xl">
            <h3 className="text-lg font-bold text-foreground mb-2">{t("downgrade_modal_title")}</h3>
            <p className="text-muted text-sm mb-5">{t("downgrade_modal_body")}</p>
            <div className="flex gap-3">
              <button
                onClick={() => setShowDowngradeModal(false)}
                className="flex-1 py-2.5 rounded-lg border border-border text-foreground text-sm hover:bg-border transition-colors"
              >
                {t("downgrade_cancel")}
              </button>
              <button
                onClick={handleDowngrade}
                disabled={downgrading}
                className="flex-1 py-2.5 rounded-lg bg-loss text-white text-sm font-medium hover:bg-red-600 transition-colors disabled:opacity-50"
              >
                {downgrading ? "..." : t("downgrade_confirm")}
              </button>
            </div>
          </div>
        </div>
      )}

      <h1 className="text-2xl font-bold text-foreground">{t("plan_upgrade_title")}</h1>
      <p className="text-muted mt-1">{t("plan_upgrade_subtitle")}</p>

      {/* Toggle monthly/annual */}
      <div className="flex items-center justify-center gap-3 mt-8">
        <span className={`text-sm font-medium transition-colors ${!annual ? "text-foreground" : "text-muted"}`}>
          {t("plan_monthly")}
        </span>
        <button
          onClick={() => setAnnual(!annual)}
          className="relative w-14 h-7 rounded-full bg-surface border border-border transition-colors"
        >
          <div
            className={`absolute top-0.5 w-6 h-6 rounded-full transition-all duration-300 ${
              annual ? "left-[30px] bg-accent" : "left-0.5 bg-muted"
            }`}
          />
        </button>
        <span className={`text-sm font-medium transition-colors ${annual ? "text-foreground" : "text-muted"}`}>
          {t("plan_annual")}
        </span>
        {annual && (
          <span className="px-2 py-0.5 bg-profit/10 text-profit text-xs font-bold rounded-full">
            -20%
          </span>
        )}
      </div>

      {/* Active plans grid (Free + Plus) */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-6 max-w-2xl mx-auto">
        {/* Free plan */}
        {(() => {
          const isCurrent = currentPlan === "free";
          return (
            <div
              className={`relative rounded-xl border-2 p-6 transition-all border-border ${
                isCurrent ? "ring-2 ring-accent/50" : ""
              }`}
            >
              {isCurrent && (
                <span className="absolute -top-3 left-1/2 -translate-x-1/2 bg-accent text-white text-xs font-bold px-3 py-0.5 rounded-full">
                  {t("plan_current")}
                </span>
              )}
              <h3 className="text-lg font-bold text-foreground">{t("plan_free")}</h3>
              <p className="text-muted text-xs mt-0.5">{t("plan_sub_free")}</p>
              <div className="mt-3">
                <div className="flex items-baseline gap-1">
                  <span className="text-3xl font-bold text-foreground">0€</span>
                  <span className="text-muted text-sm">/{t("plan_month")}</span>
                </div>
                <div className="h-8" />
              </div>
              <div className="mt-5 space-y-2.5">
                {features.map((f) => (
                  <div key={f.key} className="flex items-center gap-3">
                    <div className="w-6 flex justify-center shrink-0">{renderValue(f.free)}</div>
                    <span className="text-sm text-foreground">{t(f.key)}</span>
                    {f.free === false && f.demoHref && (
                      <Link href={f.demoHref} className="text-xs text-accent hover:underline shrink-0">
                        {t("demo_see")}
                      </Link>
                    )}
                  </div>
                ))}
              </div>
              {currentPlan === "plus" ? (
                <button
                  onClick={() => setShowDowngradeModal(true)}
                  className="w-full mt-6 py-2.5 rounded-lg font-medium text-sm transition-colors bg-surface border border-border text-foreground hover:bg-border"
                >
                  {t("plan_downgrade_free")}
                </button>
              ) : (
                <button
                  disabled
                  className="w-full mt-6 py-2.5 rounded-lg font-medium text-sm bg-surface text-muted cursor-default"
                >
                  {t("plan_current_plan")}
                </button>
              )}
            </div>
          );
        })()}

        {/* Plus plan */}
        {(() => {
          const isCurrent = currentPlan === "plus";
          return (
            <div
              className={`relative rounded-xl border-2 p-6 transition-all border-accent ${
                !isCurrent ? "shadow-lg shadow-accent/10" : ""
              } ${isCurrent ? "ring-2 ring-accent/50" : ""}`}
            >
              {isCurrent ? (
                <span className="absolute -top-3 left-1/2 -translate-x-1/2 bg-accent text-white text-xs font-bold px-3 py-0.5 rounded-full">
                  {t("plan_current")}
                </span>
              ) : (
                <span className="absolute -top-3 left-1/2 -translate-x-1/2 bg-accent text-white text-xs font-bold px-3 py-0.5 rounded-full">
                  {t("plan_popular")}
                </span>
              )}
              <h3 className="text-lg font-bold text-foreground">{t("plan_plus")}</h3>
              <p className="text-muted text-xs mt-0.5">{t("plan_sub_plus")}</p>

              {annual ? (
                <div className="mt-3">
                  <div className="flex items-baseline gap-2">
                    <span className="text-muted text-sm line-through">9.99€/{t("plan_month")}</span>
                  </div>
                  <div className="flex items-baseline gap-1">
                    <span className="text-3xl font-bold text-foreground">7.99€</span>
                    <span className="text-muted text-sm">/{t("plan_month")}</span>
                  </div>
                  <span className="inline-block mt-1 px-2 py-0.5 bg-profit/10 text-profit text-xs font-bold rounded-full">
                    {t("plan_two_months_free")}
                  </span>
                  <p className="text-muted text-xs mt-1">
                    {t("plan_billed_annual").replace("{price}", "95.88€")}
                  </p>
                </div>
              ) : (
                <div className="mt-3">
                  <div className="flex items-baseline gap-1">
                    <span className="text-3xl font-bold text-foreground">9.99€</span>
                    <span className="text-muted text-sm">/{t("plan_month")}</span>
                  </div>
                  <div className="h-8" />
                </div>
              )}

              <div className="mt-5 space-y-2.5">
                {features.map((f) => (
                  <div key={f.key} className="flex items-center gap-3">
                    <div className="w-6 flex justify-center shrink-0">{renderValue(f.plus)}</div>
                    <span className="text-sm text-foreground">{t(f.key)}</span>
                  </div>
                ))}
              </div>

              {isCurrent ? (
                <button
                  disabled
                  className="w-full mt-6 py-2.5 rounded-lg font-medium text-sm bg-surface text-muted cursor-default"
                >
                  {t("plan_current_plan")}
                </button>
              ) : (
                <button
                  onClick={handlePlusClick}
                  className="w-full mt-6 py-2.5 rounded-lg font-medium text-sm bg-accent text-white hover:bg-blue-600 transition-colors"
                >
                  {t("plan_choose")}
                </button>
              )}
            </div>
          );
        })()}
      </div>

      {/* Premium — Coming soon card */}
      <div className="mt-6 max-w-2xl mx-auto" ref={premiumRef} id="premium-notify">
        <div className="relative rounded-xl border-2 border-yellow-500/30 p-6 bg-card/80 shadow-lg shadow-yellow-500/5">
          <span className="absolute -top-3 left-1/2 -translate-x-1/2 bg-yellow-500/20 text-yellow-400 text-xs font-bold px-3 py-0.5 rounded-full border border-yellow-500/30">
            {t("plan_premium_coming")}
          </span>

          <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4">
            <div className="flex-1">
              <h3 className="text-lg font-bold text-yellow-400">{t("plan_premium")}</h3>
              <div className="flex items-baseline gap-1 mt-1">
                <span className="text-2xl font-bold text-foreground/70">19.99€</span>
                <span className="text-muted text-sm">/{t("plan_month")}</span>
              </div>
              <p className="text-muted text-sm mt-2 max-w-md">{t("plan_premium_desc")}</p>
            </div>

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
                    className="flex-1 min-w-0 px-3 py-2 bg-surface border border-border rounded-lg text-foreground text-sm placeholder-muted focus:outline-none focus:ring-1 focus:ring-accent/50 focus:border-accent/50"
                  />
                  <button
                    onClick={handleNotify}
                    disabled={notifyStatus === "loading" || !notifyEmail.trim()}
                    className="px-3 py-2 bg-surface border border-border text-foreground text-sm rounded-lg hover:bg-border transition-colors disabled:opacity-50 whitespace-nowrap"
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
              <tr className="border-b border-border bg-surface">
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

      {/* FAQ */}
      <div className="mt-10 max-w-2xl mx-auto pb-4">
        <h2 className="text-base font-semibold text-foreground mb-4">{t("faq_upgrade_title")}</h2>
        <div className="rounded-xl border border-border overflow-hidden divide-y divide-border bg-[#1a1a1a]">
          {faqKeys.map(({ q, a }, i) => (
            <div key={q}>
              <button
                onClick={() => setOpenFaq(openFaq === i ? null : i)}
                className="w-full flex items-center justify-between px-5 py-4 text-left text-sm font-medium text-foreground hover:bg-border/20 transition-colors"
              >
                <span>{t(q)}</span>
                <svg
                  className={`w-4 h-4 text-muted shrink-0 transition-transform duration-200 ml-3 ${openFaq === i ? "rotate-180" : ""}`}
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                </svg>
              </button>
              {openFaq === i && (
                <div className="px-5 pb-4 text-sm text-muted leading-relaxed">
                  {t(a)}
                </div>
              )}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
