import type { Metadata } from "next";
import PartnerStatsPage from "@/components/pages/PartnerStatsPage";

// L'URL porte un jeton d'accès : elle ne doit jamais être indexée.
export const metadata: Metadata = {
  title: "Mes inscriptions | TradeDiscipline",
  robots: { index: false, follow: false },
};

export default function Page({ params }: { params: { token: string } }) {
  return <PartnerStatsPage token={params.token} />;
}
