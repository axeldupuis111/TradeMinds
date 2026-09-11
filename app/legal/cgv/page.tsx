import type { Metadata } from "next";
import LegalCgvPage from "@/components/pages/LegalCgvPage";
import { langueDuVisiteur } from "@/lib/langue-serveur";
import { pageMonoAdresse, LEGAL_META } from "@/lib/seo";

export function generateMetadata(): Metadata {
  return pageMonoAdresse("/legal/cgv", LEGAL_META.cgv[langueDuVisiteur()]);
}

export default function Page() {
  return <LegalCgvPage />;
}
