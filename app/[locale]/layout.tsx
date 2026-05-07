import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { locales, type Locale, ogLocaleMap } from "@/i18n/config";

const SITE_URL = "https://tradediscipline.app";

const metaByLocale: Record<Locale, { title: string; description: string }> = {
  en: {
    title: "TradeDiscipline — Stop repeating the same mistakes",
    description:
      "The AI that turns your trading journal into a personal coach. It detects your destructive patterns, measures your discipline and tells you exactly what is costing you money.",
  },
  fr: {
    title: "TradeDiscipline — Arrête de répéter les mêmes erreurs",
    description:
      "L'IA qui transforme ton journal de trading en coach personnel. Elle détecte tes patterns destructeurs, mesure ta discipline et te dit exactement ce qui te coûte de l'argent.",
  },
  de: {
    title: "TradeDiscipline — Hör auf, dieselben Fehler zu wiederholen",
    description:
      "Die KI, die dein Trading-Journal in einen persönlichen Coach verwandelt. Sie erkennt deine destruktiven Muster, misst deine Disziplin und sagt dir genau, was dich Geld kostet.",
  },
  es: {
    title: "TradeDiscipline — Deja de repetir los mismos errores",
    description:
      "La IA que convierte tu diario de trading en un coach personal. Detecta tus patrones destructivos, mide tu disciplina y te dice exactamente qué te está costando dinero.",
  },
};

export function generateStaticParams() {
  // On ne génère QUE les langues non-défaut. La défaut (en) est servie par app/page.tsx à la racine.
  return locales.filter((l) => l !== "en").map((locale) => ({ locale }));
}

export async function generateMetadata({
  params,
}: {
  params: { locale: string };
}): Promise<Metadata> {
  const locale = params.locale as Locale;
  if (!(locales as readonly string[]).includes(locale)) return {};

  const meta = metaByLocale[locale];
  const path = locale === "en" ? "" : `/${locale}`;

  return {
    metadataBase: new URL(SITE_URL),
    title: meta.title,
    description: meta.description,
    alternates: {
      canonical: `${SITE_URL}${path}`,
      languages: {
        en: `${SITE_URL}/`,
        fr: `${SITE_URL}/fr`,
        de: `${SITE_URL}/de`,
        es: `${SITE_URL}/es`,
        "x-default": `${SITE_URL}/`,
      },
    },
    openGraph: {
      title: meta.title,
      description: meta.description,
      url: `${SITE_URL}${path}`,
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

export default function LocaleLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: { locale: string };
}) {
  const locale = params.locale as Locale;
  // Si la locale n'existe pas OU si c'est "en" (qui doit être servie par /), on renvoie 404
  if (!(locales as readonly string[]).includes(locale) || locale === "en") {
    notFound();
  }
  return <>{children}</>;
}
