import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { adressesAdmin } from "./garde-admin";

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
 * ── LA CAUSE, TRAITÉE LE SOIR MÊME ──────────────────────────────────────────
 *
 * ⚠️⚠️ LE GARDE ÉTAIT RECOPIÉ HUIT FOIS. Chaque route réécrivait les mêmes
 * quinze lignes et portait un commentaire « Même garde admin que
 * /api/admin/X », désignant à chaque fois une sœur DIFFÉRENTE. Huit fichiers
 * affirmaient se ressembler, et rien ne les y obligeait — jusqu'au jour où l'un
 * d'eux a cessé. Le garde vit désormais dans `lib/garde-admin.ts`.
 *
 * ⚠️ ET CE TEST-CI TENAIT LA DUPLICATION EN PLACE : sa version du matin
 * exigeait de CHAQUE FICHIER qu'il contienne `ADMIN_EMAILS` et un `includes`,
 * c'est-à-dire exactement les copies. Il est tombé le jour où elles ont
 * disparu. C'est le troisième garde de la journée à épingler la mise en œuvre
 * plutôt que l'intention ; l'intention est : toute route d'administration passe
 * par le même garde, et ce garde se ferme quand la liste est vide.
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
  it("passent toutes par le garde partagé", () => {
    const sansGarde = Array.from(sources.entries())
      .filter(([, src]) => !src.includes("@/lib/garde-admin"))
      .map(([f]) => f);
    expect(
      sansGarde,
      "ces routes se gardent autrement que les autres : c'est ainsi que l'une " +
        "d'elles est devenue inappelable sans que personne le sache :\n  " + sansGarde.join("\n  "),
    ).toEqual([]);
  });

  /** ⚠️ Et aucune ne réécrit la liste dans son coin. */
  it("ne réécrivent plus la liste des adresses", () => {
    const copies = Array.from(sources.entries())
      .filter(([, src]) => /process\.env\.ADMIN_EMAILS/.test(src))
      .map(([f]) => f);
    expect(copies, "la liste est de nouveau recopiée : " + copies.join(" ")).toEqual([]);
  });

  /**
   * ⚠️⚠️ ET AUCUNE NE DÉPEND UNIQUEMENT D'UN SECRET QUI PEUT NE PAS EXISTER.
   * C'est le défaut d'origine, mot pour mot.
   */
  it("ne dépendent jamais du seul ADMIN_SECRET", () => {
    const seulementSecret = Array.from(sources.entries())
      .filter(([, src]) => src.includes("ADMIN_SECRET") && !src.includes("@/lib/garde-admin"))
      .map(([f]) => f);
    expect(seulementSecret).toEqual([]);
  });
});

describe("le garde partagé", () => {
  /**
   * ⚠️⚠️ LISTE VIDE = PERSONNE. Le jour où `ADMIN_EMAILS` disparaît, une route
   * doit se FERMER, pas s'ouvrir. Ce test l'éprouve par le COMPORTEMENT, pas
   * par une recherche de texte : la version précédente cherchait le mot
   * `includes` dans huit fichiers, ce qui prouvait seulement que le mot était
   * là.
   */
  it("ne connaît personne quand la variable est absente", () => {
    const avant = process.env.ADMIN_EMAILS;
    try {
      delete process.env.ADMIN_EMAILS;
      expect(adressesAdmin()).toEqual([]);
      process.env.ADMIN_EMAILS = "";
      expect(adressesAdmin()).toEqual([]);
      process.env.ADMIN_EMAILS = " , ,, ";
      expect(adressesAdmin(), "des entrées vides deviendraient des adresses").toEqual([]);
    } finally {
      if (avant === undefined) delete process.env.ADMIN_EMAILS;
      else process.env.ADMIN_EMAILS = avant;
    }
  });

  /** ⚠️ Et la comparaison ne dépend ni de la casse ni des espaces. */
  it("reconnaît une adresse quelle que soit sa casse", () => {
    const avant = process.env.ADMIN_EMAILS;
    try {
      process.env.ADMIN_EMAILS = " Axel.Dupuis111@Gmail.COM , autre@exemple.fr ";
      expect(adressesAdmin()).toEqual(["axel.dupuis111@gmail.com", "autre@exemple.fr"]);
    } finally {
      if (avant === undefined) delete process.env.ADMIN_EMAILS;
      else process.env.ADMIN_EMAILS = avant;
    }
  });
});
