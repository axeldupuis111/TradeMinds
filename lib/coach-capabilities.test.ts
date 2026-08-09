import { describe, expect, it } from "vitest";
import { TOOL_MIN_PLAN } from "./coach-tools";
import {
  COACH_CAPABILITIES,
  capabilitiesForPlan,
  capabilityPlan,
  toolCountForPlan,
  totalToolCount,
} from "./coach-capabilities";
import fr from "./i18n/fr";
import en from "./i18n/en";
import es from "./i18n/es";
import de from "./i18n/de";

describe("la page de vente ne peut pas mentir sur le produit", () => {
  it("chaque outil du catalogue est vendu par exactement une promesse", () => {
    const sold = COACH_CAPABILITIES.flatMap((c) => c.tools);
    const catalogue = Object.keys(TOOL_MIN_PLAN);

    // Un outil livré mais jamais vendu, c'est du travail invisible.
    expect([...catalogue].sort()).toEqual([...sold].sort());
    // Un outil vendu deux fois, c'est la même promesse comptée deux fois.
    expect(new Set(sold).size).toBe(sold.length);
  });

  it("ne promet jamais un outil inexistant", () => {
    for (const cap of COACH_CAPABILITIES) {
      for (const tool of cap.tools) {
        expect(TOOL_MIN_PLAN[tool], `${cap.key} vend ${tool}, absent du catalogue`).toBeDefined();
      }
    }
  });

  it("aligne le plan d'une promesse sur son outil le plus verrouillé", () => {
    // Saisir des trades exige create_trade, réservé au Premium : la promesse
    // ne peut pas s'afficher en Plus sous prétexte que update_trade y serait.
    const write = COACH_CAPABILITIES.find((c) => c.key === "cap_write_trades")!;
    expect(capabilityPlan(write)).toBe("premium");

    const sizing = COACH_CAPABILITIES.find((c) => c.key === "cap_position_size")!;
    expect(capabilityPlan(sizing)).toBe("free");
  });

  it("empile les paliers au lieu de les cloisonner", () => {
    const free = capabilitiesForPlan("free");
    const plus = capabilitiesForPlan("plus");
    const premium = capabilitiesForPlan("premium");

    // Un abonné Premium garde tout ce que le Plus offrait.
    expect(plus).toEqual(expect.arrayContaining(free));
    expect(premium).toEqual(expect.arrayContaining(plus));
    expect(premium.length).toBe(COACH_CAPABILITIES.length);
  });

  it("compte les outils réellement ouverts par plan", () => {
    expect(toolCountForPlan("free")).toBeLessThan(toolCountForPlan("plus"));
    expect(toolCountForPlan("plus")).toBeLessThan(toolCountForPlan("premium"));
    expect(toolCountForPlan("premium")).toBe(totalToolCount());
  });

  it("le chiffre annoncé est celui du catalogue, jamais une valeur écrite en dur", () => {
    expect(totalToolCount()).toBe(Object.keys(TOOL_MIN_PLAN).length);
  });
});

describe("chaque promesse est traduite dans les 4 langues", () => {
  const DICTS: Record<string, Record<string, string>> = { fr, en, es, de };

  for (const [lang, dict] of Object.entries(DICTS)) {
    it(`${lang} : aucune promesse muette`, () => {
      const missing = COACH_CAPABILITIES.map((c) => c.key).filter((k) => !dict[k]);
      expect(missing, `clés absentes en ${lang}`).toEqual([]);
    });
  }

  it("aucun tiret long dans les promesses françaises", () => {
    // Marqueur de texte généré : proscrit dans la voix de TradeDiscipline.
    const offenders = COACH_CAPABILITIES
      .map((c) => fr[c.key])
      .filter((phrase) => /[—–]/.test(phrase ?? ""));
    expect(offenders).toEqual([]);
  });
});
