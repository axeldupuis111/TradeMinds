import { describe, expect, it } from "vitest";
import { displayEventTitle, hasCuratedTitle } from "./economic-event-labels";

describe("displayEventTitle", () => {
  it("traduit les indicateurs connus en libellés clairs (fr)", () => {
    expect(displayEventTitle("CPI m/m", "fr")).toBe("Inflation CPI · mensuel");
    expect(displayEventTitle("Core CPI m/m", "fr")).toBe("Inflation CPI · sous-jacent · mensuel");
    expect(displayEventTitle("Non-Farm Employment Change", "fr")).toBe("Créations d'emplois NFP");
    expect(displayEventTitle("Unemployment Claims", "fr")).toBe("Inscriptions hebdo au chômage");
    expect(displayEventTitle("Flash Services PMI", "fr")).toBe("PMI services · préliminaire");
    /**
     * ⚠️ CHAQUE BANQUE CENTRALE NOMME SON TAUX. Le glossaire aliase « federal
     * funds rate », « main refinancing rate » et « monetary policy statement »
     * sur un même indicateur, ce qui est juste pour EXPLIQUER et faux pour
     * NOMMER : la BCE publiait son taux ET son communiqué à 14:15, et l'écran
     * affichait deux fois « Décision de taux directeur » à la même minute.
     */
    expect(displayEventTitle("Federal Funds Rate", "fr")).toBe("Taux des fonds fédéraux");
    expect(displayEventTitle("Main Refinancing Rate", "fr")).toBe("Taux de refinancement BCE");
    expect(displayEventTitle("Monetary Policy Statement", "fr")).toBe(
      "Communiqué de politique monétaire",
    );
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

/**
 * DEUX ANNONCES DIFFÉRENTES NE PORTENT PAS LE MÊME NOM.
 *
 * ⚠️⚠️ VU À L'ÉCRAN, SUR « AVANT LA SESSION » : deux fois « 🔴 14:15 · EUR ·
 * Décision de taux directeur », à la même minute. Ce n'était pas un doublon :
 * la BCE publie son TAUX puis son COMMUNIQUÉ, et le glossaire aliasait les deux
 * sur le même indicateur — juste pour EXPLIQUER, faux pour NOMMER.
 *
 * ⚠️ LE TRADER, LUI, EN CONCLUT QUE LE CALENDRIER EST CASSÉ, et il a raison de
 * s'en méfier : c'est l'écran qui lui dit à quelle minute ne pas être en
 * position.
 *
 * ⚠️ LES TROIS GRANDES BANQUES CENTRALES ONT LA MÊME PAIRE, à la même minute :
 * Fed (taux + communiqué FOMC), BCE (taux + communiqué), BoE (taux + résumé).
 * La règle porte donc sur tout le catalogue, pas sur ces trois-là.
 */
describe("aucun libellé n'en désigne deux", () => {
  const ANNONCES = [
    "Federal Funds Rate",
    "FOMC Statement",
    "Main Refinancing Rate",
    "Deposit Facility Rate",
    "Monetary Policy Statement",
    "Official Bank Rate",
    "Monetary Policy Summary",
    "Cash Rate",
    "Overnight Rate",
    "Rate Statement",
    "Interest Rate Decision",
  ];

  for (const langue of ["fr", "en", "de", "es"] as const) {
    it(`les annonces de banque centrale portent des noms distincts en ${langue}`, () => {
      const parNom = new Map<string, string[]>();
      for (const brut of ANNONCES) {
        const nom = displayEventTitle(brut, langue);
        const liste = parNom.get(nom) ?? [];
        liste.push(brut);
        parNom.set(nom, liste);
      }
      const collisions = Array.from(parNom.entries())
        .filter(([, sources]) => sources.length > 1)
        .map(([nom, sources]) => `« ${nom} » ← ${sources.join(" + ")}`);
      expect(collisions, "annonces indistinguables : " + collisions.join(" | ")).toEqual([]);
    });
  }
});
