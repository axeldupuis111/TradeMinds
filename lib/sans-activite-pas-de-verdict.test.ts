import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { sansCommentaires } from "./sans-commentaires";

/**
 * NE PAS TRADER N'EST PAS DE LA DISCIPLINE.
 *
 * ── CE QUI ÉTAIT À L'ÉCRAN ──────────────────────────────────────────────────
 *
 * Page Objectifs, le 2026-09-15, sur un compte sans un seul trade du mois :
 *
 *     Pertes consécutives max   ≤ 2    0   Atteint
 *     Trades par jour           ≤ 3    0   Atteint
 *     Mes objectifs : 5 · 2 atteints · 3 en cours
 *
 * Un objectif PLAFOND est atteint par construction tant que rien ne s'est
 * passé : zéro perte consécutive, zéro trade par jour. Le produit félicitait
 * donc un trader pour son inaction, sur l'écran dont le métier est de mesurer
 * sa discipline.
 *
 * ⚠️ L'asymétrie rendait le défaut discret : un objectif PLANCHER
 * (« taux de réussite ≥ 50 % ») reste « en cours » à zéro, parce que 0 < 50.
 * Seuls les plafonds mentaient.
 *
 * ── LA RÈGLE EXISTAIT, APPLIQUÉE À L'HISTORIQUE ─────────────────────────────
 *
 * ⚠️⚠️ `historyFor` calcule DÉJÀ `hadData`, avec ce commentaire : « distingue
 * une période ratée d'une période sans aucune activité (affichée neutre côté
 * UI) ». La distinction était faite pour les périodes PASSÉES de la petite
 * frise, et pas pour la période EN COURS, c'est-à-dire la seule ligne que le
 * trader lit vraiment.
 *
 * Et le produit avait déjà tranché ailleurs : le profil public affiche « — »
 * plutôt qu'un 0 % calculé quand il n'y a pas de trade.
 */
describe("un objectif sans activité", () => {
  const api = sansCommentaires(
    readFileSync(join(process.cwd(), "app/api/goals/route.ts"), "utf8"),
  );
  const page = sansCommentaires(
    readFileSync(join(process.cwd(), "app/dashboard/goals/page.tsx"), "utf8"),
  );

  it("l'API dit s'il s'est passé quelque chose sur la période en cours", () => {
    expect(
      api,
      "hadData n'est plus renvoyé pour la période courante : l'écran ne pourra " +
        "plus distinguer « atteint » de « rien ne s'est passé »",
    ).toMatch(/hadData,/);
    expect(
      api,
      "hadData n'est plus tiré de la période courante de l'historique",
    ).toMatch(/history\.find\(\(h\) => h\.current\)/);
  });

  it("l'écran ne conclut pas sans donnée", () => {
    /**
     * ⚠️ On vérifie le point de DÉCISION, pas la présence du mot quelque part :
     * `hadData` apparaît déjà trois fois dans cette page pour la frise
     * d'historique, et un simple `includes` serait vert depuis toujours.
     */
    const debut = page.indexOf("function goalStatus");
    expect(debut, "goalStatus a disparu").toBeGreaterThan(-1);

    /**
     * ⚠️⚠️ LE CORPS COMMENCE À LA DERNIÈRE ACCOLADE DE LA LIGNE DE SIGNATURE.
     * La première version prenait `indexOf("{", debut)` et attrapait l'accolade
     * du TYPE DE RETOUR (`: { status: …; priority: number }`) : le découpage
     * rendait 58 caractères et le test échouait sur du code correct. Ce dépôt
     * avait déjà payé ce piège une fois, sur un type de paramètre.
     */
    const finDeLigne = page.indexOf("\n", debut);
    const ouverture = page.lastIndexOf("{", finDeLigne);
    let i = ouverture;
    let prof = 0;
    for (; i < page.length; i++) {
      if (page[i] === "{") prof++;
      else if (page[i] === "}" && --prof === 0) break;
    }
    const corps = page.slice(ouverture, i);

    expect(corps.length, "découpage raté").toBeGreaterThan(80);
    expect(
      corps,
      "goalStatus conclut sans regarder s'il s'est passé quelque chose : un " +
        "objectif plafond sera de nouveau « Atteint » sur un mois sans trade",
    ).toMatch(/hadData/);
  });

  it("le verdict d'absence précède celui d'atteinte", () => {
    /**
     * ⚠️ L'ORDRE EST LA RÈGLE. Placé après le verdict d'atteinte, le contrôle ne
     * servirait à rien : c'est justement `met` qui vaut `true` à tort quand rien
     * ne s'est passé.
     *
     * ⚠️ LE VERDICT D'ATTEINTE PASSE MAINTENANT PAR `objectifAtteint`, la règle
     * partagée : `goalStatus` était le SEUL endroit à l'appliquer, et trois
     * autres écrans lisaient `met` tout cru (voir objectif-atteint.test.ts).
     */
    const debut = page.indexOf("function goalStatus");
    const corps = page.slice(debut, debut + 900);
    const absence = corps.indexOf("hadData");
    const atteinte = corps.indexOf("objectifAtteint(g)");
    expect(absence, "le contrôle d'absence a disparu").toBeGreaterThan(-1);
    expect(atteinte, "le verdict d'atteinte a disparu").toBeGreaterThan(-1);
    expect(
      absence,
      "le contrôle d'absence passe APRÈS le verdict d'atteinte : il ne sert plus à rien",
    ).toBeLessThan(atteinte);
  });
});
