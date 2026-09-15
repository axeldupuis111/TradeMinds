import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

/**
 * L'ÉCRAN D'ADMINISTRATION PROPOSE TOUS LES PLANS QUE SA ROUTE ACCEPTE.
 *
 * ⚠️⚠️ « PREMIUM » MANQUAIT AU MENU, ET C'EST LE PLAN DE TREIZE COMPTES.
 * Relevé le 2026-09-15 : `/api/admin/update-plan` valide `free | plus |
 * premium` depuis sa première ligne, et le sélecteur n'offrait que `free` et
 * `plus`. Le plan le plus cher, celui des partenaires et des comptes offerts,
 * ne pouvait ni s'accorder ni se retirer depuis l'écran fait pour ça.
 *
 * ⚠️ LA FORME HABITUELLE : la règle était écrite, côté serveur, et l'écran n'en
 * appliquait que les deux tiers. Ce test compare les deux listes plutôt que de
 * recopier la bonne réponse, pour qu'un quatrième plan les tienne ensemble.
 */
describe("les plans de l'écran d'administration", () => {
  const racine = process.cwd();
  const route = readFileSync(join(racine, "app/api/admin/update-plan/route.ts"), "utf8");
  const page = readFileSync(join(racine, "app/dashboard/admin/page.tsx"), "utf8");

  /** Les plans que la route accepte, lus dans la route. */
  function plansDeLaRoute(): string[] {
    const m = route.match(/const VALID_PLANS = \[([^\]]*)\]/);
    expect(m, "VALID_PLANS introuvable : ce test ne compare plus rien").toBeTruthy();
    return Array.from(m![1].matchAll(/"([a-z]+)"/g)).map((x) => x[1]);
  }

  /** Les plans que le menu propose, lus dans le JSX du sélecteur. */
  function plansDuMenu(): string[] {
    const debut = page.indexOf('id="admin-admin-plan"');
    expect(debut, "le sélecteur de plan a disparu").toBeGreaterThan(-1);
    const bloc = page.slice(debut, page.indexOf("</select>", debut));
    return Array.from(bloc.matchAll(/<option value="([a-z]+)"/g)).map((x) => x[1]);
  }

  it("le menu propose exactement ce que la route accepte", () => {
    const route = plansDeLaRoute();
    expect(route.length, "moins de trois plans : le produit a changé, ce test aussi").toBe(3);
    expect(plansDuMenu().sort()).toEqual([...route].sort());
  });

  it("l'état du composant connaît les mêmes plans", () => {
    for (const plan of plansDeLaRoute()) {
      expect(
        page,
        `le type de l'état n'accepte pas « ${plan} » : le menu le proposerait sans pouvoir le stocker`,
      ).toContain(`"${plan}"`);
    }
  });
});
