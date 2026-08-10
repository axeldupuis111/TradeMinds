"use client";

import { useEffect, useState } from "react";
import { useLanguage } from "@/lib/LanguageContext";
import { Download, X } from "lucide-react";

/**
 * "Install the app" button. Lets users install the PWA directly from the site
 * (instead of digging into the browser menu).
 *
 * - Chrome / Edge / Android: captures the `beforeinstallprompt` event and
 *   triggers the native install dialog on click.
 * - iOS (Safari has no beforeinstallprompt): shows the manual "Add to Home
 *   Screen" instructions instead.
 * - Renders nothing when the app is already installed or can't be installed,
 *   so it never clutters the UI.
 */

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
}

export default function InstallAppButton({ className }: { className?: string }) {
  const { t } = useLanguage();
  const [deferred, setDeferred] = useState<BeforeInstallPromptEvent | null>(null);
  const [isIOS, setIsIOS] = useState(false);
  const [installed, setInstalled] = useState(false);
  const [showIOS, setShowIOS] = useState(false);

  useEffect(() => {
    // Detect "already installed / running as an app". iOS Safari doesn't support
    // the display-mode media query on older versions — it exposes the legacy
    // `navigator.standalone` flag instead, so check both.
    const standalone =
      window.matchMedia("(display-mode: standalone)").matches ||
      (window.navigator as { standalone?: boolean }).standalone === true;
    if (standalone) {
      setInstalled(true);
      return;
    }
    const ua = window.navigator.userAgent;
    setIsIOS(/iphone|ipad|ipod/i.test(ua));

    const onPrompt = (e: Event) => {
      e.preventDefault();
      setDeferred(e as BeforeInstallPromptEvent);
    };
    const onInstalled = () => setInstalled(true);
    window.addEventListener("beforeinstallprompt", onPrompt);
    window.addEventListener("appinstalled", onInstalled);
    return () => {
      window.removeEventListener("beforeinstallprompt", onPrompt);
      window.removeEventListener("appinstalled", onInstalled);
    };
  }, []);

  // Only show when actionable: a captured prompt (Chrome/Edge/Android) or iOS.
  if (installed || (!deferred && !isIOS)) return null;

  async function handleClick() {
    if (deferred) {
      await deferred.prompt();
      await deferred.userChoice;
      setDeferred(null);
    } else if (isIOS) {
      setShowIOS(true);
    }
  }

  return (
    <>
      <button
        type="button"
        onClick={handleClick}
        className={
          className ??
          "inline-flex items-center gap-2 rounded-lg border border-border bg-surface px-4 py-2 text-sm font-medium text-foreground transition-colors hover:bg-border/40"
        }
      >
        <Download className="h-4 w-4" strokeWidth={2} />
        {t("install_app")}
      </button>

      {showIOS && (
        <div
          className="fixed inset-0 z-[120] flex items-center justify-center bg-black/60 p-4"
          onClick={() => setShowIOS(false)}
          role="dialog"
          aria-modal="true"
        >
          <div
            className="relative w-full max-w-sm rounded-2xl border border-border bg-card p-6 text-center"
            onClick={(e) => e.stopPropagation()}
          >
            <button
              onClick={() => setShowIOS(false)}
              aria-label={t("install_close")}
              className="absolute right-3 top-3 text-muted hover:text-foreground"
            >
              <X className="h-4 w-4" />
            </button>
            <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-xl bg-accent/15">
              <Download className="h-6 w-6 text-accent" strokeWidth={1.75} />
            </div>
            <h3 className="text-base font-bold text-foreground">{t("install_ios_title")}</h3>
            <p className="mt-2 text-sm text-muted leading-relaxed">{t("install_ios_step")}</p>
            <button
              onClick={() => setShowIOS(false)}
              className="mt-5 w-full rounded-lg bg-accent px-4 py-2.5 text-sm font-semibold text-on-accent transition hover:bg-accent-hover"
            >
              {t("install_close")}
            </button>
          </div>
        </div>
      )}
    </>
  );
}
