/**
 * À QUEL CHALLENGE RATTACHER CE QUI ARRIVE D'UN ROBOT ?
 *
 * ── LE DÉFAUT, MESURÉ EN PRODUCTION LE 2026-09-12 ───────────────────────────
 *
 * Test bout-en-bout du rail NinjaTrader, avec la charge exacte du fichier
 * distribué. J'ai envoyé un état de compte pour le numéro
 * « SONDE-COMPTE-0000 », qui n'existe chez personne. Le serveur a répondu
 * `{"account":"ok"}` et a écrit le solde… dans le challenge Tradovate actif du
 * compte, qui porte un tout autre numéro.
 *
 * ⚠️⚠️ ET LE CLIENT SE TAIT. `TradeDiscipline_NinjaTrader.cs` cherche
 * littéralement `"account":"ok"` pour décider s'il doit prévenir le trader. Un
 * trader qui se trompe d'un chiffre dans son numéro de compte, ou qui lance
 * l'add-on sur un second compte non déclaré, voit « tout va bien » pendant que
 * le solde d'un compte atterrit sur un autre.
 *
 * ⚠️ CE SOLDE N'EST PAS DÉCORATIF. Le gardien de challenge (fonction Premium :
 * « prévenu avant de faire sauter ton compte ») calcule le drawdown dessus, et
 * la règle du produit est que le solde synchronisé s'affiche TEL QUEL. Un solde
 * étranger écrit sur un challenge fait taire le gardien, ou le fait crier pour
 * rien.
 *
 * ── LA RÈGLE ÉTAIT DÉJÀ ÉCRITE, ET APPLIQUÉE À MOITIÉ ───────────────────────
 *
 * `getChallengeAccountMap` la formule mot pour mot : « un numéro de compte est
 * une correspondance EXACTE saisie par l'utilisateur, pas une devinette », et
 * le repli sur l'unique compte actif ne vaut que « SANS NUMÉRO À COMPARER ».
 * Le code, lui, faisait `carte.get(numero) ?? repli` : il repliait aussi quand
 * un numéro était fourni et ne correspondait à rien, c'est-à-dire dans le seul
 * cas où l'on a une preuve positive que le compte est inconnu.
 *
 * ── POURQUOI LA CARTE VIDE GARDE LE REPLI ───────────────────────────────────
 *
 * Un trader qui n'a jamais saisi de numéro de compte n'a rien à comparer : son
 * numéro ne peut correspondre à rien, par construction, et refuser casserait
 * une synchro qui marche aujourd'hui. Le refus ne se déclenche donc que quand
 * le trader a DÉJÀ déclaré des numéros et que celui-ci n'en est pas.
 */

/**
 * @param numeroFourni  numéro envoyé par le robot (« » s'il n'en envoie pas)
 * @param carte         numéro de compte → challenge, déclarés par le trader
 * @param challengeActifUnique  repli : son seul challenge en cours, ou `null`
 * @returns le challenge, ou `null` s'il ne faut PAS deviner
 */
export function challengeRattache(
  numeroFourni: string | null | undefined,
  carte: Map<string, string>,
  challengeActifUnique: string | null,
): string | null {
  const numero = (numeroFourni ?? "").trim();

  // Correspondance exacte : le cas normal, et le seul qui soit une certitude.
  if (numero !== "") {
    const trouve = carte.get(numero);
    if (trouve) return trouve;

    /**
     * ⚠️ LE CŒUR DE LA CORRECTION. Le trader a déclaré des numéros, et
     * celui-ci n'en est pas : c'est une preuve que ce compte nous est inconnu,
     * pas une absence d'information. On refuse plutôt que d'écrire ailleurs.
     */
    if (carte.size > 0) return null;
  }

  // Rien à comparer : ni numéro envoyé, ni numéro déclaré. On peut deviner,
  // et seulement sur un unique challenge en cours (l'appelant s'en assure).
  return challengeActifUnique;
}
