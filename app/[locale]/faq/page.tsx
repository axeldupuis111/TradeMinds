import type { Metadata } from "next";
import FaqPage from "@/components/pages/FaqPage";
import type { Locale } from "@/i18n/config";
import { pageMetadata, FAQ_META } from "@/lib/seo";

export async function generateMetadata({
  params,
}: {
  params: { locale: string };
}): Promise<Metadata> {
  return pageMetadata({ chemin: "/faq", locale: params.locale as Locale, textes: FAQ_META });
}

export default function Page() {
  return <FaqPage />;
}
