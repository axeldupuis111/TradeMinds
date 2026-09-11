import type { Metadata } from "next";
import LegalTermsPage from "@/components/pages/LegalTermsPage";
import { langueDuVisiteur } from "@/lib/langue-serveur";
import { pageMonoAdresse, LEGAL_META } from "@/lib/seo";

export function generateMetadata(): Metadata {
  return pageMonoAdresse("/legal/terms", LEGAL_META.terms[langueDuVisiteur()]);
}

export default function Page() {
  return <LegalTermsPage />;
}
