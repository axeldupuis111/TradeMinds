"use client";

import { useLanguage } from "@/lib/LanguageContext";
import { LanguageProvider } from "@/lib/LanguageContext";
import { ThemeProvider } from "@/lib/ThemeContext";
import Link from "next/link";

function NotFoundContent() {
  const { t } = useLanguage();

  return (
    <div className="min-h-screen bg-background flex flex-col items-center justify-center p-6 text-center">
      <div className="max-w-md">
        <p className="text-8xl font-bold text-foreground/10 tabular-nums select-none mb-6">404</p>
        <h1 className="text-2xl font-bold text-foreground mb-3">{t("notfound_title")}</h1>
        <p className="text-muted mb-8">{t("notfound_subtitle")}</p>
        <Link
          href="/dashboard"
          className="inline-flex items-center gap-2 px-6 py-3 bg-accent text-white rounded-lg font-medium hover:bg-blue-600 transition-colors"
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M10 19l-7-7m0 0l7-7m-7 7h18" />
          </svg>
          {t("notfound_cta")}
        </Link>
      </div>
    </div>
  );
}

export default function NotFound() {
  return (
    <ThemeProvider>
      <LanguageProvider>
        <NotFoundContent />
      </LanguageProvider>
    </ThemeProvider>
  );
}
