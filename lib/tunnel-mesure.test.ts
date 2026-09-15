import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

/**
 * L'ÉTAPE « OFFRE » DU TUNNEL SE MESURE SUR LA PAGE, PAS SUR TROIS BOUTONS.
 *
 * ── LE DÉFAUT, LU DANS L'ADMINISTRATION ─────────────────────────────────────
 *
 * ⚠️⚠️ « 0 UTILISATEUR A CLIQUÉ SUR UNE OFFRE » PENDANT QUE DEUX PAIEMENTS SE
 * LANÇAIENT. Mesuré le 2026-09-15 sur /api/admin/funnel : `upgradeCtaUsers: 0`,
 * `checkoutStarted: 2`. Deux chiffres du même tunnel qui se contredisent.
 *
 * ⚠️ LA CAUSE : `upgrade_cta_clicked` n'était posé que sur TROIS boutons, tous
 * dans `app/dashboard/analysis/page.tsx`, alors que le produit compte dix-huit
 * chemins vers `/dashboard/upgrade` (barre latérale, palette de commandes, dock
 * du coach, calculateur, import CSV, panneau de trade, bandeau d'abonnement,
 * débrief, plan de la semaine, backtest…). C'est le chiffre qui sert à décider
 * quoi construire, et il ne voyait qu'un quinzième de la surface.
 *
 * ⚠️ POURQUOI LA MESURE EST SUR LA PAGE ET PAS SUR LES BOUTONS : une liste de
 * dix-huit appels à tenir à jour est exactement ce qui a produit le défaut. Un
 * dix-neuvième lien s'ajoutera sans personne pour y penser ; la page, elle, est
 * le passage obligé.
 */
describe("la mesure du tunnel d'abonnement", () => {
  const racine = process.cwd();
  const upgrade = readFileSync(join(racine, "app/dashboard/upgrade/page.tsx"), "utf8");

  it("la page d'offres mesure son arrivée", () => {
    expect(
      upgrade,
      "l'arrivée sur la page d'offres n'est plus comptée : le tunnel reperd " +
        "tous les chemins qui ne passent pas par les boutons de l'analyse",
    ).toContain('track("upgrade_cta_clicked", { source: `page:${source}` })');
  });

  it("elle ne la compte qu'une fois par visite", () => {
    // Sans le verrou, un rendu de plus (changement de plan, modale) rejouerait
    // l'événement et gonflerait la ventilation par source.
    expect(upgrade).toContain("if (arriveeMesuree.current) return;");
    expect(upgrade).toContain("arriveeMesuree.current = true;");
  });

  /**
   * ⚠️ ET LE NOMBRE DE CHEMINS EST RAPPELÉ ICI. S'il grandit encore, ce test ne
   * casse pas : il n'a pas à casser. Il existe pour que le prochain lecteur
   * sache POURQUOI la mesure ne vit pas sur les boutons.
   */
  it("il existe bien plus de chemins vers l'offre que de boutons mesurés", () => {
    const fichiers: string[] = [];
    const marcher = (d: string) => {
      for (const e of readdirSync(d)) {
        if (e === "node_modules" || e === ".next") continue;
        const p = join(d, e);
        if (statSync(p).isDirectory()) marcher(p);
        else if (/\.tsx$/.test(p) && !p.includes(".test.")) fichiers.push(p);
      }
    };
    marcher(join(racine, "app"));
    marcher(join(racine, "components"));

    let chemins = 0;
    let boutonsMesures = 0;
    for (const f of fichiers) {
      const src = readFileSync(f, "utf8");
      chemins += (src.match(/["'`]\/dashboard\/upgrade/g) ?? []).length;
      boutonsMesures += (src.match(/track\("upgrade_cta_clicked"/g) ?? []).length;
    }
    expect(chemins, "plus aucun chemin vers l'offre ?").toBeGreaterThan(10);
    expect(
      boutonsMesures,
      "les boutons mesurés couvrent maintenant tous les chemins : si c'est " +
        "vraiment le cas, c'est la mesure de page qui devient redondante, pas " +
        "l'inverse",
    ).toBeLessThan(chemins);
  });
});
