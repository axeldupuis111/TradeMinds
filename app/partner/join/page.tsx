import type { Metadata } from "next";
import PartnerJoinPage from "@/components/pages/PartnerJoinPage";

// Page atteignable uniquement avec le code d'inscription d'un réseau : elle n'a
// rien à faire dans l'index de Google.
export const metadata: Metadata = {
  title: "Rejoindre le programme partenaire | TradeDiscipline",
  robots: { index: false, follow: false },
};

export default function Page() {
  return <PartnerJoinPage />;
}
