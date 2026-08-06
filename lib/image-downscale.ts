/**
 * Réduction des screenshots de trades avant upload.
 *
 * POURQUOI — l'analyse visuelle (analyze-trade-vision) envoie l'image telle
 * quelle à Sonnet 5. Le coût en tokens d'une image dépend de ses dimensions :
 * au-delà de 1568 px sur le grand côté on bascule dans le palier haute
 * résolution, jusqu'à ~4 784 tokens par image contre ~1 600 en dessous. Un
 * screenshot de graphique reste parfaitement lisible à 1568 px, donc au-delà on
 * paie une définition dont le modèle ne tire rien.
 *
 * Bénéfice secondaire, non négligeable : upload plus rapide pour le trader et
 * stockage Supabase allégé.
 *
 * Le redimensionnement se fait dans le navigateur (canvas), sans dépendance :
 * `sharp` aurait imposé un binaire natif côté serverless pour un gain moindre.
 */

/** Grand côté au-delà duquel l'API bascule en tarif haute résolution. */
export const MAX_EDGE = 1568;

/**
 * Dimensions cibles pour tenir dans un carré de `maxEdge`, ratio préservé.
 * Renvoie les dimensions d'origine si l'image tient déjà (jamais d'agrandissement).
 */
export function fitWithin(
  width: number,
  height: number,
  maxEdge: number = MAX_EDGE,
): { width: number; height: number; resized: boolean } {
  if (width <= 0 || height <= 0) return { width, height, resized: false };
  const longest = Math.max(width, height);
  if (longest <= maxEdge) return { width, height, resized: false };
  const ratio = maxEdge / longest;
  return {
    width: Math.max(1, Math.round(width * ratio)),
    height: Math.max(1, Math.round(height * ratio)),
    resized: true,
  };
}

/**
 * Réduit un fichier image s'il dépasse `maxEdge`. Renvoie le fichier d'origine
 * si aucune réduction n'est nécessaire, ou si quoi que ce soit échoue : on ne
 * fait jamais perdre son screenshot au trader pour une histoire d'optimisation.
 */
export async function downscaleImageFile(file: File, maxEdge: number = MAX_EDGE): Promise<File> {
  if (typeof document === "undefined" || !file.type.startsWith("image/")) return file;
  // Le GIF peut être animé : le canvas n'en garderait que la première image.
  if (file.type === "image/gif") return file;

  let bitmap: ImageBitmap | null = null;
  try {
    bitmap = await createImageBitmap(file);
    const target = fitWithin(bitmap.width, bitmap.height, maxEdge);
    if (!target.resized) return file;

    const canvas = document.createElement("canvas");
    canvas.width = target.width;
    canvas.height = target.height;
    const ctx = canvas.getContext("2d");
    if (!ctx) return file;
    ctx.imageSmoothingQuality = "high";
    ctx.drawImage(bitmap, 0, 0, target.width, target.height);

    // On conserve le PNG pour les graphiques (lignes fines, texte) : le JPEG y
    // introduit des artefacts autour des bougies et des libellés de prix.
    const type = file.type === "image/jpeg" ? "image/jpeg" : "image/png";
    const blob = await new Promise<Blob | null>((resolve) =>
      canvas.toBlob(resolve, type, type === "image/jpeg" ? 0.92 : undefined),
    );
    if (!blob || blob.size >= file.size) return file; // aucun gain : on garde l'original

    return new File([blob], file.name, { type, lastModified: file.lastModified });
  } catch {
    return file;
  } finally {
    bitmap?.close?.();
  }
}
