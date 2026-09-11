/**
 * RECOPIER DES COOKIES D'UNE RÉPONSE À UNE AUTRE, SANS PERDRE LEURS OPTIONS.
 *
 * ── LE DÉFAUT ───────────────────────────────────────────────────────────────
 *
 * ⚠️⚠️ LE MIDDLEWARE RECOPIAIT LES COOKIES DE SESSION AVEC `set(nom, valeur)`,
 * c'est-à-dire en JETANT tout le reste : `httpOnly`, `secure`, `sameSite`,
 * `path` et `maxAge`. Un cookie d'authentification Supabase reposé sans
 * `httpOnly` devient lisible par n'importe quel script de la page, et sans
 * `secure` il peut repartir en clair.
 *
 * ⚠️ LE CHEMIN EST ÉTROIT MAIS RÉEL : la redirection automatique de langue, au
 * premier passage d'un visiteur dont le navigateur parle allemand, espagnol ou
 * français sur une adresse sans préfixe. Si Supabase a rafraîchi le jeton
 * pendant cette requête-là, c'est la version dégradée du cookie qui part au
 * navigateur.
 *
 * ⚠️ ET LA PERTE ÉTAIT INVISIBLE : le cookie existe, la session marche, rien
 * n'échoue. Seules ses protections ont disparu.
 *
 * La forme objet de `set()` garde tout ; c'est la seule à employer pour une
 * recopie.
 */

/**
 * Ce qu'une réponse rend quand on lui demande ses cookies.
 *
 * ⚠️ LE TYPE RESTE LARGE EXPRÈS : `ResponseCookie` de Next porte une dizaine
 * d'attributs qui changent d'une version à l'autre, et les énumérer ici serait
 * une deuxième liste à tenir, c'est-à-dire une deuxième occasion d'en perdre un.
 */
export type CookieRecopiable = { name: string; value: string };

/** Ce qu'il faut pour poser un cookie sur une réponse. */
export interface PoseurDeCookies<C extends CookieRecopiable = CookieRecopiable> {
  set(cookie: C): unknown;
}

/**
 * Repose sur `cible` chacun des cookies de `source`, options comprises.
 *
 * ⚠️ ON PASSE L'OBJET ENTIER, jamais `(nom, valeur)` : c'est exactement la
 * différence entre un cookie de session protégé et un cookie nu.
 */
export function recopierLesCookies<C extends CookieRecopiable>(
  source: readonly C[],
  cible: PoseurDeCookies<C>,
): void {
  for (const cookie of source) cible.set({ ...cookie });
}
