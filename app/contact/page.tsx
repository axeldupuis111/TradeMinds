import type { Metadata } from "next";
import ContactPage from "@/components/pages/ContactPage";
import { pageMetadata, CONTACT_META } from "@/lib/seo";

export const metadata: Metadata = pageMetadata({ chemin: "/contact", locale: "en", textes: CONTACT_META });

export default function Page() {
  return <ContactPage />;
}
