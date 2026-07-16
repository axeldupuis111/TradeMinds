import type jsPDF from "jspdf";
import { setUnicodeMoney } from "@/lib/pdf/kit";

/**
 * Police de marque des exports PDF.
 *
 * Geist (la police du site) en TTF statiques, instanciées depuis la variable
 * font du repo (`public/fonts/Geist-{Regular,Bold}.ttf`, ~66 Ko chacune).
 * Embarquer une vraie police Unicode permet d'écrire les accents (é, ü, ñ...)
 * et le vrai « € » dans les PDF, ce que les 14 polices standard jsPDF
 * (Helvetica/WinAnsi) ne permettaient pas proprement.
 *
 * Chargées à la demande (fetch au premier export, mises en cache module) pour
 * ne rien ajouter au bundle. En cas d'échec réseau on retombe sur Helvetica :
 * l'export marche toujours, juste sans la police de marque.
 */

export const BRAND_FONT = "Geist";

let cache: { regular: string; bold: string } | null = null;
let failed = false;

function toBase64(buf: ArrayBuffer): string {
  const bytes = new Uint8Array(buf);
  let bin = "";
  for (let i = 0; i < bytes.length; i++) {
    bin += String.fromCharCode(bytes[i]);
  }
  return btoa(bin);
}

/** Enregistre la police (base64) dans un document ; utilisé aussi par les tests. */
export function registerBrandFont(doc: jsPDF, fonts: { regular: string; bold: string }): string {
  doc.addFileToVFS("Geist-Regular.ttf", fonts.regular);
  doc.addFont("Geist-Regular.ttf", BRAND_FONT, "normal");
  doc.addFileToVFS("Geist-Bold.ttf", fonts.bold);
  doc.addFont("Geist-Bold.ttf", BRAND_FONT, "bold");
  setUnicodeMoney(true);
  return BRAND_FONT;
}

/**
 * Charge (une fois par session) puis enregistre la police de marque dans le
 * document. Retourne le nom de police à utiliser : `Geist`, ou `helvetica`
 * si le chargement a échoué.
 */
export async function ensureBrandFont(doc: jsPDF): Promise<string> {
  if (!cache && !failed) {
    try {
      const [regular, bold] = await Promise.all(
        ["/fonts/Geist-Regular.ttf", "/fonts/Geist-Bold.ttf"].map(async (url) => {
          const res = await fetch(url);
          if (!res.ok) throw new Error(`${res.status} on ${url}`);
          return toBase64(await res.arrayBuffer());
        }),
      );
      cache = { regular, bold };
    } catch (err) {
      console.error("[pdf] brand font load failed, falling back to helvetica:", err);
      failed = true;
    }
  }
  if (!cache) return "helvetica";
  return registerBrandFont(doc, cache);
}
