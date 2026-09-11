import type { Metadata } from "next";
import LoginPage from "@/components/pages/LoginPage";
import type { Locale } from "@/i18n/config";
import { pageMetadata, LOGIN_META } from "@/lib/seo";

export async function generateMetadata({
  params,
}: {
  params: { locale: string };
}): Promise<Metadata> {
  return pageMetadata({ chemin: "/login", locale: params.locale as Locale, textes: LOGIN_META, indexer: false });
}

export default function Page() {
  return <LoginPage />;
}
