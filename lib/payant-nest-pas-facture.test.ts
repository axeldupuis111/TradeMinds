import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { sansCommentaires } from "./sans-commentaires";

/**
 * « ACCÈS PAYANT » ET « ABONNEMENT FACTURÉ » SONT DEUX FAITS DIFFÉRENTS.
 *
 * ── CE QUE L'ÉCRAN AFFIRMAIT ────────────────────────────────────────────────
 *
 * Le tableau de bord admin affichait « Payants actuellement (global) », en
 * vert, avec pour seule définition `plan != 'free'`. Or ce champ est aussi
 * posé sur les accès accordés à la main : partenaires, testeurs, gestes
 * commerciaux.
 *
 * ⚠️⚠️ Au 2026-09-12 la mesure en production donnait 13 comptes à plan payant
 * pour 3 clients Stripe. L'écran annonçait donc plus de quatre fois les
 * abonnés réels, sur la seule page où se décident le modèle de marge, les
 * projections de commission et les plafonds de quota IA.
 *
 * La règle n'est pas « corriger le nombre » : les deux nombres sont vrais et
 * répondent à deux questions. La règle est de ne jamais les fusionner sous une
 * étiquette qui promet des revenus.
 *
 * ── ET UNE LECTURE RATÉE N'EST PAS UN ZÉRO ──────────────────────────────────
 *
 * `count` vaut `null` aussi bien quand la requête échoue que quand elle ne
 * trouve rien. Un `?? 0` seul afficherait une panne comme « 0 abonné », en
 * vert, sans que rien ne le signale.
 */
describe("le compteur d'abonnés du tableau de bord admin", () => {
  const route = sansCommentaires(
    readFileSync(join(process.cwd(), "app/api/admin/funnel/route.ts"), "utf8"),
  );
  const page = sansCommentaires(
    readFileSync(join(process.cwd(), "app/dashboard/admin/page.tsx"), "utf8"),
  );

  it("compte à part les abonnements adossés à un client Stripe", () => {
    expect(
      route,
      "la route ne compte plus les abonnements facturés : l'écran est revenu à " +
        "un seul nombre, qui mélange les accès offerts et les abonnés payants",
    ).toMatch(/stripe_customer_id/);
    expect(route, "billedNow n'est plus renvoyé au front").toMatch(/billedNow:/);
  });

  it("renvoie toujours les deux nombres, jamais un seul", () => {
    // Garder payingNow compte autant : c'est lui qui dit combien de comptes
    // consomment du quota IA, ce que « facturés » ne dit pas.
    expect(route, "payingNow a disparu").toMatch(/payingNow:/);
  });

  it("distingue une lecture ratée d'un zéro", () => {
    expect(
      route,
      "aucun drapeau d'échec : une panne de lecture s'afficherait comme « 0 abonné »",
    ).toMatch(/revenueCountsFailed:/);
    expect(
      route,
      "le drapeau ne regarde pas l'erreur des requêtes de comptage",
    ).toMatch(/revenueCountsFailed:\s*!!\w*[Ee]rr/);
  });

  it("l'écran affiche le nombre facturé, pas seulement le total", () => {
    /**
     * ⚠️ On vérifie le RENDU, pas seulement la route : un champ renvoyé que
     * personne n'affiche ne corrige rien. C'est déjà arrivé sur ce produit,
     * un champ ajouté côté serveur et jamais lu côté écran.
     */
    /**
     * ⚠️⚠️ ON NE SE CONTENTE PAS DE TROUVER LE NOM QUELQUE PART. La première
     * version cherchait « funnel.billedNow » n'importe où dans la page :
     * retirer le chiffre principal la laissait verte, parce que la ligne
     * dérivée (« dont accès offerts ») contient le même nom. Un fichier de
     * 900 lignes n'est pas une frontière.
     *
     * On exige donc l'ÉTIQUETTE et les DEUX usages : le chiffre annoncé et la
     * différence qui en découle.
     */
    expect(
      page,
      "l'étiquette « Abonnements facturés » a disparu de l'écran admin",
    ).toContain("Abonnements factur");
    const usages = page.split("funnel.billedNow").length - 1;
    expect(
      usages,
      "billedNow n'est plus affiché comme chiffre propre : il ne reste que son " +
        "usage dérivé, donc l'écran est revenu à un seul nombre",
    ).toBeGreaterThanOrEqual(2);
    expect(
      page,
      "la page n'a pas de branche pour la lecture ratée",
    ).toMatch(/funnel\.revenueCountsFailed/);
  });
});
