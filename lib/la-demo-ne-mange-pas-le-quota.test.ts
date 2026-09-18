import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { comptePourLeQuota, quotaAtteint } from "./quota-du-plan";
import { demoAccountRow } from "./demo-data";

/**
 * LA DÉMONSTRATION QU'ON OFFRE NE MANGE PAS LE QUOTA DU PLAN.
 *
 * ── LE DÉFAUT ───────────────────────────────────────────────────────────────
 *
 * ⚠️⚠️ LE MODE DÉMO OCCUPAIT LA SEULE PLACE DU PLAN GRATUIT. Il crée un compte
 * (« Compte de démonstration ») et une fiche stratégie, marqués `is_demo`. Les
 * deux pages comptaient les lignes sans distinguer : un inscrit qui essayait la
 * démo — c'est le parcours de découverte du produit — était à sa limite AVANT
 * d'avoir créé quoi que ce soit.
 *
 * ⚠️ ET LA RÉPONSE DU PRODUIT ÉTAIT PIRE QUE LE BLOCAGE. Page Compte : « Tu as
 * atteint la limite de comptes de ton plan », avec un lien « Passer au plan
 * supérieur ». On demandait de PAYER pour sortir d'une démonstration offerte, à
 * quelqu'un qui possède zéro compte réel. Page Stratégie : le bouton
 * « nouvelle fiche » répondait par un refus.
 *
 * ⚠️ MESURÉ EN BASE LE 2026-09-18 : un compte gratuit inscrit le 16 août,
 * jamais passé par Stripe, est exactement dans cette situation (un compte réel,
 * un compte de démonstration, profil encore en `demo_mode`).
 *
 * ── LA RÈGLE ────────────────────────────────────────────────────────────────
 *
 * Un quota compte ce que le trader a CRÉÉ. Les lignes de démonstration sont
 * prêtées, et la sortie du mode démo les reprend.
 */

const RACINE = process.cwd();

describe("ce qui compte dans un quota", () => {
  const demo = { id: "d", is_demo: true };
  const sien = { id: "s", is_demo: false };
  // Ligne d'avant la colonne : elle appartient au trader.
  const ancien: { id: string; is_demo?: boolean } = { id: "a" };

  it("écarte les lignes de démonstration", () => {
    expect(comptePourLeQuota([demo, sien]).map((l) => l.id)).toEqual(["s"]);
  });

  /** ⚠️ Une ligne sans le drapeau est au trader : sinon on offrirait des places. */
  it("garde une ligne dont le drapeau est absent", () => {
    expect(comptePourLeQuota([ancien]).map((l) => l.id)).toEqual(["a"]);
  });

  /**
   * ⚠️⚠️ LE PARCOURS EXACT DU NOUVEL INSCRIT : il essaie la démo, puis veut
   * créer SON compte. L'ancienne version comptait 1 ≥ 1 et le renvoyait vers
   * la page de paiement.
   */
  it("laisse un plan gratuit créer sa première vraie ligne pendant la démo", () => {
    expect(
      quotaAtteint([demo], 1),
      "la démonstration offerte bloque la création du premier vrai compte",
    ).toBe(false);
  });

  it("bloque quand le trader a vraiment atteint sa limite", () => {
    expect(quotaAtteint([sien], 1)).toBe(true);
    expect(quotaAtteint([demo, sien], 1)).toBe(true);
  });

  /** ⚠️ `null` = illimité, `undefined` = plan pas encore lu : on ne bloque pas. */
  it("ne bloque jamais sans limite connue", () => {
    expect(quotaAtteint([sien, sien], null)).toBe(false);
    expect(quotaAtteint([sien, sien], undefined)).toBe(false);
  });

  /** ⚠️ Et la ligne que la démo crée VRAIMENT porte bien le drapeau. */
  it("le compte de démonstration est bien marqué", () => {
    expect(demoAccountRow("u1").is_demo).toBe(true);
  });
});

describe("les deux écrans qui appliquent une limite", () => {
  // ⚠️ Les commentaires DÉCRIVENT le défaut : les laisser ferait passer le
  // garde sur du code cassé. Ce dépôt a déjà payé ce piège trois fois.
  const nu = (f: string) =>
    readFileSync(join(RACINE, f), "utf8").replace(/\/\*[\s\S]*?\*\//g, "").replace(/\/\/[^\n]*/g, "");

  it("la page Compte ne compte plus les lignes brutes", () => {
    const src = nu("app/dashboard/challenge/page.tsx");
    expect(src, "la limite compte encore le compte de démonstration").not.toContain(
      "activeAccounts.length >= maxAccounts",
    );
    expect(src).toContain("quotaAtteint(activeAccounts, maxAccounts)");
  });

  it("la page Stratégie ne compte plus les lignes brutes", () => {
    const src = nu("app/dashboard/strategy/page.tsx");
    expect(src, "la limite compte encore la fiche de démonstration").not.toContain(
      "strategies.length >= maxStrategies",
    );
    expect(src).toContain("quotaAtteint(strategies, maxStrategies)");
    /**
     * ⚠️ ET LE DRAPEAU EST PORTÉ PAR LA LISTE, pas seulement déclaré dans son
     * type. Première version de ce garde : `expect(src).toContain("is_demo")`.
     * Il restait vert quand je retirais `is_demo` du `map`, parce que le type
     * de l'état le mentionne toujours. Un filtre aveugle, certifié correct.
     */
    const i = src.indexOf("const list = (allStrats");
    expect(i, "la construction de la liste a changé de forme").toBeGreaterThan(0);
    const mapping = src.slice(i, src.indexOf(";", i));
    expect(
      mapping,
      "is_demo n'est pas rapporté dans la liste : le filtre du quota est aveugle",
    ).toContain("is_demo");
  });
});
