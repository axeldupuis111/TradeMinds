import { describe, expect, it } from "vitest";
import { MANUAL_SYNC_COOLDOWN_MS, manualSyncWaitMs, waitSeconds } from "./sync-cooldown";

/**
 * Ce délai est la seule chose qui sépare un bouton utile d'un bouton
 * dangereux.
 *
 * Le rafraîchissement manuel vivait dans les réglages, où personne ne le
 * martelait. Remonté sur « Mes Trades », là où le trader le cherche vraiment,
 * il devient le bouton qu'on presse en boucle en attendant son dernier trade.
 * Chaque pression rejoue jusqu'à 90 jours d'exécutions et un appel par contrat,
 * sur un débit Tradovate partagé entre tous nos utilisateurs.
 *
 * Ces tests tiennent les deux extrémités : on n'attend jamais quand il n'y a
 * pas de raison, et on attend toujours quand il y en a une.
 */

const NOW = new Date("2026-08-19T12:00:00.000Z").getTime();
const iso = (msAgo: number) => new Date(NOW - msAgo).toISOString();

describe("délai entre deux synchros manuelles", () => {
  it("laisse passer la toute première synchro", () => {
    // Le clic juste après avoir connecté son compte est celui où l'utilisateur
    // a le plus besoin de voir arriver quelque chose. Le faire attendre là
    // donnerait l'impression que la connexion ne marche pas.
    expect(manualSyncWaitMs(null, NOW)).toBe(0);
    expect(manualSyncWaitMs(undefined, NOW)).toBe(0);
  });

  it("fait attendre juste après une synchro", () => {
    expect(manualSyncWaitMs(iso(0), NOW)).toBe(MANUAL_SYNC_COOLDOWN_MS);
    expect(manualSyncWaitMs(iso(20_000), NOW)).toBe(40_000);
  });

  it("laisse repasser une fois le délai écoulé", () => {
    expect(manualSyncWaitMs(iso(MANUAL_SYNC_COOLDOWN_MS), NOW)).toBe(0);
    expect(manualSyncWaitMs(iso(3_600_000), NOW)).toBe(0);
  });

  it("ne bloque pas sur une date qu'il ne sait pas lire", () => {
    // Mieux vaut une synchro de trop qu'un bouton mort dont personne ne
    // comprendrait la cause.
    expect(manualSyncWaitMs("pas une date", NOW)).toBe(0);
    expect(manualSyncWaitMs("", NOW)).toBe(0);
  });

  it("ne bloque pas sur une date dans le futur", () => {
    // Horloge serveur décalée : sans ce cas, l'utilisateur resterait bloqué
    // jusqu'à ce que le temps rattrape la valeur en base.
    expect(manualSyncWaitMs(new Date(NOW + 600_000).toISOString(), NOW)).toBe(0);
  });

  it("arrondit l'attente à la seconde supérieure", () => {
    // 0 s afficherait « réessaie dans 0 seconde » sur un bouton qui refuse.
    expect(waitSeconds(1)).toBe(1);
    expect(waitSeconds(40_000)).toBe(40);
    expect(waitSeconds(40_001)).toBe(41);
  });
});
