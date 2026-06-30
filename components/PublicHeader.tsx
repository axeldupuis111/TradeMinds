"use client";

import Link from "next/link";
import { useLanguage } from "@/lib/LanguageContext";
import { localizedHref } from "@/lib/locale-href";
import LanguageSelector from "@/components/LanguageSelector";
import InstallAppButton from "@/components/InstallAppButton";

interface PublicHeaderProps {
  showAnchors?: boolean;
}

export default function PublicHeader({ showAnchors = false }: PublicHeaderProps) {
  const { lang, t } = useLanguage();

  return (
    <nav className="fixed top-0 left-0 right-0 z-50 border-b border-border bg-background/80 backdrop-blur-[12px]">
      <div className="max-w-6xl mx-auto px-6 h-14 relative flex items-center justify-between">
        {/* Logo */}
        <Link href={localizedHref("/", lang)} className="flex items-center gap-2 shrink-0">
          <div className="w-6 h-6 flex items-center justify-center rounded-md bg-accent/20">
            <svg
              className="w-3.5 h-3.5 text-accent"
              fill="none"
              stroke="currentColor"
              strokeWidth={2}
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M2.25 18L9 11.25l4.306 4.307a11.95 11.95 0 015.814-5.519l2.74-1.22m0 0l-5.94-2.28m5.94 2.28l-2.28 5.941"
              />
            </svg>
          </div>
          <span className="text-[15px] font-bold text-foreground tracking-tight">
            TradeDiscipline
          </span>
        </Link>

        {/* Centre links — only on landing (when showAnchors is true) */}
        {showAnchors && (
          <div className="hidden md:flex items-center gap-6 absolute left-1/2 -translate-x-1/2">
            <a href="#features" className="text-sm text-muted hover:text-foreground transition-colors">
              {t("nav_features")}
            </a>
            <a href="#pricing" className="text-sm text-muted hover:text-foreground transition-colors">
              {t("nav_pricing")}
            </a>
            <a href="#faq" className="text-sm text-muted hover:text-foreground transition-colors">
              {t("nav_faq")}
            </a>
          </div>
        )}

        {/* Right side */}
        <div className="flex items-center gap-2">
          {/* Blog — single URL, content adapts to the visitor's language */}
          <Link
            href="/blog"
            className="hidden sm:inline text-sm text-muted hover:text-foreground transition-colors px-3 py-1.5"
          >
            Blog
          </Link>
          <InstallAppButton className="hidden md:inline-flex items-center gap-1.5 text-sm text-muted hover:text-foreground transition-colors px-3 py-1.5" />
          <LanguageSelector />
          <Link
            href={localizedHref("/login", lang)}
            className="hidden sm:inline text-sm text-muted hover:text-foreground transition-colors px-3 py-1.5"
          >
            {t("nav_login")}
          </Link>
          <Link
            href={localizedHref("/login", lang)}
            className="text-sm px-4 py-1.5 bg-accent text-white rounded-lg font-semibold hover:bg-blue-600 glow-blue btn-scale"
          >
            {t("nav_start")}
          </Link>
        </div>
      </div>
    </nav>
  );
}
