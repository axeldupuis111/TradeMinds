import type { Metadata } from "next";
import LegalPrivacyPage from "@/components/pages/LegalPrivacyPage";
import { langueDuVisiteur } from "@/lib/langue-serveur";
import { pageMonoAdresse, LEGAL_META } from "@/lib/seo";

export function generateMetadata(): Metadata {
  return pageMonoAdresse("/legal/privacy", LEGAL_META.privacy[langueDuVisiteur()]);
}

export default function Page() {
  return <LegalPrivacyPage />;
}
