import { cookies } from "next/headers";
import { locales, defaultLocale, type Locale } from "@/i18n/config";

/**
 * La langue du visiteur, lue côté serveur.
 *
 * ⚠️ POUR LES PAGES QUI N'EXISTENT QU'À UNE ADRESSE : les pages légales se
 * traduisent côté client mais vivent toutes sur `/legal/…` (leurs variantes
 * préfixées redirigent en 301). Leur titre ne peut donc pas venir de l'URL, et
 * sans ceci il resterait en anglais pour tout le monde.
 *
 * ⚠️ NE PAS IMPORTER DEPUIS UN COMPOSANT CLIENT : `next/headers` n'existe que
 * sur le serveur. C'est la raison de ce petit module à part, plutôt qu'une
 * fonction de plus dans `lib/seo.ts`, que des composants clients importent.
 */
export function langueDuVisiteur(): Locale {
  const cookie = cookies().get("NEXT_LOCALE")?.value;
  return cookie && (locales as readonly string[]).includes(cookie) ? (cookie as Locale) : defaultLocale;
}
