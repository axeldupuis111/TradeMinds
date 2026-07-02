import { describe, expect, it } from "vitest";
import { displayEventTitle, hasCuratedTitle } from "./economic-event-labels";

describe("displayEventTitle", () => {
  it("traduit les indicateurs connus en libellés clairs (fr)", () => {
    expect(displayEventTitle("CPI m/m", "fr")).toBe("Inflation CPI · mensuel");
    expect(displayEventTitle("Core CPI m/m", "fr")).toBe("Inflation CPI · sous-jacent · mensuel");
    expect(displayEventTitle("Non-Farm Employment Change", "fr")).toBe("Créations d'emplois NFP");
    expect(displayEventTitle("Unemployment Claims", "fr")).toBe("Inscriptions hebdo au chômage");
    expect(displayEventTitle("Flash Services PMI", "fr")).toBe("PMI services · préliminaire");
    expect(displayEventTitle("Federal Funds Rate", "fr")).toBe("Décision de taux directeur");
    expect(displayEventTitle("FOMC Press Conference", "fr")).toBe("Conférence de presse banque centrale");
    expect(displayEventTitle("Bank Holiday", "fr")).toBe("Jour férié bancaire");
  });

  it("ignore les préfixes de nationalité du flux", () => {
    expect(displayEventTitle("French Flash Manufacturing PMI", "fr")).toBe("PMI manufacturier · préliminaire");
    expect(displayEventTitle("German Prelim CPI m/m", "fr")).toBe("Inflation CPI · préliminaire · mensuel");
  });

  it("ne regroupe pas Employment Change sous le libellé NFP", () => {
    expect(displayEventTitle("Employment Change", "fr")).toBe("Variation de l'emploi");
  });

  it("rend le titre du flux inchangé quand l'indicateur n'est pas curaté", () => {
    expect(displayEventTitle("Fed Chair Powell Speaks", "fr")).toBe("Fed Chair Powell Speaks");
    expect(displayEventTitle("German Ifo Business Climate", "fr")).toBe("German Ifo Business Climate");
    expect(hasCuratedTitle("Fed Chair Powell Speaks", "fr")).toBe(false);
  });

  it("fonctionne dans les 4 langues", () => {
    expect(displayEventTitle("CPI y/y", "en")).toBe("CPI inflation · y/y");
    expect(displayEventTitle("CPI y/y", "de")).toBe("Verbraucherpreise (CPI) · jährlich");
    expect(displayEventTitle("CPI y/y", "es")).toBe("Inflación CPI · anual");
  });
});
