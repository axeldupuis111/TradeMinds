import { type Lang } from "./translations";

const DEFAULT_LANG: Lang = "en";

/**
 * Préfixe un chemin avec la locale courante si nécessaire.
 * - Si lang est la défaut (en), pas de préfixe : "/" → "/", "/login" → "/login"
 * - Sinon, préfixe : "/" → "/fr", "/login" → "/fr/login"
 * - Les ancres (#features) et URLs externes (https://, mailto:) sont retournées telles quelles
 */
export function localizedHref(path: string, lang: Lang): string {
  // Ancres internes : pas de préfixe
  if (path.startsWith("#")) return path;
  // URLs externes ou mailto : pas de préfixe
  if (path.startsWith("http://") || path.startsWith("https://") || path.startsWith("mailto:") || path.startsWith("tel:")) {
    return path;
  }
  // Locale par défaut : pas de préfixe
  if (lang === DEFAULT_LANG) return path;
  // Cas /
  if (path === "/" || path === "") return `/${lang}`;
  // Cas général
  return `/${lang}${path}`;
}
