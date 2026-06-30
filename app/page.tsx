import type { Metadata } from "next";
import LandingPage from "@/components/landing/LandingPage";
import { ogLocaleMap } from "@/i18n/config";

const SITE_URL = "https://tradediscipline.app";

// The default (English) landing is served here at `/`, NOT through the
// `[locale]` layout — so it needs its own rich metadata. We mirror the
// `[locale]` version (title/description/hreflang/OpenGraph/Twitter) so the most
// important SEO page is no longer the weakest one.
export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title: "TradeDiscipline — Stop repeating the same mistakes",
  description:
    "The AI that turns your trading journal into a personal coach. It detects your destructive patterns, measures your discipline and tells you exactly what is costing you money.",
  alternates: {
    canonical: `${SITE_URL}/`,
    languages: {
      en: `${SITE_URL}/`,
      fr: `${SITE_URL}/fr`,
      de: `${SITE_URL}/de`,
      es: `${SITE_URL}/es`,
      "x-default": `${SITE_URL}/`,
    },
  },
  openGraph: {
    title: "TradeDiscipline — Stop repeating the same mistakes",
    description:
      "The AI that turns your trading journal into a personal coach. It detects your destructive patterns, measures your discipline and tells you exactly what is costing you money.",
    url: `${SITE_URL}/`,
    siteName: "TradeDiscipline",
    locale: ogLocaleMap.en,
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: "TradeDiscipline — Stop repeating the same mistakes",
    description:
      "The AI that turns your trading journal into a personal coach. It detects your destructive patterns, measures your discipline and tells you exactly what is costing you money.",
  },
  robots: {
    index: true,
    follow: true,
    googleBot: { index: true, follow: true },
  },
};

export default function Home() {
  return <LandingPage />;
}
