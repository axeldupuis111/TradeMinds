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

  /**
   * ⚠️⚠️ ET LE CHIFFRE AFFICHÉ, PAS SEULEMENT LE STATUT. La règle était tenue
   * par `goalStatus` (« En cours » plutôt qu'« Atteint ») et par la frise
   * d'historique (« pas de données »), mais la colonne PROGRESSION écrivait
   * quand même « 0 % » et « 0/100 ». Vu à l'écran le 2026-09-17 : cinq
   * objectifs, cinq zéros, sur un compte dont le dernier trade datait du
   * 26 août. Un taux de réussite qui n'existe pas n'est pas un taux de zéro,
   * et le profil public écrit « — » depuis longtemps pour cette raison-là.
   *
   * ⚠️ ET LA BARRE MENTAIT DANS L'AUTRE SENS : un objectif PLAFOND (« trades
   * par jour ≤ 3 ») a une progression de 100 % tant que la valeur vaut zéro,
   * donc elle s'affichait PLEINE pour quelqu'un qui n'avait rien fait.
   */
  it("la valeur et la barre ne concluent pas non plus", () => {
    expect(page, "la valeur brute est de nouveau affichée telle quelle").not.toContain(
      "{g.value}{unit(g.metric)}",
    );
    expect(page, "la valeur ne passe plus par le rendu qui sait se taire").toContain(
      "{valeurLisible(g)}",
    );

    const i = page.indexOf("function valeurLisible");
    expect(i, "valeurLisible a disparu").toBeGreaterThan(-1);
    const corps = page.slice(i, page.indexOf("}", page.indexOf("return", i)));
    expect(corps, "valeurLisible ne regarde pas s'il s'est passé quelque chose").toContain(
      "hadData === false",
    );

    /**
     * Les deux rendus de la barre d'un objectif, desktop et mobile : une règle
     * appliquée à un seul des deux laisse la moitié des lecteurs devant une
     * barre pleine.
     *
     * ⚠️ ON NE VISE QUE LES BARRES D'OBJECTIF (`g.progress`). `GrowBar` sert
     * aussi au palier de série et aux deux taux de l'edge, qui ne dépendent pas
     * de `hadData` : les inclure ferait un garde qui accuse du code correct,
     * donc un garde qu'on finit par désactiver.
     */
    const barres = Array.from(page.matchAll(/<GrowBar pct=\{([^}]*)\}/g))
      .map((m) => m[1])
      .filter((b) => b.includes("g.progress"));
    expect(barres.length, "les barres d'objectif ont disparu").toBeGreaterThanOrEqual(2);
    const sansGarde = barres.filter((b) => !b.includes("hadData === false"));
    expect(
      sansGarde,
      "barres qui se remplissent sans qu'il se soit rien passé : " + sansGarde.join(" | "),
    ).toEqual([]);
  });

  /**
   * ⚠️ « PROCHAINE VICTOIRE » NE PEUT PAS DÉSIGNER UN OBJECTIF SANS ACTIVITÉ, et
   * c'est son FILTRE qui l'en empêche, pas un hasard : un objectif plafond sans
   * donnée a une progression de 100 % (exclue) et un objectif plancher en a une
   * de 0 % (sous le seuil de 25 %). Élargir ce filtre remettrait une carte
   * « tu y es presque » sur un mois où rien ne s'est passé.
   */
  it("la carte « prochaine victoire » garde le filtre qui la protège", () => {
    const i = page.indexOf("const focusGoal = metricGoals");
    expect(i, "focusGoal a disparu").toBeGreaterThan(-1);
    const filtre = page.slice(i, page.indexOf("[0]", i));
    expect(filtre, "un objectif déjà atteint peut redevenir « prochaine victoire »").toContain("!g.met");
    expect(filtre, "le plancher de progression a sauté").toContain("g.progress >= 25");
    expect(filtre, "le plafond de progression a sauté").toContain("g.progress < 100");
  });
});
