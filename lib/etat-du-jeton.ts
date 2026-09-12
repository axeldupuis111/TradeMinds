/**
 * LES TROIS ÉTATS D'UN JETON DE SYNCHRONISATION, DÉCIDÉS À UN SEUL ENDROIT.
 *
 * ── LE DÉFAUT ───────────────────────────────────────────────────────────────
 *
 * ⚠️⚠️ UNE LECTURE RATÉE FAISAIT CROIRE À L'ABSENCE DE JETON, ET LA CONSIGNE
 * QUI SUIVAIT CASSAIT LA SYNCHRO. La page Réglages lisait `/api/mt/token` sans
 * regarder `res.ok`, dans un `try` dont le `catch` était muet : à la moindre
 * panne, le jeton restait `null` et l'écran affichait « Générer un jeton »,
 * exactement comme pour quelqu'un qui n'en a jamais eu.
 *
 * ⚠️ CE N'EST PAS UN SIMPLE MESSAGE FAUX, C'EST UNE PERTE DE DONNÉES. Le jeton
 * est recopié EN DUR dans l'EA MetaTrader, le cBot cTrader, l'add-on
 * NinjaTrader et l'alerte TradingView, tous installés sur la machine du
 * trader. En régénérer un invalide l'ancien : ses trades cessent d'arriver
 * dans le journal, sans message et sans erreur, jusqu'à ce qu'il s'en aperçoive
 * tout seul.
 *
 * ⚠️ ET LA CONSIGNE ÉTAIT RÉPÉTÉE QUATRE FOIS : la section MetaTrader, les
 * cartes cTrader et NinjaTrader (via `SyncTokenField`) et la carte TradingView
 * disaient toutes « tu n'as pas de jeton » à partir du même `null`.
 *
 * ── LA RÈGLE ────────────────────────────────────────────────────────────────
 *
 * Trois états, jamais deux : je n'ai pas pu lire, il n'y en a pas, le voici.
 * Et « je n'ai pas pu lire » passe TOUJOURS en premier, parce que c'est le seul
 * dont la consigne suivante est destructrice.
 */
export type EtatDuJeton = "lecture-ratee" | "absent" | "present";

export function etatDuJeton(token: string | null | undefined, lectureRatee?: boolean): EtatDuJeton {
  if (lectureRatee) return "lecture-ratee";
  if (!token) return "absent";
  return "present";
}
