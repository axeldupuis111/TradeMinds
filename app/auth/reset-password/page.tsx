import type { Metadata } from "next";
import ResetPasswordPage from "@/components/pages/ResetPasswordPage";
import { pageMetadata, MOT_DE_PASSE_META } from "@/lib/seo";

export const metadata: Metadata = pageMetadata({ chemin: "/auth/reset-password", locale: "en", textes: MOT_DE_PASSE_META, indexer: false });

export default function Page() {
  return <ResetPasswordPage />;
}
