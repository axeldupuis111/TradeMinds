import type { Metadata } from "next";
import FaqPage from "@/components/pages/FaqPage";
import { pageMetadata, FAQ_META } from "@/lib/seo";

export const metadata: Metadata = pageMetadata({ chemin: "/faq", locale: "en", textes: FAQ_META });

export default function Page() {
  return <FaqPage />;
}
