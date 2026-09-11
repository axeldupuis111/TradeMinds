"use client";

import { useLanguage } from "@/lib/LanguageContext";
import { createClient } from "@/lib/supabase/client";
import { useEffect, useState } from "react";
import { LanguageProvider } from "@/lib/LanguageContext";
import { ThemeProvider } from "@/lib/ThemeContext";
import Link from "next/link";

/**
 * ⚠️⚠️ « RETOUR AU TABLEAU DE BORD » ENVOYAIT LES VISITEURS SUR UNE PAGE DE
 * CONNEXION. Cette page répond à TOUTES les adresses inconnues, y compris
 * celles d'un lecteur qui suit un lien cassé depuis le blog ou un réseau
 * social : il n'a pas de compte, le middleware renvoie `/dashboard` vers
 * `/login`, et son erreur 404 se termine par un formulaire. Le seul bouton
 * d'une page d'erreur doit mener quelque part d'utile pour celui qui la voit.
 *
 * ⚠️ TANT QU'ON NE SAIT PAS, ON VISE L'ACCUEIL : c'est la destination qui
 * marche pour les deux, et elle mène au tableau de bord en un clic de plus
 * pour qui est connecté.
 */
function NotFoundContent() {
  const { t } = useLanguage();
  const [connecte, setConnecte] = useState<boolean | null>(null);

  useEffect(() => {
    let annule = false;
    (async () => {
      try {
        const { data } = await createClient().auth.getUser();
        if (!annule) setConnecte(!!data.user);
      } catch {
        // Session illisible : on reste sur l'accueil, qui marche pour tout le monde.
        if (!annule) setConnecte(false);
      }
    })();
    return () => {
      annule = true;
    };
  }, []);

  const versLeTableau = connecte === true;

  return (
    <div className="min-h-screen bg-background flex flex-col items-center justify-center p-6 text-center">
      <div className="max-w-md">
        <p className="text-8xl font-bold text-foreground/10 tabular-nums select-none mb-6">404</p>
        <h1 className="text-2xl font-bold text-foreground mb-3">{t("notfound_title")}</h1>
        <p className="text-muted mb-8">{t("notfound_subtitle")}</p>
        <Link
          href={versLeTableau ? "/dashboard" : "/"}
          className="inline-flex items-center gap-2 px-6 py-3 bg-accent text-on-accent rounded-lg font-medium hover:bg-accent-hover transition-colors"
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M10 19l-7-7m0 0l7-7m-7 7h18" />
          </svg>
          {versLeTableau ? t("notfound_cta") : t("notfound_cta_home")}
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
