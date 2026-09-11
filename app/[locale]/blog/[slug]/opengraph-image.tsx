import { ImageResponse } from "next/og";
import { carteDArticle, tailleDeCarte } from "@/lib/blog/carte-sociale";

/**
 * La carte sociale d'un article, dans la langue de son URL.
 *
 * ⚠️ MÊME DESSIN QUE LA ROUTE RACINE, IMPORTÉ : Next exige un fichier d'image
 * dans chaque segment, mais pas deux dessins. Voir `lib/blog/carte-sociale`.
 */
export const runtime = "edge";
export const alt = "TradeDiscipline";
export const size = tailleDeCarte;
export const contentType = "image/png";

export default async function Image({ params }: { params: { locale: string; slug: string } }) {
  return new ImageResponse(carteDArticle(params.slug, params.locale), { ...tailleDeCarte });
}
