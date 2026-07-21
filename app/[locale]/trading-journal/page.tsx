import type { Metadata } from "next";
import TradingJournalPage, { tradingJournalMetadata } from "@/components/seo/TradingJournalPage";
import type { Locale } from "@/i18n/config";

// Page mots-clés « journal de trading » localisée (/fr/trading-journal, ...).
// La locale invalide ou "en" est rejetée par app/[locale]/layout.tsx.
export async function generateMetadata({
  params,
}: {
  params: { locale: string };
}): Promise<Metadata> {
  return tradingJournalMetadata(params.locale as Locale);
}

export default function Page({ params }: { params: { locale: string } }) {
  return <TradingJournalPage locale={params.locale as Locale} />;
}
