import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it, vi } from "vitest";
import type { SupabaseClient } from "@supabase/supabase-js";
import { executeCoachTool } from "./coach-tools";

/**
 * CE QU'UN TRADER RÉÉCRIT LUI APPARTIENT, DONC CE N'EST PLUS DE LA DÉMO.
 *
 * ── LE DÉFAUT ───────────────────────────────────────────────────────────────
 *
 * ⚠️⚠️ SORTIR DU MODE DÉMO EFFAÇAIT LE TRAVAIL DU TRADER. Le mode démo insère
 * une stratégie et un compte marqués `is_demo = true`, et `/api/demo/exit`
 * supprime TOUTES les lignes ainsi marquées. Mais les écrans d'édition chargent
 * ces lignes comme les autres (aucun filtre sur `is_demo`) et les mettent à
 * jour sans toucher au drapeau.
 *
 * Le chemin complet, et il n'a rien d'exotique : un inscrit active la démo pour
 * voir à quoi ressemble le produit, trouve une fiche stratégie déjà là, écrit
 * LA SIENNE par-dessus, puis désactive la démo pour repartir sur du propre. Sa
 * fiche part avec.
 *
 * ⚠️ CE N'EST PAS THÉORIQUE : mesuré en production le 2026-09-17, un compte est
 * exactement dans cet état, avec une stratégie nommée « VP + FVG m1 » — son
 * nom, son texte, aucune des règles du gabarit — encore marquée comme
 * démonstration.
 *
 * ── LA RÈGLE ────────────────────────────────────────────────────────────────
 *
 * Éditer une ligne de démonstration la fait passer du côté réel. La démo n'y
 * perd rien : ce qui est resté fictif porte toujours son drapeau et sera purgé
 * normalement.
 */

const RACINE = process.cwd();
const USER = "11111111-1111-4111-8111-111111111111";

describe("la purge du mode démo", () => {
  /** ⚠️ Le test ne vaut que si la purge efface bien sur ce drapeau. */
  it("efface toujours sur `is_demo`, c'est ce qui rend l'oubli coûteux", () => {
    const src = readFileSync(join(RACINE, "app/api/demo/exit/route.ts"), "utf8");
    expect(src).toContain('.eq("is_demo", true)');
    expect(src, "la stratégie n'est plus purgée : ce test doit être revu").toMatch(
      /\["trades", "strategies", "prop_challenges"\]/,
    );
  });

  it("les écrans d'édition ne filtrent pas les lignes de démonstration", () => {
    // C'est ce qui rend la correction nécessaire plutôt qu'optionnelle : on ne
    // peut pas compter sur le fait que le trader n'y touchera pas.
    const page = readFileSync(join(RACINE, "app/dashboard/strategy/page.tsx"), "utf8");
    const i = page.indexOf('.from("strategies")');
    const lecture = page.slice(i, i + 220);
    expect(lecture, "la page filtre maintenant sur is_demo : ce test doit être revu").not.toContain(
      "is_demo",
    );
  });
});

describe("éditer une ligne de démonstration", () => {
  const CIBLES: [string, string][] = [
    [
      "app/dashboard/strategy/page.tsx",
      'update({ ...payload, is_demo: false })',
    ],
    [
      "app/dashboard/challenge/page.tsx",
      'update({ ...data, is_demo: false })',
    ],
    [
      "lib/coach-tools.ts",
      'update({ ...patch, is_demo: false })',
    ],
  ];

  it("la fait passer du côté réel, sur les trois chemins d'édition", () => {
    const fautes: string[] = [];
    for (const [fichier, marqueur] of CIBLES) {
      if (!readFileSync(join(RACINE, fichier), "utf8").includes(marqueur)) {
        fautes.push(`${fichier} : ${marqueur}`);
      }
    }
    expect(
      fautes,
      "chemins d'édition qui laissent le drapeau de démonstration : le travail " +
        "du trader y sera effacé à la sortie du mode démo :\n  " + fautes.join("\n  "),
    ).toEqual([]);
  });

  /**
   * ⚠️ ET ON LE VÉRIFIE EN EXÉCUTANT, pas seulement en lisant : l'outil du
   * coach écrit vraiment `is_demo: false` dans sa mise à jour.
   */
  it("l'outil du coach l'écrit vraiment", async () => {
    const ecrit: Record<string, unknown>[] = [];
    const builder: Record<string, unknown> = {};
    for (const m of ["select", "eq", "order", "limit"]) builder[m] = () => builder;
    builder.update = (row: Record<string, unknown>) => { ecrit.push(row); return builder; };
    builder.then = (r: (v: unknown) => unknown) => r({ data: [{ id: "s1" }], error: null });
    const client = { from: vi.fn(() => builder) } as unknown as SupabaseClient;

    await executeCoachTool(client, USER, "update_strategy", {
      strategy_id: "22222222-2222-4222-8222-222222222222",
      name: "Ma vraie stratégie",
    }, "Europe/Paris");

    expect(ecrit.length, "aucune mise à jour n'a été émise").toBeGreaterThan(0);
    expect(ecrit[0].is_demo, "le drapeau de démonstration survit à l'édition").toBe(false);
    expect(ecrit[0].name, "la mise à jour ne porte plus le changement demandé").toBe("Ma vraie stratégie");
  });
});
