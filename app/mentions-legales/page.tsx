import type { Metadata } from "next";
import MentionsLegalesPage from "@/components/pages/MentionsLegalesPage";
import { langueDuVisiteur } from "@/lib/langue-serveur";
import { pageMonoAdresse, LEGAL_META } from "@/lib/seo";

export function generateMetadata(): Metadata {
  return pageMonoAdresse("/mentions-legales", LEGAL_META.mentions[langueDuVisiteur()]);
}

export default function Page() {
  return <MentionsLegalesPage />;
}
