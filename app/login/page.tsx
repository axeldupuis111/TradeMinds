import type { Metadata } from "next";
import LoginPage from "@/components/pages/LoginPage";
import { pageMetadata, LOGIN_META } from "@/lib/seo";

export const metadata: Metadata = pageMetadata({ chemin: "/login", locale: "en", textes: LOGIN_META, indexer: false });

export default function Page() {
  return <LoginPage />;
}
