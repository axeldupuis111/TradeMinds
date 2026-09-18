import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { cleDeJourDuTrader, startOfDateKeyUtc } from "./timezone";

/**
 * UN JOUR EST CELUI DU TRADER, Y COMPRIS QUAND ON LE DÉCOUPE DANS UNE CHAÎNE.
 *
 * ── LE DÉFAUT ───────────────────────────────────────────────────────────────
 *
 * ⚠️⚠️ `iso.slice(0, 10)` EST LA MÊME ERREUR RECOPIÉE À QUATRE ENDROITS. Elle
 * prend les dix premiers caractères d'un instant UTC, donc le jour de
 * Greenwich, là où tout le reste du produit compte les jours du trader. Les
 * profils couvrent vingt-deux fuseaux, de Chicago à Sydney.
 *
 * Les quatre endroits, et ce que chacun coûtait :
 *
 *   1. `app/api/goals/route.ts` — « trades par jour », la mesure qui dit si
 *      l'objectif est TENU. À Sydney, une séance de 9 h à 17 h locale court de
 *      23 h à 7 h UTC : presque chaque journée se coupe en deux, le diviseur
 *      double, et la moyenne tombe de moitié. L'objectif se validait tout seul.
 *   2. `app/api/goals/recommend/route.ts` — le même calcul décide si le produit
 *      SIGNALE le surtrading (seuil : plus de 4 trades par jour). Avec une
 *      moyenne divisée par deux, il ne le signalait jamais à ceux-là.
 *   3. `app/api/goals/insights/route.ts` — la heatmap : la FENÊTRE était déjà
 *      comptée en jours du trader, une ligne au-dessus, pendant que chaque CASE
 *      était rangée au jour UTC. La règle appliquée à la bordure de la grille,
 *      pas à son contenu.
 *   4. `components/trades/TaxExportButton.tsx` — l'export comptable. Le pire :
 *      la lecture bornait l'année sur `"2026-01-01T00:00:00"`, une chaîne sans
 *      fuseau, donc minuit UTC. À Los Angeles, tout ce qui se clôturait le
 *      31 décembre après 16 h passait dans le fichier de l'année SUIVANTE, daté
 *      du 1er janvier. Un revenu déclaré sur le mauvais exercice.
 *
 * ── LA RÈGLE ────────────────────────────────────────────────────────────────
 *
 * Un seul découpage, `cleDeJourDuTrader`, et une seule façon de borner une
 * requête sur une date, `startOfDateKeyUtc` : les deux existaient déjà.
 */

const RACINE = process.cwd();
const LA = "America/Los_Angeles";
const SYDNEY = "Australia/Sydney";

describe("le jour d'un horodatage", () => {
  /** ⚠️⚠️ La séance du soir à Los Angeles : 18 h le 31, 01 h UTC le 1er. */
  it("reste la veille pour qui est à l'ouest de Greenwich", () => {
    expect(cleDeJourDuTrader("2026-01-01T01:00:00Z", LA)).toBe("2025-12-31");
    expect("2026-01-01T01:00:00Z".slice(0, 10), "le découpage naïf date du lendemain").toBe("2026-01-01");
  });

  /** ⚠️ Et la séance du matin à Sydney appartient encore à la veille en UTC. */
  it("est déjà le lendemain pour qui est à l'est", () => {
    expect(cleDeJourDuTrader("2026-08-31T23:00:00Z", SYDNEY)).toBe("2026-09-01");
  });

  it("rend le même jour qu'un découpage naïf quand le trader est en UTC", () => {
    expect(cleDeJourDuTrader("2026-09-18T10:00:00Z", "UTC")).toBe("2026-09-18");
  });

  /** ⚠️ Une valeur illisible ne fait pas disparaître la ligne. */
  it("retombe sur les dix premiers caractères quand la date est illisible", () => {
    expect(cleDeJourDuTrader("pas-une-date", LA)).toBe("pas-une-da");
    expect(cleDeJourDuTrader(null, LA)).toBe("");
  });

  /**
   * ⚠️⚠️ LE CAS DE L'EXPORT COMPTABLE, CHIFFRÉ : la borne d'année en UTC coupe
   * huit heures trop tôt à Los Angeles.
   */
  it("borne une année sur le minuit du trader", () => {
    const debut = startOfDateKeyUtc("2026-01-01", LA);
    expect(debut?.toISOString()).toBe("2026-01-01T08:00:00.000Z");
    const cloture = Date.parse("2026-01-01T01:00:00Z"); // 31 décembre, 17 h à LA
    expect(
      cloture < (debut as Date).getTime(),
      "une clôture du 31 décembre au soir tombe dans le fichier de l'année suivante",
    ).toBe(true);
  });
});

describe("les quatre surfaces qui découpaient le jour en UTC", () => {
  // ⚠️ Les commentaires DÉCRIVENT le défaut : les laisser ferait passer le
  // garde sur du code cassé. Ce dépôt a déjà payé ce piège trois fois.
  const nu = (f: string) =>
    readFileSync(join(RACINE, f), "utf8").replace(/\/\*[\s\S]*?\*\//g, "").replace(/\/\/[^\n]*/g, "");

  const jourDeTrading = [
    "app/api/goals/route.ts",
    "app/api/goals/recommend/route.ts",
    "app/api/goals/insights/route.ts",
  ];

  for (const f of jourDeTrading) {
    it(`compte les jours de trading dans le fuseau du trader (${f})`, () => {
      const src = nu(f);
      const i = src.indexOf("new Set(tr.map(");
      expect(i, "le comptage des jours de trading a changé de forme").toBeGreaterThan(0);
      const bloc = src.slice(i, src.indexOf(";", i));
      expect(bloc, "les jours de trading se recomptent au jour UTC").not.toContain("slice(0, 10)");
      expect(bloc).toContain("cleDeJourDuTrader(");
    });
  }

  it("range les cases de la heatmap dans le fuseau du trader", () => {
    const src = nu("app/api/goals/insights/route.ts");
    const i = src.indexOf("dayAgg");
    expect(i, "la heatmap a changé de forme").toBeGreaterThan(0);
    const boucle = src.slice(src.indexOf("for (const r of reviews)", i));
    expect(
      boucle.slice(0, boucle.indexOf("}")),
      "la fenêtre est comptée en jours du trader, les cases en jours UTC",
    ).toContain("cleDeJourDuTrader(");
  });

  /**
   * ⚠️ L'EXPORT COMPTABLE : une chaîne de date sans fuseau, comparée à une
   * colonne timestamptz, est une borne UTC. Elle en a l'air innocent.
   */
  it("borne l'export comptable sur l'année du trader", () => {
    const src = nu("components/trades/TaxExportButton.tsx");
    expect(src, "l'année est encore bornée sur une chaîne sans fuseau").not.toContain(
      "`${year}-01-01T00:00:00`",
    );
    expect(src).toContain("startOfDateKeyUtc(`${year}-01-01`");
    expect(src, "la colonne Date du fichier reste au jour UTC").toContain("cleDeJourDuTrader(");
  });
});
