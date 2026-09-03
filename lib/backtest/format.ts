/**
 * ÉCRIRE UN NOMBRE SIGNÉ, À UN SEUL ENDROIT.
 *
 * ── LE DÉFAUT QUI A FAIT NAÎTRE CE FICHIER ──────────────────────────────────
 *
 * ⚠️⚠️ VU À L'ÉCRAN : « intervalle [-0.000 ; 0.082] ». Un zéro négatif. La borne
 * valait environ -0,0004, et `toFixed(3)` l'a arrondie à zéro en gardant son
 * signe. Le trader lit alors un nombre qui n'existe pas, sur la ligne même où on
 * lui demande de juger si zéro est dans l'intervalle.
 *
 * ⚠️ CINQ COPIES DE CETTE FONCTION EXISTAIENT, une par carte, avec des
 * précisions différentes et des comportements différents sur le zéro. C'est
 * exactement le motif qui a déjà produit deux chiffres contradictoires pour le
 * même coût d'aller-retour.
 */

/**
 * Un nombre avec son signe, ou « — » quand il n'y en a pas.
 *
 * ⚠️ ON ARRONDIT AVANT DE DÉCIDER DU SIGNE. À la précision demandée, -0,0004
 * EST zéro : lui laisser son signe affiche « -0.000 », qui n'est ni un nombre
 * négatif ni zéro, juste une faute.
 */
export function signe(v: number | null | undefined, decimales = 3): string {
  if (v == null || !Number.isFinite(v)) return "—";
  const arrondi = Number(v.toFixed(decimales));
  if (arrondi === 0) return (0).toFixed(decimales);
  return `${arrondi > 0 ? "+" : ""}${arrondi.toFixed(decimales)}`;
}

/**
 * Le même, suivi d'un signe pourcent.
 *
 * ⚠️ MÊME RÈGLE SUR LE ZÉRO : « -0.0 % » est une faute, pas une petite perte.
 */
export function signePourcent(v: number | null | undefined, decimales = 1): string {
  const s = signe(v, decimales);
  return s === "—" ? s : `${s} %`;
}
