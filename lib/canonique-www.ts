/**
 * WWW SE CANONICALISE VERS L'APEX, SAUF SUR LE RAIL DES ROBOTS.
 *
 * ── L'INCIDENT DONT CETTE RÈGLE VIENT ───────────────────────────────────────
 *
 * ⚠️⚠️ LES EA ET cBOTS INSTALLÉS POSTENT SUR `www.tradediscipline.app` EN DUR.
 * Un trader qui a installé l'expert advisor MT4/MT5, le cBot cTrader ou
 * l'add-on NinjaTrader a cette adresse gravée dans un fichier chez lui : on ne
 * peut pas la changer à distance.
 *
 * Leurs clients HTTP ne suivent pas une redirection comme un navigateur :
 * `WebRequest` de MQL transforme un POST redirigé en GET, et le rail répond
 * 405. Le 2026-07-15, une redirection posée au niveau du DOMAINE Vercel a
 * coupé la synchro de tous les comptes installés, sans erreur visible côté
 * trader : ses trades cessaient simplement d'arriver.
 *
 * ── LA RÈGLE ────────────────────────────────────────────────────────────────
 *
 * La canonicalisation est utile pour le référencement, donc elle reste, mais
 * elle vit dans le middleware (jamais au niveau domaine) et elle laisse passer
 * `/api` intact.
 *
 * ⚠️ Le sous-domaine est écrit en entier volontairement : une comparaison du
 * genre `host.startsWith("www.")` attraperait aussi un domaine de
 * prévisualisation, et un test qui passe sur `localhost` ne prouve rien.
 */

/** L'hôte servi au public. Toute autre valeur est laissée tranquille. */
export const HOTE_WWW = "www.tradediscipline.app";

/**
 * Faut-il rediriger cette requête de `www` vers l'apex ?
 *
 * @param host    en-tête `host` de la requête, tel quel (peut contenir un port)
 * @param pathname chemin demandé
 */
export function doitCanonicaliserVersApex(host: string, pathname: string): boolean {
  if (host !== HOTE_WWW) return false;
  // ⚠️ LA MOITIÉ QUI COMPTE : le rail des robots ne bouge pas.
  if (pathname === "/api" || pathname.startsWith("/api/")) return false;
  return true;
}

/**
 * LE PRÉFIXE DE LA LANGUE PAR DÉFAUT MÈNE À LA MÊME PAGE, PAS À UN 404.
 *
 * ── CE QUE LE VISITEUR FAISAIT ──────────────────────────────────────────────
 *
 * L'anglais est la langue par défaut : il vit à la racine (`/pricing`), et les
 * trois autres sont préfixées (`/fr/pricing`). La convention est saine, le
 * plan du site et les 576 balises `hreflang` la respectent, et rien dans le
 * produit n'émet jamais de lien vers `/en/…`.
 *
 * Mais de l'extérieur, `/en/pricing` répondait 404 alors que la page existe :
 *   - un lecteur sur `/fr/pricing` qui remplace « fr » par « en » à la main
 *     (le geste le plus naturel du monde) tombait sur une page morte ;
 *   - un lien deviné par un moteur ou un assistant faisait de même, et au
 *     2026-09-12 le premier canal d'acquisition du produit était chatgpt.com,
 *     qui cite des adresses.
 *
 * ⚠️ Les préfixes qui ne sont PAS une langue connue (`/xx`, `/zz`) doivent
 * continuer à répondre 404 : les rediriger inventerait une page pour n'importe
 * quelle suite de deux lettres, et ferait passer des adresses mortes pour des
 * adresses vivantes aux yeux d'un moteur.
 *
 * @returns le chemin sans le préfixe, ou `null` s'il n'y a rien à faire
 */
export function cheminSansPrefixeParDefaut(
  pathname: string,
  langueParDefaut: string,
): string | null {
  if (pathname === `/${langueParDefaut}`) return "/";
  if (pathname.startsWith(`/${langueParDefaut}/`)) {
    return pathname.slice(`/${langueParDefaut}`.length);
  }
  return null;
}
