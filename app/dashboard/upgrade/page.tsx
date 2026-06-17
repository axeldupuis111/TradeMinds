"use client";

import { createClient } from "@/lib/supabase/client";
import { useLanguage } from "@/lib/LanguageContext";
import { usePlan } from "@/lib/PlanContext";
import { WelcomePlusModal } from "@/components/upgrade/WelcomePlusModal";
import Link from "next/link";
import { useSearchParams, useRouter, usePathname } from "next/navigation";
import { useCallback, useEffect, useRef, useState } from "react";

interface PlanFeature {
  key: string;
  free: boolean | string;
  plus: boolean | string;
  premium: boolean | string;
  demoHref?: string;
}

const features: PlanFeature[] = [
  { key: "plan_feat_csv_import",        free: "1/plan_day",  plus: "plan_unlimited", premium: "plan_unlimited"                          },
  { key: "plan_feat_accounts",          free: "1",           plus: "plan_unlimited", premium: "plan_unlimited"                          },
  { key: "plan_feat_calendar",          free: true,          plus: true,             premium: true                                      },
  { key: "plan_feat_equity_curve",      free: true,          plus: true,             premium: true                                      },
  { key: "plan_feat_manual_trades",     free: true,          plus: true,             premium: true                                      },
  { key: "plan_feat_session_pretrade",  free: true,          plus: true,             premium: true                                      },
  { key: "plan_feat_strategy_ai",       free: false,         plus: true,             premium: true,  demoHref: "/dashboard/strategy"    },
  { key: "plan_feat_analysis_ai",       free: false,         plus: "1/plan_day",     premium: "10/plan_day", demoHref: "/dashboard/analysis" },
  { key: "plan_feat_coach_ai",          free: false,         plus: "5/plan_day",     premium: "30/plan_day", demoHref: "/dashboard/analysis" },
  { key: "plan_feat_tags_emotions",     free: false,         plus: true,             premium: true                                      },
  { key: "plan_feat_pdf_export",        free: false,         plus: true,             premium: true                                      },
  { key: "plan_feat_analytics",         free: false,         plus: true,             premium: true                                      },
  { key: "plan_feat_public_profile",    free: false,         plus: true,             premium: true                                      },
  { key: "plan_feat_daily_summary",     free: false,         plus: true,             premium: true                                      },
  { key: "plan_feat_stop_trading",      free: false,         plus: true,             premium: true                                      },
  { key: "plan_feat_challenge_guardian", free: false,        plus: false,            premium: true                                      },
  { key: "plan_feat_mt_sync",           free: false,         plus: false,            premium: true                                      },
];

const faqKeys = [
  { q: "faq_upgrade_q1", a: "faq_upgrade_a1" },
  { q: "faq_upgrade_q2", a: "faq_upgrade_a2" },
  { q: "faq_upgrade_q3", a: "faq_upgrade_a3" },
  { q: "faq_upgrade_q4", a: "faq_upgrade_a4" },
];

export default function UpgradePage() {
  const { t } = useLanguage();
  const { plan: currentPlan, refreshPlan, subscriptionStatus } = usePlan();
  const hasStripeSubscription = subscriptionStatus !== null;
  const supabase = createClient();
  const [annual, setAnnual] = useState(false);
  const [showDowngradeModal, setShowDowngradeModal] = useState(false);
  const [downgrading, setDowngrading] = useState(false);
  const [openFaq, setOpenFaq] = useState<number | null>(null);
  const [isCheckoutLoading, setIsCheckoutLoading] = useState(false);
  const [checkoutError, setCheckoutError] = useState<string | null>(null);
  const [isPortalLoading, setIsPortalLoading] = useState(false);

  useEffect(() => {
    // Reset loading state on mount (handles browser back button restoring stale state)
    setIsCheckoutLoading(false);
    setCheckoutError(null);
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const [showWelcomeModal, setShowWelcomeModal] = useState(false);
  const [isPlanReady, setIsPlanReady] = useState(false);
  const [showCanceledToast, setShowCanceledToast] = useState(false);
  const premiumRef = useRef<HTMLDivElement>(null);

  const searchParams = useSearchParams();
  const router = useRouter();
  const pathname = usePathname();

  const handleCloseWelcomeModal = useCallback(() => {
    setShowWelcomeModal(false);
    refreshPlan();
  }, [refreshPlan]);

  useEffect(() => {
    return () => {
      setShowWelcomeModal(false);
    };
  }, []);

  useEffect(() => {
    const success = searchParams.get("success");
    const canceled = searchParams.get("canceled");

    if (success === "true") {
      setShowWelcomeModal(true);
      router.replace(pathname, { scroll: false });

      let pollCount = 0;
      const maxPolls = 7;

      const checkPlan = async () => {
        pollCount++;
        await refreshPlan();

        if (currentPlan === "plus" || pollCount >= 3) {
          setIsPlanReady(true);
        }
        if (currentPlan === "plus" || pollCount >= maxPolls) {
          clearInterval(intervalId);
        }
      };

      const intervalId = setInterval(checkPlan, 1500);
      checkPlan();

      return () => clearInterval(intervalId);
    }

    if (canceled === "true") {
      setShowCanceledToast(true);
      const timeout = setTimeout(() => setShowCanceledToast(false), 4000);
      router.replace(pathname, { scroll: false });
      return () => clearTimeout(timeout);
    }
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

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

  async function handleCheckout() {
    setIsCheckoutLoading(true);
    setCheckoutError(null);

    try {
      const interval = annual ? "yearly" : "monthly";

      const res = await fetch("/api/stripe/checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ interval }),
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || t("upgrade_checkout_error"));
      }

      if (!data.url) {
        throw new Error(t("upgrade_checkout_error"));
      }

      window.location.href = data.url;
    } catch (error) {
      console.error("[Checkout] Error:", error);
      setCheckoutError(error instanceof Error ? error.message : t("upgrade_checkout_error"));
      setIsCheckoutLoading(false);
    }
  }

  function renderValue(val: boolean | string): React.ReactNode {
    if (val === true) {
      return (
        <svg role="img" aria-label={t("upgrade_included")} className="w-5 h-5 text-profit mx-auto" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
        </svg>
      );
    }
    if (val === false) {
      return (
        <svg role="img" aria-label={t("upgrade_not_included")} className="w-5 h-5 text-muted/40 mx-auto" fill="none" stroke="currentColor" viewBox="0 0 24 24">
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
            -25%
          </span>
        )}
      </div>

      {/* Active plans grid (Free + Plus + Premium) */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mt-6 max-w-4xl mx-auto">
        {/* Free plan */}
        {(() => {
          const isCurrent = currentPlan === "free";
          return (
            <div
              className={`relative rounded-xl border-2 p-6 transition-all border-border flex flex-col h-full ${
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
              <div className="mt-5 space-y-2.5 flex-1">
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
              className={`relative rounded-xl border-2 p-6 transition-all border-accent flex flex-col h-full ${
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
                    <span className="text-3xl font-bold text-foreground">7.50€</span>
                    <span className="text-muted text-sm">/{t("plan_month")}</span>
                  </div>
                  <span className="inline-block mt-1 px-2 py-0.5 bg-profit/10 text-profit text-xs font-bold rounded-full">
                    {t("plan_two_months_free")}
                  </span>
                  <p className="text-muted text-xs mt-1">
                    {t("plan_billed_annual").replace("{price}", "89.99€")}
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

              <div className="mt-5 space-y-2.5 flex-1">
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
                <>
                  <button
                    onClick={handleCheckout}
                    disabled={isCheckoutLoading}
                    className="w-full mt-6 py-2.5 rounded-lg font-medium text-sm bg-accent text-white hover:bg-blue-600 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {isCheckoutLoading ? t("upgrade_redirecting") : t("pricing_choose_plus")}
                  </button>
                  {checkoutError && (
                    <p className="text-red-500 text-sm mt-2 text-center">{checkoutError}</p>
                  )}
                </>
              )}
            </div>
          );
        })()}

        {/* Premium — 3rd column */}
        <div
          className="relative rounded-xl border-2 border-yellow-500/30 p-6 bg-card/80 shadow-lg shadow-yellow-500/5 flex flex-col h-full"
          ref={premiumRef}
          id="premium"
        >
          <h3 className="text-lg font-bold text-yellow-400">{t("plan_premium")}</h3>
          <p className="text-muted text-xs mt-0.5">{t("plan_premium_desc")}</p>

          {/* Price */}
          {annual ? (
            <div className="mt-3">
              <div className="flex items-baseline gap-2">
                <span className="text-muted text-sm line-through">19,99€/{t("plan_month")}</span>
              </div>
              <div className="flex items-baseline gap-1">
                <span className="text-3xl font-bold text-foreground">14,99€</span>
                <span className="text-muted text-sm">/{t("plan_month")}</span>
              </div>
              <span className="inline-block mt-1 px-2 py-0.5 bg-profit/10 text-profit text-xs font-bold rounded-full">
                {t("plan_two_months_free")}
              </span>
              <p className="text-muted text-xs mt-1">
                {t("plan_billed_annual").replace("{price}", "179.88€")}
              </p>
            </div>
          ) : (
            <div className="mt-3">
              <div className="flex items-baseline gap-1">
                <span className="text-3xl font-bold text-foreground">19,99€</span>
                <span className="text-muted text-sm">/{t("plan_month")}</span>
              </div>
              <div className="h-8" />
            </div>
          )}

          {/* Exclusive features + Plus includes — flex-1 pushes CTA to card bottom */}
          <div className="flex-1">
            <ul className="mt-2 space-y-2">
              {(["plan_benefit_premium_1","plan_benefit_premium_2","plan_benefit_premium_3"] as const).map((key) => (
                <li key={key} className="flex items-start gap-2 text-sm">
                  <svg className="w-4 h-4 text-yellow-400 shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                  </svg>
                  <span className="text-foreground font-medium">{t(key)}</span>
                </li>
              ))}
            </ul>

            {/* Plus features included */}
            <div className="mt-4">
              <p className="text-xs font-semibold text-yellow-400/70 uppercase tracking-wider mb-2">{t("plan_premium_includes_plus")}</p>
              <ul className="space-y-2">
                {(["plan_benefit_plus_1","plan_benefit_plus_2","plan_benefit_plus_3","plan_benefit_plus_4","plan_benefit_plus_5","plan_benefit_plus_6","plan_benefit_plus_7"] as const).map((key) => (
                  <li key={key} className="flex items-start gap-2 text-sm">
                    <svg className="w-4 h-4 text-yellow-400/60 shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                    </svg>
                    <span className="text-foreground/80">{t(key)}</span>
                  </li>
                ))}
              </ul>
            </div>
          </div>

          <button
            disabled
            className="w-full mt-6 py-2.5 rounded-lg font-medium text-sm bg-yellow-500/20 border border-yellow-500/40 text-yellow-400 opacity-70 cursor-default"
          >
            {t("pricing_choose_premium")}
          </button>
          <p className="text-center text-xs text-muted/50 mt-2">{t("pricing_coming_soon_note")}</p>
        </div>
      </div>

      {/* Feature comparison table */}
      <div className="mt-10 max-w-4xl mx-auto">
        <h2 className="text-base font-semibold text-foreground mb-4">{t("plan_compare_title")}</h2>
        <div className="rounded-xl border border-border overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border bg-surface">
                <th className="text-left px-4 py-3 text-muted font-medium">{t("plan_feature")}</th>
                <th className="text-center px-4 py-3 text-muted font-medium">{t("plan_free")}</th>
                <th className="text-center px-4 py-3 text-accent font-semibold">{t("plan_plus")}</th>
                <th className="text-center px-4 py-3 text-yellow-400 font-semibold">{t("plan_premium")}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {features.map((f) => (
                <tr key={f.key} className="bg-card hover:bg-border/20 transition-colors">
                  <td className="px-4 py-3 text-foreground">{t(f.key)}</td>
                  <td className="px-4 py-3 text-center">{renderValue(f.free)}</td>
                  <td className="px-4 py-3 text-center">{renderValue(f.plus)}</td>
                  <td className="px-4 py-3 text-center">{renderValue(f.premium)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* FAQ */}
      <div className="mt-10 max-w-2xl mx-auto pb-4">
        <h2 className="text-base font-semibold text-foreground mb-4">{t("faq_upgrade_title")}</h2>
        <div className="rounded-xl border border-border overflow-hidden divide-y divide-border bg-surface">
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

      {/* Manage subscription — only visible for real Stripe subscribers */}
      {hasStripeSubscription && (
        <div className="mt-6 max-w-2xl mx-auto pb-2 flex justify-center">
          <button
            onClick={async () => {
              setIsPortalLoading(true);
              try {
                const res = await fetch("/api/stripe/portal", {
                  method: "POST",
                  headers: { "Content-Type": "application/json" },
                });
                const data = await res.json();
                if (!res.ok || !data.url) throw new Error(data.error || "Portal error");
                window.location.href = data.url;
              } catch (err) {
                console.error("[Manage subscription] Error:", err);
              } finally {
                setIsPortalLoading(false);
              }
            }}
            disabled={isPortalLoading}
            className="text-sm text-muted hover:text-accent transition-colors disabled:opacity-50 underline underline-offset-2"
          >
            {isPortalLoading ? t("upgrade_manage_subscription_loading") : t("upgrade_manage_subscription")}
          </button>
        </div>
      )}

      {/* Modal de bienvenue Plus */}
      <WelcomePlusModal
        isOpen={showWelcomeModal}
        onClose={handleCloseWelcomeModal}
        isPlanReady={isPlanReady}
      />

      {/* Toast de paiement annulé */}
      {showCanceledToast && (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50 bg-surface border border-border text-foreground px-6 py-3 rounded-lg shadow-lg flex items-center gap-3">
          <span className="text-muted">ℹ️</span>
          <span className="text-sm">{t("upgrade_canceled_message")}</span>
        </div>
      )}
    </div>
  );
}
