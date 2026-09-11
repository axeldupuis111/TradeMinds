import type { Metadata } from "next";
import LandingPage from "@/components/landing/LandingPage";
import type { Locale } from "@/i18n/config";
import { landingMetadata } from "@/lib/seo";

/**
 * ⚠️ LES MÉTADONNÉES DE LA LANDING VIVENT ICI, plus sur le layout du segment :
 * posées sur le layout, elles descendaient sur la FAQ et le contact, qui se
 * déclaraient alors canoniquement égaux à la page d'accueil.
 */
export async function generateMetadata({
  params,
}: {
  params: { locale: string };
}): Promise<Metadata> {
  return landingMetadata(params.locale as Locale);
}

export default function LocaleHome() {
  return <LandingPage />;
}
