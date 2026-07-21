import type { Metadata } from "next";
import TradingJournalPage, { tradingJournalMetadata } from "@/components/seo/TradingJournalPage";

// Page mots-clés "trading journal" — version anglaise canonique (x-default).
// Les autres langues vivent sur /{fr|de|es}/trading-journal.
export const metadata: Metadata = tradingJournalMetadata("en");

export default function Page() {
  return <TradingJournalPage locale="en" />;
}
