import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { lireExclusionReseaux } from "./exclusion-reseaux";
import { sansCommentaires } from "./sans-commentaires";

/** Un client qui rend ce qu'on lui dit de rendre, sans jamais lever. */
function client(reponse: { data: unknown; error: unknown }) {
  return {
    from: () => ({
      select: () => ({
        eq: () => Promise.resolve(reponse as never),
      }),
    }),
  } as never;
}

describe("l'exclusion des codes de réseau", () => {
  it("remonte les codes en majuscules", async () => {
    const r = await lireExclusionReseaux(
      client({ data: [{ code: "gdinvest" }, { code: "Trader1" }], error: null }),
    );
    expect(Array.from(r.codes).sort()).toEqual(["GDINVEST", "TRADER1"]);
    expect(r.lectureRatee).toBe(false);
  });

  it("distingue « aucun réseau » de « je ne sais pas »", async () => {
    /**
     * ⚠️⚠️ TOUT LE DÉFAUT EST LÀ. Les deux cas donnaient un ensemble vide, donc
     * un relevé sans aucune exclusion. Le premier est normal (le produit n'a
     * pas encore de réseau), le second fait payer DEUX FOIS la même vente.
     */
    const vide = await lireExclusionReseaux(client({ data: [], error: null }));
    expect(vide.codes.size).toBe(0);
    expect(vide.lectureRatee).toBe(false);

    const rate = await lireExclusionReseaux(
      client({ data: null, error: { message: "permission denied for table partner_reps" } }),
    );
    expect(rate.codes.size).toBe(0);
    expect(rate.lectureRatee).toBe(true);
  });

  it("nomme la cause au lieu de la laisser dans les logs", async () => {
    // Les logs Vercel ne retiennent que 14 jours et ne sont pas requêtables :
    // une cause qui n'atteint pas l'écran est une cause perdue.
    const r = await lireExclusionReseaux(
      client({ data: null, error: { message: "JWT expired" } }),
    );
    expect(r.cause).toBe("JWT expired");
  });

  it("ne lève pas quand le client lui-même casse", async () => {
    const casse = {
      from: () => {
        throw new Error("base injoignable");
      },
    } as never;
    const r = await lireExclusionReseaux(casse);
    expect(r.lectureRatee).toBe(true);
    expect(r.cause).toContain("injoignable");
  });

  it("ignore une ligne sans code plutôt que d'exclure « NULL »", async () => {
    const r = await lireExclusionReseaux(
      client({ data: [{ code: null }, { code: "X" }], error: null }),
    );
    expect(Array.from(r.codes)).toEqual(["X"]);
  });
});

describe("le relevé d'affiliation", () => {
  const route = sansCommentaires(
    readFileSync(join(process.cwd(), "app/api/admin/affiliation/route.ts"), "utf8"),
  );

  it("passe par la lecture qui sait dire qu'elle a raté", () => {
    expect(
      route,
      "le relevé relit partner_reps à la main : une erreur de requête y " +
        "redeviendra « aucun réseau », donc des ventes comptées deux fois",
    ).toContain("lireExclusionReseaux(");
    expect(
      route,
      "la lecture directe de partner_reps est revenue dans la route",
    ).not.toContain('from("partner_reps")');
  });

  it("dit à l'écran que le relevé peut être en double", () => {
    expect(
      route,
      "l'échec de lecture ne sort pas dans la réponse : l'écran affichera un " +
        "relevé qui a l'air complet",
    ).toMatch(/exclusionReseauxRatee/);
  });
});
