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
      {/* Flux simple plutôt qu'un groupe central en `absolute left-1/2` :
          l'ancien centrage absolu n'avait aucune relation de flux avec le
          groupe de droite, si bien que « Blog » et « FAQ » se chevauchaient
          (on lisait « BFAQ »). Ici les trois groupes sont des éléments flex,
          donc le recouvrement est impossible.
          Les ancres sont posées à gauche, contre le logo, et non centrées sur
          la page : le groupe de droite (Blog, Installer, langue, connexion,
          CTA) est trop large pour qu'un vrai centrage tienne sans revenir au
          chevauchement. C'est le motif classique des en-têtes SaaS, et ça se
          lit comme un choix plutôt que comme un décentrage accidentel. */}
      <div className="max-w-6xl mx-auto px-6 h-14 flex items-center">
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

        {/* Ancres de section — uniquement sur la landing.
            `lg` et non `md` : maintenant qu'elles sont dans le flux, elles
            poussent le groupe de droite. À 768px le CTA « Commencer » sortait
            de l'écran de 50px. À partir de 1024px la place est là. */}
        {showAnchors && (
          /* L'écart avec le logo est porté par les ancres (`ml-8`) et non par
             un `gap` sur le conteneur : un gap s'appliquerait aussi quand les
             ancres sont masquées, et poussait le CTA 22px au-delà du padding
             en mobile. */
          <div className="hidden lg:flex items-center gap-6 shrink-0 ml-8">
            <a href="#features" className="text-sm text-foreground-muted hover:text-foreground transition-colors">
              {t("nav_features")}
            </a>
            <a href="#pricing" className="text-sm text-foreground-muted hover:text-foreground transition-colors">
              {t("nav_pricing")}
            </a>
            <a href="#faq" className="text-sm text-foreground-muted hover:text-foreground transition-colors">
              {t("nav_faq")}
            </a>
          </div>
        )}

        {/* Right side — `ml-auto` le pousse à droite quelle que soit la
            présence des ancres, donc plus besoin de piste vide. */}
        <div className="flex items-center gap-2 ml-auto shrink-0">
          <Link
            href={localizedHref("/blog", lang)}
            className="hidden sm:inline text-sm text-foreground-muted hover:text-foreground transition-colors px-3 py-1.5"
          >
            Blog
          </Link>
          <InstallAppButton className="hidden md:inline-flex items-center gap-1.5 text-sm text-foreground-muted hover:text-foreground transition-colors px-3 py-1.5" />
          <LanguageSelector />
          <Link
            href={localizedHref("/login", lang)}
            className="hidden sm:inline text-sm text-foreground-muted hover:text-foreground transition-colors px-3 py-1.5"
          >
            {t("nav_login")}
          </Link>
          <Link
            href={localizedHref("/login", lang)}
            className="text-sm px-4 py-1.5 bg-accent text-on-accent rounded-lg font-semibold hover:bg-accent-hover glow-accent btn-scale"
          >
            {t("nav_start")}
          </Link>
        </div>
      </div>
    </nav>
  );
}
