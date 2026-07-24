"use client";

import { useLanguage } from "@/lib/LanguageContext";
import { usePlan } from "@/lib/PlanContext";
import { track } from "@/lib/track";
import { WelcomePlusModal } from "@/components/upgrade/WelcomePlusModal";
import { FoundingBanner } from "@/components/FoundingBanner";
import { ATTRIBUTION_KEY, ATTRIBUTION_MAX_AGE_MS } from "@/components/AttributionCapture";
import { useSearchParams, useRouter, usePathname } from "next/navigation";
import { Fragment, useCallback, useEffect, useRef, useState } from "react";

import { PLAN_FEATURES as features, FREE_BENEFITS, PLUS_BENEFITS, PREMIUM_BENEFITS } from "@/lib/plan-features";

const faqKeys = [
  { q: "faq_upgrade_q1", a: "faq_upgrade_a1" },
  { q: "faq_upgrade_q2", a: "faq_upgrade_a2" },
  { q: "faq_upgrade_q3", a: "faq_upgrade_a3" },
  { q: "faq_upgrade_q4", a: "faq_upgrade_a4" },
];

export default function UpgradePage() {
  const { t, lang } = useLanguage();
  const { plan: currentPlan, refreshPlan, subscriptionStatus } = usePlan();
  const hasStripeSubscription = subscriptionStatus !== null;
  const [annual, setAnnual] = useState(false);
  const [showDowngradeModal, setShowDowngradeModal] = useState(false);
  const [downgrading, setDowngrading] = useState(false);
  const [openFaq, setOpenFaq] = useState<number | null>(null);
  const [checkoutLoadingPlan, setCheckoutLoadingPlan] = useState<"plus" | "premium" | null>(null);
  const [checkoutError, setCheckoutError] = useState<string | null>(null);
  const [isPortalLoading, setIsPortalLoading] = useState(false);

  // Changement de plan in-app (Plus <-> Premium)
  interface ChangePreview {
    isUpgrade: boolean;
    amountDueNow: number | null; // en centimes ; null = montant inconnu
    currency: string;
    periodEnd: number | null; // epoch seconds
  }
  const [changeTarget, setChangeTarget] = useState<"plus" | "premium" | null>(null);
  const [changePreview, setChangePreview] = useState<ChangePreview | null>(null);
  const [changeLoadingPreview, setChangeLoadingPreview] = useState(false);
  const [changeSubmitting, setChangeSubmitting] = useState(false);
  const [changeError, setChangeError] = useState<string | null>(null);
  const [changeSuccessMsg, setChangeSuccessMsg] = useState<string | null>(null);

  useEffect(() => {
    // Reset loading state on mount (handles browser back button restoring stale state)
    setCheckoutLoadingPlan(null);
    setCheckoutError(null);
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const [showWelcomeModal, setShowWelcomeModal] = useState(false);
  const [welcomePlan, setWelcomePlan] = useState<"plus" | "premium">("plus");
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
      // Plan acheté, capturé avant la redirection Stripe (titre correct immédiatement).
      const pending = typeof window !== "undefined" ? sessionStorage.getItem("td_pending_plan") : null;
      setWelcomePlan(pending === "premium" ? "premium" : "plus");
      if (typeof window !== "undefined") sessionStorage.removeItem("td_pending_plan");

      setShowWelcomeModal(true);
      router.replace(pathname, { scroll: false });

      let pollCount = 0;
      const maxPolls = 7;

      const checkPlan = async () => {
        pollCount++;
        await refreshPlan();

        const isPaid = currentPlan === "plus" || currentPlan === "premium";
        if (isPaid || pollCount >= 3) {
          setIsPlanReady(true);
        }
        if (isPaid || pollCount >= maxPolls) {
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

  // Ouvre le portail de facturation Stripe (seule source de vérité du plan).
  // L'annulation se fait dans Stripe ; c'est le webhook customer.subscription.deleted
  // qui repassera profiles.plan à 'free'. On n'écrit JAMAIS le plan directement côté client.
  async function openBillingPortal() {
    const res = await fetch("/api/stripe/portal", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
    });
    const data = await res.json();
    if (!res.ok || !data.url) throw new Error(data.error || "Portal error");
    window.location.href = data.url;
  }

  const changeInterval: "monthly" | "yearly" = annual ? "yearly" : "monthly";

  // Ouvre la modale de changement de plan et récupère l'aperçu (montant prorata).
  async function openPlanChange(targetPlan: "plus" | "premium") {
    setChangeTarget(targetPlan);
    setChangePreview(null);
    setChangeError(null);
    setChangeLoadingPreview(true);
    try {
      const res = await fetch("/api/stripe/change-plan", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ targetPlan, interval: changeInterval, mode: "preview" }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || t("planchange_error"));
      setChangePreview(data as ChangePreview);
    } catch (err) {
      console.error("[Plan change] Preview error:", err);
      setChangeError(err instanceof Error ? err.message : t("planchange_error"));
    } finally {
      setChangeLoadingPreview(false);
    }
  }

  async function confirmPlanChange() {
    if (!changeTarget) return;
    setChangeSubmitting(true);
    setChangeError(null);
    try {
      const res = await fetch("/api/stripe/change-plan", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ targetPlan: changeTarget, interval: changeInterval, mode: "commit" }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || t("planchange_error"));

      // Paiement non collecté (carte refusée ou 3DS requis) : Stripe a généré une
      // facture payable. On y redirige : l'utilisateur paie et/ou change de carte.
      if (data.paid === false && data.hostedInvoiceUrl) {
        window.location.href = data.hostedInvoiceUrl;
        return;
      }

      const wasUpgrade = changePreview?.isUpgrade ?? false;
      setChangeTarget(null);
      setChangePreview(null);
      setChangeSuccessMsg(wasUpgrade ? t("planchange_success_upgrade") : t("planchange_success_downgrade"));

      // profiles.plan est mis à jour de façon asynchrone par le webhook Stripe
      // (customer.subscription.updated). Pour un upgrade, on rafraîchit en boucle
      // jusqu'à ce que le nouveau plan soit visible, sinon l'UI reste sur l'ancien
      // plan jusqu'à un rechargement manuel.
      await refreshPlan();
      if (wasUpgrade) {
        let tries = 0;
        const poll = setInterval(async () => {
          tries += 1;
          await refreshPlan();
          if (tries >= 6) clearInterval(poll);
        }, 1500);
      }
      setTimeout(() => setChangeSuccessMsg(null), 6000);
    } catch (err) {
      console.error("[Plan change] Commit error:", err);
      setChangeError(err instanceof Error ? err.message : t("planchange_error"));
    } finally {
      setChangeSubmitting(false);
    }
  }

  // Wrapper UI : gère le loading + les erreurs autour de l'ouverture du portail.
  async function handleManagePortal() {
    setIsPortalLoading(true);
    try {
      await openBillingPortal();
    } catch (err) {
      console.error("[Manage subscription] Error:", err);
      setIsPortalLoading(false);
    }
  }

  async function handleDowngrade() {
    setDowngrading(true);
    try {
      await openBillingPortal();
      // Pas de setDowngrading(false) en cas de succès : redirection en cours vers Stripe.
    } catch (err) {
      console.error("[Downgrade] Error:", err);
      setShowDowngradeModal(false);
      setDowngrading(false);
    }
  }

  // Slug d'attribution capté à l'arrivée (AttributionCapture, first-touch) —
  // passé au checkout pour appliquer le code promo partenaire + attribuer la
  // commission. Ignoré s'il est absent ou hors fenêtre d'attribution.
  function referralCode(): string | undefined {
    if (typeof window === "undefined") return undefined;
    try {
      const raw = localStorage.getItem(ATTRIBUTION_KEY);
      if (!raw) return undefined;
      const { source, at } = JSON.parse(raw) as { source?: string; at?: number };
      if (!source || !at || Date.now() - at > ATTRIBUTION_MAX_AGE_MS) return undefined;
      return source;
    } catch {
      return undefined;
    }
  }

  async function handleCheckout(plan: "plus" | "premium") {
    setCheckoutLoadingPlan(plan);
    setCheckoutError(null);
    track("checkout_started", { plan, interval: annual ? "yearly" : "monthly" });

    try {
      const interval = annual ? "yearly" : "monthly";
      // Mémorise le plan acheté pour afficher le bon message de bienvenue au retour de Stripe.
      if (typeof window !== "undefined") sessionStorage.setItem("td_pending_plan", plan);

      const res = await fetch("/api/stripe/checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ plan, interval, locale: lang, ref: referralCode() }),
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
      setCheckoutLoadingPlan(null);
    }
  }

  // Libellé du montant récurrent après changement de plan, selon plan + intervalle courant du toggle.
  function recurringPriceLabel(plan: "plus" | "premium"): string {
    const amounts = {
      plus: { monthly: "14,99 €", yearly: "134,90 €" },
      premium: { monthly: "29,99 €", yearly: "269,90 €" },
    } as const;
    const unit = changeInterval === "monthly" ? t("plan_month") : t("plan_year");
    return `${amounts[plan][changeInterval]}/${unit}`;
  }

  function formatMoney(cents: number, currency: string): string {
    try {
      return new Intl.NumberFormat("fr-FR", { style: "currency", currency: currency.toUpperCase() }).format(cents / 100);
    } catch {
      return `${(cents / 100).toFixed(2)} €`;
    }
  }

  function formatDate(epochSeconds: number | null): string {
    if (!epochSeconds) return "—";
    return new Date(epochSeconds * 1000).toLocaleDateString("fr-FR", { day: "numeric", month: "long", year: "numeric" });
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
    // Autres clés i18n (ex. plan_taster_once) — traduites telles quelles.
    if (val.startsWith("plan_")) {
      return <span className="text-foreground text-sm">{t(val)}</span>;
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

      {/* Offre fondateur (utilisateurs free uniquement) — code LANCEMENT / partenaire */}
      {currentPlan === "free" && (
        <div className="max-w-4xl mx-auto mt-6">
          <FoundingBanner onClaim={() => handleCheckout("plus")} />
        </div>
      )}

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
                {FREE_BENEFITS.map((key) => (
                  <div key={key} className="flex items-start gap-2 text-sm">
                    <svg className="w-4 h-4 text-profit shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                    </svg>
                    <span className="text-foreground/85">{t(key)}</span>
                  </div>
                ))}
              </div>
              {currentPlan === "free" ? (
                <button
                  disabled
                  className="w-full mt-6 py-2.5 rounded-lg font-medium text-sm bg-surface text-muted cursor-default"
                >
                  {t("plan_current_plan")}
                </button>
              ) : (
                <button
                  onClick={() => setShowDowngradeModal(true)}
                  className="w-full mt-6 py-2.5 rounded-lg font-medium text-sm transition-colors bg-surface border border-border text-foreground hover:bg-border"
                >
                  {t("plan_downgrade_free")}
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
                    <span className="text-muted text-sm line-through">14.99€/{t("plan_month")}</span>
                  </div>
                  <div className="flex items-baseline gap-1">
                    <span className="text-3xl font-bold text-foreground">11.24€</span>
                    <span className="text-muted text-sm">/{t("plan_month")}</span>
                  </div>
                  <span className="inline-block mt-1 px-2 py-0.5 bg-profit/10 text-profit text-xs font-bold rounded-full">
                    {t("plan_two_months_free")}
                  </span>
                  <p className="text-muted text-xs mt-1">
                    {t("plan_billed_annual").replace("{price}", "134.90€")}
                  </p>
                </div>
              ) : (
                <div className="mt-3">
                  <div className="flex items-baseline gap-1">
                    <span className="text-3xl font-bold text-foreground">14.99€</span>
                    <span className="text-muted text-sm">/{t("plan_month")}</span>
                  </div>
                  <div className="h-8" />
                </div>
              )}

              <div className="mt-5 space-y-2.5 flex-1">
                {PLUS_BENEFITS.map((key) => (
                  <div key={key} className="flex items-start gap-2 text-sm">
                    <svg className="w-4 h-4 text-accent shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                    </svg>
                    <span className="text-foreground/85">{t(key)}</span>
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
              ) : currentPlan === "free" ? (
                <>
                  <button
                    onClick={() => handleCheckout("plus")}
                    disabled={checkoutLoadingPlan !== null}
                    className="w-full mt-6 py-2.5 rounded-lg font-medium text-sm bg-accent text-white hover:bg-accent-hover transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {checkoutLoadingPlan === "plus" ? t("upgrade_redirecting") : t("pricing_choose_plus")}
                  </button>
                  {checkoutError && (
                    <p className="text-red-500 text-sm mt-2 text-center">{checkoutError}</p>
                  )}
                </>
              ) : (
                <button
                  onClick={() => openPlanChange("plus")}
                  disabled={changeLoadingPreview && changeTarget === "plus"}
                  className="w-full mt-6 py-2.5 rounded-lg font-medium text-sm bg-surface border border-border text-foreground hover:bg-border transition-colors disabled:opacity-50"
                >
                  {changeLoadingPreview && changeTarget === "plus" ? t("planchange_loading") : t("planchange_to_plus")}
                </button>
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
                <span className="text-muted text-sm line-through">29,99€/{t("plan_month")}</span>
              </div>
              <div className="flex items-baseline gap-1">
                <span className="text-3xl font-bold text-foreground">22,49€</span>
                <span className="text-muted text-sm">/{t("plan_month")}</span>
              </div>
              <span className="inline-block mt-1 px-2 py-0.5 bg-profit/10 text-profit text-xs font-bold rounded-full">
                {t("plan_two_months_free")}
              </span>
              <p className="text-muted text-xs mt-1">
                {t("plan_billed_annual").replace("{price}", "269.90€")}
              </p>
            </div>
          ) : (
            <div className="mt-3">
              <div className="flex items-baseline gap-1">
                <span className="text-3xl font-bold text-foreground">29,99€</span>
                <span className="text-muted text-sm">/{t("plan_month")}</span>
              </div>
              <div className="h-8" />
            </div>
          )}

          {/* Exclusive features + Plus includes — flex-1 pushes CTA to card bottom */}
          <div className="flex-1">
            <p className="mt-2 mb-2 text-xs font-semibold text-yellow-400 uppercase tracking-wider">{t("plan_premium_exclusives")}</p>
            <ul className="space-y-2">
              {PREMIUM_BENEFITS.map((key) => (
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

          {currentPlan === "premium" ? (
            <button
              disabled
              className="w-full mt-6 py-2.5 rounded-lg font-medium text-sm bg-surface text-muted cursor-default"
            >
              {t("plan_current_plan")}
            </button>
          ) : currentPlan === "free" ? (
            <button
              onClick={() => handleCheckout("premium")}
              disabled={checkoutLoadingPlan !== null}
              className="w-full mt-6 py-2.5 rounded-lg font-medium text-sm bg-yellow-500/20 border border-yellow-500/40 text-yellow-400 hover:bg-yellow-500/30 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {checkoutLoadingPlan === "premium" ? t("upgrade_redirecting") : t("pricing_choose_premium")}
            </button>
          ) : (
            <button
              onClick={() => openPlanChange("premium")}
              disabled={changeLoadingPreview && changeTarget === "premium"}
              className="w-full mt-6 py-2.5 rounded-lg font-medium text-sm bg-yellow-500/20 border border-yellow-500/40 text-yellow-400 hover:bg-yellow-500/30 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {changeLoadingPreview && changeTarget === "premium" ? t("planchange_loading") : t("planchange_to_premium")}
            </button>
          )}
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
                <Fragment key={f.key}>
                  {f.groupKey && (
                    <tr className="bg-surface/60">
                      <td colSpan={4} className="px-4 py-2 text-[11px] font-bold uppercase tracking-wider text-muted">{t(f.groupKey)}</td>
                    </tr>
                  )}
                  <tr className="bg-card hover:bg-border/20 transition-colors">
                    <td className="px-4 py-3 text-foreground">{t(f.key)}</td>
                    <td className="px-4 py-3 text-center">{renderValue(f.free)}</td>
                    <td className="px-4 py-3 text-center">{renderValue(f.plus)}</td>
                    <td className="px-4 py-3 text-center">{renderValue(f.premium)}</td>
                  </tr>
                </Fragment>
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
            onClick={handleManagePortal}
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
        plan={welcomePlan}
      />

      {/* Toast de paiement annulé */}
      {showCanceledToast && (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50 bg-surface border border-border text-foreground px-6 py-3 rounded-lg shadow-lg flex items-center gap-3">
          <span className="text-muted">ℹ️</span>
          <span className="text-sm">{t("upgrade_canceled_message")}</span>
        </div>
      )}

      {/* Modale de changement de plan (Plus <-> Premium) */}
      {changeTarget && (
        <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4">
          <div className="bg-card border border-border rounded-xl p-6 max-w-md w-full shadow-xl">
            <h3 className="text-lg font-bold text-foreground mb-3">
              {changeTarget === "premium" ? t("planchange_to_premium") : t("planchange_to_plus")}
            </h3>

            {changeLoadingPreview ? (
              <p className="text-muted text-sm mb-5">{t("planchange_loading")}</p>
            ) : changePreview?.isUpgrade ? (
              <div className="text-sm text-muted space-y-2 mb-5">
                <p>
                  {changePreview.amountDueNow != null
                    ? t("planchange_upgrade_now").replace(
                        "{amount}",
                        formatMoney(changePreview.amountDueNow, changePreview.currency)
                      )
                    : t("planchange_upgrade_now_generic")}
                </p>
                <p>{t("planchange_recurring").replace("{price}", recurringPriceLabel("premium"))}</p>
              </div>
            ) : changePreview ? (
              <div className="text-sm text-muted space-y-2 mb-5">
                <p>{t("planchange_downgrade_keep").replace("{date}", formatDate(changePreview.periodEnd))}</p>
                <p>{t("planchange_downgrade_then").replace("{price}", recurringPriceLabel("plus"))}</p>
              </div>
            ) : null}

            {changeError && (
              <p className="text-red-500 text-sm mb-4">{changeError}</p>
            )}

            <div className="flex gap-3">
              <button
                onClick={() => { setChangeTarget(null); setChangePreview(null); setChangeError(null); }}
                disabled={changeSubmitting}
                className="flex-1 py-2.5 rounded-lg border border-border text-foreground text-sm hover:bg-border transition-colors disabled:opacity-50"
              >
                {t("planchange_cancel")}
              </button>
              <button
                onClick={confirmPlanChange}
                disabled={changeSubmitting || changeLoadingPreview || !changePreview}
                className="flex-1 py-2.5 rounded-lg bg-accent text-white text-sm font-medium hover:bg-accent-hover transition-colors disabled:opacity-50"
              >
                {changeSubmitting ? t("planchange_processing") : t("planchange_confirm")}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Toast de succès de changement de plan */}
      {changeSuccessMsg && (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50 bg-surface border border-border text-foreground px-6 py-3 rounded-lg shadow-lg flex items-center gap-3">
          <span className="text-profit">✓</span>
          <span className="text-sm">{changeSuccessMsg}</span>
        </div>
      )}
    </div>
  );
}
