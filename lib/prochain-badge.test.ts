import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

/**
 * LE PRODUIT NE PROMET PAS UNE RÉCOMPENSE QU'IL NE PEUT PAS REMETTRE.
 *
 * ── LE DÉFAUT, VU À L'ÉCRAN ─────────────────────────────────────────────────
 *
 * ⚠️⚠️ « PROCHAIN BADGE DANS 3 JOURS · 7/10 » POUR UN BADGE DÉJÀ GAGNÉ. Mesuré
 * le 2026-09-15 : série de discipline à 7 jours, badge « 10 jours de
 * discipline » débloqué le 2026-07-21 et affiché comme acquis sur le profil
 * public, au même moment.
 *
 * ⚠️ ET RIEN NE SERAIT ARRIVÉ AU DIXIÈME JOUR : la boucle d'attribution saute
 * les badges déjà en base (`existing.has(badge.key)`). Ni confettis, ni
 * bannière, ni ligne écrite. La carte comptait les jours vers un événement qui
 * n'existait plus.
 *
 * ⚠️ LA CAUSE : le palier visé se déduisait de la SEULE série en cours
 * (`streak < 3 ? 3 : streak < 10 ? 10 : …`), sans jamais regarder ce que le
 * trader avait déjà débloqué. Le défaut n'apparaît donc qu'après une série
 * cassée, c'est-à-dire chez les traders qui ont le plus besoin de la carte.
 */
describe("le prochain palier de série", () => {
  const src = readFileSync(
    join(process.cwd(), "components/dashboard/GoalsStreaks.tsx"),
    "utf8",
  );

  it("se lit dans les badges déjà débloqués, pas dans la série en cours", () => {
    expect(
      src,
      "le palier se redéduit de la série : un badge déjà gagné sera de nouveau promis",
    ).toContain("PALIERS_SERIE.find((p) => !unlockedKeys.has(CLE_DU_PALIER[p]))");
    expect(src, "la table des clés de palier a disparu").toContain('3: "discipline_3"');
    expect(src, "la table des clés de palier a disparu").toContain('30: "discipline_30"');
  });

  it("ne compte jamais un nombre de jours négatif", () => {
    // Une série qui dépasse un palier non encore écrit en base (insertion
    // refusée, et journalisée) affichait « Prochain badge dans -2 jours ».
    expect(src).toContain("Math.max(0, nextMilestone - streak)");
  });

  it("ne dessine jamais une barre vide pour une série déjà avancée", () => {
    /**
     * ⚠️ Série de 7 jours et palier visé à 30 : le point de départ resterait le
     * palier précédent (10), donc un pourcentage NÉGATIF. La barre affichait
     * zéro à quelqu'un qui a fait les deux tiers du chemin.
     */
    expect(src).toContain("const departBarre = streak >= prevMilestone ? prevMilestone : 0;");
    expect(src).toMatch(/Math\.max\(0, Math\.min\(100,/);
  });

  /**
   * La règle en clair, jouée sur les valeurs mesurées ce jour-là.
   */
  it("reproduit le cas mesuré", () => {
    const PALIERS = [3, 10, 30] as const;
    const CLE: Record<number, string> = { 3: "discipline_3", 10: "discipline_10", 30: "discipline_30" };
    const prochain = (streak: number, debloques: string[]) => {
      const acquis = new Set(debloques);
      const cible = PALIERS.find((p) => !acquis.has(CLE[p])) ?? null;
      return cible === null ? null : { cible, jours: Math.max(0, cible - streak) };
    };

    // Le cas d'Axel : 7 jours de série, badges 3 et 10 déjà acquis.
    expect(prochain(7, ["discipline_3", "discipline_10"])).toEqual({ cible: 30, jours: 23 });
    // Un trader neuf vise bien le premier palier.
    expect(prochain(1, [])).toEqual({ cible: 3, jours: 2 });
    // Tout débloqué : plus de promesse du tout.
    expect(prochain(95, ["discipline_3", "discipline_10", "discipline_30"])).toBeNull();
  });
});
