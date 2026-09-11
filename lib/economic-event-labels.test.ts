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

  /**
   * ⚠️ LE REPLI EXISTE TOUJOURS, il est simplement devenu RARE : ce qui n'est
   * ni curaté, ni une forme connue, ni composable reste en anglais, et c'est
   * mieux qu'un nom inventé. « Ifo Business Climate » est dans ce cas : le nom
   * de l'institut allemand fait partie du nom de l'indice.
   */
  it("rend le titre du flux inchangé quand rien ne le reconnaît", () => {
    expect(displayEventTitle("German Ifo Business Climate", "fr")).toBe("German Ifo Business Climate");
    expect(hasCuratedTitle("German Ifo Business Climate", "fr")).toBe(false);
  });

  /**
   * ── LA COUCHE DE COMPOSITION ──────────────────────────────────────────────
   *
   * ⚠️⚠️ RELEVÉ SUR LE CALENDRIER DÉPLOYÉ, EN FRANÇAIS : sur les quatre-vingt-
   * une annonces d'une semaine, une soixantaine s'affichaient en anglais brut.
   * La table curatée couvre les indicateurs majeurs ; le reste tombait dans le
   * repli, sur une page dont la promesse est « toutes les annonces,
   * EXPLIQUÉES », réservée aux abonnés Premium.
   *
   * ⚠️ ON COMPOSE AU LIEU D'ÉNUMÉRER : le flux invente un titre à chaque
   * banque centrale, mais ce qui se répète, ce sont des FORMES.
   */
  it("traduit les formes qui reviennent : discours et adjudication", () => {
    expect(displayEventTitle("Fed Chair Powell Speaks", "fr")).toBe("Discours de Fed Chair Powell");
    expect(displayEventTitle("ECB President Lagarde Speaks", "es")).toBe("Discurso de ECB President Lagarde");
    expect(displayEventTitle("German 10-y Bond Auction", "fr")).toBe(
      "Adjudication d'obligations à 10 ans · Allemagne",
    );
  });

  it("compose un terme connu avec son pays et sa période", () => {
    expect(displayEventTitle("German Industrial Production m/m", "fr")).toBe(
      "Production industrielle · Allemagne · mensuel",
    );
    // ⚠️ Deux pays, une même devise, un même jour : sans le pays, les deux
    // lignes seraient indistinguables à l'écran.
    expect(displayEventTitle("French Industrial Production m/m", "fr")).toBe(
      "Production industrielle · France · mensuel",
    );
    expect(displayEventTitle("Construction Output m/m", "fr")).toBe("Production du bâtiment · mensuel");
    expect(displayEventTitle("Index of Services 3m/3m", "fr")).toBe("Indice des services · sur 3 mois");
  });

  /**
   * ⚠️ L'INSTITUT QUI PUBLIE RESTE DEVANT, ET IL CHASSE LA PARENTHÈSE DU
   * LIBELLÉ CURATÉ : le glossaire nomme l'enquête de confiance « Sentiment des
   * consommateurs (UMich) », l'université qui la publie aux États-Unis.
   * Recollé derrière « Westpac », qui publie la sienne en Australie, ça donnait
   * un nom FAUX.
   */
  it("garde le nom de l'institut sans lui coller celui d'un autre", () => {
    expect(displayEventTitle("Westpac Consumer Sentiment", "fr")).toBe(
      "Westpac · Sentiment des consommateurs",
    );
    expect(displayEventTitle("NAB Business Confidence", "fr")).toBe("NAB · Confiance des entreprises");
    // ⚠️ La normalisation coupe les traits d'union : le découpage se fait donc
    // sur le titre BRUT, sinon un mot du terme passe du côté de l'institut.
    expect(displayEventTitle("USD-Denominated Trade Balance", "fr")).toBe(
      "USD-Denominated · Balance commerciale",
    );
  });

  /**
   * ⚠️⚠️ ET UN MOT ANGLAIS AVEC UNE MAJUSCULE N'EST PAS UN NOM D'INSTITUT. Ma
   * première version gardait tout mot capitalisé et promouvait des
   * qualificatifs au rang d'éditeur : « Quarterly · Taux de chômage · Italie »,
   * « Consumer · Anticipations d'inflation ». Un institut est un SIGLE (ANZ,
   * NFIB, SECO), un mot composé (BusinessNZ), ou un nom propre qu'on connaît.
   */
  it("ne prend pas un qualificatif anglais pour un institut", () => {
    expect(displayEventTitle("Italian Quarterly Unemployment Rate", "fr")).toBe(
      "Taux de chômage · Italie",
    );
    expect(displayEventTitle("Consumer Inflation Expectations", "fr")).toBe(
      "Anticipations d'inflation",
    );
    expect(displayEventTitle("BusinessNZ Manufacturing Index", "fr")).toBe(
      "BusinessNZ · Indice manufacturier",
    );
    expect(displayEventTitle("Ivey PMI", "fr")).toBe("Ivey · Indice PMI");
  });

  /**
   * ⚠️ L'ANGLAIS GARDE LE TITRE DU FLUX : il est déjà en anglais, et le
   * recomposer ne gagnerait rien tout en l'éloignant des autres calendriers que
   * le trader recoupe.
   */
  it("ne recompose pas l'anglais", () => {
    expect(displayEventTitle("German Industrial Production m/m", "en")).toBe(
      "German Industrial Production m/m",
    );
    expect(displayEventTitle("Fed Chair Powell Speaks", "en")).toBe("Fed Chair Powell Speaks");
    // Les libellés curatés, eux, restent traduits en anglais aussi.
    expect(displayEventTitle("CPI m/m", "en")).toBe("CPI inflation · m/m");
  });

  /**
   * ⚠️ ET LA COMPOSITION NE DÉGRADE JAMAIS UN LIBELLÉ DÉJÀ CURATÉ : elle n'est
   * essayée que lorsque la table n'a rien dit.
   */
  it("laisse les libellés curatés intacts", () => {
    expect(displayEventTitle("Core CPI m/m", "fr")).toBe("Inflation CPI · sous-jacent · mensuel");
    expect(displayEventTitle("Non-Farm Employment Change", "fr")).toBe("Créations d'emplois NFP");
    expect(displayEventTitle("ISM Manufacturing PMI", "fr")).toContain("ISM manufacturier (US)");
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
