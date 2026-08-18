/**
 * Délai minimal entre deux synchros déclenchées à la main.
 *
 * POURQUOI CE FICHIER EXISTE. La synchro manuelle n'avait aucune limite. Tant
 * qu'elle vivait dans un bouton enterré dans les réglages, personne ne la
 * martelait. En la remontant sur « Mes Trades », là où le trader la cherche
 * vraiment, elle devient un bouton qu'on presse en boucle en attendant que son
 * dernier trade apparaisse.
 *
 * Or une synchro Tradovate rejoue jusqu'à 90 jours d'exécutions et fait un
 * appel par contrat. Multiplié par des milliers d'utilisateurs impatients, ce
 * n'est pas notre infrastructure qui cède en premier, c'est le débit autorisé
 * chez le broker, et il est partagé : un utilisateur trop pressé dégraderait le
 * service de tous les autres.
 *
 * Une minute est le bon compromis : assez court pour qu'un trader qui vient de
 * clôturer ne se sente pas bloqué, assez long pour qu'un clic répété ne coûte
 * rien. Le cron horaire continue de tourner en dessous, sans cette limite : il
 * est déjà cadencé par nature.
 */

/** Une minute entre deux synchros manuelles, par connexion. */
export const MANUAL_SYNC_COOLDOWN_MS = 60_000;

/**
 * Millisecondes restantes avant qu'une nouvelle synchro manuelle soit permise.
 * Zéro signifie « vas-y ».
 *
 * Une connexion jamais synchronisée n'attend pas : c'est le tout premier clic
 * après une connexion, celui où l'utilisateur a le plus besoin de voir arriver
 * quelque chose.
 */
export function manualSyncWaitMs(
  lastSyncedAt: string | null | undefined,
  now: number = Date.now(),
  cooldownMs: number = MANUAL_SYNC_COOLDOWN_MS,
): number {
  if (!lastSyncedAt) return 0;
  const last = new Date(lastSyncedAt).getTime();
  // Date invalide ou horloge dans le futur : on laisse passer plutôt que de
  // bloquer sur une donnée qu'on ne sait pas interpréter.
  if (!Number.isFinite(last) || last > now) return 0;
  const elapsed = now - last;
  return elapsed >= cooldownMs ? 0 : cooldownMs - elapsed;
}

/** Arrondi à la seconde supérieure, pour un message lisible par un humain. */
export function waitSeconds(waitMs: number): number {
  return Math.ceil(waitMs / 1000);
}
