"use client";

import { useLanguage } from "@/lib/LanguageContext";
import { useRouter } from "next/navigation";

export default function DashboardError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  const { t } = useLanguage();
  const router = useRouter();
  const isDev = process.env.NODE_ENV !== "production";

  return (
    <div className="min-h-[60vh] flex items-center justify-center px-4">
      <div className="max-w-md w-full bg-card border border-border rounded-2xl p-8 shadow-lg text-center">
        <div className="w-12 h-12 mx-auto mb-4 rounded-full bg-loss/10 flex items-center justify-center">
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="rgb(239 68 68)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <circle cx="12" cy="12" r="10" />
            <line x1="12" y1="8" x2="12" y2="12" />
            <line x1="12" y1="16" x2="12.01" y2="16" />
          </svg>
        </div>

        <h2 className="text-xl font-bold text-foreground mb-2">
          {t("error_title")}
        </h2>
        <p className="text-sm text-muted mb-6">
          {t("error_subtitle")}
        </p>

        {isDev && error?.message && (
          <pre className="text-xs text-left bg-surface border border-border rounded-lg p-3 mb-6 overflow-x-auto max-h-40 text-loss/80">
            {error.message}
            {error.stack && `\n\n${error.stack}`}
          </pre>
        )}

        <div className="flex gap-3 justify-center">
          <button
            onClick={reset}
            className="px-4 py-2 bg-accent text-on-accent rounded-lg text-sm font-medium hover:bg-accent-hover transition-colors btn-scale"
          >
            {t("error_retry")}
          </button>
          <button
            onClick={() => router.push("/dashboard")}
            className="px-4 py-2 bg-surface border border-border text-foreground rounded-lg text-sm font-medium hover:bg-border transition-colors btn-scale"
          >
            {t("error_back_dashboard")}
          </button>
        </div>
      </div>
    </div>
  );
}
