import type { Metadata } from "next";
import ResetPasswordPage from "@/components/pages/ResetPasswordPage";
import type { Locale } from "@/i18n/config";
import { pageMetadata, MOT_DE_PASSE_META } from "@/lib/seo";

export async function generateMetadata({
  params,
}: {
  params: { locale: string };
}): Promise<Metadata> {
  return pageMetadata({ chemin: "/auth/reset-password", locale: params.locale as Locale, textes: MOT_DE_PASSE_META, indexer: false });
}

export default function Page() {
  return <ResetPasswordPage />;
}
