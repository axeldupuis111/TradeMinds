/**
 * LA SAISON DU CLASSEMENT SE LIT SUR LA MÊME HORLOGE QUE CELLE QUI LA CALCULE.
 *
 * ── LE DÉFAUT ───────────────────────────────────────────────────────────────
 *
 * ⚠️⚠️ LE TITRE ANNONÇAIT UN MOIS, LE CLASSEMENT EN COMPTAIT UN AUTRE. La
 * saison est un mois calendaire UTC côté serveur (`app/api/leaderboard`, où la
 * fenêtre part de `Date.UTC(année, mois, 1)`) : il le faut, un classement
 * partagé ne peut pas commencer à une heure différente pour chaque lecteur.
 * Mais la page, elle, écrivait « Saison de {mois} » et « {n} j restants » avec
 * l'horloge du NAVIGATEUR.
 *
 * ⚠️ CE N'EST PAS UNE FINESSE D'UNE SECONDE. Le 31 août à 21 h à New York il
 * est déjà le 1er septembre en UTC : la page disait « Saison d'août, 0 j
 * restants » pendant que le serveur servait déjà septembre, compteur remis à
 * zéro. Et le 1er septembre à 8 h à Tokyo, l'inverse : « Saison de septembre »
 * au-dessus du classement d'août. Le produit compte 17 inscrits anglophones
 * sur 21, dont la plupart ne sont pas dans le fuseau du serveur.
 *
 * ⚠️ ET « 0 J RESTANTS » ÉTAIT FAUX MÊME EN UTC : le dernier jour du mois,
 * `dernierJour - jourCourant` rend zéro alors que la saison court encore
 * jusqu'à minuit. Un compteur qui affiche zéro pendant vingt-quatre heures
 * invite à ne plus jouer sa dernière journée.
 *
 * ── LA RÈGLE ────────────────────────────────────────────────────────────────
 *
 * Tout ce qui décrit la saison se calcule en UTC, comme la fenêtre. C'est la
 * même règle que pour les fuseaux ailleurs dans le produit, prise par l'autre
 * bout : là où la donnée appartient au trader, elle se lit dans SON fuseau ;
 * là où elle est partagée par tout le monde, elle se lit sur l'horloge commune.
 */

/** Début du mois UTC en cours : la borne exacte de la fenêtre du classement. */
export function debutDeSaison(at: Date | number = new Date()): Date {
  const d = new Date(at);
  return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), 1));
}

/** Début de la saison SUIVANTE, c'est-à-dire l'instant de la remise à zéro. */
export function finDeSaison(at: Date | number = new Date()): Date {
  const d = new Date(at);
  return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth() + 1, 1));
}

/** Clé de saison « 2026-09 », celle que porte un badge octroyé. */
export function cleDeSaison(at: Date | number = new Date()): string {
  return new Date(at).toISOString().slice(0, 7);
}

/**
 * Le nom du mois de la saison, dans la langue de l'application.
 *
 * ⚠️ `timeZone: "UTC"` n'est pas décoratif : sans lui, `toLocaleDateString`
 * reformate l'instant dans le fuseau du navigateur et rend le mois d'à côté,
 * exactement le décalage qu'on corrige ici.
 */
export function moisDeSaison(langue: string, at: Date | number = new Date()): string {
  return debutDeSaison(at).toLocaleDateString(langue, { month: "long", timeZone: "UTC" });
}

/**
 * Jours restants avant la remise à zéro, arrondis au jour entamé : le dernier
 * jour de la saison compte pour un, il se joue encore.
 */
export function joursRestantsDeSaison(at: Date | number = new Date()): number {
  const reste = finDeSaison(at).getTime() - new Date(at).getTime();
  return Math.max(0, Math.ceil(reste / 86_400_000));
}
