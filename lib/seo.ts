import type { Metadata } from "next";
import { locales, type Locale, ogLocaleMap } from "@/i18n/config";

/**
 * Métadonnées SEO de la landing — source de vérité unique.
 *
 * La landing anglaise est servie à la racine par app/page.tsx (hors segment
 * [locale]) : avant cette factorisation, son bloc title/description/hreflang/
 * OpenGraph était recopié à la main depuis app/[locale]/layout.tsx et les deux
 * copies divergeaient silencieusement. Les deux endroits appellent désormais
 * landingMetadata(locale).
 */

export const SITE_URL = "https://tradediscipline.app";

// Titres : marque + mot-clé métier (« journal de trading », "AI trading
// journal") — c'est ce que Google matche sur les requêtes catégorie, et ça
// ancre l'entité TradeDiscipline (sans quoi Google corrige la recherche
// « tradediscipline » en « trade discipline »). L'accroche transformation
// reste dans la description et le hero de la landing.
const LANDING_META: Record<Locale, { title: string; description: string }> = {
  en: {
    title: "TradeDiscipline: AI trading journal & discipline coach",
    description:
      "Stop repeating the same mistakes. The AI that turns your trading journal into a personal coach: it detects your destructive patterns, measures your discipline and tells you exactly what is costing you money.",
  },
  fr: {
    title: "TradeDiscipline : journal de trading IA et coach discipline",
    description:
      "Arrête de répéter les mêmes erreurs. L'IA qui transforme ton journal de trading en coach personnel : elle détecte tes patterns destructeurs, mesure ta discipline et te dit exactement ce qui te coûte de l'argent.",
  },
  de: {
    title: "TradeDiscipline: KI-Trading-Tagebuch & Disziplin-Coach",
    description:
      "Hör auf, dieselben Fehler zu wiederholen. Die KI, die dein Trading-Journal in einen persönlichen Coach verwandelt: Sie erkennt deine destruktiven Muster, misst deine Disziplin und sagt dir genau, was dich Geld kostet.",
  },
  es: {
    title: "TradeDiscipline: diario de trading con IA y coach de disciplina",
    description:
      "Deja de repetir los mismos errores. La IA que convierte tu diario de trading en un coach personal: detecta tus patrones destructivos, mide tu disciplina y te dice exactamente qué te está costando dinero.",
  },
};

/** hreflang partagé : la version EN vit à la racine, les autres sous /{locale}. */
const LANGUAGE_ALTERNATES = {
  en: `${SITE_URL}/`,
  fr: `${SITE_URL}/fr`,
  de: `${SITE_URL}/de`,
  es: `${SITE_URL}/es`,
  "x-default": `${SITE_URL}/`,
};

export function landingMetadata(locale: Locale): Metadata {
  if (!(locales as readonly string[]).includes(locale)) return {};
  const meta = LANDING_META[locale];
  const path = locale === "en" ? "" : `/${locale}`;

  return {
    metadataBase: new URL(SITE_URL),
    title: meta.title,
    description: meta.description,
    alternates: {
      canonical: `${SITE_URL}${path || "/"}`,
      languages: LANGUAGE_ALTERNATES,
    },
    openGraph: {
      title: meta.title,
      description: meta.description,
      url: `${SITE_URL}${path || "/"}`,
      siteName: "TradeDiscipline",
      locale: ogLocaleMap[locale],
      type: "website",
    },
    twitter: {
      card: "summary_large_image",
      title: meta.title,
      description: meta.description,
    },
    robots: {
      index: true,
      follow: true,
      googleBot: { index: true, follow: true },
    },
  };
}
