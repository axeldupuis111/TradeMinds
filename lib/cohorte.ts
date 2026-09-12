/**
 * UN TUNNEL SUIT UNE COHORTE, SINON CE N'EST PAS UN TUNNEL.
 *
 * ── CE QUE L'ÉCRAN ADMIN AFFIRMAIT ──────────────────────────────────────────
 *
 * Les étapes s'affichent sous « Inscrits » avec un pourcentage de l'étape
 * précédente : « Inscrits 21 · Activés 5 (24 %) ». Cela ne se lit que d'une
 * façon : sur les 21 qui se sont inscrits, 5 ont activé.
 *
 * Or le premier nombre comptait les profils CRÉÉS dans la fenêtre, pendant que
 * les suivants comptaient les utilisateurs ACTIFS dans la fenêtre, quelle que
 * soit leur date d'inscription. Trois populations différentes empilées dans un
 * même entonnoir.
 *
 * ⚠️⚠️ MESURE DU 2026-09-12, EN PRODUCTION :
 *   - fenêtre 30 j : activation affichée 24 %, cohorte réelle 14 % ;
 *   - fenêtre 7 j : « Analyse IA lancée » affichait 100 % des activés, alors
 *     qu'AUCUN inscrit de la semaine n'avait lancé d'analyse.
 *
 * Le biais va toujours dans le même sens : il fait paraître l'accueil meilleur
 * qu'il n'est, sur l'écran qui sert à décider où le produit perd ses
 * utilisateurs.
 */

/**
 * Utilisateurs distincts d'une liste d'événements, restreints à une cohorte.
 *
 * ⚠️ Un même utilisateur peut avoir dix événements : on compte des PERSONNES,
 * pas des gestes. C'est aussi pour ça qu'un `rows.filter(...).length` serait
 * faux ici.
 */
export function dansLaCohorte(
  rows: { user_id: string }[] | null | undefined,
  cohorte: Set<string>,
): number {
  const vus = new Set<string>();
  for (const r of rows ?? []) if (cohorte.has(r.user_id)) vus.add(r.user_id);
  return vus.size;
}

/** Utilisateurs distincts, sans filtre de cohorte (mesure d'activité). */
export function tousUtilisateurs(
  rows: { user_id: string }[] | null | undefined,
): number {
  return new Set((rows ?? []).map((r) => r.user_id)).size;
}

/**
 * La liste d'identifiants est-elle plus courte que le comptage exact ?
 *
 * ⚠️⚠️ POSTGREST PLAFONNE EN SILENCE, avec un statut 200. Une cohorte tronquée
 * sous-compte toutes les étapes sans que rien ne le signale : mieux vaut le
 * dire à l'écran que d'afficher un tunnel faux.
 *
 * @param comptageExact `count: "exact"`, juste à n'importe quelle taille ;
 *                      `null` quand la requête elle-même a échoué.
 * @param identifiantsRecus taille de la liste effectivement reçue
 */
export function cohorteTronquee(
  comptageExact: number | null | undefined,
  identifiantsRecus: number,
): boolean {
  if (comptageExact == null) return false;
  return comptageExact > identifiantsRecus;
}
