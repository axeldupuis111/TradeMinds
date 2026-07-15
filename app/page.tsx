import type { Metadata } from "next";
import LandingPage from "@/components/landing/LandingPage";
import { landingMetadata, SITE_URL } from "@/lib/seo";

// The default (English) landing is served here at `/`, NOT through the
// `[locale]` layout — the shared builder in lib/seo.ts keeps both in sync.
export const metadata: Metadata = landingMetadata("en");

// Structured data (JSON-LD) so Google can show a richer brand result (logo,
// app info). No aggregateRating: fabricating ratings violates Google's
// guidelines — add it only once real reviews exist.
const JSON_LD = {
  "@context": "https://schema.org",
  "@graph": [
    {
      "@type": "Organization",
      "@id": `${SITE_URL}/#organization`,
      name: "TradeDiscipline",
      url: SITE_URL,
      logo: `${SITE_URL}/icon-512.png`,
      description:
        "The AI that turns your trading journal into a personal coach: detect destructive patterns, measure discipline.",
    },
    {
      "@type": "WebSite",
      "@id": `${SITE_URL}/#website`,
      name: "TradeDiscipline",
      url: SITE_URL,
      publisher: { "@id": `${SITE_URL}/#organization` },
    },
    {
      "@type": "SoftwareApplication",
      name: "TradeDiscipline",
      applicationCategory: "FinanceApplication",
      operatingSystem: "Web, iOS, Android, Windows, macOS",
      url: SITE_URL,
      description:
        "AI trading journal & discipline coach: detects revenge trading and FOMO, scores your discipline, tracks prop-firm challenges.",
      offers: { "@type": "Offer", price: "0", priceCurrency: "EUR" },
    },
  ],
};

export default function Home() {
  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(JSON_LD) }}
      />
      <LandingPage />
    </>
  );
}
