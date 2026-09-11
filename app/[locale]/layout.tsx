import { notFound } from "next/navigation";
import { locales, type Locale } from "@/i18n/config";

export function generateStaticParams() {
  // On ne génère QUE les langues non-défaut. La défaut (en) est servie par app/page.tsx à la racine.
  return locales.filter((l) => l !== "en").map((locale) => ({ locale }));
}

/**
 * ⚠️⚠️ PAS DE `generateMetadata` ICI, ET C'EST LE DÉFAUT QU'ON RÉPARE. Ce
 * layout portait les métadonnées de la LANDING, que tout le segment héritait :
 * `/fr/faq` et `/fr/contact` annonçaient le titre de la page d'accueil et,
 * bien pire, `canonical = https://tradediscipline.app/fr`. Une page qui
 * désigne une autre URL comme canonique demande à Google de ne pas l'indexer :
 * la FAQ, dont c'est le seul métier, était invisible dans trois langues sur
 * quatre. Des métadonnées de page se posent sur la page.
 */
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
