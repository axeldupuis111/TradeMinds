/**
 * QUI REÇOIT QUOI : UN CANAL NE COMMANDE PAS L'AUTRE.
 *
 * ── LE DÉFAUT ───────────────────────────────────────────────────────────────
 *
 * ⚠️⚠️ LE PUSH HEBDOMADAIRE ÉTAIT COMMANDÉ PAR LA PRÉFÉRENCE D'E-MAIL. La route
 * du rapport hebdo partait de `profiles.email_notif_session = true` et glissait
 * l'envoi push dans la même boucle. Un trader qui refuse les e-mails perdait
 * donc aussi la notification, qu'il n'a jamais refusée, et personne ne pouvait
 * choisir le push seul.
 *
 * ⚠️ MESURE DU 2026-09-17, EN PRODUCTION : CINQUANTE traders sur cinquante-deux
 * ont `email_notif_session = false` et `push_notif_weekly = true`. Le réglage
 * que l'écran leur montre activé ne pouvait rien déclencher.
 *
 * ⚠️ ET LES TROIS AUTRES CRONS À PUSH LE FAISAIENT DÉJÀ BIEN (rappel de
 * séance, gel de série, calendrier éco) : tous partent de `push_subscriptions`.
 * Une règle appliquée à trois surfaces sur quatre.
 *
 * ── LA RÈGLE ────────────────────────────────────────────────────────────────
 *
 * Le public de l'e-mail vient de la préférence d'e-mail ; celui du push vient
 * des abonnements push et de la préférence push. Les deux se recouvrent, aucun
 * ne conditionne l'autre.
 */

export interface ProfilNotifiable {
  id: string;
  email: string | null;
  /** Préférence push du canal concerné. Absente (colonne manquante) = oui. */
  preferencePush?: boolean;
}

export interface Destinataire<T extends ProfilNotifiable> {
  profil: T;
  veutEmail: boolean;
  veutPush: boolean;
}

/**
 * @param profils    profils des deux publics réunis
 * @param optInEmail identifiants ayant accepté cet e-mail
 * @param abonnesPush identifiants ayant un abonnement push actif
 */
export function destinataires<T extends ProfilNotifiable>(
  profils: T[],
  optInEmail: Iterable<string>,
  abonnesPush: Iterable<string>,
): Destinataire<T>[] {
  const email = new Set(optInEmail);
  const push = new Set(abonnesPush);
  return profils.map((profil) => ({
    profil,
    veutEmail: email.has(profil.id) && !!profil.email,
    veutPush: push.has(profil.id) && profil.preferencePush !== false,
  }));
}
