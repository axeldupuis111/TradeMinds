import { ImageResponse } from "next/og";
import { carteDArticle, tailleDeCarte } from "@/lib/blog/carte-sociale";

/**
 * LA CARTE SOCIALE D'UN ARTICLE.
 *
 * ── LE DÉFAUT ───────────────────────────────────────────────────────────────
 *
 * ⚠️⚠️ LES ARTICLES DU BLOG N'AVAIENT AUCUNE IMAGE, et leurs métadonnées en
 * promettaient une : `twitter: { card: "summary_large_image" }` demande une
 * grande image, et il n'y en avait pas. Partagé sur X, LinkedIn, Discord ou
 * WhatsApp, un article s'affichait donc en lien nu, sans vignette, là où la
 * landing et les profils publics ont chacun leur carte générée.
 *
 * ⚠️ C'EST LA SEULE CHOSE QU'UN LECTEUR VOIT AVANT DE CLIQUER, sur un blog qui
 * existe pour faire venir des gens. Deux surfaces de partage sur trois
 * l'avaient : encore une règle appliquée à une partie de ce qu'elle vise.
 */
export const runtime = "edge";
export const alt = "TradeDiscipline";
export const size = tailleDeCarte;
export const contentType = "image/png";

export default async function Image({ params }: { params: { slug: string } }) {
  return new ImageResponse(carteDArticle(params.slug, "en"), { ...tailleDeCarte });
}
