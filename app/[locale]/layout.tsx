import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { locales, type Locale } from "@/i18n/config";
import { landingMetadata } from "@/lib/seo";

export function generateStaticParams() {
  // On ne génère QUE les langues non-défaut. La défaut (en) est servie par app/page.tsx à la racine.
  return locales.filter((l) => l !== "en").map((locale) => ({ locale }));
}

export async function generateMetadata({
  params,
}: {
  params: { locale: string };
}): Promise<Metadata> {
  return landingMetadata(params.locale as Locale);
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
