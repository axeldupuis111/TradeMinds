import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

/**
 * UNE ROUTE D'ADMINISTRATION SE GARDE COMME LES AUTRES, ET RESTE APPELABLE.
 *
 * ── LE DÉFAUT ───────────────────────────────────────────────────────────────
 *
 * ⚠️⚠️ UNE ROUTE SUR HUIT ÉTAIT INAPPELABLE EN PRODUCTION.
 * `/api/admin/recompute-trade-derivation` se gardait par un en-tête
 * `x-admin-secret` comparé à `ADMIN_SECRET` — la seule des huit à ne pas lire
 * `ADMIN_EMAILS`. Or cette variable N'EXISTE PAS en production : vérifié le
 * 2026-09-18, Vercel connaît `ADMIN_EMAILS`, `CRON_SECRET`,
 * `STRIPE_WEBHOOK_SECRET`, `RESEND_API_KEY`, les clés VAPID — pas
 * `ADMIN_SECRET`. Chaque appel tombait sur `secret !== undefined` et repartait
 * en 401, y compris ceux d'Axel.
 *
 * ⚠️ CE QUE ÇA A COÛTÉ : cette route est celle qui reporte sur les données les
 * corrections du calcul ICT. Le correctif de `detectKillzone` — l'heure d'été
 * écrite en dur, corrigée le 2026-09-17 — n'a donc jamais pu être appliqué.
 * Rejoué sur la production le 2026-09-18 : **onze trades portent une killzone
 * que le code contredit** (« off_session » là où il calcule « ny_pm »), et 213
 * des 288 trades réels n'en ont aucune.
 *
 * Une correction qu'on ne peut pas exécuter n'est pas une correction.
 *
 * ── LA RÈGLE ────────────────────────────────────────────────────────────────
 *
 * Une route d'administration se garde par `ADMIN_EMAILS`, comme les sept
 * autres. Le secret reste accepté quand il existe : rien de ce qui marchait ne
 * cesse de marcher.
 */

const RACINE = process.cwd();
const DOSSIER = join(RACINE, "app", "api", "admin");

/** Toutes les routes d'administration, lues sur le disque. */
function routesAdmin(): string[] {
  return readdirSync(DOSSIER)
    .filter((e) => statSync(join(DOSSIER, e)).isDirectory())
    .filter((e) => readdirSync(join(DOSSIER, e)).includes("route.ts"))
    .map((e) => `app/api/admin/${e}/route.ts`);
}

describe("les routes d'administration", () => {
  const sources = new Map(routesAdmin().map((f) => [f, readFileSync(join(RACINE, f), "utf8")]));

  it("il y en a bien plusieurs à protéger", () => {
    expect(sources.size, "plus aucune route d'administration : le garde ne protège rien").toBeGreaterThan(5);
  });

  /**
   * ⚠️ CE TEST PART DU DISQUE, pas d'une liste recopiée : une route
   * d'administration ajoutée demain est protégée par ce test le jour même.
   */
  it("lisent toutes ADMIN_EMAILS", () => {
    const sansListe = Array.from(sources.entries())
      .filter(([, src]) => !src.includes("ADMIN_EMAILS"))
      .map(([f]) => f);
    expect(
      sansListe,
      "ces routes se gardent autrement que les autres : si leur secret n'est pas " +
        "déployé, elles sont inappelables et personne ne le sait",
    ).toEqual([]);
  });

  /** ⚠️ Et aucune ne dépend UNIQUEMENT d'un secret qui peut ne pas exister. */
  it("ne dépendent jamais du seul ADMIN_SECRET", () => {
    const seulementSecret = Array.from(sources.entries())
      .filter(([, src]) => src.includes("ADMIN_SECRET") && !src.includes("ADMIN_EMAILS"))
      .map(([f]) => f);
    expect(seulementSecret).toEqual([]);
  });

  /**
   * ⚠️ LISTE VIDE = PERSONNE. Le jour où `ADMIN_EMAILS` disparaît, une route
   * doit se FERMER, pas s'ouvrir. `[].includes(x)` rend faux : c'est déjà le
   * bon sens, ce test le fige.
   */
  it("se ferment quand la liste est vide", () => {
    for (const [f, src] of Array.from(sources.entries())) {
      expect(src, `${f} n'utilise plus \`includes\` pour décider`).toMatch(
        /admins?Emails?\s*\.includes|admins\.includes/i,
      );
    }
  });
});
