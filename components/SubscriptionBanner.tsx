"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { usePlan } from "@/lib/PlanContext";
import { useLanguage } from "@/lib/LanguageContext";

export function SubscriptionBanner() {
  const { subscriptionStatus, cancelAtPeriodEnd, currentPeriodEnd } = usePlan();
  const { t, lang } = useLanguage();
  const router = useRouter();
  const [isLoading, setIsLoading] = useState(false);

  if (subscriptionStatus !== "past_due" && !cancelAtPeriodEnd) {
    return null;
  }

  const handleOpenPortal = async () => {
    setIsLoading(true);
    try {
      const res = await fetch("/api/stripe/portal", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
      });
      const data = await res.json();

      if (!res.ok || !data.url) {
        throw new Error(data.error || "Failed to open portal");
      }

      window.location.href = data.url;
    } catch (error) {
      console.error("[SubscriptionBanner] Error:", error);
      router.push("/dashboard/upgrade");
    }
  };

  const formatDate = (date: Date) => {
    const locale = lang === "en" ? "en-US" : lang === "de" ? "de-DE" : lang === "es" ? "es-ES" : "fr-FR";
    return new Intl.DateTimeFormat(locale, {
      day: "numeric",
      month: "long",
      year: "numeric",
    }).format(date);
  };

  if (subscriptionStatus === "past_due") {
    return (
      <div className="bg-orange-500/10 border-b border-orange-500/20 px-4 py-3">
        <div className="max-w-7xl mx-auto flex items-center justify-between gap-4">
          <div className="flex items-center gap-3 min-w-0">
            <span className="text-lg shrink-0">⚠️</span>
            <p className="text-sm text-foreground">
              <span className="font-semibold">{t("banner_past_due_title")}</span>
              {" — "}
              {t("banner_past_due_message")}
            </p>
          </div>
          <button
            onClick={handleOpenPortal}
            disabled={isLoading}
            className="shrink-0 text-sm font-medium text-orange-500 hover:underline disabled:opacity-50"
          >
            {isLoading ? t("banner_loading") : t("banner_past_due_cta")}
          </button>
        </div>
      </div>
    );
  }

  if (cancelAtPeriodEnd && currentPeriodEnd) {
    return (
      <div className="bg-surface border-b border-border px-4 py-3">
        <div className="max-w-7xl mx-auto flex items-center justify-between gap-4">
          <div className="flex items-center gap-3 min-w-0">
            <span className="text-lg shrink-0">ℹ️</span>
            <p className="text-sm text-foreground">
              {t("banner_canceling_message")}{" "}
              <span className="font-semibold">{formatDate(currentPeriodEnd)}</span>.
            </p>
          </div>
          <button
            onClick={handleOpenPortal}
            disabled={isLoading}
            className="shrink-0 text-sm font-medium text-accent hover:underline disabled:opacity-50"
          >
            {isLoading ? t("banner_loading") : t("banner_canceling_cta")}
          </button>
        </div>
      </div>
    );
  }

  return null;
}
