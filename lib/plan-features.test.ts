import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import de from "./i18n/de";
import en from "./i18n/en";
import es from "./i18n/es";
import fr from "./i18n/fr";
import {
  countLockedFeatures,
  FREE_BENEFITS,
  PLAN_FEATURES,
  PLUS_BENEFITS,
  PREMIUM_BENEFITS,
} from "./plan-features";

/**
 * TOUT CE QU'ON VERROUILLE EST DANS LA TABLE DES TARIFS.
 *
 * ── POURQUOI CE FICHIER EXISTE ──────────────────────────────────────────────
 *
 * ⚠️⚠️ DEUX ONGLETS ENTIERS MANQUAIENT. Backtest et Projection sont verrouillés
 * « premium » dans la barre latérale depuis leur sortie, et n'apparaissaient
 * dans AUCUNE comparaison de plans : ni sur la page de tarifs, ni sur la
 * landing, qui lisent toutes les deux cette table. Quelqu'un qui hésite entre
 * Plus et Premium ne voyait pas les deux plus grosses raisons de prendre
 * Premium, et le compteur « N fonctionnalités verrouillées » les oubliait.
 *
 * ⚠️ PERSONNE NE PENSE À LA TABLE DE TARIFS LE JOUR OÙ IL ÉCRIT UNE PAGE. C'est
 * exactement le genre d'oubli qu'un test attrape et qu'une relecture non : il
 * n'y a rien de cassé à voir, seulement quelque chose d'absent.
 */
describe("la table des tarifs et ce que l'application verrouille", () => {
  const sidebar = readFileSync(join(process.cwd(), "components/Sidebar.tsx"), "utf8");

  /**
   * Les pages que la barre latérale marque comme payantes.
   *
   * ⚠️ On les LIT plutôt que de les recopier : une liste écrite à la main ici
   * aurait le même défaut que celui qu'on corrige.
   */
  const pagesGardees = Array.from(
    sidebar.matchAll(/href:\s*"\/dashboard\/([a-z-]+)"[^}]*requiredPlan:\s*"(plus|premium)"/g),
  ).map((m) => ({ page: m[1], plan: m[2] as "plus" | "premium" }));

  it("lit bien des pages gardées, sinon ce test ne prouve rien", () => {
    expect(pagesGardees.length).toBeGreaterThan(3);
  });

  /**
   * Le nom de la ligne de tarif qui correspond à une page.
   *
   * ⚠️ La correspondance n'est pas mécanique (« goals » se vend sous
   * « plan_feat_goals_hub »), donc elle est écrite ici, et le test échoue sur
   * toute page qu'elle ne couvre pas : une nouvelle page force à décider
   * comment elle se vend, au lieu de disparaître.
   */
  const LIGNE_DE_TARIF: Record<string, string> = {
    macro: "plan_feat_macro",
    projection: "plan_feat_projection",
    backtest: "plan_feat_backtest",
    goals: "plan_feat_goals_hub",
    review: "plan_feat_monthly_review",
    challenge: "plan_feat_challenge_guardian",
    community: "plan_feat_public_profile",
  };

  it("chaque page payante se vend quelque part", () => {
    const cles = new Set(PLAN_FEATURES.map((f) => f.key));
    const absentes: string[] = [];
    for (const { page } of pagesGardees) {
      const ligne = LIGNE_DE_TARIF[page];
      if (!ligne) absentes.push(`${page} : aucune ligne de tarif ne lui est attribuée`);
      else if (!cles.has(ligne)) absentes.push(`${page} → ${ligne}, absente de la table`);
    }
    expect(absentes, absentes.join(" | ")).toEqual([]);
  });

  /**
   * ⚠️ ET LA LIGNE DIT LA MÊME CHOSE QUE LE VERROU. Vendre en « Plus » ce que
   * l'application réserve au Premium serait pire qu'un oubli : une promesse que
   * le produit ne tient pas.
   */
  it("la table verrouille au même niveau que l'application", () => {
    const parCle = new Map(PLAN_FEATURES.map((f) => [f.key, f]));
    const desaccords: string[] = [];
    for (const { page, plan } of pagesGardees) {
      const f = parCle.get(LIGNE_DE_TARIF[page] ?? "");
      if (!f) continue;
      if (plan === "premium" && f.plus !== false) {
        desaccords.push(`${page} : réservée au Premium, mais vendue en Plus`);
      }
      if (f.free !== false) desaccords.push(`${page} : gardée, mais annoncée gratuite`);
    }
    expect(desaccords, desaccords.join(" | ")).toEqual([]);
  });

  it("les deux nouvelles lignes existent dans les quatre langues", () => {
    for (const [nom, dico] of Array.from(Object.entries({ fr, en, es, de }))) {
      for (const cle of ["plan_feat_backtest", "plan_feat_projection"]) {
        expect((dico as Record<string, string>)[cle], `${cle} en ${nom}`).toBeTruthy();
      }
    }
  });

  /**
   * ⚠️ LE COMPTEUR SUIT. « N fonctionnalités verrouillées » s'affiche dans la
   * barre latérale d'un compte gratuit : un chiffre qui oublie deux onglets
   * sous-vend le produit à la personne qu'il essaie de convaincre.
   */
  it("le compteur de verrous compte les nouvelles", () => {
    expect(countLockedFeatures("free")).toBeGreaterThan(countLockedFeatures("plus"));
    expect(countLockedFeatures("premium")).toBe(0);
    const verrouilleesEnPlus = PLAN_FEATURES.filter((f) => f.plus === false).map((f) => f.key);
    expect(verrouilleesEnPlus).toContain("plan_feat_backtest");
    expect(verrouilleesEnPlus).toContain("plan_feat_projection");
  });
});

/**
 * ⚠️⚠️ SEPT PUCES VANTAIENT LE PREMIUM, AUCUNE NE PARLAIT DU BACKTEST, qui est
 * la plus grosse différence entre Plus et Premium et la seule chose qu'aucun
 * autre journal ne propose. Une fonctionnalité construite pendant des semaines
 * et absente de l'argumentaire n'existe pas commercialement.
 */
describe("les atouts mis en avant", () => {
  it("nomment le backtest", () => {
    expect(PREMIUM_BENEFITS).toContain("plan_benefit_premium_backtest");
  });

  it("sont tous traduits dans les quatre langues", () => {
    for (const [nom, dico] of Array.from(Object.entries({ fr, en, es, de }))) {
      for (const cle of [...FREE_BENEFITS, ...PLUS_BENEFITS, ...PREMIUM_BENEFITS]) {
        expect((dico as Record<string, string>)[cle], `${cle} en ${nom}`).toBeTruthy();
      }
    }
  });

  /**
   * ⚠️ ET AUCUN NE PROMET LA RENTABILITÉ. L'onglet refuse de le dire, sur
   * chacun de ses écrans et sous plusieurs tests ; la landing n'a pas le droit
   * de le dire à sa place, sinon toute cette prudence ne sert plus à rien.
   */
  it("ne promettent pas de gagner de l'argent", () => {
    const PROMESSE = /rentable|rentabilité|profitable|gagner de l'argent|garantit/i;
    const fautes = [...FREE_BENEFITS, ...PLUS_BENEFITS, ...PREMIUM_BENEFITS]
      .map((c) => [c, (fr as Record<string, string>)[c]] as const)
      .filter(([, texte]) => PROMESSE.test(texte ?? ""))
      .map(([c]) => c);
    expect(fautes, "promesse de gain : " + fautes.join(", ")).toEqual([]);
  });
});
