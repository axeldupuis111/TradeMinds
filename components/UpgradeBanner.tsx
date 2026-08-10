"use client";

import { useLanguage } from "@/lib/LanguageContext";
import { Lock, Sparkles } from "lucide-react";
import Link from "next/link";

export default function UpgradeBanner({ message }: { message: string }) {
  const { t } = useLanguage();

  return (
    <div className="relative overflow-hidden rounded-xl border border-accent/25 bg-gradient-to-br from-accent/[0.08] via-card to-card p-8 text-center card-inset">
      {/* Halo décoratif */}
      <div
        aria-hidden
        className="pointer-events-none absolute -top-16 left-1/2 -translate-x-1/2 w-72 h-40 rounded-full bg-accent/10 blur-3xl"
      />
      <div className="relative flex flex-col items-center gap-3">
        <span className="flex w-12 h-12 items-center justify-center rounded-2xl bg-accent/10 ring-1 ring-accent/30">
          <Lock className="w-5 h-5 text-accent" strokeWidth={1.75} />
        </span>
        <p className="text-foreground font-semibold">{message}</p>
        <Link
          href="/dashboard/upgrade"
          className="mt-1 inline-flex items-center gap-2 px-5 py-2.5 bg-accent text-on-accent rounded-lg font-medium hover:bg-accent-hover transition-colors btn-primary-shimmer glow-accent"
        >
          <Sparkles className="w-4 h-4" strokeWidth={1.75} />
          {t("plan_upgrade_btn")}
        </Link>
      </div>
    </div>
  );
}
