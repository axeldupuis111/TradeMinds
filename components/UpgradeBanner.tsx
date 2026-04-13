"use client";

import { useLanguage } from "@/lib/LanguageContext";
import Link from "next/link";

export default function UpgradeBanner({ message }: { message: string }) {
  const { t } = useLanguage();

  return (
    <div className="relative rounded-xl border border-accent/30 bg-accent/5 p-6 text-center">
      <div className="flex flex-col items-center gap-3">
        <svg className="w-10 h-10 text-accent" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
        </svg>
        <p className="text-foreground font-medium">{message}</p>
        <Link
          href="/dashboard/upgrade"
          className="mt-1 px-5 py-2 bg-accent text-white rounded-lg font-medium hover:bg-blue-600 transition-colors"
        >
          {t("plan_upgrade_btn")}
        </Link>
      </div>
    </div>
  );
}
