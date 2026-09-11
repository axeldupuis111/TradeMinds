import type { Metadata } from "next";
import ContactPage from "@/components/pages/ContactPage";
import type { Locale } from "@/i18n/config";
import { pageMetadata, CONTACT_META } from "@/lib/seo";

export async function generateMetadata({
  params,
}: {
  params: { locale: string };
}): Promise<Metadata> {
  return pageMetadata({ chemin: "/contact", locale: params.locale as Locale, textes: CONTACT_META });
}

export default function Page() {
  return <ContactPage />;
}
