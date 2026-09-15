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
 * LES RAILS QUI NE TOURNENT PAS SUR UN COMPTE DE COURTIER.
 *
 * ── POURQUOI LE REPLI NE VAUT PAS POUR EUX ──────────────────────────────────
 *
 * Le repli sur « l'unique challenge en cours » se justifie ainsi : un expert
 * advisor est INSTALLÉ SUR un compte MetaTrader, un cBot sur un compte cTrader,
 * un add-on sur un compte NinjaTrader. Quand il n'annonce pas son numéro, le
 * compte existe quand même, et il n'y en a qu'un candidat.
 *
 * ⚠️⚠️ UNE STRATÉGIE PINE TOURNE SUR UN GRAPHIQUE, PAS SUR UN COMPTE. Ses
 * exécutions sont celles du moteur de backtest de TradingView, à des prix
 * simulés, et le snippet distribué n'a aucun numéro de compte à envoyer parce
 * qu'il n'en existe aucun.
 *
 * Mesuré le 2026-09-15 en testant le webhook de bout en bout : un trade venu
 * d'une alerte TradingView se rattachait au challenge Tradovate actif du
 * compte. Ces trades entrent donc dans le P&L du challenge, dans sa courbe
 * d'équité, et dans le DRAWDOWN sur lequel le gardien de challenge décide de
 * prévenir ou non. La fonctionnalité qui promet d'avertir « avant que tu fasses
 * sauter ton compte » se serait prononcée sur des trades qui ne sont pas passés
 * sur ce compte.
 *
 * ⚠️ On ne devine donc pas : le trade entre au journal sans challenge, comme un
 * import CSV sans compte. Le trader qui VEUT le rattacher le dit, en ajoutant
 * `"account": "…"` à son message d'alerte (le parseur l'accepte déjà), et le
 * guide le documente.
 */
const RAILS_SANS_COMPTE = new Set(["tradingview"]);

/**
 * @param numeroFourni  numéro envoyé par le robot (« » s'il n'en envoie pas)
 * @param carte         numéro de compte → challenge, déclarés par le trader
 * @param challengeActifUnique  repli : son seul challenge en cours, ou `null`
 * @param source        le rail d'où vient le trade (`mt4`, `tradingview`…)
 * @returns le challenge, ou `null` s'il ne faut PAS deviner
 */
export function challengeRattache(
  numeroFourni: string | null | undefined,
  /** `null` : la lecture a échoué, on ne sait pas ce que le trader a déclaré. */
  carte: Map<string, string> | null,
  challengeActifUnique: string | null,
  source?: string,
): string | null {
  /**
   * ⚠️⚠️ UNE CARTE ILLISIBLE N'EST PAS UNE CARTE VIDE. Sans ce cas, une
   * panne de lecture se présenterait comme « le trader n'a déclaré aucun
   * numéro », et rouvrirait la devinette que toute cette fonction ferme.
   */
  if (carte === null) return null;

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

  /**
   * ⚠️ CE RAIL NE TOURNE SUR AUCUN COMPTE (voir RAILS_SANS_COMPTE ci-dessus).
   * Le repli suppose un compte qui existe et qui s'est tu ; ici il n'y en a
   * pas, et deviner ferait entrer des exécutions simulées dans le drawdown
   * d'un compte financé.
   */
  if (source && RAILS_SANS_COMPTE.has(source)) return null;

  // Rien à comparer : ni numéro envoyé, ni numéro déclaré. On peut deviner,
  // et seulement sur un unique challenge en cours (l'appelant s'en assure).
  return challengeActifUnique;
}
