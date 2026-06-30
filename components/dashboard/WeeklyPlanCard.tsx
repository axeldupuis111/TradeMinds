"use client";

import { useEffect, useState } from "react";
import { useLanguage } from "@/lib/LanguageContext";
import Link from "next/link";
import { Sparkles, Target, Lock } from "lucide-react";

interface WeeklyPlan {
  headline: string;
  focuses: string[];
}

/**
 * Forward-looking "plan for the week": 3 AI discipline goals based on the last
 * 14 days. Self-contained — fetches its own data and renders loading / locked
 * (free plan) / empty / plan states, so it drops into the dashboard with one line.
 */
export default function WeeklyPlanCard() {
  const { t, lang } = useLanguage();
  const [loading, setLoading] = useState(true);
  const [locked, setLocked] = useState(false);
  const [plan, setPlan] = useState<WeeklyPlan | null>(null);

  useEffect(() => {
    let alive = true;
    setLoading(true);
    fetch("/api/weekly-plan", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ language: lang }),
    })
      .then((r) => r.json())
      .then((data: { locked?: boolean; plan?: WeeklyPlan | null }) => {
        if (!alive) return;
        setLocked(!!data.locked);
        setPlan(data.plan ?? null);
      })
      .catch(() => { if (alive) setPlan(null); })
      .finally(() => { if (alive) setLoading(false); });
    return () => { alive = false; };
  }, [lang]);

  const header = (
    <div className="flex items-center gap-2 mb-3">
      <Target className="w-4 h-4 text-accent shrink-0" strokeWidth={1.75} />
      <div>
        <h3 className="text-sm font-bold text-foreground leading-tight">{t("wplan_title")}</h3>
        <p className="text-[11px] text-foreground-muted">{t("wplan_subtitle")}</p>
      </div>
    </div>
  );

  if (loading) {
    return (
      <div className="rounded-xl border border-border bg-card p-5">
        {header}
        <div className="space-y-2">
          <div className="skeleton h-9 w-full rounded-lg" />
          <div className="skeleton h-9 w-full rounded-lg" />
          <div className="skeleton h-9 w-5/6 rounded-lg" />
        </div>
      </div>
    );
  }

  if (locked) {
    return (
      <div className="rounded-xl border border-gold/30 bg-gold/5 p-5">
        {header}
        <div className="flex items-center gap-3 mt-1">
          <Lock className="w-4 h-4 text-gold shrink-0" strokeWidth={1.75} />
          <p className="text-sm text-foreground-muted flex-1">{t("wplan_locked")}</p>
          <Link
            href="/dashboard/upgrade"
            className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg bg-gradient-to-r from-gold to-amber-500 text-black font-semibold text-xs hover:brightness-110 transition whitespace-nowrap"
          >
            <Sparkles className="w-3.5 h-3.5" /> {t("wplan_cta")}
          </Link>
        </div>
      </div>
    );
  }

  if (!plan) {
    return (
      <div className="rounded-xl border border-border bg-card p-5">
        {header}
        <p className="text-sm text-foreground-muted">{t("wplan_empty")}</p>
      </div>
    );
  }

  return (
    <div className="rounded-xl border border-accent/25 bg-accent/[0.04] p-5">
      {header}
      <p className="text-sm font-semibold text-foreground mb-3">{plan.headline}</p>
      <ol className="space-y-2">
        {plan.focuses.map((f, i) => (
          <li key={i} className="flex gap-3 rounded-lg border border-border bg-card p-3">
            <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-accent/15 text-[11px] font-bold text-accent">
              {i + 1}
            </span>
            <span className="text-sm text-foreground-muted leading-relaxed">{f}</span>
          </li>
        ))}
      </ol>
      <p className="mt-3 flex items-center gap-1.5 text-[11px] text-foreground-muted/80">
        <Sparkles className="w-3 h-3 text-accent" /> {t("wplan_ai")}
      </p>
    </div>
  );
}
